import { useState, useEffect } from 'react';
import { Shortcut, UserSettings } from '../types';
import { jaduStorage } from '../shared/storage';

// Domain-specific preset shortcuts suggestions
const PRESET_SUGGESTIONS: Record<string, { name: string; action: string; key: string; selector: string }[]> = {
  'youtube.com': [
    { name: 'Focus Video Player', action: 'focus', key: 'f', selector: 'video.html5-main-video' },
    { name: 'Search Video Library', action: 'focus', key: 's', selector: 'input#search' },
    { name: 'Toggle Play/Pause', action: 'click', key: 'space', selector: 'button.ytp-play-button' },
  ],
  'linkedin.com': [
    { name: 'Focus LinkedIn Search', action: 'focus', key: 'shift+s', selector: 'input.search-global-typeahead__input' },
    { name: 'Open Navigation Messaging', action: 'click', key: 'm', selector: 'button.msg-overlay-bubble-header__control' },
    { name: 'Go to Feed Scroll', action: 'focus', key: 'g f', selector: 'main.scaffold-layout__main' },
  ],
  'github.com': [
    { name: 'Focus Repository Search', action: 'focus', key: 's', selector: 'button.header-search-button' },
    { name: 'View Pull Requests', action: 'click', key: 'g p', selector: 'a#pull-requests-tab' },
    { name: 'Scroll Down Feed', action: 'scroll', key: 'j', selector: 'body' },
  ],
  'google.com': [
    { name: 'Focus Search Field', action: 'focus', key: 's', selector: 'textarea[name="q"]' },
    { name: 'Go to Next Page', action: 'click', key: 'n', selector: 'a#pnnext' },
  ]
};

export default function Popup() {
  const [domain, setDomain] = useState('localhost');
  const [shortcuts, setShortcuts] = useState<Shortcut[]>([]);
  const [settings, setSettings] = useState<UserSettings>({
    isEnabled: true,
    enableVimMode: false,
    enableSoundEffects: true,
    enableToastNotifications: true,
    theme: 'dark'
  });

  // Settings tab or configuration section visibility
  const [showSettings, setShowSettings] = useState(false);

  // Inline editing state
  const [editingShortcutId, setEditingShortcutId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [editKey, setEditKey] = useState('');

  const loadData = async () => {
    // 1. Get active tab URL/Domain
    if (typeof chrome !== 'undefined' && chrome.tabs && chrome.tabs.query) {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (tab && tab.url) {
        try {
          const urlObj = new URL(tab.url);
          setDomain(urlObj.hostname.replace('www.', ''));
        } catch (e) {}
      }
    }

    // 2. Fetch storage
    const allShortcuts = await jaduStorage.getShortcuts();
    const savedSettings = await jaduStorage.getSettings();
    setSettings(savedSettings);
    setShortcuts(allShortcuts);
  };

  useEffect(() => {
    loadData();
  }, []);

  const toggleExtension = async () => {
    const updated = { ...settings, isEnabled: !settings.isEnabled };
    await jaduStorage.saveSettings(updated);
    setSettings(updated);
  };

  const updateSetting = async (key: keyof UserSettings, value: any) => {
    const updated = { ...settings, [key]: value };
    await jaduStorage.saveSettings(updated);
    setSettings(updated);
  };

  const toggleShortcut = async (id: string) => {
    const all = await jaduStorage.getShortcuts();
    const index = all.findIndex(s => s.id === id);
    if (index >= 0) {
      all[index].isActive = !all[index].isActive;
      await jaduStorage.set('shortcuts', all);
      setShortcuts(all);
    }
  };

  const deleteShortcut = async (id: string) => {
    await jaduStorage.deleteShortcut(id);
    loadData();
  };

  const startEdit = (s: Shortcut) => {
    setEditingShortcutId(s.id);
    setEditName(s.name);
    setEditKey(s.key);
  };

  const saveEdit = async (id: string) => {
    const all = await jaduStorage.getShortcuts();
    const idx = all.findIndex(s => s.id === id);
    if (idx >= 0) {
      all[idx].name = editName.trim() || all[idx].name;
      all[idx].key = editKey.trim() || all[idx].key;
      await jaduStorage.set('shortcuts', all);
      setEditingShortcutId(null);
      loadData();
    }
  };

  // Cross-context commands to Page Content Script
  const sendTabMessage = async (action: string) => {
    if (typeof chrome === 'undefined' || !chrome.tabs || !chrome.tabs.query) return;
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (tab?.id) {
      chrome.tabs.sendMessage(tab.id, { action }, () => {
        // Access lastError to prevent uncaught exception warning in Chrome Console
        if (chrome.runtime.lastError) {
          console.warn('[Jadu] Message delivery failed:', chrome.runtime.lastError.message);
        }
        window.close(); // Close popup panel safely after message dispatch
      });
    }
  };

  const openDashboard = () => {
    if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.openOptionsPage) {
      chrome.runtime.openOptionsPage();
    } else {
      window.open('/options.html', '_blank');
    }
  };

  // Add AI-suggested hotkey
  const installPreset = async (preset: typeof PRESET_SUGGESTIONS[string][0]) => {
    const tagName = preset.selector.split(/[#.[\]]/)[0] || 'button';
    const newShortcut: Shortcut = {
      id: Math.random().toString(36).substring(2, 9),
      name: preset.name,
      key: preset.key,
      domain,
      selector: preset.selector,
      fallbackSelectors: [preset.selector.split(/[#.]/)[0]],
      action: preset.action as any,
      isActive: true,
      isCustom: false,
      createdAt: Date.now(),
      tagName: tagName.toLowerCase(),
      ariaLabel: preset.name
    };
    await jaduStorage.saveShortcut(newShortcut);
    loadData();
  };

  const domainShortcuts = shortcuts.filter(s => s.domain === domain);
  const presets = PRESET_SUGGESTIONS[domain] || PRESET_SUGGESTIONS['google.com'];
  
  // Check if current tab is a browser system page
  const isSystemPage = domain === 'newtab' || domain.includes('chrome://') || domain.includes('chrome-extension://');

  return (
    <div className="w-[360px] h-[490px] bg-[#09090b] text-white flex flex-col justify-between select-none font-sans">
      {/* Header Panel */}
      <header className="border-b border-white/10 px-4 py-3 flex items-center justify-between bg-white/[0.01]">
        <div className="flex items-center gap-2">
          {/* Brand Logo Icon */}
          <img src="icons/logo256.png" alt="Jadu" className="w-10 h-10 logo-glow" />
          <div>
            <h1 className="text-base font-bold tracking-wide text-brand-gradient leading-none">Jadu</h1>
            <p className="text-[9px] text-zinc-500 font-medium mt-0.5">Keyboard Superpowers</p>
          </div>
        </div>

        {/* Global extension toggle */}
        <button
          onClick={toggleExtension}
          className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-[10px] font-semibold transition-all duration-150 ${
            settings.isEnabled
              ? 'bg-accent-fuchsia/10 border-accent-fuchsia/30 text-jadu-300'
              : 'bg-zinc-800/20 border-zinc-700/50 text-zinc-500'
          }`}
        >
          <span className={`w-1.5 h-1.5 rounded-full ${settings.isEnabled ? 'bg-accent-fuchsia' : 'bg-zinc-600'}`} />
          {settings.isEnabled ? 'Active' : 'Disabled'}
        </button>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 overflow-y-auto p-4 flex flex-col gap-4">
        {/* Navigation Tabs */}
        <div className="flex gap-2">
          <button
            onClick={() => setShowSettings(false)}
            className={`flex-1 py-1 px-3 text-xs font-semibold rounded-lg border text-center transition-all ${
              !showSettings
                ? 'bg-white/[0.04] text-white border-white/10'
                : 'text-zinc-400 border-transparent hover:text-zinc-200'
            }`}
          >
            My Shortcuts
          </button>
          <button
            onClick={() => setShowSettings(true)}
            className={`flex-1 py-1 px-3 text-xs font-semibold rounded-lg border text-center transition-all ${
              showSettings
                ? 'bg-white/[0.04] text-white border-white/10'
                : 'text-zinc-400 border-transparent hover:text-zinc-200'
            }`}
          >
            Extension Settings
          </button>
        </div>

        {!showSettings ? (
          <>
            {/* Pick Element Primary Action Button */}
            <section className="flex flex-col gap-1.5">
              <button
                disabled={isSystemPage || !settings.isEnabled}
                onClick={() => sendTabMessage('jadu-start-pick-mode')}
                className={`w-full flex items-center justify-center gap-2.5 px-4 py-3 rounded-xl border font-bold text-xs transition-all duration-200 shadow-glow-brand ${
                  isSystemPage || !settings.isEnabled
                    ? 'bg-zinc-900 border-zinc-800/50 text-zinc-500 cursor-not-allowed opacity-50'
                    : 'bg-gradient-to-r from-jadu-700 via-jadu-600 to-accent-fuchsia hover:from-jadu-600 hover:via-jadu-500 hover:to-jadu-400 border-jadu-400/30 text-white hover:scale-[1.01] active:scale-[0.99]'
                }`}
              >
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" className="w-4 h-4 text-white">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15.042 9.152c.582.448 1.148.89 1.676 1.345m-7.308-3.64C8.835 6.279 8.27 5.827 7.7 5.372m0 0a20.52 20.52 0 0 0-3.372-2.187m3.372 2.187a20.25 20.25 0 0 1 3.372 2.187m0 0a20.25 20.25 0 0 1 3.372 2.187m0-4.374h-.008a2.25 2.25 0 1 0 0 4.5h.008a2.25 2.25 0 1 0 0-4.5Zm0 0L10.5 7.5M12 21a9.003 9.003 0 0 0 8.354-5.646 9.003 9.003 0 0 0-8.354-5.646M12 21a9.003 9.003 0 0 1-8.354-5.646M12 21V9.75" />
                </svg>
                <span>Pick Element on Page</span>
              </button>
              {isSystemPage && (
                <p className="text-[9px] text-amber-500 text-center font-medium">Jadu cannot run on system browser pages.</p>
              )}
            </section>

            {/* Shortcuts list on current website */}
            <section className="flex flex-col gap-2 flex-1 min-h-[140px]">
              <div className="flex justify-between items-center text-[10px] text-zinc-500 font-semibold uppercase tracking-wider">
                <span>Active on {domain}</span>
                <span className="font-mono text-zinc-500 font-semibold">{domainShortcuts.length}</span>
              </div>

              <div className="flex flex-col gap-1.5 max-h-[160px] overflow-y-auto">
                {domainShortcuts.length > 0 ? (
                  domainShortcuts.map(s => (
                    <div
                      key={s.id}
                      className="flex flex-col gap-2 p-2.5 rounded-xl bg-white/[0.01] border border-white/5"
                    >
                      {editingShortcutId === s.id ? (
                        /* Inline Edit Form */
                        <div className="flex flex-col gap-2 animate-fade-in">
                          <input
                            type="text"
                            value={editName}
                            onChange={(e) => setEditName(e.target.value)}
                            placeholder="Shortcut Name"
                            className="bg-zinc-900 border border-white/10 rounded px-2 py-1 text-xs outline-none focus:border-jadu-500 text-white"
                          />
                          <div className="flex gap-2 items-center">
                            <input
                              type="text"
                              value={editKey}
                              onChange={(e) => setEditKey(e.target.value)}
                              placeholder="Key (e.g. shift+s)"
                              className="bg-zinc-900 border border-white/10 rounded px-2 py-1 text-xs outline-none focus:border-jadu-500 font-mono text-white flex-1"
                            />
                            <button
                              onClick={() => saveEdit(s.id)}
                              className="px-2.5 py-1 rounded bg-jadu-600 hover:bg-jadu-500 text-[10px] font-bold text-white transition-colors"
                            >
                              Save
                            </button>
                            <button
                              onClick={() => setEditingShortcutId(null)}
                              className="px-2.5 py-1 rounded bg-white/5 border border-white/10 text-[10px] font-bold text-zinc-400 hover:text-white transition-colors"
                            >
                              Cancel
                            </button>
                          </div>
                        </div>
                      ) : (
                        /* Standard Row */
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2 min-w-0">
                            <input
                              type="checkbox"
                              checked={s.isActive}
                              onChange={() => toggleShortcut(s.id)}
                              className="accent-jadu-500 cursor-pointer w-3.5 h-3.5"
                            />
                            <span className="text-xs text-zinc-300 font-medium truncate max-w-[130px]">{s.name}</span>
                          </div>

                          <div className="flex items-center gap-2">
                            <span className="px-1.5 py-0.5 rounded text-[9px] font-mono bg-jadu-500/10 border border-jadu-500/20 text-jadu-300 font-semibold uppercase">
                              {s.key}
                            </span>
                            <button
                              onClick={() => startEdit(s)}
                              className="text-zinc-500 hover:text-zinc-300 p-0.5 transition-colors"
                              title="Edit Shortcut"
                            >
                              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-3.5 h-3.5">
                                <path strokeLinecap="round" strokeLinejoin="round" d="m16.862 4.487 1.687-1.688a1.875 1.875 0 1 1 2.652 2.652L6.83 20.062a4.5 4.5 0 0 1-1.89 1.07a1.98 1.98 0 0 1-2.427-2.428 4.5 4.5 0 0 1 1.07-1.89L16.863 4.487Zm0 0L19.5 7.125" />
                              </svg>
                            </button>
                            <button
                              onClick={() => deleteShortcut(s.id)}
                              className="text-zinc-600 hover:text-rose-400 p-0.5 transition-colors"
                              title="Delete Shortcut"
                            >
                              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-3.5 h-3.5">
                                <path strokeLinecap="round" strokeLinejoin="round" d="m14.74 9-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 0 1-2.244 2.077H8.084a2.25 2.25 0 0 1-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 0 0-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 0 1 3.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 0 0-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 0 0-7.5 0" />
                              </svg>
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  ))
                ) : (
                  <div className="py-5 text-center text-xs text-zinc-500 font-medium bg-white/[0.01] border border-white/5 border-dashed rounded-xl">
                    No active shortcuts. Use the picker to create one!
                  </div>
                )}
              </div>
            </section>

            {/* AI suggested shortcuts */}
            <section className="flex flex-col gap-2">
              <div className="text-[10px] text-zinc-500 font-semibold uppercase tracking-wider flex items-center gap-1.5">
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" className="w-3 h-3 text-accent-fuchsia">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904 9 21l-.813-5.096L3 15l5.096-.813L9 9l.813 5.187L15 15l-5.187.813ZM18 10.5l-.5 3-.5-3-3-.5 3-.5.5-3 .5 3 3 .5-3 .5ZM10.5 4.5l-.25 1.5-.25-1.5-1.5-.25 1.5-.25.25-1.5.25 1.5 1.5.25-1.5.25Z" />
                </svg>
                <span>Suggested Shortcuts</span>
              </div>

              <div className="flex flex-col gap-1.5 max-h-[110px] overflow-y-auto">
                {presets.map((preset, index) => {
                  const installed = shortcuts.some(s => s.domain === domain && s.name === preset.name);
                  return (
                    <div
                      key={index}
                      className="flex items-center justify-between px-3 py-2 rounded-xl bg-white/[0.01] border border-white/5"
                    >
                      <div className="flex flex-col min-w-0">
                        <span className="text-xs text-zinc-300 font-medium truncate">{preset.name}</span>
                        <span className="text-[9px] text-zinc-500 font-mono mt-0.5">{preset.action.toUpperCase()}</span>
                      </div>

                      {installed ? (
                        <span className="text-[10px] text-accent-emerald font-semibold">Installed</span>
                      ) : (
                        <button
                          onClick={() => installPreset(preset)}
                          className="px-2.5 py-1 rounded bg-jadu-600 hover:bg-jadu-500 text-[10px] font-semibold transition-colors"
                        >
                          Add (+{preset.key.toUpperCase()})
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            </section>
          </>
        ) : (
          /* Extension Settings List */
          <div className="flex flex-col gap-3.5 bg-white/[0.01] border border-white/5 rounded-xl p-4.5">
            <h3 className="text-xs font-semibold text-zinc-400 uppercase tracking-wider pb-1">Preferences</h3>
            
            {/* Vim mode toggle */}
            <div className="flex items-center justify-between">
              <div className="flex flex-col">
                <span className="text-xs font-semibold text-zinc-200">Vim Navigation Mode</span>
                <span className="text-[9px] text-zinc-500">Navigate using j, k, g g, d, u</span>
              </div>
              <input
                type="checkbox"
                checked={settings.enableVimMode}
                onChange={(e) => updateSetting('enableVimMode', e.target.checked)}
                className="accent-jadu-500 cursor-pointer w-4 h-4"
              />
            </div>

            {/* Sound effects toggle */}
            <div className="flex items-center justify-between">
              <div className="flex flex-col">
                <span className="text-xs font-semibold text-zinc-200">Audio Feedback Beeps</span>
                <span className="text-[9px] text-zinc-500">Play a subtle beep on hotkey fires</span>
              </div>
              <input
                type="checkbox"
                checked={settings.enableSoundEffects}
                onChange={(e) => updateSetting('enableSoundEffects', e.target.checked)}
                className="accent-jadu-500 cursor-pointer w-4 h-4"
              />
            </div>

            {/* Visual notification toggle */}
            <div className="flex items-center justify-between">
              <div className="flex flex-col">
                <span className="text-xs font-semibold text-zinc-200">Toast Notifications</span>
                <span className="text-[9px] text-zinc-500">Show visual toast popup on trigger</span>
              </div>
              <input
                type="checkbox"
                checked={settings.enableToastNotifications}
                onChange={(e) => updateSetting('enableToastNotifications', e.target.checked)}
                className="accent-jadu-500 cursor-pointer w-4 h-4"
              />
            </div>
          </div>
        )}
      </main>

      {/* Footer copyright and actions */}
      <footer className="border-t border-white/10 px-4 py-2 flex items-center justify-between bg-white/[0.01] text-[10px] text-zinc-500 font-semibold">
        <span>Version 1.0.0</span>
        <button 
          onClick={openDashboard} 
          className="text-accent-fuchsia hover:text-jadu-400 transition-colors"
        >
          Manage All Shortcuts →
        </button>
      </footer>
    </div>
  );
}
