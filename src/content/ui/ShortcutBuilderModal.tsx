import { useState, useEffect, useRef } from 'react';
import { ActionType, ActionParams, Shortcut } from '../../types';
import { isBrowserReserved } from '../keyboard/manager';
import { jaduStorage } from '../../shared/storage';

interface ShortcutBuilderModalProps {
  element: HTMLElement;
  selector: string;
  fallbackSelectors: string[];
  onCancel: () => void;
  onSave: (newShortcut: Shortcut) => void;
}

export default function ShortcutBuilderModal({
  element,
  selector,
  fallbackSelectors,
  onCancel,
  onSave
}: ShortcutBuilderModalProps) {
  const domain = window.location.hostname.replace('www.', '');

  // Auto-generate name based on element attributes
  const suggestName = (): string => {
    const tag = element.tagName.toLowerCase();
    const text = element.innerText?.trim().substring(0, 20);
    const ariaLabel = element.getAttribute('aria-label')?.trim();
    const placeholder = element.getAttribute('placeholder')?.trim();

    if (tag === 'input' || tag === 'textarea') {
      if (placeholder) return `Focus "${placeholder}"`;
      if (ariaLabel) return `Focus "${ariaLabel}"`;
      return 'Focus Input Field';
    }

    if (text) return `Click "${text}"`;
    if (ariaLabel) return `Click "${ariaLabel}"`;
    return `Click ${element.tagName.toLowerCase()} element`;
  };

  const suggestAction = (): ActionType => {
    const tag = element.tagName.toLowerCase();
    if (tag === 'input' || tag === 'textarea') {
      return 'focus';
    }
    return 'click';
  };

  const [shortcutName, setShortcutName] = useState(suggestName());
  const [actionType, setActionType] = useState<ActionType>(suggestAction());
  const [recordedKey, setRecordedKey] = useState('');
  const [recordedStrokes, setRecordedStrokes] = useState<string[]>([]);
  const [textValue, setTextValue] = useState('');
  const [scrollDir, setScrollDir] = useState<'down' | 'up' | 'top' | 'bottom'>('down');
  const [isRecording, setIsRecording] = useState(false);
  const [collisionWarning, setCollisionWarning] = useState('');
  const [existingShortcuts, setExistingShortcuts] = useState<Shortcut[]>([]);

  const nameInputRef = useRef<HTMLInputElement>(null);

  // Load existing shortcuts to check for collision
  useEffect(() => {
    const fetchShortcuts = async () => {
      const active = await jaduStorage.getActiveShortcutsForDomain(domain);
      setExistingShortcuts(active);
    };
    fetchShortcuts();
    nameInputRef.current?.focus();
  }, [domain]);

  // Listen to recorded keys from capture-phase
  useEffect(() => {
    if (!isRecording) return;

    // Set global flag so index.ts intercepts keydown and dispatches jadu-key-recorded
    (window as any).JADU_RECORDING_SHORTCUT = true;

    const handleKeyRecorded = (e: Event) => {
      const combo = (e as CustomEvent).detail as string;
      if (combo) {
        setRecordedStrokes((prev) => {
          if (prev.length >= 3) return prev;

          const next = [...prev, combo];
          const joined = next.join(' ');
          setRecordedKey(joined);

          // Check for collisions
          if (isBrowserReserved(joined)) {
            setCollisionWarning('Warning: This key combo is reserved by the browser');
          } else {
            const conflicting = existingShortcuts.find(
              s => s.key.toLowerCase() === joined.toLowerCase()
            );
            if (conflicting) {
              setCollisionWarning(`Warning: Collides with "${conflicting.name}"`);
            } else {
              setCollisionWarning('');
            }
          }

          // Auto-terminate if we reached 3 strokes OR if it's a modifier key combo
          const hasModifier = combo.includes('ctrl') || combo.includes('alt') || combo.includes('cmd') || combo.includes('meta');
          if (next.length >= 3 || hasModifier) {
            setIsRecording(false);
            (window as any).JADU_RECORDING_SHORTCUT = false;
          }

          return next;
        });
      }
    };

    const handleKeyRecordingCancelled = () => {
      setIsRecording(false);
      (window as any).JADU_RECORDING_SHORTCUT = false;
    };

    window.addEventListener('jadu-key-recorded', handleKeyRecorded);
    window.addEventListener('jadu-key-recording-cancelled', handleKeyRecordingCancelled);
    return () => {
      window.removeEventListener('jadu-key-recorded', handleKeyRecorded);
      window.removeEventListener('jadu-key-recording-cancelled', handleKeyRecordingCancelled);
      (window as any).JADU_RECORDING_SHORTCUT = false;
    };
  }, [isRecording, existingShortcuts]);

  const handleSave = () => {
    if (!recordedKey) return;

    const actionParams: ActionParams = {};
    if (actionType === 'text') {
      actionParams.textValue = textValue;
    } else if (actionType === 'scroll') {
      actionParams.scrollDirection = scrollDir;
      actionParams.scrollAmount = 300;
    }

    const newShortcut: Shortcut = {
      id: Math.random().toString(36).substring(2, 9),
      name: shortcutName.trim() || 'Unnamed Shortcut',
      key: recordedKey,
      domain,
      selector,
      fallbackSelectors,
      action: actionType,
      actionParams,
      isActive: true,
      isCustom: true,
      createdAt: Date.now(),
      tagName: element.tagName.toLowerCase(),
      ariaLabel: element.getAttribute('aria-label') || undefined,
      innerText: element.innerText?.trim() || undefined,
      placeholder: element.getAttribute('placeholder') || undefined,
    };

    onSave(newShortcut);
  };

  return (
    <div className="fixed bottom-6 right-6 z-[2147483647] pointer-events-auto animate-slide-up font-sans select-none">
      <div 
        className="w-[350px] bg-[#09090b]/95 border border-white/10 rounded-2xl shadow-premium overflow-hidden text-white flex flex-col glass-panel"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <header className="border-b border-white/10 px-4.5 py-3.5 flex items-center justify-between bg-white/[0.02]">
          <div className="flex items-center gap-2">
            <img 
              src={typeof chrome !== 'undefined' && chrome.runtime ? chrome.runtime.getURL('icons/logo256.png') : 'icons/logo256.png'} 
              alt="Jadu" 
              className="w-9 h-9" 
              style={{ filter: 'drop-shadow(0 0 8px rgba(217, 70, 239, 0.4)) drop-shadow(0 0 20px rgba(168, 85, 247, 0.2))' }}
            />
            <div>
              <h2 className="text-sm font-bold tracking-wide leading-none" style={{ background: 'linear-gradient(135deg, #a855f7 0%, #ec4899 35%, #f97316 65%, #eab308 100%)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>Shortcut Builder</h2>
              <p className="text-[9px] text-zinc-500 font-medium mt-1">Create a shortcut on <span className="font-semibold" style={{ color: '#d946ef' }}>{domain}</span></p>
            </div>
          </div>
          <button
            onClick={onCancel}
            className="text-zinc-500 hover:text-zinc-300 transition-colors p-1"
            title="Cancel"
          >
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" className="w-4 h-4">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
            </svg>
          </button>
        </header>

        <div className="p-4.5 flex flex-col gap-3.5">
          {/* Selected Element Section */}
          <div className="bg-white/[0.02] border border-white/5 rounded-xl p-3 flex flex-col gap-1 text-[11px]">
            <div className="text-[10px] font-semibold text-zinc-500 uppercase tracking-wider">Selected Element</div>
            <div className="flex items-center gap-2 mt-1">
              <span className="font-mono px-1.5 py-0.5 rounded bg-zinc-800 text-zinc-300 text-[9px] uppercase font-semibold">
                {element.tagName.toLowerCase()}
              </span>
              <span className="text-xs font-semibold text-zinc-200 truncate flex-1">
                {element.innerText?.trim().substring(0, 30) || element.getAttribute('placeholder') || element.getAttribute('aria-label') || 'unnamed element'}
              </span>
            </div>
            <div className="font-mono text-[9px] text-zinc-500 truncate mt-1">
              CSS: <span className="text-zinc-400">{selector}</span>
            </div>
          </div>

          {/* Form Fields */}
          <div className="flex flex-col gap-3">
            {/* Shortcut Name */}
            <div className="flex flex-col gap-1.5">
              <label className="text-[10px] font-semibold text-zinc-400 uppercase tracking-wide">Name</label>
              <input
                ref={nameInputRef}
                type="text"
                value={shortcutName}
                onChange={(e) => setShortcutName(e.target.value)}
                placeholder="e.g. Focus Search Box"
                className="glass-input rounded-xl px-3 py-2 text-xs outline-none focus:border-jadu-500 text-white"
              />
            </div>

            {/* Action Type */}
            <div className="flex flex-col gap-1.5">
              <label className="text-[10px] font-semibold text-zinc-400 uppercase tracking-wide">Action</label>
              <select
                value={actionType}
                onChange={(e) => setActionType(e.target.value as ActionType)}
                className="bg-[#121214] border border-white/10 rounded-xl px-3 py-2 text-xs outline-none focus:border-jadu-500 text-white cursor-pointer"
              >
                <option value="click">Click</option>
                <option value="focus">Focus</option>
                <option value="scroll">Scroll</option>
                <option value="text">Insert Text</option>
              </select>
            </div>

            {/* Conditional parameter inputs */}
            {actionType === 'text' && (
              <div className="flex flex-col gap-1.5 animate-fade-in">
                <label className="text-[10px] font-semibold text-zinc-400 uppercase tracking-wide">Text to Insert</label>
                <textarea
                  value={textValue}
                  onChange={(e) => setTextValue(e.target.value)}
                  placeholder="Paste text template here..."
                  className="glass-input rounded-xl px-3 py-2 text-xs outline-none focus:border-jadu-500 h-14 resize-none text-white"
                />
              </div>
            )}

            {actionType === 'scroll' && (
              <div className="flex flex-col gap-1.5 animate-fade-in">
                <label className="text-[10px] font-semibold text-zinc-400 uppercase tracking-wide">Scroll Direction</label>
                <select
                  value={scrollDir}
                  onChange={(e) => setScrollDir(e.target.value as any)}
                  className="bg-[#121214] border border-white/10 rounded-xl px-3 py-2 text-xs outline-none focus:border-jadu-500 text-white cursor-pointer"
                >
                  <option value="down">Scroll Down (300px)</option>
                  <option value="up">Scroll Up (300px)</option>
                  <option value="top">Scroll to Top</option>
                  <option value="bottom">Scroll to Bottom</option>
                </select>
              </div>
            )}

            {/* Key Combo Recorder */}
            <div className="flex flex-col gap-1.5 relative">
              <label className="text-[10px] font-semibold text-zinc-400 uppercase tracking-wide">Shortcut</label>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => {
                    if (isRecording) {
                      setIsRecording(false);
                      (window as any).JADU_RECORDING_SHORTCUT = false;
                    } else {
                      setRecordedKey('');
                      setRecordedStrokes([]);
                      setIsRecording(true);
                    }
                  }}
                  className={`flex-1 text-xs border rounded-xl py-2 font-medium font-mono text-center transition-all ${
                    isRecording 
                      ? 'border-jadu-500 bg-jadu-500/10 text-jadu-300 shadow-glow-purple' 
                      : 'border-white/10 bg-white/5 hover:border-white/20 text-zinc-300'
                  }`}
                >
                  {isRecording 
                    ? (recordedStrokes.length > 0 ? `${recordedStrokes.join(' ')} ...` : 'Press shortcut...') 
                    : (recordedKey || 'Press Keys')}
                </button>
                {(recordedKey || isRecording) && (
                  <button 
                    type="button"
                    onClick={() => {
                      setRecordedKey('');
                      setRecordedStrokes([]);
                      setIsRecording(false);
                      (window as any).JADU_RECORDING_SHORTCUT = false;
                    }}
                    className="border border-white/10 hover:border-white/20 px-3 rounded-xl text-zinc-400 hover:text-white transition-all text-xs font-semibold"
                  >
                    Clear
                  </button>
                )}
              </div>
              {collisionWarning && (
                <span className="text-[9px] text-amber-400 mt-1 font-medium">{collisionWarning}</span>
              )}
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex gap-2 mt-2 border-t border-white/10 pt-3">
            <button
              type="button"
              onClick={onCancel}
              className="flex-1 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl py-2 text-xs font-semibold transition-colors"
            >
              Cancel
            </button>
            <button
              type="button"
              disabled={!recordedKey}
              onClick={handleSave}
              className="flex-1 bg-jadu-600 hover:bg-jadu-500 text-white rounded-xl py-2 text-xs font-semibold disabled:opacity-40 disabled:cursor-not-allowed transition-all shadow-glow-purple"
            >
              Save Shortcut
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
