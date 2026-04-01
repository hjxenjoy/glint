import { appState } from 'store/app-state.js';
import { setSetting } from 'db/settings.js';
import { t, getLocale, setLocale } from 'utils/i18n.js';
import { icon } from 'utils/icons.js';

export class Header {
  constructor(container) {
    this.container = container;
    this._localeHandler = () => this.render();
    window.addEventListener('locale-change', this._localeHandler);
    this.render();
  }

  _themeIconName() {
    const theme = appState.get('theme');
    return theme === 'light' ? 'sun' : theme === 'dark' ? 'moon' : 'monitor';
  }

  render() {
    const themeIconName = this._themeIconName();
    this.container.innerHTML = `
      <button id="sidebar-toggle" class="btn btn-icon btn-ghost" aria-label="${t('header.sidebar.toggle')}">
        ${icon('menu', 'w-5 h-5')}
      </button>

      <a href="#/" class="flex items-center gap-2 font-semibold text-[var(--color-text-primary)] hover:text-[var(--color-accent)] transition-colors no-underline">
        ${icon('sparkle', 'w-6 h-6 text-[var(--color-accent)]')}
        <span class="text-lg tracking-tight">${t('app.name')}</span>
      </a>

      <div class="flex-1 max-w-sm mx-auto">
        <button id="search-trigger" class="w-full flex items-center gap-2 px-3 py-1.5 rounded-lg bg-[var(--color-bg-tertiary)] border border-[var(--color-border)] text-[var(--color-text-tertiary)] text-sm hover:border-[var(--color-accent)] transition-colors cursor-text">
          ${icon('magnifying-glass', 'w-4 h-4 shrink-0')}
          <span>${t('header.search.placeholder')}</span>
          <kbd class="ml-auto text-xs bg-[var(--color-bg-secondary)] border border-[var(--color-border)] rounded px-1 py-0.5 font-mono">/</kbd>
        </button>
      </div>

      <div class="flex items-center gap-1 ml-auto">
        <button id="theme-toggle" class="btn btn-icon btn-ghost" id="theme-btn"
          aria-label="${t('header.theme.system')}" title="${t('header.theme.system')}">
          <span id="theme-icon">${icon(themeIconName, 'w-5 h-5')}</span>
        </button>
        <button id="lang-toggle" class="btn btn-icon btn-ghost text-xs font-medium w-8" title="${t('lang.toggle')}" aria-label="${t('lang.toggle')}">
          ${getLocale() === 'zh' ? 'EN' : '中'}
        </button>
        <a href="#/settings" class="btn btn-icon btn-ghost" aria-label="${t('header.settings')}">
          ${icon('gear', 'w-5 h-5')}
        </a>
      </div>
    `;

    this.bindEvents();
  }

  updateThemeIcon() {
    const name = this._themeIconName();
    const el = this.container.querySelector('#theme-icon');
    if (el) el.innerHTML = icon(name, 'w-5 h-5');

    const theme = appState.get('theme');
    const themeBtn = this.container.querySelector('#theme-toggle');
    if (themeBtn) {
      const titleKey =
        theme === 'light'
          ? 'header.theme.light'
          : theme === 'dark'
            ? 'header.theme.dark'
            : 'header.theme.system';
      const label = t(titleKey);
      themeBtn.title = label;
      themeBtn.setAttribute('aria-label', label);
    }
  }

  bindEvents() {
    this.container.querySelector('#sidebar-toggle')?.addEventListener('click', () => {
      const open = !appState.get('sidebarOpen');
      appState.set('sidebarOpen', open);
      document.body.classList.toggle('sidebar-open', open);
      document.body.classList.toggle('sidebar-collapsed', !open);
    });

    this.container.querySelector('#theme-toggle')?.addEventListener('click', () => {
      const themes = ['system', 'light', 'dark'];
      const current = appState.get('theme');
      const next = themes[(themes.indexOf(current) + 1) % themes.length];
      this.applyTheme(next);
    });

    this.container.querySelector('#lang-toggle')?.addEventListener('click', () => {
      const next = getLocale() === 'zh' ? 'en' : 'zh';
      setLocale(next);
    });

    this.container.querySelector('#search-trigger')?.addEventListener('click', () => {
      appState.navigate('#/search');
    });

    document.addEventListener('keydown', (e) => {
      if (e.key === '/' && !['INPUT', 'TEXTAREA'].includes(document.activeElement.tagName)) {
        e.preventDefault();
        appState.navigate('#/search');
      }
    });
  }

  applyTheme(theme) {
    appState.set('theme', theme);
    localStorage.setItem('glint-theme', theme);
    setSetting('theme', theme).catch(console.error);
    if (
      theme === 'dark' ||
      (theme === 'system' && matchMedia('(prefers-color-scheme: dark)').matches)
    ) {
      document.documentElement.dataset.theme = 'dark';
    } else {
      delete document.documentElement.dataset.theme;
    }
    this.updateThemeIcon();
  }

  destroy() {
    window.removeEventListener('locale-change', this._localeHandler);
  }
}
