import { useState, useEffect } from 'react';
import { Shortcut, InteractiveElement, UserSettings } from '../../types';
import { jaduStorage } from '../../shared/storage';
import { scanDOM } from '../dom/scanner';
import CommandPalette from './CommandPalette';
import VimHints from './VimHints';
import Toast, { ToastMessage } from './Toast';
import PickOverlay from './PickOverlay';
import ShortcutBuilderModal from './ShortcutBuilderModal';
import { generateSelector, generateFallbackSelectors, generateXPath, stampJaduId } from '../dom/selector';

export default function OverlayManager() {
  const [settings, setSettings] = useState<UserSettings>({
    isEnabled: true,
    enableVimMode: false,
    enableSoundEffects: true,
    enableToastNotifications: true,
    theme: 'dark'
  });

  const [shortcuts, setShortcuts] = useState<Shortcut[]>([]);
  const [scannedElements, setScannedElements] = useState<InteractiveElement[]>([]);
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  // UI Modes
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [vimHintsActive, setVimHintsActive] = useState(false);
  const [isPickerActive, setIsPickerActive] = useState(false);
  const [builderModalOpen, setBuilderModalOpen] = useState(false);

  // Picker selected element data
  const [pickedElement, setPickedElement] = useState<HTMLElement | null>(null);
  const [pickedMetadata, setPickedMetadata] = useState<{
    selector: string;
    fallbackSelectors: string[];
    xpath: string;
  } | null>(null);

  // Sync window global flags with React state so capture-phase listener knows status
  useEffect(() => {
    (window as any).JADU_PALETTE_OPEN = paletteOpen;
  }, [paletteOpen]);

  useEffect(() => {
    (window as any).JADU_PICKER_ACTIVE = isPickerActive;
  }, [isPickerActive]);

  useEffect(() => {
    (window as any).JADU_HINTS_ACTIVE = vimHintsActive;
  }, [vimHintsActive]);

  useEffect(() => {
    (window as any).JADU_BUILDER_OPEN = builderModalOpen;
  }, [builderModalOpen]);

  // Load shortcuts and settings from database
  const loadData = async () => {
    const domain = window.location.hostname.replace('www.', '');
    const activeShortcuts = await jaduStorage.getActiveShortcutsForDomain(domain);
    const savedSettings = await jaduStorage.getSettings();
    setShortcuts(activeShortcuts);
    setSettings(savedSettings);
  };

  useEffect(() => {
    loadData();

    // Listen for storage updates
    const handleStorageChange = () => {
      loadData();
    };

    window.addEventListener('jadu-storage-updated', handleStorageChange);
    
    if (typeof chrome !== 'undefined' && chrome.storage) {
      chrome.storage.onChanged.addListener(handleStorageChange);
    }

    return () => {
      window.removeEventListener('jadu-storage-updated', handleStorageChange);
      if (typeof chrome !== 'undefined' && chrome.storage) {
        chrome.storage.onChanged.removeListener(handleStorageChange);
      }
    };
  }, []);

  // Listen to custom window events dispatched by the content script / capture-phase event loop
  useEffect(() => {
    const handleTogglePalette = () => {
      setPaletteOpen(prev => !prev);
      if (!paletteOpen) {
        runScanner();
      }
    };

    const handleStartPickMode = () => {
      setIsPickerActive(true);
      setPaletteOpen(false);
      setVimHintsActive(false);
      setBuilderModalOpen(false);
      setPickedElement(null);
    };

    const handleScanDom = () => {
      runScanner();
      setPaletteOpen(true);
    };

    const handleEscapePicker = () => {
      setIsPickerActive(false);
    };

    const handleEscapeBuilder = () => {
      setBuilderModalOpen(false);
      setPickedElement(null);
      setPickedMetadata(null);
    };

    const handleTriggerSuccess = (e: Event) => {
      const shortcut = (e as CustomEvent).detail as Shortcut;
      playBeep();
      triggerToast(
        shortcut.name,
        `Executed action "${shortcut.action}" on target`,
        shortcut.key.toUpperCase()
      );
    };

    const handleVimAction = (e: Event) => {
      const action = (e as CustomEvent).detail as string;
      handleVimModeAction(action);
    };

    const handleResetUI = () => {
      setPaletteOpen(false);
      setIsPickerActive(false);
      setVimHintsActive(false);
      setBuilderModalOpen(false);
      setPickedElement(null);
      setPickedMetadata(null);
    };

    window.addEventListener('jadu-toggle-palette', handleTogglePalette);
    window.addEventListener('jadu-start-pick-mode-event', handleStartPickMode);
    window.addEventListener('jadu-scan-dom-event', handleScanDom);
    window.addEventListener('jadu-escape-picker', handleEscapePicker);
    window.addEventListener('jadu-escape-builder', handleEscapeBuilder);
    window.addEventListener('jadu-trigger-success', handleTriggerSuccess);
    window.addEventListener('jadu-vim-action', handleVimAction);
    window.addEventListener('jadu-reset-ui', handleResetUI);

    return () => {
      window.removeEventListener('jadu-toggle-palette', handleTogglePalette);
      window.removeEventListener('jadu-start-pick-mode-event', handleStartPickMode);
      window.removeEventListener('jadu-scan-dom-event', handleScanDom);
      window.removeEventListener('jadu-escape-picker', handleEscapePicker);
      window.removeEventListener('jadu-escape-builder', handleEscapeBuilder);
      window.removeEventListener('jadu-trigger-success', handleTriggerSuccess);
      window.removeEventListener('jadu-vim-action', handleVimAction);
      window.removeEventListener('jadu-reset-ui', handleResetUI);
    };
  }, [paletteOpen]);

  // Audio beep cue using Web Audio API
  const playBeep = () => {
    if (!settings.enableSoundEffects) return;
    try {
      const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(580, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(1100, ctx.currentTime + 0.08);

      gain.gain.setValueAtTime(0.06, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.1);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start();
      osc.stop(ctx.currentTime + 0.1);
    } catch (e) {}
  };

  const triggerToast = (title: string, message: string, hotkey: string) => {
    if (!settings.enableToastNotifications) return;
    const newToast: ToastMessage = {
      id: Math.random().toString(36).substring(2, 9),
      title,
      message,
      hotkey
    };
    setToasts(prev => [...prev, newToast]);
  };

  const handleCloseToast = (id: string) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  };

  // Run DOM Scanner
  const runScanner = () => {
    const detected = scanDOM();
    setScannedElements(detected);
    triggerToast('Scanner Completed ⚡', `Discovered ${detected.length} page components`, 'SCAN');
  };

  // Vim keyboard navigation actions
  const handleVimModeAction = (action: string) => {
    switch (action) {
      case 'scroll_down':
        window.scrollBy({ top: 300, behavior: 'smooth' });
        break;
      case 'scroll_up':
        window.scrollBy({ top: -300, behavior: 'smooth' });
        break;
      case 'scroll_page_down':
        window.scrollBy({ top: window.innerHeight / 2, behavior: 'smooth' });
        break;
      case 'scroll_page_up':
        window.scrollBy({ top: -window.innerHeight / 2, behavior: 'smooth' });
        break;
      case 'scroll_top':
        window.scrollTo({ top: 0, behavior: 'smooth' });
        break;
      case 'scroll_bottom':
        window.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' });
        break;
      case 'toggle_hints':
        setVimHintsActive(true);
        break;
    }
  };

  // Element picked from PickOverlay
  const handleElementPicked = (el: HTMLElement) => {
    if ((window as any).JADU_DEBUG) {
      console.log('[Jadu Debug] Element picked in overlay:', el);
    }
    const sel = generateSelector(el);
    const fallbacks = generateFallbackSelectors(el);
    const xpath = generateXPath(el);
    stampJaduId(el); // Stamp session id

    setPickedElement(el);
    setPickedMetadata({ selector: sel, fallbackSelectors: fallbacks, xpath });
    setIsPickerActive(false);
    setBuilderModalOpen(true);
  };

  const handleSaveShortcut = async (newShortcut: Shortcut) => {
    await jaduStorage.saveShortcut(newShortcut);
    triggerToast('Shortcut Saved ⚡', `Created "${newShortcut.name}"`, newShortcut.key.toUpperCase());
    setBuilderModalOpen(false);
    setPickedElement(null);
    setPickedMetadata(null);
    loadData();

    // Notify other contexts that shortcuts changed
    window.dispatchEvent(new CustomEvent('jadu-storage-updated'));
  };

  const handleCancelBuilder = () => {
    setBuilderModalOpen(false);
    setPickedElement(null);
    setPickedMetadata(null);
  };

  return (
    <div className="theme-dark select-none pointer-events-none">
      {/* Spotlight Command Palette */}
      <CommandPalette
        isOpen={paletteOpen}
        onClose={() => setPaletteOpen(false)}
        shortcuts={shortcuts}
        scannedElements={scannedElements}
        onTriggerShortcut={async (shortcut) => {
          // Trigger success toast / play beep manually for palette executions
          playBeep();
          triggerToast(
            shortcut.name,
            `Executed action "${shortcut.action}" on target`,
            shortcut.key.toUpperCase()
          );
          // Let index.ts executor handle it
          const { executeShortcut } = await import('../keyboard/executor');
          executeShortcut(
            shortcut.selector,
            shortcut.fallbackSelectors,
            shortcut.action,
            shortcut.actionParams,
            {
              tagName: shortcut.tagName || 'button',
              label: shortcut.name,
              ariaLabel: shortcut.ariaLabel,
              innerText: shortcut.innerText,
              placeholder: shortcut.placeholder
            }
          );
        }}
        onSaveShortcut={async (newShortcut) => {
          await jaduStorage.saveShortcut(newShortcut);
          triggerToast('Shortcut Saved ⚡', `Created "${newShortcut.name}"`, newShortcut.key.toUpperCase());
          loadData();
          window.dispatchEvent(new CustomEvent('jadu-storage-updated'));
        }}
        onScanPage={runScanner}
        onToggleVim={async () => {
          const updated = { ...settings, enableVimMode: !settings.enableVimMode };
          await jaduStorage.saveSettings(updated);
          setSettings(updated);
          triggerToast('Vim Mode Updated', updated.enableVimMode ? 'Vim navigation active' : 'Vim navigation off', 'VIM');
        }}
        vimEnabled={settings.enableVimMode}
      />

      {/* Visual picker overlay */}
      {isPickerActive && (
        <PickOverlay
          onCancel={() => setIsPickerActive(false)}
          onElementPicked={handleElementPicked}
        />
      )}

      {/* Visual shortcut builder modal */}
      {builderModalOpen && pickedElement && pickedMetadata && (
        <ShortcutBuilderModal
          element={pickedElement}
          selector={pickedMetadata.selector}
          fallbackSelectors={pickedMetadata.fallbackSelectors}
          onCancel={handleCancelBuilder}
          onSave={handleSaveShortcut}
        />
      )}

      {/* Vim Key Hints */}
      <VimHints
        isActive={vimHintsActive}
        onClose={() => setVimHintsActive(false)}
        onTriggerToast={triggerToast}
      />

      {/* Toast Notification Stack */}
      <div className="fixed bottom-4 right-4 z-[2147483647] pointer-events-none flex flex-col gap-2">
        {toasts.map(toast => (
          <Toast
            key={toast.id}
            id={toast.id}
            title={toast.title}
            message={toast.message}
            hotkey={toast.hotkey}
            onClose={handleCloseToast}
          />
        ))}
      </div>
    </div>
  );
}
