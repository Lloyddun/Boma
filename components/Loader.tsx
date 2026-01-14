import React, { useState, useEffect } from 'react';
import { Globe, X } from 'lucide-react';

interface LoaderProps {
  text?: string;
  onCancel?: () => void;
}

const TIPS = [
  "Astuce : Soyez poli et respectueux envers vos interlocuteurs.",
  "Le saviez-vous ? L'Afrique compte plus de 2000 langues différentes.",
  "Boma signifie 'Maison' ou 'Village' dans plusieurs langues bantoues.",
  "Restez courtois, la communauté compte sur vous.",
  "Si la recherche est longue, c'est que nous cherchons la meilleure connexion...",
  "Protégez vos informations personnelles lors des échanges.",
  "Signalez tout comportement inapproprié via le support WhatsApp."
];

export const Loader: React.FC<LoaderProps> = ({ text, onCancel }) => {
  const [tipIndex, setTipIndex] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setTipIndex(prev => (prev + 1) % TIPS.length);
    }, 4000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="flex flex-col items-center justify-center h-full w-full bg-boma-black relative overflow-hidden z-50">
      {/* Radar Waves */}
      <div className="absolute w-64 h-64 border-2 border-boma-orange rounded-full animate-radar opacity-0 delay-0"></div>
      <div className="absolute w-64 h-64 border-2 border-boma-orange rounded-full animate-radar opacity-0 delay-700"></div>
      <div className="absolute w-64 h-64 border-2 border-boma-orange rounded-full animate-radar opacity-0 delay-1000"></div>
      
      {/* Central Logo */}
      <div className="z-10 bg-boma-black p-4 rounded-full border-2 border-boma-orange shadow-[0_0_30px_rgba(255,107,0,0.3)]">
        <Globe size={48} className="text-boma-orange animate-pulse" />
      </div>
      
      {text && (
        <p className="mt-8 text-boma-orange text-lg font-medium animate-pulse z-10 tracking-wider px-4 text-center">
          {text}
        </p>
      )}

      {onCancel && (
        <button 
          onClick={onCancel}
          className="mt-8 z-20 flex items-center gap-2 bg-red-500/10 hover:bg-red-500/20 text-red-500 px-6 py-2 rounded-full border border-red-500/50 transition-all duration-300 backdrop-blur-sm group cursor-pointer hover:shadow-[0_0_15px_rgba(220,38,38,0.4)]"
        >
          <X size={18} className="group-hover:rotate-90 transition-transform" />
          <span className="font-semibold">Annuler la recherche</span>
        </button>
      )}
      
      {/* Dynamic Tips */}
      <div className="absolute bottom-10 z-10 w-full px-8 text-center pointer-events-none">
        <p className="text-zinc-500 text-sm animate-in fade-in slide-in-from-bottom-2 duration-500" key={tipIndex}>
          {TIPS[tipIndex]}
        </p>
      </div>
    </div>
  );
};