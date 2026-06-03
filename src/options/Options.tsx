import React, { useState, useEffect } from 'react';
import { Shortcut, UserSettings, ShortcutAction, ActionType } from '../types';
import { jaduStorage } from '../shared/storage';

const COMMUNITY_PACKS = [
  {
    name: 'Notion Speedrunner Pack',
    domain: 'notion.so',
    author: 'Jadu Team',
    downloads: '12.4k',
    shortcuts: [
      { name: 'Focus Notion Sidebar Search', key: 'ctrl+shift+p', action: 'click', selector: '.notion-sidebar-search-button' },
      { name: 'Toggle Document Sidebar', key: 'ctrl+\\', action: 'click', selector: '.notion-sidebar-toggler' },
      { name: 'Create New Page Button', key: 'alt+n', action: 'click', selector: '.notion-sidebar-new-page-button' }
    ]
  },
  {
    name: 'GitHub Power-User Bundle',
    domain: 'github.com',
    author: 'Linus D.',
    downloads: '8.2k',
    shortcuts: [
      { name: 'Search repositories', key: 's', action: 'focus', selector: 'button.header-search-button' },
      { name: 'Go to Notification Center', key: 'g n', action: 'click', selector: 'a[aria-label="You have unread notifications"]' },
      { name: 'Focus PR Search bar', key: 'alt+f', action: 'focus', selector: 'input#js-issues-search' }
    ]
  },
  {
    name: 'Gmail Inbox Cleaner',
    domain: 'mail.google.com',
    author: 'Sarah Jenkins',
    downloads: '4.8k',
    shortcuts: [
      { name: 'Compose New Email', key: 'c', action: 'click', selector: 'div[role="button"][gh="cm"]' },
      { name: 'Focus Search Box', key: '/', action: 'focus', selector: 'input[name="q"]' },
      { name: 'Select All Conversations', key: 'x', action: 'click', selector: 'div[role="checkbox"][aria-label="Select all"]' }
    ]
  }
];

export default function Options() {
  const [activeTab, setActiveTab] = useState<'catalog' | 'workflow' | 'packs' | 'settings' | 'onboarding' | 'about'>('catalog');
  const [shortcuts, setShortcuts] = useState<Shortcut[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  
  const [settings, setSettings] = useState<UserSettings>({
    isEnabled: true,
    enableVimMode: false,
    enableSoundEffects: true,
    enableToastNotifications: true,
    theme: 'dark'
  });

  // Action Sequence Chainer State
  const [wfName, setWfName] = useState('');
  const [wfKey, setWfKey] = useState('');
  const [wfDomain, setWfDomain] = useState('');
  const [wfSelector, setWfSelector] = useState('');
  const [wfSteps, setWfSteps] = useState<ShortcutAction[]>([
    { type: 'click', params: { delayMs: 150 } }
  ]);

  const loadData = async () => {
    const all = await jaduStorage.getShortcuts();
    const currentSettings = await jaduStorage.getSettings();
    setShortcuts(all);
    setSettings(currentSettings);
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleSaveSettings = async (updates: Partial<UserSettings>) => {
    const updated = { ...settings, ...updates };
    setSettings(updated);
    await jaduStorage.saveSettings(updated);
  };

  const handleDeleteShortcut = async (id: string) => {
    await jaduStorage.deleteShortcut(id);
    loadData();
  };

  const handleToggleShortcut = async (id: string) => {
    const all = [...shortcuts];
    const idx = all.findIndex(s => s.id === id);
    if (idx >= 0) {
      all[idx].isActive = !all[idx].isActive;
      await jaduStorage.set('shortcuts', all);
      setShortcuts(all);
    }
  };

  // Workflow Chainer Step utilities
  const addWorkflowStep = () => {
    setWfSteps(prev => [...prev, { type: 'click', params: { delayMs: 100 } }]);
  };

  const removeWorkflowStep = (idx: number) => {
    setWfSteps(prev => prev.filter((_, i) => i !== idx));
  };

  const updateWorkflowStep = (idx: number, updates: Partial<ShortcutAction>) => {
    setWfSteps(prev => {
      const next = [...prev];
      next[idx] = { ...next[idx], ...updates };
      return next;
    });
  };

  const updateWorkflowStepParams = (idx: number, updates: Partial<ShortcutAction['params']>) => {
    setWfSteps(prev => {
      const next = [...prev];
      next[idx].params = { ...next[idx].params, ...updates } as any;
      return next;
    });
  };

  const handleSaveWorkflow = async () => {
    if (!wfName || !wfKey || !wfDomain || !wfSelector) {
      alert('Please fill out all workflow details.');
      return;
    }

    const tagName = wfSelector.split(/[#.[\]]/)[0] || 'button';
    const workflowShortcut: Shortcut = {
      id: Math.random().toString(36).substring(2, 9),
      name: wfName,
      key: wfKey,
      domain: wfDomain.toLowerCase().replace('www.', ''),
      selector: wfSelector,
      fallbackSelectors: [wfSelector.split(/[#.]/)[0]],
      action: 'sequence',
      actionParams: {
        sequenceSteps: wfSteps
      },
      isActive: true,
      isCustom: true,
      createdAt: Date.now(),
      tagName: tagName.toLowerCase(),
      ariaLabel: wfName
    };

    await jaduStorage.saveShortcut(workflowShortcut);
    loadData();
    
    // Clear form
    setWfName('');
    setWfKey('');
    setWfDomain('');
    setWfSelector('');
    setWfSteps([{ type: 'click', params: { delayMs: 150 } }]);
    setActiveTab('catalog');
  };

  // Community Pack installer
  const installPack = async (pack: typeof COMMUNITY_PACKS[0]) => {
    for (const item of pack.shortcuts) {
      const tagName = item.selector.split(/[#.[\]]/)[0] || 'button';
      const sc: Shortcut = {
        id: Math.random().toString(36).substring(2, 9),
        name: item.name,
        key: item.key,
        domain: pack.domain,
        selector: item.selector,
        fallbackSelectors: [item.selector.split(/[#.]/)[0]],
        action: item.action as ActionType,
        isActive: true,
        isCustom: false,
        createdAt: Date.now(),
        tagName: tagName.toLowerCase(),
        ariaLabel: item.name
      };
      await jaduStorage.saveShortcut(sc);
    }
    loadData();
    alert(`Successfully installed pack "${pack.name}"!`);
  };

  // Database Import/Export utilities
  const exportDatabase = () => {
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify({ shortcuts, settings }));
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute("href", dataStr);
    downloadAnchor.setAttribute("download", `jadu_backup_${Date.now()}.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
  };

  const importDatabase = (e: React.ChangeEvent<HTMLInputElement>) => {
    const fileReader = new FileReader();
    if (e.target.files && e.target.files[0]) {
      fileReader.readAsText(e.target.files[0], "UTF-8");
      fileReader.onload = async (event) => {
        try {
          const parsed = JSON.parse(event.target?.result as string);
          if (parsed.shortcuts && Array.isArray(parsed.shortcuts)) {
            await jaduStorage.set('shortcuts', parsed.shortcuts);
            if (parsed.settings) {
              await jaduStorage.set('settings', parsed.settings);
            }
            loadData();
            alert('Database imported successfully!');
          } else {
            alert('Invalid database format.');
          }
        } catch (err) {
          alert('Failed to parse database file.');
        }
      };
    }
  };

  // Filter shortcuts based on query
  const filteredShortcuts = shortcuts.filter(s =>
    s.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    s.domain.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="flex min-h-screen bg-background text-white font-sans selection:bg-jadu-500/30">
      
      {/* Sidebar Navigation */}
      <aside className="w-[240px] border-r border-white/10 bg-[#09090b]/80 p-5 flex flex-col justify-between">
        <div className="flex flex-col gap-6">
          {/* Extension Title Logo */}
          <div className="flex items-center gap-3">
            <img src="icons/logo256.png" alt="Jadu" className="w-12 h-12 logo-glow" />
            <div>
              <h1 className="text-lg font-bold tracking-wide text-brand-gradient leading-none">Jadu</h1>
              <p className="text-[10px] text-zinc-500 font-medium mt-1">Control Center</p>
            </div>
          </div>

          {/* Nav links */}
          <nav className="flex flex-col gap-1">
            <button
              onClick={() => setActiveTab('catalog')}
              className={`flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs font-semibold tracking-wide transition-all ${
                activeTab === 'catalog' ? 'bg-accent-fuchsia/10 border border-accent-fuchsia/30 text-jadu-300' : 'text-zinc-400 hover:text-white hover:bg-white/[0.02] border border-transparent'
              }`}
            >
              Shortcuts Catalog
            </button>

            <button
              onClick={() => setActiveTab('workflow')}
              className={`flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs font-semibold tracking-wide transition-all ${
                activeTab === 'workflow' ? 'bg-accent-fuchsia/10 border border-accent-fuchsia/30 text-jadu-300' : 'text-zinc-400 hover:text-white hover:bg-white/[0.02] border border-transparent'
              }`}
            >
              Workflow Chainer (AI)
            </button>

            <button
              onClick={() => setActiveTab('packs')}
              className={`flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs font-semibold tracking-wide transition-all ${
                activeTab === 'packs' ? 'bg-accent-fuchsia/10 border border-accent-fuchsia/30 text-jadu-300' : 'text-zinc-400 hover:text-white hover:bg-white/[0.02] border border-transparent'
              }`}
            >
              Marketplace Packs
            </button>

            <button
              onClick={() => setActiveTab('onboarding')}
              className={`flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs font-semibold tracking-wide transition-all ${
                activeTab === 'onboarding' ? 'bg-accent-fuchsia/10 border border-accent-fuchsia/30 text-jadu-300' : 'text-zinc-400 hover:text-white hover:bg-white/[0.02] border border-transparent'
              }`}
            >
              Tutorial Guide
            </button>

            <button
              onClick={() => setActiveTab('settings')}
              className={`flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs font-semibold tracking-wide transition-all ${
                activeTab === 'settings' ? 'bg-accent-fuchsia/10 border border-accent-fuchsia/30 text-jadu-300' : 'text-zinc-400 hover:text-white hover:bg-white/[0.02] border border-transparent'
              }`}
            >
              Settings & Backup
            </button>

            <button
              onClick={() => setActiveTab('about')}
              className={`flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs font-semibold tracking-wide transition-all ${
                activeTab === 'about' ? 'bg-accent-fuchsia/10 border border-accent-fuchsia/30 text-jadu-300' : 'text-zinc-400 hover:text-white hover:bg-white/[0.02] border border-transparent'
              }`}
            >
              About Jadu
            </button>
          </nav>
        </div>

        <div className="text-[10px] text-zinc-600 font-semibold mt-auto border-t border-white/5 pt-4">
          © 2026 Ciphera · Jadu
        </div>
      </aside>

      {/* Main Console Interface */}
      <main className="flex-1 bg-[#0b0b0e] p-10 overflow-y-auto">
        
        {/* TAB 1: Shortcuts Catalog */}
        {activeTab === 'catalog' && (
          <div className="flex flex-col gap-6">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-xl font-bold tracking-wide text-white">Shortcuts Catalog</h2>
                <p className="text-xs text-zinc-500 font-medium">Manage and search your registered website shortcuts</p>
              </div>

              {/* Search filter bar */}
              <div className="relative w-72">
                <input
                  type="text"
                  placeholder="Search shortcuts..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="bg-white/5 border border-white/10 rounded-xl px-4 py-2 text-xs w-full outline-none focus:border-jadu-500 text-white"
                />
              </div>
            </div>

            {/* List Table */}
            <div className="bg-white/[0.01] border border-white/10 rounded-2xl overflow-hidden shadow-premium">
              <table className="w-full border-collapse text-left">
                <thead>
                  <tr className="border-b border-white/10 bg-white/[0.02] text-[10px] uppercase tracking-wider text-zinc-500 font-bold">
                    <th className="px-6 py-4">Status</th>
                    <th className="px-6 py-4">Shortcut Name</th>
                    <th className="px-6 py-4">Domain</th>
                    <th className="px-6 py-4">Trigger Key</th>
                    <th className="px-6 py-4">Target Action</th>
                    <th className="px-6 py-4">Created</th>
                    <th className="px-6 py-4">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5 text-xs text-zinc-300">
                  {filteredShortcuts.length > 0 ? (
                    filteredShortcuts.map(s => (
                      <tr key={s.id} className="hover:bg-white/[0.01] transition-colors">
                        <td className="px-6 py-4">
                          <input
                            type="checkbox"
                            checked={s.isActive}
                            onChange={() => handleToggleShortcut(s.id)}
                            className="accent-jadu-500 cursor-pointer w-4 h-4"
                          />
                        </td>
                        <td className="px-6 py-4 font-semibold text-white">{s.name}</td>
                        <td className="px-6 py-4 font-mono text-zinc-400">{s.domain}</td>
                        <td className="px-6 py-4">
                          <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-jadu-500/10 border border-jadu-500/20 text-jadu-300">
                            {s.key}
                          </span>
                        </td>
                        <td className="px-6 py-4">
                          <span className={`px-2 py-0.5 rounded text-[9px] font-mono tracking-wide ${
                            s.action === 'sequence' ? 'bg-amber-500/10 text-amber-300 border border-amber-500/20' : 'bg-white/5 text-zinc-300 border border-white/10'
                          }`}>
                            {s.action.toUpperCase()}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-zinc-500 font-medium">
                          {new Date(s.createdAt).toLocaleDateString()}
                        </td>
                        <td className="px-6 py-4">
                          <button
                            onClick={() => handleDeleteShortcut(s.id)}
                            className="text-zinc-500 hover:text-rose-400 transition-colors p-1"
                          >
                            Delete
                          </button>
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={7} className="py-12 text-center text-zinc-500 font-medium">
                        No shortcuts registered yet.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* TAB 2: Workflow Sequence Chainer */}
        {activeTab === 'workflow' && (
          <div className="flex flex-col gap-6 max-w-3xl">
            <div>
              <h2 className="text-xl font-bold tracking-wide text-white">Workflow Sequence Chainer</h2>
              <p className="text-xs text-zinc-500 font-medium">Build complex action sequences with delays to automate website tasks</p>
            </div>

            <div className="bg-white/[0.01] border border-white/10 rounded-2xl p-6 flex flex-col gap-4 shadow-premium">
              {/* Basic configuration */}
              <div className="grid grid-cols-2 gap-4">
                <div className="flex flex-col gap-1.5">
                  <label className="text-[10px] font-bold text-zinc-500 uppercase">Workflow Name</label>
                  <input
                    type="text"
                    value={wfName}
                    onChange={(e) => setWfName(e.target.value)}
                    placeholder="e.g. Automate Feed Posting"
                    className="bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-xs outline-none focus:border-jadu-500 text-white"
                  />
                </div>

                <div className="flex flex-col gap-1.5">
                  <label className="text-[10px] font-bold text-zinc-500 uppercase">Trigger Key Combination</label>
                  <input
                    type="text"
                    value={wfKey}
                    onChange={(e) => setWfKey(e.target.value)}
                    placeholder="e.g. ctrl+shift+y"
                    className="bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-xs outline-none focus:border-jadu-500 text-white font-mono"
                  />
                </div>

                <div className="flex flex-col gap-1.5">
                  <label className="text-[10px] font-bold text-zinc-500 uppercase">Website Scope (Domain)</label>
                  <input
                    type="text"
                    value={wfDomain}
                    onChange={(e) => setWfDomain(e.target.value)}
                    placeholder="e.g. linkedin.com"
                    className="bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-xs outline-none focus:border-jadu-500 text-white"
                  />
                </div>

                <div className="flex flex-col gap-1.5">
                  <label className="text-[10px] font-bold text-zinc-500 uppercase">Core Target Element Selector</label>
                  <input
                    type="text"
                    value={wfSelector}
                    onChange={(e) => setWfSelector(e.target.value)}
                    placeholder="e.g. button.share-box-feed"
                    className="bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-xs outline-none focus:border-jadu-500 text-white font-mono"
                  />
                </div>
              </div>

              {/* Steps Designer */}
              <div className="flex flex-col gap-3 mt-2">
                <div className="flex justify-between items-center">
                  <label className="text-[10px] font-bold text-zinc-500 uppercase">Workflow Steps</label>
                  <button
                    onClick={addWorkflowStep}
                    className="text-[10px] text-jadu-400 hover:text-jadu-350 font-semibold"
                  >
                    + Add Sequence Step
                  </button>
                </div>

                <div className="flex flex-col gap-3">
                  {wfSteps.map((step, idx) => (
                    <div
                      key={idx}
                      className="flex items-center gap-3 bg-white/[0.02] border border-white/5 rounded-xl p-3.5"
                    >
                      <span className="text-[10px] font-mono font-bold text-zinc-500 w-5">#{idx + 1}</span>

                      {/* Step type selector */}
                      <div className="flex flex-col gap-1 flex-1">
                        <span className="text-[9px] text-zinc-500 font-bold uppercase">Action</span>
                        <select
                          value={step.type}
                          onChange={(e) => updateWorkflowStep(idx, { type: e.target.value as any })}
                          className="bg-zinc-900 border border-white/10 rounded-lg px-2 py-1.5 text-xs outline-none text-white w-full"
                        >
                          <option value="click">Trigger Click</option>
                          <option value="focus">Focus Element</option>
                          <option value="scroll">Scroll</option>
                          <option value="text">Insert Text</option>
                        </select>
                      </div>

                      {/* Action Params */}
                      {step.type === 'text' && (
                        <div className="flex flex-col gap-1 flex-[2]">
                          <span className="text-[9px] text-zinc-500 font-bold uppercase">Insert Text Value</span>
                          <input
                            type="text"
                            value={step.params?.textValue || ''}
                            onChange={(e) => updateWorkflowStepParams(idx, { textValue: e.target.value })}
                            placeholder="Boilerplate text..."
                            className="bg-white/5 border border-white/10 rounded-lg px-2 py-1.5 text-xs outline-none text-white w-full"
                          />
                        </div>
                      )}

                      {step.type === 'scroll' && (
                        <div className="flex flex-col gap-1 flex-[2]">
                          <span className="text-[9px] text-zinc-500 font-bold uppercase">Direction</span>
                          <select
                            value={step.params?.scrollDirection || 'down'}
                            onChange={(e) => updateWorkflowStepParams(idx, { scrollDirection: e.target.value as any })}
                            className="bg-zinc-900 border border-white/10 rounded-lg px-2 py-1.5 text-xs outline-none text-white w-full"
                          >
                            <option value="down">Down (300px)</option>
                            <option value="up">Up (300px)</option>
                            <option value="top">Top</option>
                            <option value="bottom">Bottom</option>
                          </select>
                        </div>
                      )}

                      {/* Step Delay */}
                      <div className="flex flex-col gap-1 w-24">
                        <span className="text-[9px] text-zinc-500 font-bold uppercase">Delay (ms)</span>
                        <input
                          type="number"
                          value={step.params?.delayMs || 0}
                          onChange={(e) => updateWorkflowStepParams(idx, { delayMs: parseInt(e.target.value) || 0 })}
                          placeholder="e.g. 150"
                          className="bg-white/5 border border-white/10 rounded-lg px-2 py-1.5 text-xs outline-none text-white w-full text-center"
                        />
                      </div>

                      <button
                        onClick={() => removeWorkflowStep(idx)}
                        disabled={wfSteps.length <= 1}
                        className="text-zinc-500 hover:text-rose-400 disabled:opacity-30 disabled:hover:text-zinc-500 self-end mb-2 transition-colors p-1"
                      >
                        Remove
                      </button>
                    </div>
                  ))}
                </div>
              </div>

              {/* Actions */}
              <div className="flex gap-3 border-t border-white/10 pt-4 mt-2">
                <button
                  onClick={handleSaveWorkflow}
                  className="flex-1 bg-jadu-600 hover:bg-jadu-500 text-white rounded-xl py-3 text-xs font-semibold shadow-glow-purple transition-all"
                >
                  Create Workflow Shortcut
                </button>
              </div>
            </div>
          </div>
        )}

        {/* TAB 3: Community Packs Marketplace */}
        {activeTab === 'packs' && (
          <div className="flex flex-col gap-6">
            <div>
              <h2 className="text-xl font-bold tracking-wide text-white">Community Packs</h2>
              <p className="text-xs text-zinc-500 font-medium">Download pre-made productivity shortcuts curated by the community</p>
            </div>

            <div className="grid grid-cols-3 gap-4">
              {COMMUNITY_PACKS.map((pack, idx) => (
                <div
                  key={idx}
                  className="bg-white/[0.01] border border-white/10 rounded-2xl p-5 flex flex-col justify-between shadow-premium hover:border-white/20 transition-all"
                >
                  <div>
                    <div className="flex justify-between items-center text-[10px] text-zinc-500 font-bold uppercase tracking-wider mb-2">
                      <span>{pack.domain}</span>
                      <span>{pack.downloads} DLs</span>
                    </div>
                    <h3 className="text-sm font-semibold text-white mb-1.5">{pack.name}</h3>
                    <p className="text-[10px] text-zinc-500 font-medium mb-4">Curated by {pack.author}</p>
                    
                    <div className="flex flex-col gap-2 mb-6">
                      {pack.shortcuts.map((sc, i) => (
                        <div key={i} className="flex justify-between text-[11px] text-zinc-400 font-medium">
                          <span>{sc.name}</span>
                          <span className="font-mono text-jadu-300">{sc.key.toUpperCase()}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  <button
                    onClick={() => installPack(pack)}
                    className="w-full bg-white/5 hover:bg-jadu-600 border border-white/10 hover:border-jadu-500 rounded-xl py-2 text-xs font-semibold transition-all hover:text-white"
                  >
                    Install Pack
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* TAB 4: Tutorial Onboarding */}
        {activeTab === 'onboarding' && (
          <div className="flex flex-col gap-6 max-w-3xl">
            <div>
              <h2 className="text-xl font-bold tracking-wide text-white">Jadu Tutorial Guide</h2>
              <p className="text-xs text-zinc-500 font-medium">Everything you need to master Jadu — from first install to advanced workflows</p>
            </div>

            {/* Section 1: Getting Started */}
            <div className="bg-white/[0.01] border border-white/10 rounded-2xl p-6 flex flex-col gap-6 shadow-premium">
              <h3 className="text-sm font-bold text-white tracking-wide flex items-center gap-2">
                <span className="w-6 h-6 rounded-lg bg-jadu-500/15 border border-jadu-500/30 flex items-center justify-center text-jadu-400 text-[10px] font-bold">🚀</span>
                Getting Started
              </h3>

              <div className="flex gap-4">
                <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-jadu-500/10 border border-jadu-500/30 text-jadu-400 font-bold text-sm shrink-0">1</div>
                <div className="flex-1">
                  <h4 className="text-sm font-semibold text-white mb-1">Install the Extension</h4>
                  <p className="text-xs text-zinc-400 font-medium leading-relaxed">
                    Install Jadu from the Chrome Web Store or load it as an unpacked extension from <span className="font-mono text-zinc-300">chrome://extensions</span>. Enable "Developer mode" and click "Load unpacked", then select the <span className="font-mono text-zinc-300">dist/</span> folder.
                  </p>
                </div>
              </div>

              <div className="flex gap-4">
                <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-jadu-500/10 border border-jadu-500/30 text-jadu-400 font-bold text-sm shrink-0">2</div>
                <div className="flex-1">
                  <h4 className="text-sm font-semibold text-white mb-1">Open the Command Palette</h4>
                  <p className="text-xs text-zinc-400 font-medium leading-relaxed">
                    Navigate to any website and press <span className="px-1.5 py-0.5 rounded font-mono bg-white/5 border border-white/10 text-zinc-300">Ctrl+K</span> (Windows/Linux) or <span className="px-1.5 py-0.5 rounded font-mono bg-white/5 border border-white/10 text-zinc-300">Cmd+K</span> (Mac). The Jadu Command Palette will appear as a floating overlay. You can search through existing shortcuts, trigger actions, or access quick settings.
                  </p>
                </div>
              </div>

              <div className="flex gap-4">
                <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-jadu-500/10 border border-jadu-500/30 text-jadu-400 font-bold text-sm shrink-0">3</div>
                <div className="flex-1">
                  <h4 className="text-sm font-semibold text-white mb-1">Pin the Extension</h4>
                  <p className="text-xs text-zinc-400 font-medium leading-relaxed">
                    Click the puzzle icon in the Chrome toolbar and pin Jadu for quick access. The popup panel gives you a snapshot of your registered shortcuts, a direct toggle to enable/disable the extension, and a fast path to the Dashboard.
                  </p>
                </div>
              </div>
            </div>

            {/* Section 2: Creating Shortcuts */}
            <div className="bg-white/[0.01] border border-white/10 rounded-2xl p-6 flex flex-col gap-6 shadow-premium">
              <h3 className="text-sm font-bold text-white tracking-wide flex items-center gap-2">
                <span className="w-6 h-6 rounded-lg bg-accent-emerald/15 border border-accent-emerald/30 flex items-center justify-center text-accent-emerald text-[10px] font-bold">⌨️</span>
                Creating Your First Shortcut
              </h3>

              <div className="flex gap-4">
                <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-accent-emerald/10 border border-accent-emerald/30 text-accent-emerald font-bold text-sm shrink-0">1</div>
                <div className="flex-1">
                  <h4 className="text-sm font-semibold text-white mb-1">Scan the Page for Elements</h4>
                  <p className="text-xs text-zinc-400 font-medium leading-relaxed">
                    Open the Command Palette and type <span className="text-accent-emerald font-semibold">scan</span> or click <span className="text-accent-emerald font-semibold">"Scan DOM for Elements"</span>. Jadu will intelligently scan the current page and identify interactive elements — buttons, inputs, links, toggles, nav items, and more. Each element is ranked by relevance.
                  </p>
                </div>
              </div>

              <div className="flex gap-4">
                <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-accent-emerald/10 border border-accent-emerald/30 text-accent-emerald font-bold text-sm shrink-0">2</div>
                <div className="flex-1">
                  <h4 className="text-sm font-semibold text-white mb-1">Pick an Element Visually</h4>
                  <p className="text-xs text-zinc-400 font-medium leading-relaxed">
                    Alternatively, use the <span className="text-accent-emerald font-semibold">Element Picker</span> mode. Hover your cursor over any element on the page — Jadu will highlight it in real time. Click to select the element and open the Shortcut Builder with its CSS selector pre-filled.
                  </p>
                </div>
              </div>

              <div className="flex gap-4">
                <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-accent-emerald/10 border border-accent-emerald/30 text-accent-emerald font-bold text-sm shrink-0">3</div>
                <div className="flex-1">
                  <h4 className="text-sm font-semibold text-white mb-1">Choose an Action</h4>
                  <p className="text-xs text-zinc-400 font-medium leading-relaxed">
                    In the Shortcut Builder, select what Jadu should do when the shortcut fires:
                  </p>
                  <div className="grid grid-cols-2 gap-2 mt-3 text-[11px] text-zinc-400">
                    <div><span className="text-accent-emerald font-bold font-mono">click</span> — Simulate a mouse click on the element</div>
                    <div><span className="text-accent-emerald font-bold font-mono">focus</span> — Move keyboard focus to the element</div>
                    <div><span className="text-accent-emerald font-bold font-mono">scroll</span> — Scroll the element into view</div>
                    <div><span className="text-accent-emerald font-bold font-mono">text</span> — Insert text into an input field</div>
                  </div>
                </div>
              </div>

              <div className="flex gap-4">
                <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-accent-emerald/10 border border-accent-emerald/30 text-accent-emerald font-bold text-sm shrink-0">4</div>
                <div className="flex-1">
                  <h4 className="text-sm font-semibold text-white mb-1">Record Your Shortcut Key</h4>
                  <p className="text-xs text-zinc-400 font-medium leading-relaxed">
                    Click the "Record Key" button and press your desired key combination (e.g. <span className="px-1.5 py-0.5 rounded font-mono bg-white/5 border border-white/10 text-zinc-300">Alt+S</span>). Jadu records the exact combo and binds it to the selected element. Hit <span className="font-semibold text-white">Save</span> and your shortcut is live immediately — no reload needed!
                  </p>
                </div>
              </div>
            </div>

            {/* Section 3: Advanced Features */}
            <div className="bg-white/[0.01] border border-white/10 rounded-2xl p-6 flex flex-col gap-6 shadow-premium">
              <h3 className="text-sm font-bold text-white tracking-wide flex items-center gap-2">
                <span className="w-6 h-6 rounded-lg bg-accent-violet/15 border border-accent-violet/30 flex items-center justify-center text-accent-violet text-[10px] font-bold">⚡</span>
                Advanced Features
              </h3>

              <div className="flex gap-4">
                <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-accent-violet/10 border border-accent-violet/30 text-accent-violet font-bold text-sm shrink-0">W</div>
                <div className="flex-1">
                  <h4 className="text-sm font-semibold text-white mb-1">Workflow Sequence Chainer</h4>
                  <p className="text-xs text-zinc-400 font-medium leading-relaxed">
                    Go to the <span className="text-accent-violet font-semibold">Workflow Chainer</span> tab in this Dashboard. You can chain multiple actions together — for example, click a button, wait 200ms, focus an input, then insert text. Each step runs sequentially with configurable delays, making it perfect for multi-step automations like posting on social media, filling forms, or navigating complex UIs.
                  </p>
                </div>
              </div>

              <div className="flex gap-4">
                <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-accent-violet/10 border border-accent-violet/30 text-accent-violet font-bold text-sm shrink-0">P</div>
                <div className="flex-1">
                  <h4 className="text-sm font-semibold text-white mb-1">Community Marketplace Packs</h4>
                  <p className="text-xs text-zinc-400 font-medium leading-relaxed">
                    Visit the <span className="text-accent-violet font-semibold">Marketplace Packs</span> tab to browse pre-made shortcut bundles for popular websites like GitHub, Notion, and Gmail. Install a pack with one click to get instant keyboard productivity on those sites.
                  </p>
                </div>
              </div>

              <div className="flex gap-4">
                <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-accent-violet/10 border border-accent-violet/30 text-accent-violet font-bold text-sm shrink-0">B</div>
                <div className="flex-1">
                  <h4 className="text-sm font-semibold text-white mb-1">Backup & Restore</h4>
                  <p className="text-xs text-zinc-400 font-medium leading-relaxed">
                    In <span className="text-accent-violet font-semibold">Settings & Backup</span>, export your entire shortcut database as a JSON file. You can import it later on a new machine or browser profile — your shortcuts and settings travel with you.
                  </p>
                </div>
              </div>
            </div>

            {/* Section 4: Vim Mode */}
            <div className="bg-white/[0.01] border border-white/10 rounded-2xl p-6 flex flex-col gap-6 shadow-premium">
              <h3 className="text-sm font-bold text-white tracking-wide flex items-center gap-2">
                <span className="w-6 h-6 rounded-lg bg-amber-500/15 border border-amber-500/30 flex items-center justify-center text-amber-400 text-[10px] font-bold">V</span>
                Vim Mode Navigation
              </h3>

              <div className="flex gap-4">
                <div className="flex-1">
                  <p className="text-xs text-zinc-400 font-medium leading-relaxed mb-3">
                    Toggle Vim mode from <span className="text-amber-400 font-semibold">Settings</span> or the Command Palette. When active, Jadu intercepts vim-style keys <em>only when no input or textarea is focused</em>, so you can still type normally in forms.
                  </p>
                  <div className="grid grid-cols-2 gap-2 text-[11px] text-zinc-400 font-mono bg-white/[0.02] border border-white/5 rounded-xl p-4">
                    <div><span className="text-amber-400 font-bold">j / k</span> — Scroll page down / up</div>
                    <div><span className="text-amber-400 font-bold">g g / G</span> — Jump to top / bottom</div>
                    <div><span className="text-amber-400 font-bold">d / u</span> — Half-page down / up</div>
                    <div><span className="text-amber-400 font-bold">alt + f</span> — Show link-click hint labels</div>
                    <div><span className="text-amber-400 font-bold">Esc</span> — Close palette / dismiss hints</div>
                    <div><span className="text-amber-400 font-bold">h / l</span> — Scroll left / right (if scrollable)</div>
                  </div>
                </div>
              </div>
            </div>

            {/* Section 5: Tips */}
            <div className="bg-white/[0.01] border border-white/10 rounded-2xl p-6 flex flex-col gap-4 shadow-premium">
              <h3 className="text-sm font-bold text-white tracking-wide flex items-center gap-2">
                <span className="w-6 h-6 rounded-lg bg-jadu-500/15 border border-jadu-500/30 flex items-center justify-center text-jadu-400 text-[10px] font-bold">💡</span>
                Pro Tips
              </h3>
              <ul className="text-xs text-zinc-400 font-medium leading-relaxed flex flex-col gap-2.5 pl-1">
                <li className="flex gap-2"><span className="text-jadu-400">•</span> Use specific CSS selectors (e.g. <span className="font-mono text-zinc-300">#search-btn</span>) for reliable targeting. Avoid generic selectors like <span className="font-mono text-zinc-300">div</span>.</li>
                <li className="flex gap-2"><span className="text-jadu-400">•</span> Shortcuts are domain-scoped — a shortcut on <span className="font-mono text-zinc-300">github.com</span> won't trigger on <span className="font-mono text-zinc-300">notion.so</span>.</li>
                <li className="flex gap-2"><span className="text-jadu-400">•</span> If an element changes after a page update, use the <span className="font-semibold text-white">Element Picker</span> to re-select it and update the selector.</li>
                <li className="flex gap-2"><span className="text-jadu-400">•</span> You can disable individual shortcuts from the <span className="font-semibold text-white">Shortcuts Catalog</span> without deleting them.</li>
                <li className="flex gap-2"><span className="text-jadu-400">•</span> Export your shortcuts regularly. Backups protect against accidental data loss during extension updates.</li>
                <li className="flex gap-2"><span className="text-jadu-400">•</span> Use Workflow Chainer for repetitive multi-step tasks — it's like a personal macro recorder for the web.</li>
              </ul>
            </div>
          </div>
        )}

        {/* TAB 5: Settings & Backup */}
        {activeTab === 'settings' && (
          <div className="flex flex-col gap-6 max-w-2xl">
            <div>
              <h2 className="text-xl font-bold tracking-wide text-white">System Settings</h2>
              <p className="text-xs text-zinc-500 font-medium">Configure global extension properties and backups</p>
            </div>

            <div className="bg-white/[0.01] border border-white/10 rounded-2xl p-6 flex flex-col gap-5 shadow-premium">
              {/* Settings selectors */}
              <div className="flex flex-col gap-4">
                <div className="flex items-center justify-between">
                  <div className="flex flex-col">
                    <span className="text-xs font-semibold">Enable Vim Mode</span>
                    <span className="text-[10px] text-zinc-500 font-medium">Binds Vim navigation (j, k, gg, alt+f hints) globally when inputs are not focused</span>
                  </div>
                  <input
                    type="checkbox"
                    checked={settings.enableVimMode}
                    onChange={(e) => handleSaveSettings({ enableVimMode: e.target.checked })}
                    className="accent-jadu-500 cursor-pointer w-4 h-4"
                  />
                </div>

                <div className="flex items-center justify-between border-t border-white/5 pt-4">
                  <div className="flex flex-col">
                    <span className="text-xs font-semibold">Sound Feedback Effects</span>
                    <span className="text-[10px] text-zinc-500 font-medium">Synthesize audio clicks using Web Audio API upon shortcut triggering</span>
                  </div>
                  <input
                    type="checkbox"
                    checked={settings.enableSoundEffects}
                    onChange={(e) => handleSaveSettings({ enableSoundEffects: e.target.checked })}
                    className="accent-jadu-500 cursor-pointer w-4 h-4"
                  />
                </div>

                <div className="flex items-center justify-between border-t border-white/5 pt-4">
                  <div className="flex flex-col">
                    <span className="text-xs font-semibold">Toast Notifications</span>
                    <span className="text-[10px] text-zinc-500 font-medium">Display slides on the bottom-right corner during command execution</span>
                  </div>
                  <input
                    type="checkbox"
                    checked={settings.enableToastNotifications}
                    onChange={(e) => handleSaveSettings({ enableToastNotifications: e.target.checked })}
                    className="accent-jadu-500 cursor-pointer w-4 h-4"
                  />
                </div>
              </div>

              {/* Database Import/Export backup section */}
              <div className="border-t border-white/10 pt-6 mt-2 flex flex-col gap-3">
                <h3 className="text-xs font-bold text-zinc-500 uppercase tracking-wide">Backup & Sync</h3>
                <p className="text-[10px] text-zinc-500 font-medium">Export all shortcuts configurations as a JSON file or import a previous backup.</p>
                
                <div className="flex items-center gap-3 mt-1">
                  <button
                    onClick={exportDatabase}
                    className="bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl px-4 py-2 text-xs font-semibold text-white transition-all"
                  >
                    Export Database
                  </button>

                  <label className="bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl px-4 py-2 text-xs font-semibold text-white cursor-pointer transition-all">
                    Import Backup JSON
                    <input
                      type="file"
                      accept=".json"
                      onChange={importDatabase}
                      className="hidden"
                    />
                  </label>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* TAB 6: About Jadu */}
        {activeTab === 'about' && (
          <div className="flex flex-col gap-6 max-w-3xl">
            <div>
              <h2 className="text-xl font-bold tracking-wide text-white">About Jadu</h2>
              <p className="text-xs text-zinc-500 font-medium">The story, mission, and people behind Jadu</p>
            </div>

            {/* Hero / Mission */}
            <div className="bg-gradient-to-br from-jadu-700/10 via-accent-fuchsia/5 to-accent-orange/5 border border-accent-fuchsia/20 rounded-2xl p-8 shadow-premium">
              <div className="flex items-center gap-5 mb-5">
                <img src="icons/logo256.png" alt="Jadu" className="w-20 h-20 logo-glow" />
                <div>
                  <h3 className="text-2xl font-extrabold text-brand-gradient tracking-wide">Jadu</h3>
                  <p className="text-xs text-accent-fuchsia font-semibold mt-1">Keyboard Superpowers for the Web</p>
                </div>
              </div>
              <p className="text-sm text-zinc-300 leading-relaxed">
                Jadu is a browser extension that lets you create custom keyboard shortcuts for <strong className="text-white">any element on any website</strong>. No more repetitive mouse-clicking through menus, no more hunting for buttons — just pure keyboard-driven productivity.
              </p>
            </div>

            {/* Why Jadu Exists */}
            <div className="bg-white/[0.01] border border-white/10 rounded-2xl p-6 flex flex-col gap-4 shadow-premium">
              <h3 className="text-sm font-bold text-white tracking-wide">Why Jadu Exists</h3>
              <p className="text-xs text-zinc-400 font-medium leading-relaxed">
                Modern web applications are powerful but often lack proper keyboard shortcuts. Developers, writers, marketers, and knowledge workers spend hours every day clicking the same buttons, navigating the same menus, and performing the same repetitive actions.
              </p>
              <p className="text-xs text-zinc-400 font-medium leading-relaxed">
                Jadu was born from a simple frustration: <span className="text-white font-semibold">why can't we just press a key to do what we want?</span> Instead of waiting for each web app to implement shortcuts (if they ever do), Jadu puts you in control. You pick the element, choose the action, bind a key — and it just works.
              </p>
            </div>

            {/* What Jadu Solves */}
            <div className="bg-white/[0.01] border border-white/10 rounded-2xl p-6 flex flex-col gap-4 shadow-premium">
              <h3 className="text-sm font-bold text-white tracking-wide">What Jadu Solves</h3>
              <div className="grid grid-cols-1 gap-3">
                <div className="flex items-start gap-3 bg-white/[0.02] border border-white/5 rounded-xl p-4">
                  <span className="text-jadu-400 text-sm mt-0.5">✦</span>
                  <div>
                    <span className="text-xs font-semibold text-white">Eliminates Repetitive Clicking</span>
                    <p className="text-[11px] text-zinc-500 font-medium mt-0.5">Stop clicking the same buttons dozens of times a day. Bind them to keys and save hours every week.</p>
                  </div>
                </div>
                <div className="flex items-start gap-3 bg-white/[0.02] border border-white/5 rounded-xl p-4">
                  <span className="text-accent-emerald text-sm mt-0.5">✦</span>
                  <div>
                    <span className="text-xs font-semibold text-white">Works on Any Website</span>
                    <p className="text-[11px] text-zinc-500 font-medium mt-0.5">Unlike built-in shortcuts limited to specific apps, Jadu works universally across every website you visit.</p>
                  </div>
                </div>
                <div className="flex items-start gap-3 bg-white/[0.02] border border-white/5 rounded-xl p-4">
                  <span className="text-accent-violet text-sm mt-0.5">✦</span>
                  <div>
                    <span className="text-xs font-semibold text-white">Automates Multi-Step Workflows</span>
                    <p className="text-[11px] text-zinc-500 font-medium mt-0.5">Chain click → wait → focus → type sequences into a single keybind with the Workflow Chainer.</p>
                  </div>
                </div>
                <div className="flex items-start gap-3 bg-white/[0.02] border border-white/5 rounded-xl p-4">
                  <span className="text-amber-400 text-sm mt-0.5">✦</span>
                  <div>
                    <span className="text-xs font-semibold text-white">Vim-Style Navigation Everywhere</span>
                    <p className="text-[11px] text-zinc-500 font-medium mt-0.5">Power users can navigate any page with j/k scrolling, gg/G jumping, and Alt+F link hints without touching the mouse.</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Features Grid */}
            <div className="bg-white/[0.01] border border-white/10 rounded-2xl p-6 flex flex-col gap-4 shadow-premium">
              <h3 className="text-sm font-bold text-white tracking-wide">Core Features</h3>
              <div className="grid grid-cols-2 gap-3">
                {[
                  { icon: '🎯', title: 'Smart Element Picker', desc: 'Point-and-click to select any DOM element with live highlighting' },
                  { icon: '🔍', title: 'DOM Scanner', desc: 'Automatically scans pages to discover interactive elements ranked by relevance' },
                  { icon: '⌨️', title: 'Custom Keybinds', desc: 'Bind any key combination to any element — click, focus, scroll, or type' },
                  { icon: '🔗', title: 'Workflow Chainer', desc: 'Chain multi-step actions with configurable delays for complex automations' },
                  { icon: '📦', title: 'Marketplace Packs', desc: 'Install pre-made shortcut bundles for popular sites like GitHub and Notion' },
                  { icon: '🎮', title: 'Vim Navigation', desc: 'j/k scrolling, gg/G jump, half-page d/u, and Alt+F interactive link hints' },
                  { icon: '💾', title: 'Backup & Restore', desc: 'Export and import your shortcuts as JSON — portable across machines' },
                  { icon: '🎨', title: 'Command Palette', desc: 'Ctrl+K to search, trigger, and manage shortcuts from a beautiful overlay' },
                ].map((feat, i) => (
                  <div key={i} className="bg-white/[0.02] border border-white/5 rounded-xl p-4 hover:border-white/10 transition-all">
                    <div className="text-base mb-2">{feat.icon}</div>
                    <h4 className="text-xs font-semibold text-white mb-1">{feat.title}</h4>
                    <p className="text-[10px] text-zinc-500 font-medium leading-relaxed">{feat.desc}</p>
                  </div>
                ))}
              </div>
            </div>

            {/* Made by Ciphera */}
            <div className="bg-gradient-to-br from-white/[0.02] to-transparent border border-white/10 rounded-2xl p-6 flex flex-col gap-4 shadow-premium">
              <h3 className="text-sm font-bold text-white tracking-wide">Built by Ciphera</h3>
              <p className="text-xs text-zinc-400 font-medium leading-relaxed">
                Jadu is proudly built by <span className="text-white font-bold">Ciphera</span>, a software startup focused on creating intelligent tools that empower developers and everyday users to work smarter. We believe technology should adapt to people — not the other way around.
              </p>
              <div className="flex items-center gap-4 bg-white/[0.02] border border-white/5 rounded-xl p-5 mt-1">
                <div className="w-11 h-11 rounded-full bg-gradient-to-br from-jadu-700 via-accent-fuchsia to-accent-orange flex items-center justify-center text-white font-bold text-sm border-2 border-accent-fuchsia/30 shadow-glow-brand">
                  Y
                </div>
                <div className="flex-1">
                  <h4 className="text-sm font-semibold text-white">Muhammad Yasir</h4>
                  <p className="text-[11px] text-zinc-500 font-medium">Founder & Lead Developer at Ciphera</p>
                </div>
                <a
                  href="https://www.linkedin.com/in/muhammad-yasir-402a67237"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 bg-[#0A66C2]/10 hover:bg-[#0A66C2]/20 border border-[#0A66C2]/30 hover:border-[#0A66C2]/50 rounded-xl px-4 py-2.5 text-xs font-semibold text-[#0A66C2] transition-all"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4">
                    <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 01-2.063-2.065 2.064 2.064 0 112.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/>
                  </svg>
                  LinkedIn Profile
                </a>
              </div>
              <p className="text-[10px] text-zinc-600 font-medium mt-2">
                Have feedback, suggestions, or want to contribute? Reach out via LinkedIn — we'd love to hear from you.
              </p>
            </div>

            {/* Version */}
            <div className="text-center text-[10px] text-zinc-600 font-semibold pb-4">
              Jadu v1.0.1 · Made with ✨ by Ciphera
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
