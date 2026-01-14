import React, { useEffect } from 'react';
import { ToastMessage } from '../types';
import { X } from 'lucide-react';

interface ToastProps {
  toasts: ToastMessage[];
  removeToast: (id: string) => void;
}

export const ToastContainer: React.FC<ToastProps> = ({ toasts, removeToast }) => {
  return (
    <div className="fixed top-4 left-0 right-0 z-50 flex flex-col items-center gap-2 pointer-events-none">
      {toasts.map((toast) => (
        <ToastItem key={toast.id} toast={toast} removeToast={removeToast} />
      ))}
    </div>
  );
};

const ToastItem: React.FC<{ toast: ToastMessage; removeToast: (id: string) => void }> = ({ toast, removeToast }) => {
  useEffect(() => {
    const timer = setTimeout(() => {
      removeToast(toast.id);
    }, 3000);
    return () => clearTimeout(timer);
  }, [toast.id, removeToast]);

  return (
    <div className="bg-zinc-800 border border-boma-orange/50 text-white px-4 py-3 rounded-lg shadow-lg flex items-center gap-3 min-w-[300px] pointer-events-auto animate-in slide-in-from-top-5 fade-in duration-300">
      <div className="flex-1 text-sm font-medium">{toast.message}</div>
      <button onClick={() => removeToast(toast.id)} className="text-zinc-400 hover:text-white">
        <X size={16} />
      </button>
    </div>
  );
};