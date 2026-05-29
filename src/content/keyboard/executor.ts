import { ActionType, ActionParams } from '../../types';
import { recoverElement } from '../dom/selector';

/**
 * Dispatches simulated mouse events to trigger click actions on complex elements
 */
function simulateClick(el: HTMLElement): void {
  // Dispatch synthetic mouse event sequence for SPA/framework compatibility (React, Vue, Angular)
  // This covers click handlers that listen to mousedown/mouseup/click events
  ['mousedown', 'mouseup', 'click'].forEach(name => {
    el.dispatchEvent(new MouseEvent(name, { bubbles: true, cancelable: true, view: window }));
  });
  // Native .click() for anchor navigation and native browser button behavior
  el.click();
}

/**
 * Insert value into an input and fire input/change events for framework compatibility
 */
function insertText(el: HTMLInputElement | HTMLTextAreaElement, text: string, append = false): void {
  el.focus();
  const value = append ? el.value + text : text;
  
  // Set value directly
  el.value = value;

  // React/Angular/Vue change trackers need these events dispatched
  el.dispatchEvent(new Event('input', { bubbles: true }));
  el.dispatchEvent(new Event('change', { bubbles: true }));
  
  // Place cursor at the end
  const length = el.value.length;
  el.setSelectionRange(length, length);
}

/**
 * Handle scrolling on an element or window
 */
function executeScroll(el: HTMLElement, params?: ActionParams): void {
  const behavior = 'smooth';
  const target = el === document.body || el === document.documentElement ? window : el;
  const direction = params?.scrollDirection || 'down';
  const amount = params?.scrollAmount || 300;

  if (target === window) {
    if (direction === 'top') {
      window.scrollTo({ top: 0, behavior });
    } else if (direction === 'bottom') {
      window.scrollTo({ top: document.body.scrollHeight, behavior });
    } else if (direction === 'down') {
      window.scrollBy({ top: amount, behavior });
    } else if (direction === 'up') {
      window.scrollBy({ top: -amount, behavior });
    }
  } else {
    if (direction === 'top') {
      el.scrollTo({ top: 0, behavior });
    } else if (direction === 'bottom') {
      el.scrollTo({ top: el.scrollHeight, behavior });
    } else if (direction === 'down') {
      el.scrollBy({ top: amount, behavior });
    } else if (direction === 'up') {
      el.scrollBy({ top: -amount, behavior });
    }
  }
}

/**
 * Core function to execute a single action on a resolved element
 */
export function executeSingleAction(el: HTMLElement, action: ActionType, params?: ActionParams): void {
  switch (action) {
    case 'click':
      simulateClick(el);
      break;

    case 'focus':
      // Some inputs need a click before focusing (e.g. search drop panels)
      simulateClick(el);
      el.focus();
      
      // If text input, move cursor to end
      if (el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement) {
        const len = el.value.length;
        el.setSelectionRange(len, len);
      }
      break;

    case 'scroll':
      executeScroll(el, params);
      break;

    case 'text':
      if (el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement) {
        insertText(el, params?.textValue || '');
      }
      break;

    default:
      console.warn(`Jadu: Unknown action type "${action}"`);
  }
}

/**
 * Main entry point for executing shortcut actions, handling element recovery & sequencing
 */
export async function executeShortcut(
  primarySelector: string,
  fallbacks: string[],
  action: ActionType,
  params?: ActionParams,
  cachedMeta?: { tagName: string; label: string; innerText?: string; ariaLabel?: string; placeholder?: string }
): Promise<boolean> {
  
  // For scrolling, if no selector is specified, default to scrolling body
  let el: HTMLElement | null = null;
  if (!primarySelector && action === 'scroll') {
    el = document.documentElement;
  } else {
    // Attempt recovery
    el = recoverElement(
      primarySelector, 
      fallbacks, 
      cachedMeta || { tagName: primarySelector ? primarySelector.split(/[#.[\]]/)[0] : 'button' }
    );
  }

  if (!el) {
    console.error(`Jadu: Failed to locate element for selector: ${primarySelector}`);
    return false;
  }

  // Handle Action Sequence Chaining
  if (action === 'sequence' && params?.sequenceSteps) {
    for (const step of params.sequenceSteps) {
      // Execute each step with optional delays
      executeSingleAction(el, step.type, step.params);
      if (step.params?.delayMs) {
        await new Promise(resolve => setTimeout(resolve, step.params!.delayMs));
      }
    }
    return true;
  }

  // Execute standard single action
  executeSingleAction(el, action, params);
  return true;
}
