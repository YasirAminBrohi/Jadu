import { useState, useEffect, useRef } from 'react';
import { ElementType } from '../../types';
import ElementHighlighter from './ElementHighlighter';

interface PickOverlayProps {
  onCancel: () => void;
  onElementPicked: (el: HTMLElement) => void;
}

export default function PickOverlay({ onCancel, onElementPicked }: PickOverlayProps) {
  const [hoveredElement, setHoveredElement] = useState<HTMLElement | null>(null);

  // Use refs so the event handler closures always read the latest values
  // without needing to tear down and re-register listeners.
  const hoveredRef = useRef<HTMLElement | null>(null);
  const onCancelRef = useRef(onCancel);
  const onElementPickedRef = useRef(onElementPicked);

  // Keep refs in sync with props on every render
  useEffect(() => {
    onCancelRef.current = onCancel;
    onElementPickedRef.current = onElementPicked;
  });

  // Single mount/unmount effect — listeners registered ONCE
  useEffect(() => {
    console.log('[Jadu Debug] PickOverlay MOUNTED — attaching event listeners');

    // Inject temporary style tag to force crosshair cursor on the host page
    const styleEl = document.createElement('style');
    styleEl.id = 'jadu-pick-cursor-style';
    styleEl.textContent = '*, *::before, *::after { cursor: crosshair !important; }';
    (document.head || document.documentElement).appendChild(styleEl);

    const isOwnUI = (target: any): boolean => {
      if (!target || !(target instanceof Node)) return false;
      const root = document.getElementById('jadu-root');
      return !!(root && (root === target || root.contains(target)));
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
        e.stopImmediatePropagation();
        onCancelRef.current();
      }
    };

    const handleMouseMove = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (!target || !(target instanceof Element) || target === document.body || target === document.documentElement) return;
      if (isOwnUI(target)) {
        hoveredRef.current = null;
        setHoveredElement(null);
        return;
      }
      const interactive = getInteractiveAncestor(target) || target;
      hoveredRef.current = interactive;
      setHoveredElement(interactive);
    };

    const handleClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (!target) return;

      // Intercept and block events immediately to prevent click-through navigation on pages like LinkedIn notifications
      if (!isOwnUI(target)) {
        e.preventDefault();
        e.stopPropagation();
        e.stopImmediatePropagation();

        if (target instanceof Element) {
          const picked = getInteractiveAncestor(target) || target;
          if (picked) {
            console.log('[Jadu Debug] Element picked:', picked.tagName, picked);
            onElementPickedRef.current(picked);
          }
        }
      }
    };

    const blockInteraction = (e: Event) => {
      const target = e.target as HTMLElement;
      if (target && isOwnUI(target)) return;
      e.preventDefault();
      e.stopPropagation();
      e.stopImmediatePropagation();
    };

    // Capture-phase listeners intercept BEFORE the page's own handlers
    window.addEventListener('keydown', handleKeyDown, true);
    window.addEventListener('mousemove', handleMouseMove, true);
    window.addEventListener('click', handleClick, true);
    window.addEventListener('mousedown', blockInteraction, true);
    window.addEventListener('mouseup', blockInteraction, true);
    window.addEventListener('pointerdown', blockInteraction, true);
    window.addEventListener('pointerup', blockInteraction, true);
    window.addEventListener('contextmenu', blockInteraction, true);
    window.addEventListener('dblclick', blockInteraction, true);
    window.addEventListener('submit', blockInteraction, true);

    return () => {
      console.log('[Jadu Debug] PickOverlay UNMOUNTED — removing event listeners');
      styleEl.remove();
      window.removeEventListener('keydown', handleKeyDown, true);
      window.removeEventListener('mousemove', handleMouseMove, true);
      window.removeEventListener('click', handleClick, true);
      window.removeEventListener('mousedown', blockInteraction, true);
      window.removeEventListener('mouseup', blockInteraction, true);
      window.removeEventListener('pointerdown', blockInteraction, true);
      window.removeEventListener('pointerup', blockInteraction, true);
      window.removeEventListener('contextmenu', blockInteraction, true);
      window.removeEventListener('dblclick', blockInteraction, true);
      window.removeEventListener('submit', blockInteraction, true);
    };
  }, []); // ← Empty deps: registered once, refs keep values fresh

  return (
    <>
      {/* Semi-transparent backdrop */}
      <div className="fixed inset-0 bg-black/35 z-[2147483640] pointer-events-none transition-opacity duration-200" />

      {/* Floating instruction banner */}
      <div className="fixed top-6 left-1/2 -translate-x-1/2 z-[2147483645] pointer-events-auto animate-slide-up">
        <div className="flex items-center gap-4 bg-[#09090b]/90 border border-white/10 backdrop-blur-xl rounded-full px-5 py-3 shadow-premium">
          <div className="flex items-center gap-2">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-accent-emerald opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-accent-emerald"></span>
            </span>
            <span className="text-xs font-semibold text-zinc-200 tracking-wide font-sans">Jadu Picker Mode</span>
          </div>
          <div className="h-4 w-px bg-white/10" />
          <span className="text-[11px] text-zinc-400 font-medium font-sans">Hover & click any element to capture it</span>
          <button
            onClick={() => onCancelRef.current()}
            className="text-[10px] font-bold text-zinc-400 hover:text-white px-3 py-1.5 rounded-full bg-white/5 hover:bg-white/10 border border-white/5 hover:border-white/10 transition-all font-sans"
          >
            Cancel [Esc]
          </button>
        </div>
      </div>

      {/* Hover Highlighter */}
      {hoveredElement && (
        <ElementHighlighter
          element={hoveredElement}
          label={
            hoveredElement.innerText?.trim().substring(0, 25) ||
            hoveredElement.getAttribute('aria-label')?.substring(0, 25) ||
            hoveredElement.getAttribute('placeholder')?.substring(0, 25) ||
            hoveredElement.tagName.toLowerCase()
          }
          type={getElementType(hoveredElement)}
          score={100}
        />
      )}
    </>
  );
}

function getElementType(el: HTMLElement): ElementType {
  const tag = el.tagName.toLowerCase();
  if (tag === 'input') {
    if (el.getAttribute('type') === 'search' || el.id?.includes('search') || el.className?.includes('search')) {
      return 'search';
    }
    return 'input';
  }
  if (tag === 'textarea') return 'editor';
  if (tag === 'button' || tag === 'a' || el.getAttribute('role') === 'button') return 'button';
  if (tag === 'nav') return 'nav';
  return 'scroll';
}

function getInteractiveAncestor(el: HTMLElement | null): HTMLElement | null {
  let current: HTMLElement | null = el;
  while (current && current !== document.body && current !== document.documentElement) {
    if (!(current instanceof Element)) {
      break;
    }
    const tag = current.tagName?.toLowerCase();
    if (!tag) {
      current = current.parentElement;
      continue;
    }
    const role = current.getAttribute?.('role');
    const isCE = current.getAttribute?.('contenteditable') !== null;
    if (
      ['a', 'button', 'input', 'textarea', 'select'].includes(tag) ||
      role === 'button' ||
      role === 'link' ||
      role === 'tab' ||
      role === 'textbox' ||
      role === 'searchbox' ||
      role === 'checkbox' ||
      role === 'radio' ||
      isCE
    ) {
      return current;
    }
    current = current.parentElement;
  }
  return null;
}
