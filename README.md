# Jadu ⚡
> Keyboard Superpowers for the Web

Jadu is a premium, AI-powered browser extension that puts keyboard-driven productivity at the core of your web experience. By letting you define custom hotkeys and automated workflow macros for **any element on any website**, Jadu eliminates repetitive clicking, speeds up form fills, and streamlines your daily workflows.

---

## ✨ Features

### 🎯 1. Visual Element Picker
* Point-and-click to target any interactive element on a website.
* Real-time highlighting of elements on hover.
* Auto-generates robust CSS selectors and fallback matching arrays.

### 🔍 2. DOM Scanner
* Scans the current page's Document Object Model to identify buttons, inputs, links, and forms.
* Sorts and ranks elements by interactive relevance, letting you instantly bind shortcuts to them from a floating UI.

### ⌨️ 3. Multi-Action Key Bindings
Bind standard hotkeys, modifier combinations (e.g., `Ctrl+Shift+S`, `Alt+N`), or multi-stroke chords (e.g., `g f`) to execute action types:
* `click`: Triggers a mouse click on the target.
* `focus`: Moves focus to an input field, select box, or editor.
* `scroll`: Scrolls the element into view or scrolls the page in any direction.
* `text`: Instantly injects preconfigured boilerplate/template text into text areas.

### 🔗 4. Workflow Chainer (Macro Sequence Automator)
* Chain multiple steps into a single keystroke.
* For example: Click button ➔ Wait 150ms ➔ Focus input ➔ Paste template text.
* Configurable delays (in milliseconds) ensure compatibility with async page loads and animations.

### 📦 5. Community Packs Marketplace
* Pre-made productivity packages curated for popular web apps.
* Install bundles for **Notion**, **GitHub**, and **Gmail** with a single click.

### 🎮 6. Vim Navigation Mode
Power users can traverse any web page using native Vim-style keystrokes (intercepted only when text input fields are unfocused):
* `j` / `k` — Scroll down / up.
* `d` / `u` — Page down / up.
* `g g` / `Shift+G` — Jump to top / bottom of the page.
* `f` — Show interactive letter overlay badges on all links (Vimium-style) for keyboard-only clicking.

### 🎨 7. Command Palette (`Ctrl+K` / `Cmd+K`)
* A Raycast-like command bar that floats over the active page.
* Instantly search through active shortcuts, scan page elements, toggle settings, or trigger actions.

### 💾 8. Settings & Portable Backups
* Toggle sound feedback effects (clicks synthesized via the Web Audio API).
* Enable/disable visual toast notifications for hotkey execution.
* Export your entire shortcut database to a JSON file and import it on any other browser or machine.

---

## 🛠️ Technology Stack

Jadu is built using modern, light, and robust technologies:
* **Core Framework**: React 18 & React DOM
* **Language**: TypeScript
* **Styling**: Vanilla CSS + TailwindCSS (Glassmorphism design tokens)
* **Animation**: Framer Motion
* **Bundler**: Vite (configured for multi-entry build outputs: Popup, Options, Background service worker, and content script injection)
* **Assets**: Sharp (high-performance Node.js image processing for icon generation)

---

## 🚀 Getting Started

### 1. Installation

To run Jadu locally in your browser:

1. Clone the repository:
   ```bash
   git clone https://github.com/YasirAminBrohi/Jadu.git
   cd Jadu
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Build the project:
   ```bash
   npm run build
   ```

4. Load the extension in your browser:
   * Open Chrome and navigate to `chrome://extensions/`.
   * Enable **Developer mode** in the top right.
   * Click **Load unpacked** in the top left.
   * Select the `dist` directory inside the project folder.

---

## 📖 Command Guide

| Action | Shortcut Key | Description |
|---|---|---|
| **Toggle Command Palette** | `Ctrl + K` or `Cmd + K` | Opens the spotlight bar over any web page. |
| **Vim Scroll Down** | `j` | Scrolls down 300px (when inputs aren't focused). |
| **Vim Scroll Up** | `k` | Scrolls up 300px (when inputs aren't focused). |
| **Vim Jump to Top** | `g g` | Scrolls to the top of the page. |
| **Vim Jump to Bottom** | `G` | Scrolls to the bottom of the page. |
| **Vim Link Hints** | `f` | Overlays character badges over links to trigger clicks. |
| **Dismiss Overlays** | `Esc` | Closes command palettes, picker overlays, or hints. |

---

## 📁 Project Structure

```
Jadu/
├── public/                 # Static assets & Manifest configurations
│   ├── icons/              # Generated extension icons (16x16, 48x48, 128x128, 256x256)
│   └── manifest.json       # Web Extension Manifest V3 configuration
├── src/
│   ├── background/         # Service worker background script
│   ├── content/            # Injected content scripts
│   │   ├── dom/            # DOM scanners and selector generators
│   │   ├── keyboard/       # Hotkey routing and execution engine
│   │   └── ui/             # Command palette, hints, builder and toast React UIs
│   ├── options/            # Dashboard & Settings page React app
│   ├── popup/              # Chrome extension action Popup React app
│   ├── shared/             # IndexedDB/Chrome storage utilities
│   ├── types/              # Type definitions
│   └── index.css           # Global custom stylesheet & Tailwind imports
├── tailwind.config.js      # Tailwind configurations & color gradients
├── vite.config.ts          # Main Vite configurations (UI build)
├── vite.config.content.ts  # Vite content script configurations
└── vite.config.background.ts# Vite background script configurations
```

---

## 📝 License

Developed by **Ciphera**. Created with ✨ by Muhammad Yasir.
All rights reserved.
