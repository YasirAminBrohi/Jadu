import { Shortcut, UserSettings, StorageSchema } from '../types';

const DEFAULT_SETTINGS: UserSettings = {
  isEnabled: true,
  enableVimMode: false,
  enableSoundEffects: true,
  enableToastNotifications: true,
  theme: 'dark',
};

const isExtensionEnv = typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local;

export const jaduStorage = {
  async get<K extends keyof StorageSchema>(key: K): Promise<StorageSchema[K] | null> {
    if (isExtensionEnv) {
      return new Promise((resolve) => {
        chrome.storage.local.get([key], (result) => {
          resolve(result[key] || null);
        });
      });
    } else {
      const data = localStorage.getItem(`jadu_${key}`);
      return data ? JSON.parse(data) : null;
    }
  },

  async set<K extends keyof StorageSchema>(key: K, value: StorageSchema[K]): Promise<void> {
    if (isExtensionEnv) {
      return new Promise((resolve) => {
        chrome.storage.local.set({ [key]: value }, () => {
          resolve();
        });
      });
    } else {
      localStorage.setItem(`jadu_${key}`, JSON.stringify(value));
    }
  },

  async getShortcuts(): Promise<Shortcut[]> {
    const shortcuts = await this.get('shortcuts');
    return shortcuts || [];
  },

  async getActiveShortcutsForDomain(domain: string): Promise<Shortcut[]> {
    const shortcuts = await this.getShortcuts();
    return shortcuts.filter(s => s.isActive && (s.domain === domain || s.domain === 'global'));
  },

  async saveShortcut(shortcut: Shortcut): Promise<void> {
    const shortcuts = await this.getShortcuts();
    const index = shortcuts.findIndex(s => s.id === shortcut.id);
    if (index >= 0) {
      shortcuts[index] = shortcut;
    } else {
      shortcuts.push(shortcut);
    }
    await this.set('shortcuts', shortcuts);
  },

  async deleteShortcut(id: string): Promise<void> {
    const shortcuts = await this.getShortcuts();
    const filtered = shortcuts.filter(s => s.id !== id);
    await this.set('shortcuts', filtered);
  },

  async getSettings(): Promise<UserSettings> {
    const settings = await this.get('settings');
    return settings || DEFAULT_SETTINGS;
  },

  async saveSettings(settings: UserSettings): Promise<void> {
    await this.set('settings', settings);
  }
};
