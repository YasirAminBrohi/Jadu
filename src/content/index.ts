import React from 'react';
import { createRoot } from 'react-dom/client';
import OverlayManager from './ui/OverlayManager';
import { Shortcut, UserSettings } from '../types';
import { jaduStorage } from '../shared/storage';
import { formatKeyEvent } from './keyboard/manager';
import { executeShortcut } from './keyboard/executor';
import '../index.css';

// Global state flags for overlay visibility
(window as any).JADU_PALETTE_OPEN = false;
(window as any).JADU_PICKER_ACTIVE = false;
(window as any).JADU_HINTS_ACTIVE = false;
(window as any).JADU_BUILDER_OPEN = false;
(window as any).JADU_RECORDING_SHORTCUT = false;
(window as any).JADU_DEBUG = true; // Always enable debugging console statements

let activeShortcuts: Shortcut[] = [];
let settings: UserSettings = {
  isEnabled: true,
  enableVimMode: true,
  enableSoundEffects: true,
  enableToastNotifications: true,
  theme: 'dark'
};

let keyBuffer: string[] = [];
let bufferTimeout: ReturnType<typeof setTimeout> | null = null;
const BUFFER_TIMEOUT_MS = 300; // Fast timeout for snappy multi-key sequences

// Synchronize storage cache
async function syncCache() {
  try {
    const domain = window.location.hostname.replace('www.', '');
    activeShortcuts = await jaduStorage.getActiveShortcutsForDomain(domain);
    const savedSettings = await jaduStorage.getSettings();
    if (savedSettings) {
      settings = savedSettings;
    }
    if ((window as any).JADU_DEBUG) {
      console.log(`[Jadu Debug] Shortcuts cache loaded. Active shortcuts for ${domain}:`, activeShortcuts);
    }
  } catch (e) {}
}

// Initial cache load
syncCache();

// Watch for database updates
if (typeof chrome !== 'undefined' && chrome.storage) {
  chrome.storage.onChanged.addListener(syncCache);
}
window.addEventListener('jadu-storage-updated', syncCache);

let lastPathname = window.location.pathname;

/**
 * Reset all transient Jadu state — called on SPA navigation to prevent stale
 * keyboard buffer or stuck flags (e.g. LinkedIn pushState-based navigation).
 */
function resetKeyboardState() {
  const currentPath = window.location.pathname;
  
  // Normalize pathnames by removing trailing slashes for stable SPA routing comparison
  const normCurrent = currentPath.endsWith('/') && currentPath.length > 1 ? currentPath.slice(0, -1) : currentPath;
  const normLast = lastPathname.endsWith('/') && lastPathname.length > 1 ? lastPathname.slice(0, -1) : lastPathname;

  if (normCurrent === normLast) {
    // Only URL query parameters or history states changed, keep active overlays intact
    syncCache();
    return;
  }
  
  const oldPath = lastPathname;
  lastPathname = currentPath;

  keyBuffer = [];
  if (bufferTimeout) { clearTimeout(bufferTimeout); bufferTimeout = null; }
  
  // Reset window flags to prevent key locks on page transitions
  (window as any).JADU_PALETTE_OPEN = false;
  (window as any).JADU_PICKER_ACTIVE = false;
  (window as any).JADU_HINTS_ACTIVE = false;
  (window as any).JADU_BUILDER_OPEN = false;

  // If recording got stuck, cancel it
  if ((window as any).JADU_RECORDING_SHORTCUT) {
    (window as any).JADU_RECORDING_SHORTCUT = false;
    window.dispatchEvent(new CustomEvent('jadu-key-recording-cancelled'));
  }

  // Dispatch reset event to OverlayManager to synchronize React UI states
  window.dispatchEvent(new CustomEvent('jadu-reset-ui'));

  if ((window as any).JADU_DEBUG) {
    console.log(`[Jadu Debug] SPA route transition detected (${oldPath} -> ${currentPath}) — resetting keyboard and UI states.`);
  }
  // Re-sync shortcuts for new page context
  syncCache();
  // Ensure DOM mount is still present on SPA transition
  initJaduExtension();
}

// Hook into SPA navigation (LinkedIn, Twitter, YouTube etc. use pushState/replaceState)
try {
  const _origPushState = history.pushState.bind(history);
  history.pushState = function (...args: Parameters<typeof history.pushState>) {
    _origPushState(...args);
    resetKeyboardState();
  };
  const _origReplaceState = history.replaceState.bind(history);
  history.replaceState = function (...args: Parameters<typeof history.replaceState>) {
    _origReplaceState(...args);
    resetKeyboardState();
  };
  window.addEventListener('popstate', resetKeyboardState);
} catch (e) {
  // Some pages restrict history API mutation — silently skip
}

/**
 * Capture-phase keyboard router
 */
function handleGlobalKeydown(e: KeyboardEvent) {
  if (!settings.isEnabled) return;

  // Intercept and block keys if recording a shortcut key combo
  if ((window as any).JADU_RECORDING_SHORTCUT) {
    e.preventDefault();
    e.stopPropagation();
    e.stopImmediatePropagation();
    if (e.key === 'Escape') {
      window.dispatchEvent(new CustomEvent('jadu-key-recording-cancelled'));
      return;
    }
    const key = e.key.toLowerCase();
    if (key === 'control' || key === 'alt' || key === 'shift' || key === 'meta') {
      return;
    }
    const combo = formatKeyEvent(e);
    if (combo) {
      window.dispatchEvent(new CustomEvent('jadu-key-recorded', { detail: combo }));
    }
    return;
  }

  const target = e.target as HTMLElement | null;
  if (!target) return;

  let activeEl: Element | null = document.activeElement;
  while (activeEl && activeEl.shadowRoot && activeEl.shadowRoot.activeElement) {
    activeEl = activeEl.shadowRoot.activeElement;
  }

  /**
   * Check if the element itself or any ancestor has contenteditable="true" or is a textbox
   */
  const isExplicitlyEditable = (el: Element | null): boolean => {
    if (!el) return false;
    try {
      const editableEl = el.closest?.('[contenteditable], [role="textbox"], [role="combobox"], [role="searchbox"]');
      if (editableEl) {
        const ce = editableEl.getAttribute('contenteditable');
        const role = editableEl.getAttribute('role');
        if (ce === 'true' || ce === '' || role === 'textbox' || role === 'combobox' || role === 'searchbox') {
          return true;
        }
      }
      return false;
    } catch (e) {
      return false;
    }
  };

  const isInputFocused =
    (activeEl && (
      activeEl.tagName === 'INPUT' ||
      activeEl.tagName === 'TEXTAREA' ||
      activeEl.tagName === 'SELECT' ||
      isExplicitlyEditable(activeEl)
    )) ||
    (target && (
      target.tagName === 'INPUT' ||
      target.tagName === 'TEXTAREA' ||
      target.tagName === 'SELECT' ||
      isExplicitlyEditable(target)
    ));

  const combo = formatKeyEvent(e);
  if (!combo) return;

  // 1. Check Command Palette Trigger (Cmd+K / Ctrl+K)
  const isCmdK = (e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k';
  if (isCmdK) {
    e.preventDefault();
    e.stopPropagation();
    e.stopImmediatePropagation();
    
    const nextState = !(window as any).JADU_PALETTE_OPEN;
    (window as any).JADU_PALETTE_OPEN = nextState;

    if ((window as any).JADU_DEBUG) {
      console.log('[Jadu Debug] Intercepted Cmd+K. Dispatching toggle palette.');
    }
    
    window.dispatchEvent(new CustomEvent('jadu-toggle-palette'));
    return;
  }

  // 2. Escape Picker Mode or Builder Modal
  if (((window as any).JADU_PICKER_ACTIVE || (window as any).JADU_BUILDER_OPEN) && e.key === 'Escape') {
    e.preventDefault();
    e.stopPropagation();
    e.stopImmediatePropagation();
    if ((window as any).JADU_PICKER_ACTIVE) {
      (window as any).JADU_PICKER_ACTIVE = false;
      window.dispatchEvent(new CustomEvent('jadu-escape-picker'));
    } else {
      (window as any).JADU_BUILDER_OPEN = false;
      window.dispatchEvent(new CustomEvent('jadu-escape-builder'));
    }
    return;
  }

  // If palette, picker, hints or builder is active, let them capture keys natively
  if (
    (window as any).JADU_PALETTE_OPEN || 
    (window as any).JADU_PICKER_ACTIVE || 
    (window as any).JADU_HINTS_ACTIVE ||
    (window as any).JADU_BUILDER_OPEN
  ) {
    return;
  }

  // Modifiers bypass input checks, regular shortcuts are ignored when input is focused
  // Only ctrl/alt/meta bypass the input-focus guard — shift types capital letters,
  // so shift combos are intentionally kept in the buffer path below.
  const hasModifiers = e.ctrlKey || e.altKey || e.metaKey;
  if (isInputFocused && !hasModifiers) return;

  // For modifier/shift combos, match immediately without buffering
  if (hasModifiers) {
    // Clear any pending multi-key buffer since modifier combos are standalone
    if (bufferTimeout) { clearTimeout(bufferTimeout); bufferTimeout = null; }
    keyBuffer = [];

    // Check Vim Mode modifier triggers first (e.g. alt+f for Vim Link Hints)
    if (settings.enableVimMode && !isInputFocused && combo === 'alt+f') {
      e.preventDefault();
      e.stopPropagation();
      e.stopImmediatePropagation();

      if ((window as any).JADU_DEBUG) {
        console.log(`[Jadu Debug] Intercepted Vim command: "toggle_hints"`);
      }
      
      window.dispatchEvent(new CustomEvent('jadu-vim-action', { detail: 'toggle_hints' }));
      return;
    }

    const matched = activeShortcuts.find(s => s.key.toLowerCase() === combo);
    if (matched) {
      e.preventDefault();
      e.stopPropagation();
      e.stopImmediatePropagation();

      if ((window as any).JADU_DEBUG) {
        console.log(`[Jadu Debug] Match Found (modifier): "${matched.name}" [${matched.key}]. Executing...`);
      }

      executeShortcut(
        matched.selector,
        matched.fallbackSelectors,
        matched.action,
        matched.actionParams,
        {
          tagName: matched.tagName || 'button',
          label: matched.name,
          ariaLabel: matched.ariaLabel,
          innerText: matched.innerText,
          placeholder: matched.placeholder
        }
      ).then(success => {
        if (success) {
          window.dispatchEvent(new CustomEvent('jadu-trigger-success', { detail: matched }));
          // Blur focused element so the page's own keyboard shortcuts keep working
          requestAnimationFrame(() => {
            const active = document.activeElement as HTMLElement | null;
            if (active && active !== document.body &&
                !['INPUT', 'TEXTAREA', 'SELECT'].includes(active.tagName) &&
                !isExplicitlyEditable(active)) {
              active.blur();
            }
          });
        }
      });
      return;
    }
    // No match for this modifier combo — let it pass through to the browser
    return;
  }

  // --- Non-modifier keys: buffer for multi-key sequences ---
  if (bufferTimeout) clearTimeout(bufferTimeout);
  keyBuffer.push(combo);
  bufferTimeout = setTimeout(() => { keyBuffer = []; bufferTimeout = null; }, BUFFER_TIMEOUT_MS);

  const bufferStr = keyBuffer.join(' ');

  // 3. Match buffer against domain shortcuts
  const matched = activeShortcuts.find(s => s.key.toLowerCase() === bufferStr);
  if (matched) {
    e.preventDefault();
    e.stopPropagation();
    e.stopImmediatePropagation();
    keyBuffer = [];
    if (bufferTimeout) { clearTimeout(bufferTimeout); bufferTimeout = null; }

    if ((window as any).JADU_DEBUG) {
      console.log(`[Jadu Debug] Match Found: "${matched.name}" [${matched.key}]. Executing...`);
    }

    executeShortcut(
      matched.selector,
      matched.fallbackSelectors,
      matched.action,
      matched.actionParams,
      {
        tagName: matched.tagName || 'button',
        label: matched.name,
        ariaLabel: matched.ariaLabel,
        innerText: matched.innerText,
        placeholder: matched.placeholder
      }
    ).then(success => {
      if (success) {
        window.dispatchEvent(new CustomEvent('jadu-trigger-success', { detail: matched }));
        // Blur focused element so the page's own keyboard shortcuts keep working
        requestAnimationFrame(() => {
          const active = document.activeElement as HTMLElement | null;
          if (active && active !== document.body &&
              !['INPUT', 'TEXTAREA', 'SELECT'].includes(active.tagName) &&
              !isExplicitlyEditable(active)) {
            active.blur();
          }
        });
      }
    });
    return;
  }

  // Match partial triggers (buffer is prefix of a registered shortcut or Vim sequence)
  const isVimPartial = settings.enableVimMode && ('g'.startsWith(bufferStr) && bufferStr !== 'g g');
  const isPartial = isVimPartial || activeShortcuts.some(s => s.key.toLowerCase().startsWith(bufferStr + ' '));
  if (isPartial) {
    e.preventDefault();
    e.stopPropagation();
    e.stopImmediatePropagation();
    return;
  }

  // 4. Match Vim Navigation triggers
  if (settings.enableVimMode && !isInputFocused) {
    let vimAction = '';
    switch (bufferStr) {
      case 'j': vimAction = 'scroll_down'; break;
      case 'k': vimAction = 'scroll_up'; break;
      case 'g g': vimAction = 'scroll_top'; break;
      case 'shift+g':
        if (e.key === 'G') vimAction = 'scroll_bottom';
        break;
      case 'd': vimAction = 'scroll_page_down'; break;
      case 'u': vimAction = 'scroll_page_up'; break;
    }

    if (vimAction) {
      e.preventDefault();
      e.stopPropagation();
      e.stopImmediatePropagation();
      keyBuffer = [];
      if (bufferTimeout) { clearTimeout(bufferTimeout); bufferTimeout = null; }

      if ((window as any).JADU_DEBUG) {
        console.log(`[Jadu Debug] Intercepted Vim command: "${vimAction}"`);
      }
      
      window.dispatchEvent(new CustomEvent('jadu-vim-action', { detail: vimAction }));
      return;
    }
  }

  // No match at all — reset buffer immediately to prevent stale keys corrupting next shortcut
  if (!isPartial) {
    keyBuffer = [];
    if (bufferTimeout) { clearTimeout(bufferTimeout); bufferTimeout = null; }
  }
}

// Attach high priority interceptor immediately on window load
window.addEventListener('keydown', handleGlobalKeydown, true);

// Listen for chrome messages and dispatch corresponding window events
if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.onMessage) {
  chrome.runtime.onMessage.addListener((message: any, _sender: any, sendResponse: any) => {
    if ((window as any).JADU_DEBUG) {
      console.log('[Jadu Debug] Content script received message:', message);
    }
    if (message.action === 'jadu-start-pick-mode') {
      window.dispatchEvent(new CustomEvent('jadu-start-pick-mode-event'));
      sendResponse({ success: true });
    } else if (message.action === 'jadu-toggle-palette') {
      window.dispatchEvent(new CustomEvent('jadu-toggle-palette'));
      sendResponse({ success: true });
    } else if (message.action === 'jadu-scan-dom') {
      window.dispatchEvent(new CustomEvent('jadu-scan-dom-event'));
      sendResponse({ success: true });
    }
    return true;
  });
}

let jaduContainer: HTMLDivElement | null = null;
let bodyObserver: MutationObserver | null = null;

/**
 * Bootstrap isolation React mount
 */
function initJaduExtension() {
  if ((window as any).JADU_DEBUG) {
    console.log('[Jadu Debug] initJaduExtension initialized. Document readyState:', document.readyState);
  }
  if (document.getElementById('jadu-root')) {
    return;
  }

  // If container was already created but got detached, just append it back
  if (jaduContainer) {
    if (document.body && !document.getElementById('jadu-root')) {
      try {
        document.body.appendChild(jaduContainer);
        if ((window as any).JADU_DEBUG) {
          console.log('[Jadu Debug] Re-attached existing #jadu-root to body.');
        }
      } catch (e) {}
    }
    return;
  }

  const container = document.createElement('div');
  container.id = 'jadu-root';
  container.style.position = 'absolute';
  container.style.top = '0';
  container.style.left = '0';
  container.style.width = '0';
  container.style.height = '0';
  container.style.zIndex = '2147483647';
  
  const shadowRoot = container.attachShadow({ mode: 'open' });
  
  // Ensure document.body exists before attaching
  const mount = () => {
    // Inject Google Fonts link for Outfit, Inter and JetBrains Mono
    const fontLink = document.createElement('link');
    fontLink.rel = 'stylesheet';
    fontLink.href = 'https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Outfit:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500;700&display=swap';
    (document.head || document.documentElement).appendChild(fontLink);

    document.body.appendChild(container);
    jaduContainer = container;

    // Start MutationObserver on body to prevent SPA routing from wiping out our mount
    if (!bodyObserver) {
      bodyObserver = new MutationObserver(() => {
        if (jaduContainer && !document.getElementById('jadu-root') && document.body) {
          try {
            document.body.appendChild(jaduContainer);
            if ((window as any).JADU_DEBUG) {
              console.log('[Jadu Debug] MutationObserver re-attached #jadu-root to body.');
            }
          } catch (e) {}
        }
      });
      bodyObserver.observe(document.body, { childList: true });
    }
    
    const rootElement = document.createElement('div');
    rootElement.id = 'jadu-shadow-root';
    shadowRoot.appendChild(rootElement);

    const styleLink = document.createElement('link');
    styleLink.rel = 'stylesheet';
    styleLink.href = typeof chrome !== 'undefined' && chrome.runtime?.getURL 
      ? chrome.runtime.getURL('style.css') 
      : '/dist/style.css';
    shadowRoot.appendChild(styleLink);

    const root = createRoot(rootElement);
    root.render(React.createElement(OverlayManager));
    
    if ((window as any).JADU_DEBUG) {
      console.log('[Jadu Debug] Shadow DOM mount completed.');
    }
  };

  if (document.body) {
    mount();
  } else {
    document.addEventListener('DOMContentLoaded', mount);
  }
}

initJaduExtension();
