import { useEffect } from 'react';

export interface ToastMessage {
  id: string;
  title: string;
  message: string;
  hotkey: string;
  duration?: number;
}

interface ToastProps extends ToastMessage {
  onClose: (id: string) => void;
}

export default function Toast({ id, title, message, hotkey, duration = 2500, onClose }: ToastProps) {
  useEffect(() => {
    const timer = setTimeout(() => {
      onClose(id);
    }, duration);
    return () => clearTimeout(timer);
  }, [id, duration, onClose]);

  return (
    <div className="flex items-center gap-3 bg-[#0a0a0c]/95 border border-white/10 text-white px-4 py-3 rounded-xl shadow-premium backdrop-blur-md animate-slide-up pointer-events-auto max-w-sm">
      {/* Glow effect */}
      <div className="absolute inset-0 bg-gradient-to-r from-jadu-500/10 to-transparent rounded-xl pointer-events-none" />
      
      {/* Icon Indicator */}
      <div className="relative flex items-center justify-center w-10 h-10 rounded-lg" style={{ background: 'rgba(217, 70, 239, 0.15)', border: '1px solid rgba(217, 70, 239, 0.3)' }}>
        <img 
          src={typeof chrome !== 'undefined' && chrome.runtime ? chrome.runtime.getURL('icons/logo256.png') : 'icons/logo256.png'} 
          alt="Jadu" 
          className="w-7 h-7" 
          style={{ filter: 'drop-shadow(0 0 4px rgba(217, 70, 239, 0.4))' }}
        />
      </div>

      <div className="flex-1 min-w-0">
        <h4 className="text-xs font-semibold text-white truncate">{title}</h4>
        <p className="text-[10px] text-zinc-400 truncate">{message}</p>
      </div>

      {/* Shortcut Badge */}
      <div className="px-1.5 py-0.5 rounded bg-white/5 border border-white/10 text-[10px] font-mono text-zinc-300">
        {hotkey}
      </div>

      {/* Close button */}
      <button 
        onClick={() => onClose(id)} 
        className="text-zinc-500 hover:text-white transition-colors duration-150 p-0.5 hover:bg-white/5 rounded-md"
      >
        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-3.5 h-3.5">
          <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
        </svg>
      </button>
    </div>
  );
}
