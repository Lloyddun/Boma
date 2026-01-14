import React, { useState } from 'react';
import { createUserWithEmailAndPassword, signInWithEmailAndPassword, updateProfile } from "firebase/auth";
import { doc, setDoc } from "firebase/firestore"; 
import { auth, db } from '../firebase';
import { AFRICAN_COUNTRIES, UserProfile } from '../types';
import { Globe } from 'lucide-react';

interface AuthProps {
  onAuthSuccess: (user: UserProfile) => void;
  addToast: (msg: string) => void;
}

export const Auth: React.FC<AuthProps> = ({ onAuthSuccess, addToast }) => {
  const [isLogin, setIsLogin] = useState(true);
  const [loading, setLoading] = useState(false);
  
  // Login State
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  // Register State
  const [name, setName] = useState('');
  const [country, setCountry] = useState(AFRICAN_COUNTRIES[0]);
  const [gender, setGender] = useState<'Homme' | 'Femme'>('Homme');

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const userCredential = await signInWithEmailAndPassword(auth, email, password);
      // Retrieve user data is handled in App.tsx via onAuthStateChanged usually, 
      // but for immediate feedback we can construct it partially or fetch it.
      // For simplicity, we assume generic login success and App handles the rest.
      addToast("Connexion réussie !");
    } catch (error: any) {
      console.error(error);
      addToast("Erreur: Email ou mot de passe incorrect.");
    } finally {
      setLoading(false);
    }
  };

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      const user = userCredential.user;
      
      await updateProfile(user, { displayName: name });
      
      const userProfile: UserProfile = {
        uid: user.uid,
        name,
        email,
        country,
        gender
      };

      // Store extra user info in Firestore
      await setDoc(doc(db, "users", user.uid), userProfile);
      
      addToast("Compte créé avec succès ! Bienvenue sur Boma.");
      // App's auth listener will pick this up
    } catch (error: any) {
      console.error(error);
      addToast("Erreur lors de l'inscription. Vérifiez les champs.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-boma-black p-4 relative overflow-hidden">
        {/* Background Decorative */}
        <div className="absolute top-[-20%] left-[-20%] w-[500px] h-[500px] bg-boma-orange/10 rounded-full blur-3xl"></div>
        <div className="absolute bottom-[-20%] right-[-20%] w-[500px] h-[500px] bg-blue-500/10 rounded-full blur-3xl"></div>

        <div className="z-10 bg-zinc-900/80 backdrop-blur-lg border border-zinc-800 p-8 rounded-2xl w-full max-w-md shadow-2xl">
            <div className="flex flex-col items-center mb-8">
                <Globe className="text-boma-orange w-16 h-16 mb-2" />
                <h1 className="text-3xl font-bold text-white tracking-wider">BOMA</h1>
                <p className="text-zinc-400">Le réseau du continent</p>
            </div>

            <div className="flex mb-6 border-b border-zinc-700">
                <button 
                  className={`flex-1 pb-2 font-medium transition-colors ${isLogin ? 'text-boma-orange border-b-2 border-boma-orange' : 'text-zinc-500'}`}
                  onClick={() => setIsLogin(true)}
                >
                    Connexion
                </button>
                <button 
                  className={`flex-1 pb-2 font-medium transition-colors ${!isLogin ? 'text-boma-orange border-b-2 border-boma-orange' : 'text-zinc-500'}`}
                  onClick={() => setIsLogin(false)}
                >
                    Inscription
                </button>
            </div>

            {isLogin ? (
                <form onSubmit={handleLogin} className="space-y-4">
                    <div>
                        <label className="block text-zinc-400 text-sm mb-1">Gmail</label>
                        <input type="email" required className="w-full bg-zinc-800 border border-zinc-700 rounded-lg p-3 text-white focus:border-boma-orange focus:outline-none" value={email} onChange={e => setEmail(e.target.value)} />
                    </div>
                    <div>
                        <label className="block text-zinc-400 text-sm mb-1">Mot de passe</label>
                        <input type="password" required className="w-full bg-zinc-800 border border-zinc-700 rounded-lg p-3 text-white focus:border-boma-orange focus:outline-none" value={password} onChange={e => setPassword(e.target.value)} />
                    </div>
                    <button type="submit" disabled={loading} className="w-full bg-boma-orange hover:bg-boma-orangeHover text-white font-bold py-3 rounded-lg transition-colors mt-4">
                        {loading ? 'Connexion...' : 'Se connecter'}
                    </button>
                </form>
            ) : (
                <form onSubmit={handleSignup} className="space-y-4">
                    <div>
                        <label className="block text-zinc-400 text-sm mb-1">Nom</label>
                        <input type="text" required className="w-full bg-zinc-800 border border-zinc-700 rounded-lg p-3 text-white focus:border-boma-orange focus:outline-none" value={name} onChange={e => setName(e.target.value)} />
                    </div>
                    <div>
                        <label className="block text-zinc-400 text-sm mb-1">Sexe</label>
                        <select className="w-full bg-zinc-800 border border-zinc-700 rounded-lg p-3 text-white focus:border-boma-orange focus:outline-none" value={gender} onChange={e => setGender(e.target.value as any)}>
                            <option value="Homme">Homme</option>
                            <option value="Femme">Femme</option>
                        </select>
                    </div>
                    <div>
                        <label className="block text-zinc-400 text-sm mb-1">Pays</label>
                        <select className="w-full bg-zinc-800 border border-zinc-700 rounded-lg p-3 text-white focus:border-boma-orange focus:outline-none" value={country} onChange={e => setCountry(e.target.value)}>
                            {AFRICAN_COUNTRIES.map(c => <option key={c} value={c}>{c}</option>)}
                        </select>
                    </div>
                    <div>
                        <label className="block text-zinc-400 text-sm mb-1">Gmail</label>
                        <input type="email" required className="w-full bg-zinc-800 border border-zinc-700 rounded-lg p-3 text-white focus:border-boma-orange focus:outline-none" value={email} onChange={e => setEmail(e.target.value)} />
                    </div>
                    <div>
                        <label className="block text-zinc-400 text-sm mb-1">Mot de passe</label>
                        <input type="password" required className="w-full bg-zinc-800 border border-zinc-700 rounded-lg p-3 text-white focus:border-boma-orange focus:outline-none" value={password} onChange={e => setPassword(e.target.value)} />
                    </div>
                    <button type="submit" disabled={loading} className="w-full bg-boma-orange hover:bg-boma-orangeHover text-white font-bold py-3 rounded-lg transition-colors mt-4">
                        {loading ? 'Inscription...' : "S'inscrire"}
                    </button>
                </form>
            )}
        </div>
    </div>
  );
};