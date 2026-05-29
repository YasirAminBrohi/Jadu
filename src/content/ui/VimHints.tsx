import { useState, useEffect } from 'react';
import { scanDOM } from '../dom/scanner';
import { executeSingleAction } from '../keyboard/executor';

interface HintTarget {
  key: string;
  element: HTMLElement;
  rect: DOMRect;
}

interface VimHintsProps {
  isActive: boolean;
  onClose: () => void;
  onTriggerToast: (title: string, message: string, key: string) => void;
}

const HINT_LETTERS = 'asdfghjklqwertyuiopzxcvbnm';

function getVimHintCodes(count: number): string[] {
  const codes: string[] = [];
  if (count <= HINT_LETTERS.length) {
    for (let i = 0; i < count; i++) {
      codes.push(HINT_LETTERS[i]);
    }
  } else {
    // Double letters: aa, as, ad...
    for (let i = 0; i < HINT_LETTERS.length && codes.length < count; i++) {
      for (let j = 0; j < HINT_LETTERS.length && codes.length < count; j++) {
        codes.push(HINT_LETTERS[i] + HINT_LETTERS[j]);
      }
    }
  }
  return codes;
}

export default function VimHints({ isActive, onClose, onTriggerToast }: VimHintsProps) {
  const [targets, setTargets] = useState<HintTarget[]>([]);
  const [typedBuffer, setTypedBuffer] = useState('');

  useEffect(() => {
    if (!isActive) {
      setTargets([]);
      setTypedBuffer('');
      return;
    }

    // 1. Scan page for active targets
    const scanned = scanDOM();
    const visibleTargets: HintTarget[] = [];

    // Map DOM elements
    const uniqueElements = new Set<HTMLElement>();
    scanned.forEach(item => {
      try {
        const el = document.querySelector(item.selector) as HTMLElement;
        if (el && !uniqueElements.has(el)) {
          const rect = el.getBoundingClientRect();
          // Verify it's within current viewport
          if (
            rect.top >= 0 &&
            rect.left >= 0 &&
            rect.top <= (window.innerHeight || document.documentElement.clientHeight) &&
            rect.left <= (window.innerWidth || document.documentElement.clientWidth)
          ) {
            visibleTargets.push({
              key: '', // set later
              element: el,
              rect
            });
            uniqueElements.add(el);
          }
        }
      } catch (e) {}
    });

    // 2. Assign short keys to targets
    const codes = getVimHintCodes(visibleTargets.length);
    visibleTargets.forEach((target, index) => {
      target.key = codes[index];
    });

    setTargets(visibleTargets);
    setTypedBuffer('');

    // 3. Register escape listener
    const handleGlobalKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
        onClose();
      }
    };

    window.addEventListener('keydown', handleGlobalKey, true);
    return () => window.removeEventListener('keydown', handleGlobalKey, true);
  }, [isActive, onClose]);

  // Handle typing inside Vim Hints Mode
  useEffect(() => {
    if (!isActive || targets.length === 0) return;

    const handleKeyPress = (e: KeyboardEvent) => {
      // Ignore modifier keys
      if (e.ctrlKey || e.altKey || e.metaKey) return;
      if (e.key === 'Escape') return;

      const char = e.key.toLowerCase();
      if (!HINT_LETTERS.includes(char)) return;

      e.preventDefault();
      e.stopPropagation();

      const newBuffer = typedBuffer + char;
      setTypedBuffer(newBuffer);

      // Check for matches
      const exactMatch = targets.find(t => t.key === newBuffer);
      if (exactMatch) {
        // Trigger Click/Focus
        const el = exactMatch.element;
        const tagName = el.tagName.toLowerCase();
        
        if (['input', 'textarea', 'select'].includes(tagName) || el.isContentEditable) {
          executeSingleAction(el, 'focus');
          onTriggerToast('Element Focused ⚡', `Focused standard ${tagName}`, exactMatch.key.toUpperCase());
        } else {
          executeSingleAction(el, 'click');
          onTriggerToast('Element Clicked ⚡', `Triggered mouse click`, exactMatch.key.toUpperCase());
        }
        
        onClose();
        return;
      }

      // Check if buffer matches any prefixes
      const hasPrefixMatch = targets.some(t => t.key.startsWith(newBuffer));
      if (!hasPrefixMatch) {
        // Reset buffer if mistyped
        setTypedBuffer('');
      }
    };

    window.addEventListener('keydown', handleKeyPress, true);
    return () => window.removeEventListener('keydown', handleKeyPress, true);
  }, [isActive, typedBuffer, targets, onClose, onTriggerToast]);

  if (!isActive || targets.length === 0) return null;

  // Filter targets that match current typed prefix
  const activeTargets = targets.filter(t => t.key.startsWith(typedBuffer));

  return (
    <div className="fixed inset-0 pointer-events-none z-[9999999]">
      {activeTargets.map((target, index) => {
        // Split hint key to highlight already typed letters
        const typedPart = target.key.substring(0, typedBuffer.length);
        const remainingPart = target.key.substring(typedBuffer.length);

        return (
          <div
            key={index}
            style={{
              position: 'absolute',
              top: `${target.rect.top}px`,
              left: `${target.rect.left}px`,
              pointerEvents: 'auto',
            }}
            className="flex items-center text-[10px] font-bold font-mono px-1 py-0.5 rounded shadow-md border bg-amber-200 border-amber-400 text-zinc-950 scale-100 transition-transform duration-100"
          >
            <span className="text-amber-600 opacity-60">{typedPart}</span>
            <span className="uppercase">{remainingPart}</span>
          </div>
        );
      })}
    </div>
  );
}
