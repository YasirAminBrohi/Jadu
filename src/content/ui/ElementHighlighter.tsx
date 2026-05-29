import React, { useState, useEffect } from 'react';
import { ElementType } from '../../types';

interface ElementHighlighterProps {
  element: HTMLElement | null;
  label: string;
  type: ElementType;
  score: number;
}

export default function ElementHighlighter({ element, label, type, score }: ElementHighlighterProps) {
  const [rect, setRect] = useState<DOMRect | null>(null);

  useEffect(() => {
    if (!element) {
      setRect(null);
      return;
    }

    const updateRect = () => {
      setRect(element.getBoundingClientRect());
    };

    updateRect();

    // Listen to events that might move the element
    window.addEventListener('scroll', updateRect, true);
    window.addEventListener('resize', updateRect, true);

    // Watch for size changes using ResizeObserver
    const observer = new ResizeObserver(updateRect);
    observer.observe(element);

    return () => {
      window.removeEventListener('scroll', updateRect, true);
      window.removeEventListener('resize', updateRect, true);
      observer.disconnect();
    };
  }, [element]);

  if (!rect) return null;

  // Add scroll offsets to position it absolutely relative to the page viewport
  const style: React.CSSProperties = {
    position: 'fixed',
    top: `${rect.top}px`,
    left: `${rect.left}px`,
    width: `${rect.width}px`,
    height: `${rect.height}px`,
    pointerEvents: 'none',
    zIndex: 999999,
    transition: 'all 0.12s cubic-bezier(0.16, 1, 0.3, 1)',
  };

  // Color mapping per element type
  const getTypeColor = (t: ElementType) => {
    switch (t) {
      case 'search': return 'border-accent-violet bg-accent-violet/5';
      case 'input': return 'border-blue-500 bg-blue-500/5';
      case 'editor': return 'border-amber-500 bg-amber-500/5';
      case 'button': return 'border-accent-emerald bg-accent-emerald/5';
      case 'nav': return 'border-sky-500 bg-sky-500/5';
      case 'scroll': return 'border-orange-500 bg-orange-500/5';
      default: return 'border-zinc-500 bg-zinc-500/5';
    }
  };

  return (
    <div style={style} className={`border-2 rounded-lg shadow-glow-purple ${getTypeColor(type)}`}>
      {/* Visual Bounding Box Corners */}
      <div className="absolute -top-1.5 -left-1.5 w-3 h-3 border-t-2 border-l-2 border-inherit rounded-tl-sm" />
      <div className="absolute -top-1.5 -right-1.5 w-3 h-3 border-t-2 border-r-2 border-inherit rounded-tr-sm" />
      <div className="absolute -bottom-1.5 -left-1.5 w-3 h-3 border-b-2 border-l-2 border-inherit rounded-bl-sm" />
      <div className="absolute -bottom-1.5 -right-1.5 w-3 h-3 border-b-2 border-r-2 border-inherit rounded-br-sm" />

      {/* Floating Info Tooltip */}
      <div 
        className="absolute bottom-full left-1/2 -translate-x-1/2 mb-3 bg-[#0c0c0e]/95 border border-white/10 text-white rounded-lg px-3 py-2 flex items-center gap-2.5 shadow-premium backdrop-blur-md whitespace-nowrap"
        style={{ pointerEvents: 'none' }}
      >
        <span className="flex items-center gap-1">
          <span className={`w-2 h-2 rounded-full ${
            type === 'search' || type === 'editor' ? 'bg-accent-violet' :
            type === 'button' ? 'bg-accent-emerald' : 'bg-blue-400'
          }`} />
          <span className="text-[10px] font-mono uppercase tracking-wider text-zinc-400">{type}</span>
        </span>
        
        <span className="text-xs font-semibold max-w-[150px] truncate">{label}</span>
        
        <span className="px-1.5 py-0.5 rounded bg-white/5 border border-white/10 text-[9px] font-mono text-zinc-400">
          Match: {score}%
        </span>
      </div>
    </div>
  );
}
