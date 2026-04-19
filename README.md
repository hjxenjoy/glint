# Glint ✦

> Capture your sparks of creativity — a browser-native HTML demo manager

**[Live Demo →](https://glint.enjoy666.online)** · [中文文档](README-zh.md)

Glint is a zero-server, zero-install web app for managing, previewing, and editing AI-generated static HTML demos. All data lives in your browser's IndexedDB — no account, no cloud, no lock-in.

## Features

### Demo Management
- **Quick paste** — paste HTML and hit create; `<title>` is auto-extracted as the demo name
- **Drag & drop** — drag one or multiple `.html` files onto the home page to batch-create demos (each HTML gets its own demo); drag mixed files (html + css + images) to bundle them into a single multi-file demo; CSS files are shared to the project when uploading alongside multiple HTMLs
- **Upload** — single file or entire folder upload, entry file auto-detected
- **Multi-select** — select multiple demos in a project view to batch-delete or batch-move them to another project
- **Clone** — one-click deep copy of any demo, including all image assets
- **Export** — download a self-contained HTML file with all assets inlined (ready to share)
- **Delete**

### Preview & Editor (4-tab view)
- **Preview** — sandboxed `srcdoc` iframe (null origin — demo code cannot access parent page data)
- **Device presets** — Mobile (375×667) / Tablet (768×1024) / Laptop (1280×800) / Desktop (1920×1080)
- **Resizable panel** — drag right, bottom, or corner handles to any custom size
- **Code tab** — full-file editor with line numbers + Tab-key indentation (2 spaces)
- **Files tab** — upload / delete text files and binary image assets inline
- **Info tab** — edit notes, assign demo to a project

### Projects & Organisation
- Create, rename, and delete projects; optionally delete all demos when deleting a project
- Click-to-edit project description (auto-saves)
- Demos can belong to a project or stay standalone ("Uncategorised")
- **Project export** — one-click ZIP containing the project and all its demos
- Sidebar project tree is collapsible; supports manual drag-to-reorder projects

### Search & Navigation
- **Global search** — press `/` anywhere; searches title and notes across all demos
- **All Demos view** — keyword filter, sort by updated / created / name, group by project
- Home page combines quick-paste, drag-to-create, and a full recent-demo grid

### Import / Export
- Export everything as **JSON** (human-readable) or **ZIP** (original files preserved)
- Import JSON or ZIP; conflicts show the exact names of colliding items
- Conflict resolution: **Skip** / **Overwrite** / **Import as new records**
- Per-project ZIP export alongside the global export

### System
- **Theme** — Light / Dark / System (flash-of-unstyled-content prevention built in)
- **i18n** — Chinese & English, switch live without reload
- **PWA** — Service Worker caches all shell files; works fully offline
- Storage usage bar + automatic persistence request on first launch
- Pure-browser stack: no server, no build step at runtime

## Live Demo

**[https://glint.enjoy666.online](https://glint.enjoy666.online)**

## Quick Start

No dependencies to install. Serve the directory with any static file server:

```bash
git clone git@github.com:hjxenjoy/glint.git
cd glint

python3 -m http.server 8080
# or: npx serve .
# or: VS Code Live Server extension
```

Open `http://localhost:8080`.

> **Note:** Service Workers require `localhost` or an HTTPS origin.

## Tech Stack

| Technology | Role |
|---|---|
| Vanilla JS (ES2022+ modules) | No build tool, runs directly in the browser |
| IndexedDB | All data (text + base64 images) persisted locally |
| Service Worker | Offline shell cache, PWA support |
| Tailwind CSS v4 | Compiled locally to `styles/tailwind.css` |
| CSS Cascade Layers | Style specificity management |
| Web Crypto API | `crypto.randomUUID()` for IDs |
| fflate | ZIP import/export (dynamically imported on demand) |
| Phosphor Icons | Inline SVG icon set via `utils/icons.js` |

## Project Structure

```
glint/
├── index.html              # App shell (import map, FOUC prevention, SW registration)
├── manifest.json           # PWA manifest
├── sw.js                   # Service Worker (cache-first shell, stale-while-revalidate CDN)
├── styles/
│   ├── tailwind-input.css  # Tailwind source
│   ├── tailwind.css        # Compiled output (committed)
│   ├── theme.css           # Light/dark CSS custom properties
│   ├── layout.css          # App-level layout (sidebar + main split)
│   └── components.css      # Component styles
├── db/                     # IndexedDB data layer
│   ├── connection.js       # DB singleton + upgrade logic
│   ├── projects.js         # Projects CRUD
│   ├── demos.js            # Demos CRUD + clone
│   ├── assets.js           # Binary assets CRUD + clone
│   ├── settings.js         # Key-value settings
│   └── search.js           # In-memory full-text search
├── store/
│   └── app-state.js        # Reactive state + hash router
├── utils/
│   ├── icons.js            # Inline SVG icon helper
│   ├── i18n.js             # zh/en translations
│   ├── file-resolver.js    # File set processing + srcdoc builder
│   ├── zip.js              # fflate wrappers (pack/unpack)
│   ├── base64.js           # File→base64, size helpers
│   ├── date.js             # Relative + full date formatting
│   └── storage-estimate.js # navigator.storage wrappers
├── components/             # 16 UI components
│   ├── app.js              # Root: layout, routing, view mounting
│   ├── sidebar.js          # Project tree + demo list + storage bar
│   ├── header.js           # Top bar: search trigger, theme, settings
│   ├── home-view.js        # Dashboard: quick-paste, drag-drop, recent demos
│   ├── demo-view.js        # 4-tab view: Preview / Code / Files / Info
│   ├── project-view.js     # Project page: demo grid + metadata
│   ├── demo-editor.js      # New demo wizard (paste / upload)
│   ├── preview-panel.js    # Sandboxed iframe + resize + viewport presets
│   ├── search-overlay.js   # Full-screen search results
│   ├── import-export.js    # Settings tabs: import/export/storage/about
│   ├── modal.js            # Generic <dialog>-based modal
│   └── toast.js            # Toast notification stack
└── icons/
    ├── icon-192.png        # PWA icon
    ├── icon-512.png        # PWA icon (maskable)
    └── apple-touch-icon.png
```

## Development

Tailwind CSS must be compiled after editing class names:

```bash
npm install          # install dev dependencies (tailwindcss + prettier)
npm run build:css    # one-off compile
npm run watch:css    # watch mode during development
npm run format       # run prettier
```

A pre-commit hook runs prettier automatically on every commit.

## Data Model

All data is stored in **IndexedDB** (`glint-db`). Binary assets are kept in a separate store so list views never load base64 image data unnecessarily.

| Store | Contents |
|---|---|
| `projects` | Title, notes, timestamps |
| `demos` | Title, notes, entry file name, `files[]` (text content) |
| `assets` | `demoId`, filename, MIME type, base64 data URI, size |
| `settings` | Theme preference, sidebar state |

## Browser Support

Modern browsers only — Chrome 105+, Edge 105+, Firefox 110+, Safari 16+.

## License

MIT
