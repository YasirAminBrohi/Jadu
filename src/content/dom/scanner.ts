import { InteractiveElement, ElementType, ActionType } from '../../types';
import { generateSelector, generateFallbackSelectors } from './selector';

// Keywords to match types
const SEARCH_KEYWORDS = /search|query|find|filter|typeahead/i;
const EDITOR_KEYWORDS = /editor|contenteditable|composer|textbox|rich-text|ql-editor|ProseMirror/i;
const NAV_KEYWORDS = /nav|menu|tab|sidebar|drawer|link-list|header/i;
const SCROLL_KEYWORDS = /scroll|feed|stream|list|overflow/i;
const BUTTON_KEYWORDS = /btn|button|submit|action|clickable|trigger|dropdown|modal-open/i;

function getLabel(el: HTMLElement): string {
  // 1. Aria Label
  const ariaLabel = el.getAttribute('aria-label') || el.getAttribute('aria-labelledby');
  if (ariaLabel && ariaLabel.trim()) return ariaLabel.trim();

  // 2. Placeholder
  const placeholder = el.getAttribute('placeholder');
  if (placeholder && placeholder.trim()) return placeholder.trim();

  // 3. Title attribute
  const title = el.getAttribute('title');
  if (title && title.trim()) return title.trim();

  // 4. Text content (up to 40 chars)
  const text = el.innerText || el.textContent;
  if (text && text.trim() && text.trim().length < 50) {
    return text.trim();
  }

  // 5. Value (if button/input)
  if (el instanceof HTMLInputElement && el.value) {
    return el.value;
  }

  // 6. Sibling label mapping (for inputs)
  if (el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement) {
    if (el.id) {
      const labelEl = document.querySelector(`label[for="${el.id}"]`);
      if (labelEl && labelEl.textContent) {
        return labelEl.textContent.trim();
      }
    }
  }

  // Fallback default names based on tag
  const tagName = el.tagName.toLowerCase();
  if (tagName === 'input' && (el as HTMLInputElement).type === 'search') return 'Search Input';
  if (tagName === 'input') return 'Text Input';
  if (tagName === 'button') return 'Button';
  if (tagName === 'textarea') return 'Text Area';
  return `${tagName.charAt(0).toUpperCase() + tagName.slice(1)} Element`;
}

function classifyElement(el: HTMLElement): { type: ElementType; suggestedAction: ActionType; score: number } {
  const tagName = el.tagName.toLowerCase();
  const id = el.id || '';
  const className = el.className ? (typeof el.className === 'string' ? el.className : '') : '';
  const role = el.getAttribute('role') || '';
  const typeAttr = el.getAttribute('type') || '';
  
  let type: ElementType = 'button';
  let suggestedAction: ActionType = 'click';
  let score = 50;

  // Search input check
  const isSearchTag = tagName === 'input' && (typeAttr === 'search' || SEARCH_KEYWORDS.test(id) || SEARCH_KEYWORDS.test(className) || SEARCH_KEYWORDS.test(el.getAttribute('placeholder') || ''));
  if (isSearchTag || role === 'searchbox') {
    return { type: 'search', suggestedAction: 'focus', score: 95 };
  }

  // Editor check
  const isEditor = tagName === 'textarea' || el.getAttribute('contenteditable') === 'true' || EDITOR_KEYWORDS.test(className) || EDITOR_KEYWORDS.test(id);
  if (isEditor) {
    return { type: 'editor', suggestedAction: 'focus', score: 90 };
  }

  // Input check
  const isInput = tagName === 'input' && ['text', 'email', 'number', 'tel', 'url', 'password'].includes(typeAttr);
  if (isInput) {
    return { type: 'input', suggestedAction: 'focus', score: 85 };
  }

  // Navigation tabs/links check
  const isNav = tagName === 'nav' || role === 'navigation' || role === 'tab' || NAV_KEYWORDS.test(className) || NAV_KEYWORDS.test(id);
  if (isNav) {
    return { type: 'nav', suggestedAction: 'click', score: 70 };
  }

  // Scroll Container check
  const style = window.getComputedStyle(el);
  const isScrollable = (el.scrollHeight > el.clientHeight + 25 || el.scrollWidth > el.clientWidth + 25) &&
                       (style.overflowY === 'scroll' || style.overflowY === 'auto' || style.overflow === 'scroll' || style.overflow === 'auto');
  if (isScrollable && !['body', 'html'].includes(tagName)) {
    return { type: 'scroll', suggestedAction: 'scroll', score: 80 };
  }

  // Modal Dialog check
  const isModal = role === 'dialog' || role === 'alertdialog' || className.includes('modal') || className.includes('dialog');
  if (isModal) {
    return { type: 'modal', suggestedAction: 'focus', score: 80 };
  }

  // Feed container check
  if (SCROLL_KEYWORDS.test(className) || SCROLL_KEYWORDS.test(id)) {
    return { type: 'feed', suggestedAction: 'scroll', score: 65 };
  }

  // Button check
  const isButton = tagName === 'button' || tagName === 'a' || role === 'button' || typeAttr === 'submit' || BUTTON_KEYWORDS.test(className) || BUTTON_KEYWORDS.test(id);
  if (isButton) {
    score = 60;
    if (tagName === 'button' || role === 'button') score = 80;
    return { type: 'button', suggestedAction: 'click', score };
  }

  return { type, suggestedAction, score };
}

function isVisible(el: HTMLElement): boolean {
  if (!el.isConnected) return false;
  const style = window.getComputedStyle(el);
  if (style.display === 'none' || style.visibility === 'hidden' || style.opacity === '0') return false;
  
  const rect = el.getBoundingClientRect();
  if (rect.width === 0 || rect.height === 0) return false;
  
  return true;
}

/**
 * Main function to scan DOM and find interactive components
 */
export function scanDOM(): InteractiveElement[] {
  const detected: InteractiveElement[] = [];
  const processedElements = new Set<HTMLElement>();

  // Select basic interactive tag names
  const selector = 'button, input, select, textarea, a, nav, [role="button"], [role="tab"], [role="searchbox"], [contenteditable="true"]';
  const rawElements = Array.from(document.querySelectorAll(selector)) as HTMLElement[];

  // Also query scroll containers
  const divElements = Array.from(document.querySelectorAll('div, section, aside, main, article')) as HTMLElement[];

  const allCandidates = [...rawElements, ...divElements];

  for (const el of allCandidates) {
    if (!isVisible(el) || processedElements.has(el)) continue;

    const { type, suggestedAction, score } = classifyElement(el);

    // Filter scrollable containers that don't have enough size or are html/body
    if (type === 'scroll' && (el.clientHeight < 100 || el.clientWidth < 100)) {
      continue;
    }

    // Skip generic div elements unless they are scrollable/modal/feed
    if (!['button', 'input', 'select', 'textarea', 'a', 'nav'].includes(el.tagName.toLowerCase())) {
      if (type === 'button' || type === 'input') {
        // Not a real interactive target, just a generic container div
        continue;
      }
    }

    // Filter out deeply nested duplicate clicks (e.g. SVG inside button)
    // If a parent is a button or an anchor, we should generally focus/click the parent, not the inner svg/span
    let parent = el.parentElement;
    let isNestedDuplicate = false;
    while (parent && parent !== document.body) {
      const parentTagName = parent.tagName.toLowerCase();
      if (parentTagName === 'button' || parentTagName === 'a' || parent.getAttribute('role') === 'button') {
        isNestedDuplicate = true;
        break;
      }
      parent = parent.parentElement;
    }
    if (isNestedDuplicate) continue;

    // Generate unique ID for scanner list
    const label = getLabel(el);
    const primarySelector = generateSelector(el);
    const fallbackSelectors = generateFallbackSelectors(el);

    detected.push({
      id: Math.random().toString(36).substring(2, 9),
      type,
      label,
      selector: primarySelector,
      fallbackSelectors,
      suggestedAction,
      score,
      tagName: el.tagName,
      placeholder: el.getAttribute('placeholder') || undefined,
      ariaLabel: el.getAttribute('aria-label') || undefined,
      innerText: el.innerText ? el.innerText.substring(0, 100) : undefined,
    });

    processedElements.add(el);
  }

  // Sort by confidence score descending
  return detected.sort((a, b) => b.score - a.score);
}
