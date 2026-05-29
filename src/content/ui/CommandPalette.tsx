import { useState, useEffect, useRef } from 'react';
import { Shortcut, InteractiveElement, ActionType } from '../../types';
import { formatKeyEvent, isBrowserReserved } from '../keyboard/manager';

interface PaletteItem {
  id: string;
  type: 'shortcut' | 'element' | 'action';
  name: string;
  key?: string;
  sub?: string;
  data?: Shortcut | InteractiveElement;
  action?: () => void;
}

interface CommandPaletteProps {
  isOpen: boolean;
  onClose: () => void;
  shortcuts: Shortcut[];
  scannedElements: InteractiveElement[];
  onTriggerShortcut: (s: Shortcut) => void;
  onSaveShortcut: (s: Shortcut) => void;
  onScanPage: () => void;
  onToggleVim: () => void;
  vimEnabled: boolean;
}

type PaletteView = 'list' | 'create';

export default function CommandPalette({
  isOpen,
  onClose,
  shortcuts,
  scannedElements,
  onTriggerShortcut,
  onSaveShortcut,
  onScanPage,
  onToggleVim,
  vimEnabled
}: CommandPaletteProps) {
  const [view, setView] = useState<PaletteView>('list');
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);

  // Shortcut builder states
  const [selectedElement, setSelectedElement] = useState<InteractiveElement | null>(null);
  const [shortcutName, setShortcutName] = useState('');
  const [recordedKey, setRecordedKey] = useState('');
  const [actionType, setActionType] = useState<ActionType>('focus');
  const [textValue, setTextValue] = useState('');
  const [scrollDir, setScrollDir] = useState<'down' | 'up' | 'top' | 'bottom'>('down');
  
  const [isRecording, setIsRecording] = useState(false);
  const [collisionWarning, setCollisionWarning] = useState('');

  const inputRef = useRef<HTMLInputElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  // Focus search input on open
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 50);
      setView('list');
      setQuery('');
      setSelectedIndex(0);
    }
  }, [isOpen]);

  // Handle keyboard navigation inside command list
  useEffect(() => {
    if (!isOpen || view !== 'list') return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSelectedIndex(prev => Math.min(prev + 1, filteredItems.length - 1));
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSelectedIndex(prev => Math.max(prev - 1, 0));
      } else if (e.key === 'Enter') {
        e.preventDefault();
        triggerItem(filteredItems[selectedIndex]);
      } else if (e.key === 'Escape') {
        onClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, view, query, selectedIndex]);

  // Adjust scroll position of active list item
  useEffect(() => {
    if (scrollContainerRef.current) {
      const activeEl = scrollContainerRef.current.querySelector('[data-active="true"]');
      if (activeEl) {
        activeEl.scrollIntoView({ block: 'nearest' });
      }
    }
  }, [selectedIndex]);

  // Intercept keys when recording shortcut key combination
  useEffect(() => {
    if (!isRecording) return;

    const handleRecord = (e: KeyboardEvent) => {
      e.preventDefault();
      e.stopPropagation();

      const combo = formatKeyEvent(e);
      if (combo) {
        setRecordedKey(combo);
        setIsRecording(false);

        // Check for collisions
        if (isBrowserReserved(combo)) {
          setCollisionWarning('Warning: This key combo is reserved by the browser');
        } else {
          const conflicting = shortcuts.find(s => s.key.toLowerCase() === combo.toLowerCase());
          if (conflicting) {
            setCollisionWarning(`Warning: Collides with "${conflicting.name}"`);
          } else {
            setCollisionWarning('');
          }
        }
      }
    };

    window.addEventListener('keydown', handleRecord, true);
    return () => window.removeEventListener('keydown', handleRecord, true);
  }, [isRecording, shortcuts]);

  if (!isOpen) return null;

  // Build command item list
  const systemActions = [
    { id: 'sys-scan', type: 'system', name: 'Scan DOM for Elements', action: () => { onScanPage(); } },
    { id: 'sys-vim', type: 'system', name: vimEnabled ? 'Disable Vim Navigation Mode' : 'Enable Vim Navigation Mode', action: () => { onToggleVim(); onClose(); } },
    { id: 'sys-new', type: 'system', name: 'Create Custom Shortcut...', action: () => { openBuilder(null); } },
  ];

  const items: PaletteItem[] = [
    ...shortcuts.map(s => ({ id: `sc-${s.id}`, type: 'shortcut' as const, name: s.name, key: s.key, data: s })),
    ...scannedElements.map(el => ({ id: `el-${el.id}`, type: 'element' as const, name: el.label, sub: `Scanned ${el.type}`, data: el })),
    ...systemActions.map(a => ({ id: a.id, type: 'action' as const, name: a.name, action: a.action }))
  ];

  const filteredItems = items.filter(item => 
    item.name.toLowerCase().includes(query.toLowerCase())
  );

  const openBuilder = (element: InteractiveElement | null) => {
    setSelectedElement(element);
    if (element) {
      setShortcutName(`Focus ${element.label}`);
      setActionType(element.suggestedAction);
      setRecordedKey('');
    } else {
      setShortcutName('');
      setActionType('click');
      setRecordedKey('');
    }
    setCollisionWarning('');
    setView('create');
  };

  const triggerItem = (item: PaletteItem) => {
    if (!item) return;

    if (item.type === 'shortcut' && item.data) {
      onTriggerShortcut(item.data as Shortcut);
      onClose();
    } else if (item.type === 'element' && item.data) {
      openBuilder(item.data as InteractiveElement);
    } else if (item.type === 'action' && item.action) {
      item.action();
    }
  };

  const saveShortcut = () => {
    if (!recordedKey) return;
    
    const domain = window.location.hostname.replace('www.', '');

    const newShortcut: Shortcut = {
      id: Math.random().toString(36).substring(2, 9),
      name: shortcutName || (selectedElement ? `Trigger ${selectedElement.label}` : 'Unnamed Shortcut'),
      key: recordedKey,
      domain,
      selector: selectedElement ? selectedElement.selector : '',
      fallbackSelectors: selectedElement ? selectedElement.fallbackSelectors : [],
      action: actionType,
      actionParams: {
        textValue: actionType === 'text' ? textValue : undefined,
        scrollDirection: actionType === 'scroll' ? scrollDir : undefined,
      },
      isActive: true,
      isCustom: true,
      createdAt: Date.now(),
      tagName: selectedElement ? selectedElement.tagName.toLowerCase() : undefined,
      ariaLabel: selectedElement ? selectedElement.ariaLabel : undefined,
      innerText: selectedElement ? selectedElement.innerText : undefined,
      placeholder: selectedElement ? selectedElement.placeholder : undefined,
    };

    onSaveShortcut(newShortcut);
    setView('list');
    setQuery('');
    setSelectedIndex(0);
    setTimeout(() => inputRef.current?.focus(), 50);
  };

  return (
    <div className="fixed inset-0 bg-[#040406]/60 backdrop-blur-[6px] flex items-start justify-center pt-[15vh] z-[999999] pointer-events-auto">
      <div 
        className="w-[550px] bg-background-card/95 border border-white/10 rounded-2xl shadow-premium overflow-hidden text-white flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {view === 'list' ? (
          /* List Mode */
          <>
            {/* Search Input Bar */}
            <div className="flex items-center border-b border-white/10 px-4 py-3.5 gap-3 bg-white/[0.02]">
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-5 h-5 text-zinc-400">
                <path strokeLinecap="round" strokeLinejoin="round" d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.637 10.637Z" />
              </svg>
              <input
                ref={inputRef}
                type="text"
                value={query}
                onChange={(e) => { setQuery(e.target.value); setSelectedIndex(0); }}
                placeholder="Search shortcuts, scanned page elements, commands..."
                className="bg-transparent border-0 outline-none text-sm text-white w-full placeholder-zinc-500"
              />
              <span className="px-1.5 py-0.5 text-[9px] font-semibold text-zinc-500 border border-zinc-700/60 rounded bg-zinc-800/30">ESC</span>
            </div>

            {/* List Body */}
            <div ref={scrollContainerRef} className="max-h-[300px] overflow-y-auto p-2 flex flex-col gap-0.5">
              {filteredItems.length > 0 ? (
                filteredItems.map((item, index) => {
                  const isActive = index === selectedIndex;
                  return (
                    <div
                      key={item.id}
                      data-active={isActive}
                      onClick={() => { setSelectedIndex(index); triggerItem(item); }}
                      className={`flex items-center justify-between px-3 py-2.5 rounded-xl cursor-pointer transition-all duration-100 ${
                        isActive ? 'bg-jadu-500/20 border border-jadu-500/40 text-white' : 'border border-transparent text-zinc-300 hover:bg-white/[0.03]'
                      }`}
                    >
                      <div className="flex flex-col">
                        <span className="text-xs font-medium">{item.name}</span>
                        {item.type === 'element' && (
                          <span className="text-[10px] text-zinc-500 font-mono mt-0.5">{item.sub}</span>
                        )}
                      </div>
                      
                      {/* Shortcut/Type Badge */}
                      {item.type === 'shortcut' && (
                        <span className="px-2 py-0.5 rounded text-[10px] font-mono font-semibold bg-jadu-500/10 border border-jadu-500/20 text-jadu-300">
                          {item.key}
                        </span>
                      )}

                      {item.type === 'element' && (
                        <span className="px-2 py-0.5 rounded text-[9px] font-semibold bg-white/5 border border-white/10 text-zinc-400">
                          Create Shortcut
                        </span>
                      )}

                      {item.type === 'action' && (
                        <span className="text-zinc-600 text-[10px] font-semibold">Command</span>
                      )}
                    </div>
                  );
                })
              ) : (
                <div className="py-8 text-center text-xs text-zinc-500 font-medium">
                  No matches found.
                </div>
              )}
            </div>

            {/* Footer Status Bar */}
            <div className="flex items-center justify-between border-t border-white/10 px-4 py-2 bg-white/[0.01] text-[10px] text-zinc-500 font-medium">
              <span>Domain: {window.location.hostname.replace('www.', '')}</span>
              <div className="flex items-center gap-3">
                <span>↑↓ Navigate</span>
                <span>↵ Trigger</span>
              </div>
            </div>
          </>
        ) : (
          /* Create Shortcut Mode */
          <div className="p-5 flex flex-col gap-4">
            <h3 className="text-sm font-semibold border-b border-white/10 pb-3 flex items-center justify-between">
              <span>Create Custom Shortcut</span>
              <button 
                onClick={() => setView('list')}
                className="text-xs text-zinc-400 hover:text-white flex items-center gap-1"
              >
                ← Back
              </button>
            </h3>

            {/* Target Element Detail */}
            {selectedElement && (
              <div className="bg-white/[0.03] border border-white/5 rounded-xl p-3 flex flex-col gap-1.5">
                <div className="flex justify-between items-center text-[10px] font-mono text-zinc-500">
                  <span>LIVE TARGET</span>
                  <span className="uppercase text-accent-violet">{selectedElement.type}</span>
                </div>
                <div className="text-xs font-semibold">{selectedElement.label}</div>
                <div className="text-[9px] font-mono text-zinc-400 truncate">{selectedElement.selector}</div>
              </div>
            )}

            {/* Form Fields */}
            <div className="flex flex-col gap-3">
              {/* Name */}
              <div className="flex flex-col gap-1.5">
                <label className="text-[10px] font-semibold text-zinc-400 uppercase tracking-wide">Shortcut Name</label>
                <input
                  type="text"
                  value={shortcutName}
                  onChange={(e) => setShortcutName(e.target.value)}
                  placeholder="e.g. Focus Search Bar"
                  className="bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-xs outline-none focus:border-jadu-500"
                />
              </div>

              {/* Action type */}
              <div className="flex flex-col gap-1.5">
                <label className="text-[10px] font-semibold text-zinc-400 uppercase tracking-wide">Action Type</label>
                <select
                  value={actionType}
                  onChange={(e) => setActionType(e.target.value as ActionType)}
                  className="bg-zinc-900 border border-white/10 rounded-xl px-3 py-2 text-xs outline-none focus:border-jadu-500"
                >
                  <option value="focus">Focus Element</option>
                  <option value="click">Trigger Click</option>
                  <option value="scroll">Scroll</option>
                  <option value="text">Insert Text</option>
                </select>
              </div>

              {/* Action parameter fields */}
              {actionType === 'text' && (
                <div className="flex flex-col gap-1.5">
                  <label className="text-[10px] font-semibold text-zinc-400 uppercase tracking-wide">Template Text</label>
                  <textarea
                    value={textValue}
                    onChange={(e) => setTextValue(e.target.value)}
                    placeholder="Enter template text to paste"
                    className="bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-xs outline-none focus:border-jadu-500 h-16 resize-none"
                  />
                </div>
              )}

              {actionType === 'scroll' && (
                <div className="flex flex-col gap-1.5">
                  <label className="text-[10px] font-semibold text-zinc-400 uppercase tracking-wide">Scroll Direction</label>
                  <select
                    value={scrollDir}
                    onChange={(e) => setScrollDir(e.target.value as any)}
                    className="bg-zinc-900 border border-white/10 rounded-xl px-3 py-2 text-xs outline-none focus:border-jadu-500"
                  >
                    <option value="down">Scroll Down (300px)</option>
                    <option value="up">Scroll Up (300px)</option>
                    <option value="top">Scroll to Top</option>
                    <option value="bottom">Scroll to Bottom</option>
                  </select>
                </div>
              )}

              {/* Keyboard Recorder */}
              <div className="flex flex-col gap-1.5 relative">
                <label className="text-[10px] font-semibold text-zinc-400 uppercase tracking-wide">Shortcut Key</label>
                <div className="flex gap-2">
                  <button
                    onClick={() => setIsRecording(true)}
                    className={`flex-1 text-xs border rounded-xl py-2 font-medium font-mono text-center transition-all ${
                      isRecording 
                        ? 'border-jadu-500 bg-jadu-500/10 text-jadu-300 animate-pulse' 
                        : 'border-white/10 bg-white/5 hover:border-white/20'
                    }`}
                  >
                    {isRecording ? 'Press keys now...' : recordedKey || 'Click to Record Shortcut'}
                  </button>
                  {recordedKey && (
                    <button 
                      onClick={() => setRecordedKey('')}
                      className="border border-white/10 hover:border-white/20 px-3 rounded-xl text-zinc-400 hover:text-white"
                    >
                      Clear
                    </button>
                  )}
                </div>
                {collisionWarning && (
                  <span className="text-[10px] text-amber-500 mt-1 font-medium">{collisionWarning}</span>
                )}
              </div>
            </div>

            {/* Action buttons */}
            <div className="flex gap-2 mt-2 border-t border-white/10 pt-4">
              <button
                onClick={() => setView('list')}
                className="flex-1 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl py-2.5 text-xs font-semibold"
              >
                Cancel
              </button>
              <button
                disabled={!recordedKey}
                onClick={saveShortcut}
                className="flex-1 bg-jadu-600 hover:bg-jadu-500 text-white rounded-xl py-2.5 text-xs font-semibold disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Create Shortcut
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
