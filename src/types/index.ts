export type ActionType = 'focus' | 'click' | 'scroll' | 'text' | 'sequence';

export interface ActionParams {
  scrollDirection?: 'top' | 'bottom' | 'up' | 'down';
  scrollAmount?: number; // for scroll by amount
  textValue?: string; // for inserting template text
  delayMs?: number; // delay for step sequences
  sequenceSteps?: ShortcutAction[]; // for chaining actions
}

export interface ShortcutAction {
  type: ActionType;
  params?: ActionParams;
}

export interface Shortcut {
  id: string;
  name: string;
  key: string; // e.g. "ctrl+shift+s" or "s" or "g g"
  domain: string; // e.g. "linkedin.com" or "global"
  selector: string; // primary CSS selector
  fallbackSelectors: string[]; // list of alternative selectors
  action: ActionType;
  actionParams?: ActionParams;
  isActive: boolean;
  isCustom: boolean; // false for preset/community shortcuts
  createdAt: number;
  tagName?: string;
  ariaLabel?: string;
  innerText?: string;
  placeholder?: string;
}

export type ElementType = 
  | 'search' 
  | 'input' 
  | 'button' 
  | 'nav' 
  | 'scroll' 
  | 'modal' 
  | 'feed' 
  | 'editor'
  | 'panel';

export interface InteractiveElement {
  id: string;
  type: ElementType;
  label: string;
  selector: string;
  fallbackSelectors: string[];
  suggestedAction: ActionType;
  score: number;
  tagName: string;
  placeholder?: string;
  ariaLabel?: string;
  innerText?: string;
}

export interface ElementRect {
  top: number;
  left: number;
  width: number;
  height: number;
}

export interface UserSettings {
  isEnabled: boolean;
  enableVimMode: boolean;
  enableSoundEffects: boolean;
  enableToastNotifications: boolean;
  theme: 'dark' | 'light' | 'glass';
}

export interface StorageSchema {
  shortcuts: Shortcut[];
  settings: UserSettings;
  customSelectors?: Record<string, string>; // Manual selector overrides
}
