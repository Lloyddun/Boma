import React, { useEffect, useState } from 'react';
import { Download } from 'lucide-react';

export const PWAInstall = () => {
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [showInstall, setShowInstall] = useState(false);

  useEffect(() => {
    const handler = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e);
      setShowInstall(true);
    };

    window.addEventListener('beforeinstallprompt', handler);

    return () => {
      window.removeEventListener('beforeinstallprompt', handler);
    };
  }, []);

  const handleInstallClick = async () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === 'accepted') {
      setShowInstall(false);
    }
    setDeferredPrompt(null);
  };

  if (!showInstall) return null;

  return (
    <button
      onClick={handleInstallClick}
      className="fixed bottom-20 left-1/2 transform -translate-x-1/2 z-50 bg-white text-black px-4 py-2 rounded-full shadow-lg flex items-center gap-2 font-medium animate-bounce"
    >
      <Download size={18} />
      Installer l'App
    </button>
  );
};