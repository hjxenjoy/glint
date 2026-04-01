import { appState } from 'store/app-state.js';
import { Header } from 'components/header.js';
import { Sidebar } from 'components/sidebar.js';
import { getSetting } from 'db/settings.js';
import { requestPersistence } from 'utils/storage-estimate.js';
import { toast } from 'components/toast.js';
import { t } from 'utils/i18n.js';

// Lazy-load views to keep initial bundle small
async function loadView(view) {
  switch (view) {
    case 'home':
      return (await import('components/home-view.js')).HomeView;
    case 'all-demos':
      return (await import('components/home-view.js')).AllDemosView;
    case 'project':
      return (await import('components/project-view.js')).ProjectView;
    case 'demo-preview':
      return (await import('components/demo-view.js')).DemoView;
    case 'demo-edit':
      return (await import('components/demo-editor.js')).DemoEditor;
    case 'new-demo':
      return (await import('components/demo-editor.js')).NewDemoView;
    case 'search':
      return (await import('components/search-overlay.js')).SearchView;
    case 'settings':
      return (await import('components/import-export.js')).SettingsView;
    default:
      return (await import('components/home-view.js')).HomeView;
  }
}

class App {
  constructor() {
    this.currentViewInstance = null;
    this.init();
  }

  async init() {
    // Load theme from IDB (already applied from localStorage in FOUC script, but sync with IDB)
    const theme = await getSetting('theme', 'system').catch(() => 'system');
    appState.set('theme', theme);

    // Request persistent storage — warn once if denied
    const persisted = await requestPersistence();
    if (!persisted && !localStorage.getItem('glint-persist-warned')) {
      localStorage.setItem('glint-persist-warned', '1');
      setTimeout(() => {
        toast.warning(t('toast.persist_warning'));
      }, 2000);
    }

    // Build layout
    this.buildLayout();

    // Re-render current view on locale change
    window.addEventListener('locale-change', async () => {
      await this.renderView(appState.get('currentView'));
    });

    // Load SVG sprite
    await this.loadSprite();

    // Listen to view changes
    appState.addEventListener('change', async (e) => {
      if (e.detail.key === 'currentView') {
        await this.renderView(e.detail.value);
      }
      if (e.detail.key === 'sidebarOpen') {
        this.updateSidebarState(e.detail.value);
      }
    });

    // Initial render
    await this.renderView(appState.get('currentView'));

    // Remove loading skeleton
    document.getElementById('app-loading')?.remove();
  }

  buildLayout() {
    const app = document.getElementById('app');
    app.innerHTML = `
      <div class="app-layout" id="app-layout">
        <aside class="app-sidebar" id="sidebar"></aside>
        <div class="app-content">
          <header class="app-header" id="header"></header>
          <main class="app-main" id="main-content"></main>
        </div>
      </div>
    `;

    // Mount persistent components
    new Header(document.getElementById('header'));
    new Sidebar(document.getElementById('sidebar'));

    // Restore sidebar state
    const sidebarOpen = appState.get('sidebarOpen');
    this.updateSidebarState(sidebarOpen);
  }

  async loadSprite() {
    try {
      const res = await fetch('icons/sprite.svg');
      const text = await res.text();
      const div = document.createElement('div');
      div.style.display = 'none';
      div.innerHTML = text;
      document.body.insertBefore(div, document.body.firstChild);
    } catch (e) {
      console.warn('Failed to load icon sprite:', e);
    }
  }

  async renderView(view) {
    const main = document.getElementById('main-content');
    if (!main) return;

    // Show loading state
    main.innerHTML = `
      <div class="flex items-center justify-center h-full">
        <div class="w-8 h-8 border-2 border-[var(--color-accent)] border-t-transparent rounded-full animate-spin"></div>
      </div>
    `;

    try {
      const ViewClass = await loadView(view);
      main.innerHTML = '';
      this.currentViewInstance = new ViewClass(main);
    } catch (e) {
      console.error('Failed to load view:', view, e);
      main.innerHTML = `<div class="flex items-center justify-center h-full text-[var(--color-text-secondary)]">${t('common.error')}</div>`;
    }
  }

  updateSidebarState(open) {
    document.body.classList.toggle('sidebar-open', open);
    document.body.classList.toggle('sidebar-collapsed', !open);
  }
}

document.addEventListener('DOMContentLoaded', () => {
  new App();
});
