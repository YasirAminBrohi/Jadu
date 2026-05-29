import { Shortcut, UserSettings } from '../types';
import { jaduStorage } from '../shared/storage';

const INITIAL_SHORTCUTS: Shortcut[] = [
  {
    id: 'yt-focus-video',
    name: 'Focus Video Player',
    key: 'f',
    domain: 'youtube.com',
    selector: 'video.html5-main-video',
    fallbackSelectors: ['video'],
    action: 'focus',
    isActive: true,
    isCustom: false,
    createdAt: Date.now()
  },
  {
    id: 'yt-search',
    name: 'Search Video Library',
    key: 's',
    domain: 'youtube.com',
    selector: 'input#search',
    fallbackSelectors: ['input[name="search_query"]'],
    action: 'focus',
    isActive: true,
    isCustom: false,
    createdAt: Date.now()
  },
  {
    id: 'li-focus-search',
    name: 'Focus LinkedIn Search',
    key: 'shift+s',
    domain: 'linkedin.com',
    selector: 'input.search-global-typeahead__input',
    fallbackSelectors: ['input[placeholder="Search"]'],
    action: 'focus',
    isActive: true,
    isCustom: false,
    createdAt: Date.now()
  },
  {
    id: 'google-focus-search',
    name: 'Focus Search Input',
    key: 's',
    domain: 'google.com',
    selector: 'textarea[name="q"]',
    fallbackSelectors: ['input[name="q"]', 'textarea'],
    action: 'focus',
    isActive: true,
    isCustom: false,
    createdAt: Date.now()
  }
];

const DEFAULT_SETTINGS: UserSettings = {
  isEnabled: true,
  enableVimMode: true,
  enableSoundEffects: true,
  enableToastNotifications: true,
  theme: 'dark'
};

chrome.runtime.onInstalled.addListener(async (details) => {
  if (details.reason === 'install') {
    console.log('Jadu: Extension installed. Seeding default database.');
    
    // Seed initial values
    await jaduStorage.set('shortcuts', INITIAL_SHORTCUTS);
    await jaduStorage.set('settings', DEFAULT_SETTINGS);

    // Open options page tutorial
    chrome.runtime.openOptionsPage();
  }
});

chrome.runtime.onStartup.addListener(() => {
  console.log('Jadu: Service worker started.');
});
