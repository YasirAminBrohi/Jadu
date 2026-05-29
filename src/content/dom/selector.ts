// Dynamic selectors pattern matching to filter out auto-generated hashes (e.g., css-1abc2, sc-def4, tailwind hashes)
const DYNAMIC_CLASS_REGEX = /(^| )([a-zA-Z0-9_-]+[a-fA-F0-9]{4,}[a-zA-Z0-9_-]*|css-[a-zA-Z0-9]+|sc-[a-zA-Z0-9]+|styled-[a-zA-Z0-9]+|__[a-zA-Z0-9_-]+)( |$)/;
const STATE_CLASS_REGEX = /(active|selected|focus|hover|current|disabled|expanded|collapsed|checked|loading|is-)/i;
const AUTO_ID_REGEX = /^[0-9]+|-[0-9]+$|^[a-f0-9]{8,}/i; // Matches IDs that look numeric or hex hashes

function isClassStable(className: string): boolean {
  if (!className) return false;
  return !DYNAMIC_CLASS_REGEX.test(className) && !STATE_CLASS_REGEX.test(className);
}

function isIdStable(id: string): boolean {
  if (!id) return false;
  
  // Framework dynamic IDs:
  // - Ember: ember123, ember-123
  // - React 18 useId: :r0:, :r1:
  // - Angular: ng-xxxx
  if (/^ember[-0-9]/i.test(id)) return false;
  if (/^:r[0-9a-zA-Z]+:/i.test(id)) return false;
  if (/^ng-/i.test(id)) return false;
  if (id.includes('headlessui') || id.includes('radix') || id.includes('react-aria')) return false;

  // Numeric/dynamic-ending patterns:
  // - Purely numeric
  if (/^[0-9]+$/i.test(id)) return false;
  // - Ends with dynamic-looking digits (3+ digits)
  if (/-\d{3,}$/i.test(id)) return false;
  
  // UUIDs / long hashes:
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (uuidRegex.test(id)) return false;
  
  // Hex/hash pattern: 8+ hex characters
  if (/^[a-f0-9]{8,}$/i.test(id)) return false;
  
  return true;
}

function getStableClasses(el: HTMLElement): string[] {
  const classList = Array.from(el.classList);
  return classList.filter(c => isClassStable(c));
}

/**
 * Checks if the selector string is an XPath expression
 */
export function isXPath(selector: string): boolean {
  return selector.startsWith('/') || selector.startsWith('//') || selector.startsWith('(');
}

/**
 * Resolve an element via XPath
 */
export function getElementByXPath(xpath: string): HTMLElement | null {
  try {
    const result = document.evaluate(
      xpath,
      document,
      null,
      XPathResult.FIRST_ORDERED_NODE_TYPE,
      null
    );
    return result.singleNodeValue as HTMLElement | null;
  } catch (e) {
    return null;
  }
}

/**
 * Generate a stable XPath for a DOM node
 */
export function generateXPath(el: HTMLElement): string {
  if (el.id && isIdStable(el.id)) {
    return `//*[@id="${el.id}"]`;
  }
  
  if (el.tagName.toLowerCase() === 'a') {
    const href = el.getAttribute('href');
    if (href) {
      let cleanHref = href;
      try {
        const url = new URL(href, window.location.href);
        if (url.origin === window.location.origin) {
          cleanHref = url.pathname + url.search;
        }
      } catch (e) {}
      if (cleanHref && cleanHref !== '#' && !cleanHref.startsWith('javascript:')) {
        return `//a[@href="${cleanHref.replace(/"/g, '\\"')}"]`;
      }
    }
  }
  
  // Try stable attributes first
  const stableAttrs = ['aria-label', 'placeholder', 'title', 'name', 'type', 'data-testid', 'role'];
  for (const attr of stableAttrs) {
    const val = el.getAttribute(attr);
    if (val) {
      return `//${el.tagName.toLowerCase()}[@${attr}="${val.replace(/"/g, '\\"')}"]`;
    }
  }

  const parts: string[] = [];
  let current: HTMLElement | null = el;
  while (current && current.nodeType === Node.ELEMENT_NODE) {
    let sibCount = 0;
    let sibIndex = 0;
    let sib = current.previousElementSibling;
    while (sib) {
      if (sib.tagName === current.tagName) {
        sibIndex++;
      }
      sib = sib.previousElementSibling;
    }
    let sibNext = current.nextElementSibling;
    while (sibNext) {
      if (sibNext.tagName === current.tagName) {
        sibCount++;
      }
      sibNext = sibNext.nextElementSibling;
    }
    const tagName = current.tagName.toLowerCase();
    const hasSiblings = sibIndex > 0 || sibCount > 0;
    const pathIndex = hasSiblings ? `[${sibIndex + 1}]` : '';
    parts.unshift(`${tagName}${pathIndex}`);
    current = current.parentElement;
  }
  return parts.length ? '/' + parts.join('/') : '';
}

/**
 * Stamp a temporary data-jadu-id attribute for session-level identification
 */
export function stampJaduId(el: HTMLElement): string {
  let jid = el.getAttribute('data-jadu-id');
  if (!jid) {
    jid = Math.random().toString(36).substring(2, 9);
    el.setAttribute('data-jadu-id', jid);
  }
  return jid;
}

/**
 * Generate a primary, robust CSS selector for an element.
 */
export function generateSelector(el: HTMLElement): string {
  if (el.id && isIdStable(el.id)) {
    return `#${el.id}`;
  }

  if (el.tagName.toLowerCase() === 'a') {
    const href = el.getAttribute('href');
    if (href) {
      let cleanHref = href;
      try {
        const url = new URL(href, window.location.href);
        if (url.origin === window.location.origin) {
          cleanHref = url.pathname + url.search;
        }
      } catch (e) {}

      if (cleanHref && cleanHref !== '#' && !cleanHref.startsWith('javascript:')) {
        const escapedVal = cleanHref.replace(/"/g, '\\"');
        const selector = `a[href="${escapedVal}"]`;
        if (document.querySelectorAll(selector).length === 1) {
          return selector;
        }
        
        const containsSelector = `a[href*="${escapedVal}"]`;
        if (document.querySelectorAll(containsSelector).length === 1) {
          return containsSelector;
        }
      }
    }
  }

  const stableAttrs = ['aria-label', 'placeholder', 'title', 'name', 'type', 'data-testid', 'role'];
  for (const attr of stableAttrs) {
    const val = el.getAttribute(attr);
    if (val) {
      const escapedVal = val.replace(/"/g, '\\"');
      const selector = `${el.tagName.toLowerCase()}[${attr}="${escapedVal}"]`;
      if (document.querySelectorAll(selector).length === 1) {
        return selector;
      }
    }
  }

  const classes = getStableClasses(el);
  const tagName = el.tagName.toLowerCase();
  if (classes.length > 0) {
    const classSelector = `${tagName}.${classes.join('.')}`;
    if (document.querySelectorAll(classSelector).length === 1) {
      return classSelector;
    }
  }

  return getPathSelector(el);
}

/**
 * Generate alternative selectors that can be used if the primary fails.
 */
export function generateFallbackSelectors(el: HTMLElement): string[] {
  const fallbacks: string[] = [];
  const tagName = el.tagName.toLowerCase();

  // XPath is highly resilient, add as first fallback
  fallbacks.push(generateXPath(el));

  // Temporary ID if stamped
  const jid = el.getAttribute('data-jadu-id');
  if (jid) {
    fallbacks.push(`[data-jadu-id="${jid}"]`);
  }

  const ariaLabel = el.getAttribute('aria-label');
  if (ariaLabel) {
    fallbacks.push(`${tagName}[aria-label="${ariaLabel.replace(/"/g, '\\"')}"]`);
  }

  if (tagName === 'a') {
    const href = el.getAttribute('href');
    if (href) {
      fallbacks.push(`a[href="${href.replace(/"/g, '\\"')}"]`);
      try {
        const url = new URL(href, window.location.href);
        if (url.pathname && url.pathname !== '/') {
          fallbacks.push(`a[href*="${url.pathname.replace(/"/g, '\\"')}"]`);
        }
      } catch (e) {}
    }
  }
  
  const placeholder = el.getAttribute('placeholder');
  if (placeholder) {
    fallbacks.push(`${tagName}[placeholder="${placeholder.replace(/"/g, '\\"')}"]`);
  }

  const classes = getStableClasses(el);
  if (classes.length > 0) {
    fallbacks.push(`${tagName}.${classes[0]}`);
  }

  let path = '';
  let current: HTMLElement | null = el;
  let depth = 0;
  while (current && current.tagName && current !== document.body && depth < 4) {
    const sibIndex = getSiblingIndex(current);
    const step = `${current.tagName.toLowerCase()}:nth-child(${sibIndex})`;
    path = path ? `${step} > ${path}` : step;
    current = current.parentElement;
    depth++;
  }
  if (path) {
    fallbacks.push(path);
  }

  fallbacks.push(tagName);
  return [...new Set(fallbacks)];
}

function getSiblingIndex(el: HTMLElement): number {
  let index = 1;
  let sib = el.previousElementSibling;
  while (sib) {
    index++;
    sib = sib.previousElementSibling;
  }
  return index;
}

function getPathSelector(el: HTMLElement): string {
  const parts: string[] = [];
  let current: HTMLElement | null = el;

  while (current && current.nodeType === Node.ELEMENT_NODE) {
    let selector = current.tagName.toLowerCase();
    
    if (current.id && isIdStable(current.id)) {
      selector += `#${current.id}`;
      parts.unshift(selector);
      break;
    }

    const classes = getStableClasses(current);
    if (classes.length > 0) {
      selector += `.${classes.join('.')}`;
    }

    if (current.tagName.toLowerCase() === 'a') {
      const href = current.getAttribute('href');
      if (href) {
        let cleanHref = href;
        try {
          const url = new URL(href, window.location.href);
          if (url.origin === window.location.origin) {
            cleanHref = url.pathname + url.search;
          }
        } catch (e) {}
        if (cleanHref && cleanHref !== '#' && !cleanHref.startsWith('javascript:')) {
          selector += `[href="${cleanHref.replace(/"/g, '\\"')}"]`;
        }
      }
    }

    const parentElement: HTMLElement | null = current.parentElement;
    if (parentElement) {
      const siblings = Array.from(parentElement.children).filter(
        (c: Element) => c.tagName === current!.tagName
      );
      if (siblings.length > 1) {
        const index = siblings.indexOf(current) + 1;
        selector += `:nth-of-type(${index})`;
      }
    }

    parts.unshift(selector);
    current = parentElement;
  }

  return parts.join(' > ');
}

export interface CachedMetadata {
  tagName: string;
  label?: string;
  innerText?: string;
  ariaLabel?: string;
  placeholder?: string;
  jaduId?: string;
}

/**
 * Fuzzy recovery engine: If selector and fallback selectors fail,
 * scan page elements and score them based on matching attributes.
 */
export function recoverElement(
  primarySelector: string,
  fallbacks: string[],
  meta: CachedMetadata
): HTMLElement | null {
  const isDebug = (window as any).JADU_DEBUG === true;

  if (isDebug) {
    console.log(`[Jadu Debug] Resolving selector: "${primarySelector}"`, { fallbacks, meta });
  }

  // Helper to query CSS or XPath
  const query = (sel: string): HTMLElement | null => {
    if (!sel) return null;
    try {
      if (isXPath(sel)) {
        return getElementByXPath(sel);
      } else {
        return document.querySelector(sel) as HTMLElement | null;
      }
    } catch (e) {
      return null;
    }
  };

  // 1. Try primary selector
  let el = query(primarySelector);
  if (el) {
    if (isDebug) console.log('[Jadu Debug] Target matched via primary selector:', el);
    return el;
  }

  // 2. Try fallbacks sequentially
  for (const fallback of fallbacks) {
    el = query(fallback);
    if (el) {
      if (isDebug) console.log(`[Jadu Debug] Target matched via fallback "${fallback}":`, el);
      return el;
    }
  }

  // 3. Try temporary jaduId if cached
  if (meta.jaduId) {
    el = query(`[data-jadu-id="${meta.jaduId}"]`);
    if (el) {
      if (isDebug) console.log('[Jadu Debug] Target matched via session data-jadu-id:', el);
      return el;
    }
  }

  // 4. Fuzzy matching fallback
  if (isDebug) console.warn('[Jadu Debug] Selector match failed. Launching fuzzy selector recovery...');
  
  const tagName = meta.tagName ? meta.tagName.toLowerCase() : '*';
  let elements: HTMLElement[] = [];
  try {
    elements = Array.from(document.querySelectorAll(tagName)) as HTMLElement[];
  } catch (e) {
    return null;
  }

  let bestElement: HTMLElement | null = null;
  let highestScore = 0;

  for (const item of elements) {
    let score = 0;

    if (meta.ariaLabel && item.getAttribute('aria-label') === meta.ariaLabel) {
      score += 40;
    }

    if (meta.placeholder && item.getAttribute('placeholder') === meta.placeholder) {
      score += 40;
    }

    if (meta.innerText && item.innerText) {
      const cleanMetaText = meta.innerText.trim().toLowerCase();
      const cleanElText = item.innerText.trim().toLowerCase();
      if (cleanMetaText && cleanElText) {
        if (cleanMetaText === cleanElText) {
          score += 40;
        } else if (cleanElText.includes(cleanMetaText) || cleanMetaText.includes(cleanElText)) {
          score += 15;
        }
      }
    }

    if (meta.label) {
      const title = item.getAttribute('title');
      const name = item.getAttribute('name');
      const cleanLabel = meta.label.toLowerCase();
      if (title && title.toLowerCase() === cleanLabel) score += 20;
      if (name && name.toLowerCase() === cleanLabel) score += 20;
    }

    if (['button', 'input', 'a', 'select', 'textarea'].includes(tagName)) {
      score += 10;
    }

    if (score > highestScore) {
      const style = window.getComputedStyle(item);
      if (style.display === 'none' || style.visibility === 'hidden') continue;
      if (item.offsetWidth === 0 || item.offsetHeight === 0) continue;

      highestScore = score;
      bestElement = item;
    }
  }

  if (highestScore >= 50 && bestElement) {
    if (isDebug) {
      console.warn(`[Jadu Debug] Fuzzy recovery matched element with score ${highestScore}/100:`, bestElement);
    }
    return bestElement;
  }

  if (isDebug) console.error('[Jadu Debug] Fuzzy recovery failed. Target element could not be located.');
  return null;
}
