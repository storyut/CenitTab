# ✦ Cenit New Tab

A highly customizable browser new tab extension designed to transform your default new tab page into a beautiful, productivity-focused workspace.

Cenit combines elegant aesthetics with practical widgets, allowing you to create a personalized dashboard that fits your workflow.

![Version](https://img.shields.io/badge/version-1.2-gold)
![Manifest](https://img.shields.io/badge/Manifest-v3-blue)
![License](https://img.shields.io/badge/license-MIT-green)

---

## ✨ Features

### 🕒 Elegant Clock

* Real-time clock display
* 12-hour and 24-hour formats
* Optional AM/PM indicator
* Dynamic time-based greetings
* Date display with ordinal formatting
* Customizable clock fonts

---

### 🎨 Fully Customizable Backgrounds

Choose the look that matches your style:

#### Preset Gradient Themes

Built-in curated gradient backgrounds.

#### Custom Image Backgrounds

* Upload local images
* Drag-and-drop support
* Persistent storage

#### Background Effects

* Adjustable overlay darkness
* Adjustable blur amount
* Instant live preview

---

### 📚 Bookmark Dashboard

Create a personalized quick-access bar.

Features include:

* Add bookmarks
* Edit existing bookmarks
* Delete bookmarks
* Drag-and-drop reordering
* Automatic favicon fetching
* Persistent local storage

Perfect for:

* Frequently used websites
* Development tools
* Study resources
* Social platforms

---

### 📜 Recently Visited Widget

Quickly access your browsing history.

Features:

* Configurable item count
* Displays recent websites
* Shows page titles
* Shows website domains
* Updates automatically

Requires History permission.

---

### 🎵 Media Activity Widget

Monitor currently playing browser media.

Displays:

* Active media tab title
* Source website
* Real-time updates

Useful for:

* Spotify Web Player
* YouTube
* Twitch
* Music streaming services

Requires Tabs permission.

---

### 📝 Sticky Notes Widget

Built-in markdown-powered note taking.

Supported formatting:

* **Bold**
* *Italic*
* `Inline Code`
* Hyperlinks
* Multi-line notes

Features:

* Live preview
* Save notes locally
* Clear notes instantly
* Persistent storage

---

### 🖱 Draggable Widgets

Every widget can be freely repositioned.

Features:

* Drag-and-drop placement
* Layout editing mode
* Position persistence
* Responsive positioning
* Visual drag indicators

Available widgets:

* Clock
* Bookmarks
* Recently Visited
* Media
* Sticky Notes

---

### 👁 Widget Visibility Controls

Toggle widgets individually.

Hide or show:

* Clock
* Bookmarks
* Recently Visited
* Media

Create a minimal workspace or a fully featured dashboard.

---

### 🎭 Layout Profiles

Save multiple workspace configurations.

Examples:

#### Productivity Layout

* Clock centered
* Notes visible
* Recent sites enabled

#### Minimal Layout

* Clock only
* Clean background

#### Development Layout

* Bookmarks expanded
* Notes visible
* Recent history enabled

Features:

* Save profiles
* Load profiles
* Delete profiles
* Switch instantly

---

### 🔤 Font Customization

Personalize typography across the extension.

Built-in fonts include:

* Cormorant Garamond
* DM Mono
* Playfair Display
* Space Mono
* Josefin Sans
* Cinzel
* Raleway
* IBM Plex Mono

Additional features:

* Import Google Fonts
* Separate Clock and UI fonts
* Live font preview

---

### 🏷 Brand Visibility Toggle

Prefer a cleaner interface?

Hide or show the Cenit brand label anytime.

---

## 📦 Installation

1. Download or clone this repository.

```bash
git clone https://github.com/yourusername/cenit-new-tab.git
```

2. Open Chrome or any Chromium-based browser.

3. Navigate to:

```text
chrome://extensions
```

4. Enable:

```text
Developer Mode
```

5. Click:

```text
Load Unpacked
```

6. Select the project folder.

7. Open a new tab.

Done.

---

## 🔒 Permissions

### Storage

Used to save:

* Layouts
* Profiles
* Notes
* Fonts
* Settings
* Background preferences

### Bookmarks

Used for bookmark management.

### History

Used by the Recently Visited widget.

### Tabs

Used by the Media widget to detect active media playback.

---

## 🏗 Project Structure

```text
cenit-new-tab/
│
├── manifest.json
├── newtab.html
├── style.css
├── src/
│   ├── main.js              # Entry point + core orchestration
│   ├── core/                # Pure logic shared by runtime + tests
│   │   ├── migrations.js
│   │   ├── import-validation.js
│   │   ├── url-normalization.js
│   │   ├── widget-presets.js
│   │   ├── widget-dock.js
│   │   ├── settings-sections.js
│   │   └── command-palette.js
│   ├── shared/              # Cross-cutting utilities
│   │   ├── storage.js
│   │   └── ui.js
│   └── features/            # Self-contained feature modules
│       ├── clock/clock.js
│       ├── notes/notes.js
│       ├── search/search.js
│       ├── background/background.js
│       ├── fonts/fonts.js
│       └── bookmarks/bookmarks.js
├── tests/
│   ├── unit/                # Vitest unit tests
│   ├── e2e/                 # Playwright end-to-end tests
│   └── helpers/             # Re-exports from src/core (no duplication)
├── icons/
│   ├── icon16.png
│   ├── icon48.png
│   └── icon128.png
└── README.md
```

---

## ⚙ Technical Highlights

### Browser APIs

* chrome.storage
* chrome.history
* chrome.tabs

### Frontend

* HTML5
* CSS3
* Vanilla JavaScript (ES Modules)

### Architecture

* No frameworks
* No build step
* Modular ES module architecture (src/core, src/shared, src/features)
* Single source of truth: runtime and tests share the same core modules
* Dependency injection pattern for feature modules
* Lightweight
* Fast startup
* Persistent local configuration

---

## 🧪 Testing

```bash
npm test          # Run unit tests (Vitest)
npm run test:e2e  # Run end-to-end tests (Playwright)
npm run test:all  # Run both
```

Unit tests import shared logic directly from `src/core/*`, ensuring runtime
and tests never drift apart.

---

## 💾 Data Storage

All user preferences are stored locally using browser storage.

Stored settings include:

* Widget positions
* Layout profiles
* Bookmarks
* Sticky notes
* Backgrounds
* Fonts
* Visibility preferences
* Clock settings

No external servers are used.

---

## 🚀 Roadmap

Planned future features:

### Widgets

* Weather widget
* Calendar widget
* Pomodoro timer
* To-do list
* RSS feeds
* Quick search bar

### Customization

* Theme marketplace
* More animations
* Additional widget styles
* Widget resizing

### Productivity

* Keyboard shortcuts
* Focus mode
* Daily goals
* Habit tracker

### Sync

* Cloud profile sync
* Import / Export layouts

---

## 🤝 Contributing

Contributions are welcome.

Possible areas:

* New widgets
* UI improvements
* Performance optimization
* Accessibility enhancements
* Bug fixes

Feel free to submit an issue or pull request.

---

## 📄 License

This project is licensed under the MIT License.

---

## ❤️ About

Cenit was built to make every new tab feel intentional.

Instead of opening an empty page, open a workspace tailored to your habits, preferences, and daily workflow.
