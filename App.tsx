import React, { useEffect, useState } from 'react';
import { ToastContainer } from './components/Toast';
import { Auth } from './components/Auth';
import { VideoRoom } from './components/VideoRoom';
import { TextRoom } from './components/TextRoom';
import { PWAInstall } from './components/PWAInstall';
import { AppMode, ToastMessage, UserProfile } from './types';
import { onAuthStateChanged, signOut } from 'firebase/auth';
import { auth, db } from './firebase';
import { doc, getDoc } from 'firebase/firestore';
import { Globe, Video, MessageSquare, LogOut, Share2, HelpCircle } from 'lucide-react';

export default function App() {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [mode, setMode] = useState<AppMode>('auth');
  const [toasts, setToasts] = useState<ToastMessage[]>([]);
  
  // Used to force re-render of room components to trigger new match
  const [sessionKey, setSessionKey] = useState(0); 

  const addToast = (message: string) => {
    const id = Date.now().toString();
    setToasts(prev => [...prev, { id, message, type: 'info' }]);
  };

  const removeToast = (id: string) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  };

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (authUser) => {
      if (authUser) {
        // Fetch full profile
        const docRef = doc(db, 'users', authUser.uid);
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
          setUser(docSnap.data() as UserProfile);
          setMode(prev => prev === 'auth' ? 'home' : prev);
        } else {
            // Fallback if profile doesn't exist yet (rare race condition)
           setUser({
               uid: authUser.uid,
               name: authUser.displayName || 'Utilisateur',
               email: authUser.email || '',
               country: 'Afrique',
               gender: 'Homme'
           });
           setMode('home');
        }
      } else {
        setUser(null);
        setMode('auth');
      }
    });
    return () => unsubscribe();
  }, []);

  const handleLogout = async () => {
    await signOut(auth);
    setMode('auth');
    addToast("Déconnexion réussie");
  };

  const handleShare = async () => {
    const shareData = {
      title: 'Boma',
      text: `Salut ${user?.name || ''} t'invite à rejoindre la team Boma, la meilleure plateforme de chat africaine !`,
      url: window.location.href,
    };
    if (navigator.share) {
      try {
        await navigator.share(shareData);
        addToast("Partagé avec succès !");
      } catch (err) {
        console.log("Share cancelled");
      }
    } else {
      navigator.clipboard.writeText(shareData.text + " " + shareData.url);
      addToast("Lien copié dans le presse-papier");
    }
  };

  const handleSwap = () => {
      // Increment key to remount component
      setSessionKey(prev => prev + 1);
  };

  // --- Views ---

  if (mode === 'auth') {
    return (
      <>
        <ToastContainer toasts={toasts} removeToast={removeToast} />
        <Auth onAuthSuccess={(u) => setUser(u)} addToast={addToast} />
        <PWAInstall />
      </>
    );
  }

  if (mode === 'video' && user) {
    return (
        <>
            <ToastContainer toasts={toasts} removeToast={removeToast} />
            <VideoRoom 
                key={`video-${sessionKey}`}
                currentUser={user} 
                onExit={() => setMode('home')} 
                onSwap={handleSwap}
                addToast={addToast}
            />
        </>
    );
  }

  if (mode === 'text' && user) {
    return (
        <>
            <ToastContainer toasts={toasts} removeToast={removeToast} />
            <TextRoom 
                key={`text-${sessionKey}`}
                currentUser={user} 
                onExit={() => setMode('home')} 
                onSwap={handleSwap}
                addToast={addToast}
            />
        </>
    );
  }

  // Home Screen
  return (
    <div className="min-h-screen bg-boma-black text-white flex flex-col items-center p-4">
      <ToastContainer toasts={toasts} removeToast={removeToast} />
      <PWAInstall />
      
      {/* Top Bar */}
      <div className="w-full flex justify-between items-center mb-8 max-w-4xl">
         <div className="flex items-center gap-2">
            <Globe className="text-boma-orange w-8 h-8" />
            <span className="font-bold text-xl tracking-wide hidden md:block">BOMA</span>
         </div>
         <div className="flex gap-4">
            <button onClick={handleShare} className="flex items-center gap-2 bg-zinc-800 hover:bg-zinc-700 px-4 py-2 rounded-full transition-colors text-sm">
                <Share2 size={16} />
                <span className="hidden sm:inline">Inviter</span>
            </button>
            <button onClick={handleLogout} className="text-zinc-400 hover:text-white transition-colors">
                <LogOut size={24} />
            </button>
         </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col items-center justify-center w-full max-w-md gap-8">
          <div className="text-center space-y-2 animate-in fade-in slide-in-from-bottom-10 duration-700">
              <h1 className="text-4xl md:text-5xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-boma-orange to-yellow-500">
                  Salut, {user?.name}
              </h1>
              <p className="text-zinc-400 text-lg">Prêt à rencontrer l'Afrique ?</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 w-full mt-8">
              <button 
                onClick={() => setMode('video')}
                className="group relative overflow-hidden bg-zinc-900 border border-zinc-700 hover:border-boma-orange rounded-2xl p-6 flex flex-col items-center gap-4 transition-all duration-300 hover:shadow-2xl hover:shadow-boma-orange/20"
              >
                  <div className="absolute inset-0 bg-gradient-to-br from-boma-orange/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                  <div className="bg-zinc-800 p-4 rounded-full group-hover:scale-110 transition-transform">
                    <Video size={32} className="text-boma-orange" />
                  </div>
                  <span className="font-bold text-xl">Mode Vidéo</span>
                  <span className="text-xs text-zinc-500">Rencontre face à face</span>
              </button>

              <button 
                onClick={() => setMode('text')}
                className="group relative overflow-hidden bg-zinc-900 border border-zinc-700 hover:border-blue-500 rounded-2xl p-6 flex flex-col items-center gap-4 transition-all duration-300 hover:shadow-2xl hover:shadow-blue-500/20"
              >
                   <div className="absolute inset-0 bg-gradient-to-br from-blue-500/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                  <div className="bg-zinc-800 p-4 rounded-full group-hover:scale-110 transition-transform">
                    <MessageSquare size={32} className="text-blue-500" />
                  </div>
                  <span className="font-bold text-xl">Mode Tchat</span>
                  <span className="text-xs text-zinc-500">Discussion textuelle</span>
              </button>
          </div>
      </div>

      {/* Footer / Support */}
      <div className="mt-12 mb-4 w-full flex justify-center">
          <a 
            href="https://wa.me/24176225865" 
            target="_blank" 
            rel="noopener noreferrer"
            className="flex items-center gap-2 text-green-500 hover:text-green-400 bg-green-500/10 px-4 py-2 rounded-lg transition-colors border border-green-500/20"
          >
              <HelpCircle size={18} />
              <span>Support WhatsApp</span>
          </a>
      </div>
    </div>
  );
}