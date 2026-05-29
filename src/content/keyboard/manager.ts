import { Shortcut } from '../../types';

// Browser-reserved shortcuts to display warning logs/UI notifications
const RESERVED_HOTKEYS = new Set([
  'ctrl+t', 'ctrl+w', 'ctrl+n', 'ctrl+shift+t', 'ctrl+shift+w', 'ctrl+tab', 'ctrl+shift+tab',
  'cmd+t', 'cmd+w', 'cmd+n', 'cmd+shift+t', 'cmd+shift+w', 'cmd+tab', 'cmd+shift+tab',
  'ctrl+l', 'cmd+l', 'ctrl+d', 'cmd+d', 'ctrl+r', 'cmd+r', 'f5'
]);

let isRecording = false;
let recordCallback: ((combo: string) => void) | null = null;

let keyBuffer: string[] = [];
let bufferTimeout: ReturnType<typeof setTimeout> | null = null;

/**
 * Format a keyboard event into a standardized string combo, e.g. "ctrl+shift+k"
 */
export function formatKeyEvent(e: KeyboardEvent): string {
  const key = e.key.toLowerCase();
  if (key === 'control' || key === 'alt' || key === 'shift' || key === 'meta') {
    return '';
  }

  const parts: string[] = [];
  if (e.ctrlKey) parts.push('ctrl');
  if (e.altKey) parts.push('alt');
  if (e.shiftKey) parts.push('shift');
  if (e.metaKey) parts.push('cmd');

  if (key === ' ') {
    parts.push('space');
  } else {
    parts.push(key);
  }

  return parts.join('+');
}

/**
 * Checks if the hotkey combination is reserved by Chrome/Brave
 */
export function isBrowserReserved(combo: string): boolean {
  return RESERVED_HOTKEYS.has(combo.toLowerCase());
}

/**
 * Enter recording mode to listen to the next key combination
 */
export function startRecordingShortcut(callback: (combo: string) => void): void {
  isRecording = true;
  recordCallback = callback;
}

export function stopRecordingShortcut(): void {
  isRecording = false;
  recordCallback = null;
}

/**
 * Main listener mapping keystrokes to registered shortcuts or Vim commands
 */
export function handlePageKeyDown(
  e: KeyboardEvent,
  shortcuts: Shortcut[],
  onTrigger: (shortcut: Shortcut) => void,
  vimModeEnabled: boolean,
  onVimAction: (action: string) => void
): void {
  // If user is recording a shortcut, intercept it
  if (isRecording && recordCallback) {
    e.preventDefault();
    e.stopPropagation();
    const combo = formatKeyEvent(e);
    if (combo) {
      recordCallback(combo);
      stopRecordingShortcut();
    }
    return;
  }

  // Detect whether typing inside an editable field
  const target = e.target as HTMLElement;
  const isInputFocused =
    target.tagName === 'INPUT' ||
    target.tagName === 'TEXTAREA' ||
    target.tagName === 'SELECT' ||
    target.isContentEditable ||
    target.closest('[contenteditable="true"]') !== null;

  const combo = formatKeyEvent(e);
  if (!combo) return;

  // Modifiers (like ctrl/cmd/alt) should always bypass input focus checks
  const hasModifiers = e.ctrlKey || e.altKey || e.metaKey;

  if (isInputFocused && !hasModifiers) {
    // User is just typing in a text field, do not trigger shortcuts
    return;
  }

  // Clear buffer timeout on new input
  if (bufferTimeout) {
    clearTimeout(bufferTimeout);
  }

  // Append key to buffer
  keyBuffer.push(combo);

  // Set timeout to clear buffer after 300ms for snappy response
  bufferTimeout = setTimeout(() => {
    keyBuffer = [];
    bufferTimeout = null;
  }, 300);

  const fullBufferString = keyBuffer.join(' ');

  // 1. Match buffer against active shortcuts
  const matchedShortcut = shortcuts.find(s => s.key.toLowerCase() === fullBufferString);

  if (matchedShortcut) {
    e.preventDefault();
    e.stopPropagation();
    keyBuffer = [];
    if (bufferTimeout) { clearTimeout(bufferTimeout); bufferTimeout = null; }
    onTrigger(matchedShortcut);
    return;
  }

  // Check if buffer is a partial match for any shortcut
  const isPartialMatch = shortcuts.some(s => s.key.toLowerCase().startsWith(fullBufferString + ' '));
  if (isPartialMatch) {
    // Keep the buffer, wait for the next key
    e.preventDefault();
    e.stopPropagation();
    return;
  }

  // 2. Handle Vim Mode navigation (only when NOT focused in an input)
  if (vimModeEnabled && !isInputFocused) {
    const vimTriggered = handleVimNavigation(fullBufferString, e, onVimAction);
    if (vimTriggered) {
      keyBuffer = [];
      if (bufferTimeout) { clearTimeout(bufferTimeout); bufferTimeout = null; }
      return;
    }
  }

  // No match — reset buffer immediately to prevent stale keys
  keyBuffer = [];
  if (bufferTimeout) { clearTimeout(bufferTimeout); bufferTimeout = null; }
}

/**
 * Handle Vim commands for navigation and hint modes
 */
function handleVimNavigation(
  buffer: string,
  e: KeyboardEvent,
  onVimAction: (action: string) => void
): boolean {
  switch (buffer) {
    case 'j':
      e.preventDefault();
      onVimAction('scroll_down');
      return true;
    case 'k':
      e.preventDefault();
      onVimAction('scroll_up');
      return true;
    case 'g g':
      e.preventDefault();
      onVimAction('scroll_top');
      return true;
    case 'shift+g':
    case 'g': // if G is pressed (Shift+g)
      if (e.key === 'G') {
        e.preventDefault();
        onVimAction('scroll_bottom');
        return true;
      }
      return false;
    case 'f':
      e.preventDefault();
      onVimAction('toggle_hints');
      return true;
    case 'd':
      // Scroll page down by half window
      e.preventDefault();
      onVimAction('scroll_page_down');
      return true;
    case 'u':
      // Scroll page up by half window
      e.preventDefault();
      onVimAction('scroll_page_up');
      return true;
    default:
      return false;
  }
}
