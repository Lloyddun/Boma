import React, { useEffect, useRef, useState } from 'react';
import { UserProfile } from '../types';
import { Mic, MicOff, PhoneOff, RefreshCw, Video as VideoIcon } from 'lucide-react';
import { Loader } from './Loader';
import { db } from '../firebase';
import { collection, addDoc, onSnapshot, query, where, getDocs, deleteDoc, doc, updateDoc, serverTimestamp, setDoc, getDoc } from 'firebase/firestore';

interface VideoRoomProps {
  currentUser: UserProfile;
  onExit: () => void;
  onSwap: () => void; 
  addToast: (msg: string) => void;
}

// STUN servers are required for Real WebRTC to traverse NATs
const SERVERS = {
  iceServers: [
    {
      urls: ['stun:stun1.l.google.com:19302', 'stun:stun2.l.google.com:19302'],
    },
  ],
  iceCandidatePoolSize: 10,
};

export const VideoRoom: React.FC<VideoRoomProps> = ({ currentUser, onExit, onSwap, addToast }) => {
  const [partner, setPartner] = useState<UserProfile | null>(null);
  const [isSearching, setIsSearching] = useState(true);
  const [micOn, setMicOn] = useState(true);
  
  const localVideoRef = useRef<HTMLVideoElement>(null);
  const remoteVideoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  
  // Refs for cleanup and WebRTC
  const pcRef = useRef<RTCPeerConnection | null>(null);
  const roomRef = useRef<string | null>(null);
  const queueDocRef = useRef<string | null>(null);
  const unsubscribeRoomRef = useRef<(() => void) | null>(null);

  // Initialize Media
  useEffect(() => {
    const initMedia = async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ 
            video: {
                facingMode: 'user', // Selfie camera on mobile
                width: { ideal: 640 },
                height: { ideal: 480 }
            }, 
            audio: {
                echoCancellation: true,
                noiseSuppression: true
            } 
        });
        
        streamRef.current = stream;
        if (localVideoRef.current) {
          localVideoRef.current.srcObject = stream;
          localVideoRef.current.muted = true; // Mute local to avoid feedback
        }
        startMatchmaking();
      } catch (err) {
        console.error("Media Error:", err);
        addToast("Erreur: Accès caméra/micro refusé. Vérifiez vos permissions.");
        onExit();
      }
    };

    initMedia();

    return () => {
      // Cleanup media
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
      }
      // Cleanup PC
      if (pcRef.current) {
          pcRef.current.close();
      }
      if (unsubscribeRoomRef.current) {
          unsubscribeRoomRef.current();
      }
      // Cleanup Firestore
      cleanupFirestore();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const cleanupFirestore = async () => {
      if (queueDocRef.current) {
          try { await deleteDoc(doc(db, 'video_queue', queueDocRef.current)); } catch(e) {}
      }
      if (roomRef.current) {
          try { await updateDoc(doc(db, 'active_rooms', roomRef.current), { status: 'ended' }); } catch(e) {}
      }
  };

  const startMatchmaking = async () => {
    setIsSearching(true);
    setPartner(null);

    try {
      const queueRef = collection(db, 'video_queue');
      // Look for anyone who is NOT me
      const q = query(queueRef, where('uid', '!=', currentUser.uid)); 
      const querySnapshot = await getDocs(q);

      if (!querySnapshot.empty) {
        // --- WE ARE THE CALLER (Initiator) ---
        const matchDoc = querySnapshot.docs[0];
        const matchData = matchDoc.data() as UserProfile;
        
        // Optimistic lock: Try to delete. If fail, someone else took them.
        try {
            await deleteDoc(matchDoc.ref);
        } catch (e) {
            // If delete fails, retry matchmaking
            return startMatchmaking();
        }
        
        setPartner(matchData);
        addToast(`Connecté à ${matchData.name} (${matchData.country})`);
        
        // Create Room
        const roomDoc = await addDoc(collection(db, 'active_rooms'), {
            user1: currentUser, // We are user1 (Caller)
            user2: matchData,   // They are user2 (Callee)
            createdAt: serverTimestamp(),
            status: 'active'
        });
        
        roomRef.current = roomDoc.id;
        setIsSearching(false);
        
        // Notify the waiter (User 2) where to join by writing to a specific collection they listen to?
        // Simpler approach: Queue waiters listen to 'active_rooms' creation.
        
        // Start WebRTC as Caller
        await createRoom(roomDoc.id, true);

      } else {
        // --- WE ARE THE CALLEE (Waiter) ---
        const myQueueEntry = await addDoc(queueRef, {
            ...currentUser,
            timestamp: serverTimestamp()
        });
        queueDocRef.current = myQueueEntry.id;
        
        // Listen for a room where we are 'user2'
        const roomsRef = collection(db, 'active_rooms');
        const qRoom = query(roomsRef, where('user2.uid', '==', currentUser.uid), where('status', '==', 'active'));
        
        unsubscribeRoomRef.current = onSnapshot(qRoom, (snapshot) => {
             snapshot.docChanges().forEach((change) => {
                 if (change.type === 'added') {
                     const data = change.doc.data();
                     // Found our match
                     deleteDoc(myQueueEntry); // Remove self from queue
                     queueDocRef.current = null;
                     
                     setPartner(data.user1);
                     addToast(`Connecté à ${data.user1.name} (${data.user1.country})`);
                     
                     roomRef.current = change.doc.id;
                     setIsSearching(false);
                     
                     // Start WebRTC as Callee
                     joinRoom(change.doc.id);
                     
                     // Unsubscribe from searching
                     if (unsubscribeRoomRef.current) unsubscribeRoomRef.current();
                 }
             });
        });
      }
    } catch (e) {
      console.error(e);
      addToast("Erreur de connexion au serveur");
    }
  };

  const setupPC = () => {
      const pc = new RTCPeerConnection(SERVERS);
      pcRef.current = pc;

      // Add local tracks to PC
      if (streamRef.current) {
          streamRef.current.getTracks().forEach((track) => {
              pc.addTrack(track, streamRef.current!);
          });
      }

      // Handle remote tracks
      pc.ontrack = (event) => {
          if (remoteVideoRef.current && event.streams[0]) {
              remoteVideoRef.current.srcObject = event.streams[0];
          }
      };

      return pc;
  };

  // Caller Logic
  const createRoom = async (roomId: string, isCaller: boolean) => {
      const pc = setupPC();
      const roomDocRef = doc(db, 'active_rooms', roomId);
      const candidatesCollection = collection(roomDocRef, 'callerCandidates');

      pc.onicecandidate = (event) => {
          if (event.candidate) {
              addDoc(candidatesCollection, event.candidate.toJSON());
          }
      };

      // Create Offer
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);

      const roomWithOffer = {
          offer: {
              type: offer.type,
              sdp: offer.sdp,
          },
      };
      
      await updateDoc(roomDocRef, roomWithOffer);

      // Listen for Answer
      onSnapshot(roomDocRef, (snapshot) => {
          const data = snapshot.data();
          if (!pc.currentRemoteDescription && data?.answer) {
              const answer = new RTCSessionDescription(data.answer);
              pc.setRemoteDescription(answer);
          }
          if (data?.status === 'ended') {
              onExit();
          }
      });

      // Listen for remote ICE candidates
      onSnapshot(collection(roomDocRef, 'calleeCandidates'), (snapshot) => {
          snapshot.docChanges().forEach((change) => {
              if (change.type === 'added') {
                  const data = change.doc.data();
                  const candidate = new RTCIceCandidate(data);
                  pc.addIceCandidate(candidate);
              }
          });
      });
  };

  // Callee Logic
  const joinRoom = async (roomId: string) => {
      const pc = setupPC();
      const roomDocRef = doc(db, 'active_rooms', roomId);
      const candidatesCollection = collection(roomDocRef, 'calleeCandidates');
      
      pc.onicecandidate = (event) => {
          if (event.candidate) {
              addDoc(candidatesCollection, event.candidate.toJSON());
          }
      };

      // Listen for Offer
      const roomSnapshot = await getDoc(roomDocRef);
      const roomData = roomSnapshot.data();

      if (roomData?.offer) {
          await pc.setRemoteDescription(new RTCSessionDescription(roomData.offer));
          const answer = await pc.createAnswer();
          await pc.setLocalDescription(answer);

          const roomWithAnswer = {
              answer: {
                  type: answer.type,
                  sdp: answer.sdp,
              },
          };
          await updateDoc(roomDocRef, roomWithAnswer);
      }

      // Listen for remote ICE candidates
      onSnapshot(collection(roomDocRef, 'callerCandidates'), (snapshot) => {
          snapshot.docChanges().forEach((change) => {
              if (change.type === 'added') {
                  const data = change.doc.data();
                  const candidate = new RTCIceCandidate(data);
                  pc.addIceCandidate(candidate);
              }
          });
      });
      
      // Listen for room end
      onSnapshot(roomDocRef, (snap) => {
          if (snap.data()?.status === 'ended') onExit();
      });
  };

  const toggleMic = () => {
    if (streamRef.current) {
      streamRef.current.getAudioTracks().forEach(track => {
          track.enabled = !micOn;
      });
      setMicOn(!micOn);
    }
  };

  const handleSwap = async () => {
      addToast("Recherche d'un nouveau partenaire...");
      cleanupFirestore(); // End current call
      onSwap(); // Triggers parent re-render
  };
  
  const handleCancel = () => {
      onExit();
  };

  if (isSearching) {
    return <Loader text="Recherche d'un partenaire..." onCancel={handleCancel} />;
  }

  return (
    <div className="relative w-full h-full bg-black overflow-hidden flex flex-col">
      {/* Remote Video */}
      <div className="flex-1 relative">
         <video 
           ref={remoteVideoRef} 
           autoPlay 
           playsInline 
           className="w-full h-full object-cover"
         />
         
         <div className="absolute top-4 left-4 bg-black/60 backdrop-blur-md px-4 py-2 rounded-full border border-boma-orange/30 z-10">
            <h2 className="text-white font-bold text-lg drop-shadow-md">
                {partner?.name || 'Utilisateur'}
            </h2>
            <p className="text-boma-orange text-sm font-medium">
                {partner?.country || 'Afrique'}
            </p>
         </div>

         <div className="absolute bottom-24 right-4 w-32 h-48 md:w-48 md:h-64 bg-zinc-900 rounded-xl overflow-hidden border-2 border-white/20 shadow-2xl z-20">
             <video 
                ref={localVideoRef} 
                autoPlay 
                playsInline 
                muted 
                className="w-full h-full object-cover transform scale-x-[-1]" // Mirror local video
             />
         </div>
      </div>

      {/* Controls */}
      <div className="absolute bottom-0 w-full h-20 bg-gradient-to-t from-black to-transparent flex items-center justify-center gap-8 pb-4 z-30">
         <button 
           onClick={toggleMic}
           className={`p-4 rounded-full transition-all duration-200 shadow-lg ${micOn ? 'bg-zinc-800 text-white hover:bg-zinc-700' : 'bg-red-500 text-white'}`}
         >
            {micOn ? <Mic size={24} /> : <MicOff size={24} />}
         </button>

         <button 
           onClick={handleSwap}
           className="p-4 rounded-full bg-boma-orange text-white hover:bg-boma-orangeHover transition-all duration-200 shadow-lg scale-110"
         >
            <RefreshCw size={28} />
         </button>

         <button 
            onClick={onExit}
            className="p-4 rounded-full bg-red-600 text-white hover:bg-red-700 transition-all duration-200 shadow-lg"
         >
            <PhoneOff size={24} />
         </button>
      </div>
    </div>
  );
};