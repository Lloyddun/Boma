import React, { useEffect, useState, useRef } from 'react';
import { UserProfile } from '../types';
import { Send, RefreshCw, XCircle, MoreVertical } from 'lucide-react';
import { Loader } from './Loader';
import { db } from '../firebase';
import { collection, addDoc, query, where, getDocs, deleteDoc, serverTimestamp, onSnapshot, updateDoc, doc, limit } from 'firebase/firestore';

interface TextRoomProps {
  currentUser: UserProfile;
  onExit: () => void;
  onSwap: () => void;
  addToast: (msg: string) => void;
}

interface Message {
    id: string;
    text: string;
    senderId: string;
    createdAt: any;
}

export const TextRoom: React.FC<TextRoomProps> = ({ currentUser, onExit, onSwap, addToast }) => {
  const [partner, setPartner] = useState<UserProfile | null>(null);
  const [roomId, setRoomId] = useState<string | null>(null);
  const [isSearching, setIsSearching] = useState(true);
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputText, setInputText] = useState('');
  const [isPartnerTyping, setIsPartnerTyping] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const typingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  
  // Refs for cleanup
  const queueDocRef = useRef<string | null>(null);
  const roomRef = useRef<string | null>(null);

  useEffect(() => {
    startMatchmaking();
    return () => {
        // Cleanup queue if still searching
        if (queueDocRef.current) {
            deleteDoc(doc(db, 'chat_queue', queueDocRef.current)).catch(() => {});
        }
        // Cleanup room if connected
        if (roomRef.current) {
            leaveRoom(roomRef.current);
        }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const scrollToBottom = () => {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
      scrollToBottom();
  }, [messages, isPartnerTyping]);

  const startMatchmaking = async () => {
      setIsSearching(true);
      setMessages([]);
      setPartner(null);
      setRoomId(null);
      roomRef.current = null;
      queueDocRef.current = null;

      try {
        const queueRef = collection(db, 'chat_queue');
        const q = query(queueRef, where('uid', '!=', currentUser.uid), limit(1));
        const snapshot = await getDocs(q);

        if (!snapshot.empty) {
            // Found partner
            const matchDoc = snapshot.docs[0];
            const matchData = matchDoc.data() as UserProfile;
            
            await deleteDoc(matchDoc.ref);

            // Create room
            const newRoomRef = await addDoc(collection(db, 'chat_rooms'), {
                users: [currentUser.uid, matchData.uid],
                userProfiles: { [currentUser.uid]: currentUser, [matchData.uid]: matchData },
                createdAt: serverTimestamp(),
                status: 'active',
                typing: {}
            });

            setRoomId(newRoomRef.id);
            roomRef.current = newRoomRef.id;
            setPartner(matchData);
            setIsSearching(false);
            addToast(`Vous discutez avec ${matchData.name}`);
            subscribeToRoom(newRoomRef.id);

        } else {
            // Join queue
            const myEntry = await addDoc(queueRef, { ...currentUser, timestamp: serverTimestamp() });
            queueDocRef.current = myEntry.id;
            
            // Listen for room creation
            const roomsRef = collection(db, 'chat_rooms');
            const qRoom = query(roomsRef, where('users', 'array-contains', currentUser.uid), where('status', '==', 'active'));
            
            const unsubscribe = onSnapshot(qRoom, (snap) => {
                snap.docChanges().forEach((change) => {
                    if (change.type === 'added') {
                        const roomData = change.doc.data();
                        const partnerId = roomData.users.find((uid: string) => uid !== currentUser.uid);
                        const pProfile = roomData.userProfiles[partnerId];
                        
                        // We are matched, remove from queue ref so cleanup doesn't try to delete again
                        deleteDoc(myEntry);
                        queueDocRef.current = null;
                        
                        setRoomId(change.doc.id);
                        roomRef.current = change.doc.id;
                        setPartner(pProfile);
                        setIsSearching(false);
                        addToast(`Vous discutez avec ${pProfile.name}`);
                        subscribeToRoom(change.doc.id);
                        unsubscribe();
                    }
                });
            });
        }
      } catch (e) {
          console.error(e);
          addToast("Erreur réseau");
      }
  };

  const subscribeToRoom = (id: string) => {
      // Messages listener (removed orderBy to avoid index issues for now, sorted in UI via state if needed, but snapshot order usually good)
      // Ideally should have orderBy('createdAt', 'asc') but that requires index with array-contains.
      // We will re-sort on client side to be safe.
      const msgQuery = collection(db, 'chat_rooms', id, 'messages');
      onSnapshot(msgQuery, (snap) => {
          const msgs: Message[] = snap.docs
            .map(d => ({ id: d.id, ...d.data() } as Message))
            .sort((a, b) => (a.createdAt?.seconds - b.createdAt?.seconds));
          setMessages(msgs);
      });

      // Room status
      onSnapshot(doc(db, 'chat_rooms', id), (snap) => {
          if (!snap.exists()) return;
          const data = snap.data();
          if (data.status === 'ended') {
              addToast(`${partner?.name || 'Le partenaire'} a quitté.`);
              onExit();
          }
          
          const typingMap = data.typing || {};
          const partnerId = partner?.uid;
          if (partnerId && typingMap[partnerId]) {
              setIsPartnerTyping(true);
          } else {
              setIsPartnerTyping(false);
          }
      });
  };

  const leaveRoom = async (id: string) => {
      try {
          await updateDoc(doc(db, 'chat_rooms', id), { status: 'ended' });
      } catch (e) {}
  };

  const handleSendMessage = async () => {
      if (!inputText.trim() || !roomId) return;
      const text = inputText;
      setInputText('');
      
      await addDoc(collection(db, 'chat_rooms', roomId, 'messages'), {
          text: text,
          senderId: currentUser.uid,
          createdAt: serverTimestamp()
      });
      
      updateTyping(false);
  };

  const handleTyping = (e: React.ChangeEvent<HTMLInputElement>) => {
      setInputText(e.target.value);
      updateTyping(true);
      
      if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
      typingTimeoutRef.current = setTimeout(() => updateTyping(false), 2000);
  };

  const updateTyping = async (isTyping: boolean) => {
      if (!roomId) return;
      await updateDoc(doc(db, 'chat_rooms', roomId), {
          [`typing.${currentUser.uid}`]: isTyping
      });
  };

  const handleSwap = async () => {
     if (roomId) await leaveRoom(roomId);
     onSwap();
  };

  const handleCancel = () => {
      onExit(); // Triggers useEffect cleanup
  };

  if (isSearching) return <Loader text="Recherche d'un correspondant..." onCancel={handleCancel} />;

  return (
    <div className="flex flex-col h-full bg-zinc-900">
      {/* Header */}
      <div className="bg-boma-black border-b border-zinc-800 p-4 flex justify-between items-center shadow-md">
         <div className="flex items-center gap-3">
             <div className="w-10 h-10 rounded-full bg-boma-orange flex items-center justify-center text-white font-bold shadow-sm">
                 {partner?.name.charAt(0).toUpperCase()}
             </div>
             <div>
                 <h3 className="text-white font-bold text-sm md:text-base">{partner?.name}</h3>
                 <p className="text-zinc-400 text-xs flex items-center gap-1">
                     <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></span>
                     {partner?.country}
                 </p>
             </div>
         </div>
         
         <div className="flex items-center gap-2">
             <button onClick={handleSwap} className="p-2 text-boma-orange hover:bg-zinc-800 rounded-full transition-colors" title="Changer">
                 <RefreshCw size={20} />
             </button>
             <button onClick={onExit} className="p-2 text-red-500 hover:bg-zinc-800 rounded-full transition-colors" title="Quitter">
                 <XCircle size={20} />
             </button>
         </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4 no-scrollbar bg-zinc-900">
          <div className="flex justify-center my-4">
              <span className="bg-zinc-800 text-zinc-400 text-xs px-4 py-1.5 rounded-full border border-zinc-700 shadow-sm">
                  Conversation sécurisée avec {partner?.country}.
              </span>
          </div>

          {messages.map((msg) => {
              const isMe = msg.senderId === currentUser.uid;
              return (
                  <div key={msg.id} className={`flex ${isMe ? 'justify-end' : 'justify-start'}`}>
                      <div className={`max-w-[80%] px-4 py-2 rounded-2xl shadow-md ${
                          isMe 
                          ? 'bg-gradient-to-br from-boma-orange to-boma-orangeHover text-white rounded-tr-none' 
                          : 'bg-zinc-800 text-white rounded-tl-none border border-zinc-700'
                      }`}>
                          <p className="text-sm md:text-base whitespace-pre-wrap">{msg.text}</p>
                      </div>
                  </div>
              );
          })}
          
          {isPartnerTyping && (
             <div className="flex justify-start animate-pulse">
                <div className="bg-transparent text-white text-xs italic opacity-70 ml-2">
                    L'inconnu est en train d'écrire...
                </div>
             </div>
          )}
          <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="bg-boma-black p-3 md:p-4 border-t border-zinc-800">
          <div className="flex gap-2">
              <input 
                 type="text"
                 value={inputText}
                 onChange={handleTyping}
                 onKeyDown={(e) => e.key === 'Enter' && handleSendMessage()}
                 placeholder="Tapez un message..."
                 className="flex-1 bg-zinc-800 text-white border-none rounded-full px-4 py-3 focus:ring-2 focus:ring-boma-orange outline-none placeholder-zinc-500 transition-all"
              />
              <button 
                onClick={handleSendMessage}
                disabled={!inputText.trim()}
                className="bg-boma-orange text-white p-3 rounded-full hover:bg-boma-orangeHover disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-lg hover:shadow-boma-orange/20"
              >
                  <Send size={20} />
              </button>
          </div>
      </div>
    </div>
  );
};