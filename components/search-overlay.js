import { appState } from 'store/app-state.js';
import { search } from 'db/search.js';
import { formatRelative } from 'utils/date.js';
import { getAllDemos } from 'db/demos.js';
import { t } from 'utils/i18n.js';
import { icon } from 'utils/icons.js';

export class SearchView {
  constructor(container) {
    this.container = container;
    this.query = appState.get('searchQuery') || '';
    this.results = { demos: [], projects: [] };
    this._debounceTimer = null;
    this._localeHandler = () => this.render();
    window.addEventListener('locale-change', this._localeHandler);
    this.render();
    if (this.query) {
      this.doSearch(this.query);
    } else {
      this.loadRecent();
    }
  }

  destroy() {
    window.removeEventListener('locale-change', this._localeHandler);
  }

  render() {
    this.container.innerHTML = `
      <div class="max-w-3xl mx-auto px-6 py-8">
        <!-- Search input -->
        <div class="relative mb-6">
          <span class="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-[var(--color-text-tertiary)] pointer-events-none flex items-center">${icon('magnifying-glass', 'w-5 h-5')}</span>
          <input
            type="text"
            id="main-search-input"
            class="w-full pl-12 pr-12 py-3 text-lg rounded-xl border-2 border-[var(--color-border)] bg-[var(--color-bg-secondary)] focus:border-[var(--color-accent)] focus:outline-none transition-colors"
            placeholder="${escapeAttr(t('search.placeholder'))}"
            autofocus
            value="${escapeAttr(this.query)}"
          />
          <kbd class="absolute right-4 top-1/2 -translate-y-1/2 text-xs bg-[var(--color-bg-tertiary)] border border-[var(--color-border)] rounded px-1.5 py-0.5 font-mono text-[var(--color-text-tertiary)]">${escapeHtml(t('search.shortcut_hint'))}</kbd>
        </div>

        <!-- Results container -->
        <div id="search-results">
          <div class="text-center py-12 text-[var(--color-text-tertiary)]">
            <span class="w-12 h-12 mx-auto mb-3 opacity-40 flex justify-center">${icon('magnifying-glass', 'w-12 h-12')}</span>
            <p>输入关键词开始搜索</p>
          </div>
        </div>
      </div>
    `;

    const input = this.container.querySelector('#main-search-input');

    input.addEventListener('input', (e) => {
      const q = e.target.value;
      this.query = q;
      clearTimeout(this._debounceTimer);
      this._debounceTimer = setTimeout(() => {
        const encoded = encodeURIComponent(q);
        appState.navigate(q ? `#/search?q=${encoded}` : '#/search');
        if (q) {
          this.doSearch(q);
        } else {
          this.loadRecent();
        }
      }, 200);
    });

    input.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        appState.navigate('#/');
      }
    });

    // Focus the input
    requestAnimationFrame(() => input.focus());
  }

  async doSearch(query) {
    const resultsEl = this.container.querySelector('#search-results');
    if (!resultsEl) return;

    resultsEl.innerHTML = `
      <div class="text-center py-8 text-[var(--color-text-tertiary)]">
        <div class="inline-block w-5 h-5 border-2 border-[var(--color-accent)] border-t-transparent rounded-full animate-spin mb-2"></div>
        <p class="text-sm">${escapeHtml(t('common.loading'))}</p>
      </div>
    `;

    try {
      const results = await search(query);
      this.results = results;
      this.renderResults(query, results);
    } catch (err) {
      resultsEl.innerHTML = `<p class="text-center py-8 text-[var(--color-text-secondary)]">搜索失败，请重试</p>`;
    }
  }

  async loadRecent() {
    const resultsEl = this.container.querySelector('#search-results');
    if (!resultsEl) return;

    try {
      const allDemos = await getAllDemos();
      const recent = allDemos.slice(0, 5);

      if (recent.length === 0) {
        resultsEl.innerHTML = `
          <div class="text-center py-12 text-[var(--color-text-tertiary)]">
            <span class="w-12 h-12 mx-auto mb-3 opacity-40 flex justify-center">${icon('file-code', 'w-12 h-12')}</span>
            <p>暂无 Demo，快去新建一个吧</p>
          </div>
        `;
        return;
      }

      resultsEl.innerHTML = `
        <div>
          <h2 class="text-xs font-semibold text-[var(--color-text-tertiary)] uppercase tracking-wider mb-3">${escapeHtml(t('search.recent'))}</h2>
          <div class="space-y-1">
            ${recent.map((demo) => this.renderDemoItem(demo, '')).join('')}
          </div>
        </div>
      `;
    } catch (err) {
      resultsEl.innerHTML = '';
    }
  }

  renderResults(query, results) {
    const resultsEl = this.container.querySelector('#search-results');
    if (!resultsEl) return;

    const { demos = [], projects = [] } = results;
    const totalCount = demos.length + projects.length;

    if (totalCount === 0) {
      resultsEl.innerHTML = `
        <div class="text-center py-12">
          <span class="w-12 h-12 mx-auto mb-3 text-[var(--color-text-tertiary)] opacity-40 flex justify-center">${icon('magnifying-glass', 'w-12 h-12')}</span>
          <p class="text-[var(--color-text-secondary)] mb-1">${escapeHtml(t('search.empty'))}</p>
          <p class="text-sm text-[var(--color-text-tertiary)]">${escapeHtml(t('search.empty.hint'))} "<strong>${escapeHtml(query)}</strong>"</p>
        </div>
      `;
      return;
    }

    let html = '';

    if (demos.length > 0) {
      html += `
        <div class="mb-6">
          <h2 class="text-xs font-semibold text-[var(--color-text-tertiary)] uppercase tracking-wider mb-3">${escapeHtml(t('search.demos_section'))} (${demos.length})</h2>
          <div class="space-y-1">
            ${demos.map((demo) => this.renderDemoItem(demo, query)).join('')}
          </div>
        </div>
      `;
    }

    if (projects.length > 0) {
      html += `
        <div class="mb-6">
          <h2 class="text-xs font-semibold text-[var(--color-text-tertiary)] uppercase tracking-wider mb-3">${escapeHtml(t('search.projects_section'))} (${projects.length})</h2>
          <div class="space-y-1">
            ${projects.map((project) => this.renderProjectItem(project, query)).join('')}
          </div>
        </div>
      `;
    }

    resultsEl.innerHTML = html;
  }

  renderDemoItem(demo, query) {
    const title = query
      ? highlightText(demo.title || '未命名', query)
      : escapeHtml(demo.title || '未命名');
    const snippet = demo.notes
      ? escapeHtml(demo.notes.slice(0, 80)) + (demo.notes.length > 80 ? '…' : '')
      : '';
    const tags = (demo.tags || [])
      .map(
        (t) =>
          `<span class="inline-block text-xs px-1.5 py-0.5 rounded bg-[var(--color-bg-tertiary)] text-[var(--color-text-secondary)]">${escapeHtml(t)}</span>`
      )
      .join(' ');
    const time = demo.updatedAt ? formatRelative(demo.updatedAt) : '';

    return `
      <a href="#/demos/${escapeAttr(demo.id)}"
         class="flex items-start gap-3 px-3 py-2.5 rounded-lg hover:bg-[var(--color-bg-hover)] transition-colors group">
        <span class="mt-0.5 shrink-0 text-[var(--color-text-tertiary)]">${icon('file-code', 'w-4 h-4')}</span>
        <div class="flex-1 min-w-0">
          <div class="font-medium text-sm text-[var(--color-text-primary)] truncate">${title}</div>
          ${snippet ? `<div class="text-xs text-[var(--color-text-secondary)] mt-0.5 line-clamp-1">${snippet}</div>` : ''}
          ${tags ? `<div class="flex flex-wrap gap-1 mt-1">${tags}</div>` : ''}
        </div>
        ${time ? `<span class="text-xs text-[var(--color-text-tertiary)] shrink-0 mt-0.5">${escapeHtml(time)}</span>` : ''}
      </a>
    `;
  }

  renderProjectItem(project, query) {
    const title = query
      ? highlightText(project.title || '未命名项目', query)
      : escapeHtml(project.title || '未命名项目');
    const snippet = project.notes
      ? escapeHtml(project.notes.slice(0, 80)) + (project.notes.length > 80 ? '…' : '')
      : '';
    const tags = (project.tags || [])
      .map(
        (t) =>
          `<span class="inline-block text-xs px-1.5 py-0.5 rounded bg-[var(--color-bg-tertiary)] text-[var(--color-text-secondary)]">${escapeHtml(t)}</span>`
      )
      .join(' ');
    const time = project.updatedAt ? formatRelative(project.updatedAt) : '';
    const accentStyle = project.color ? `style="color:${escapeAttr(project.color)}"` : '';

    return `
      <a href="#/projects/${escapeAttr(project.id)}"
         class="flex items-start gap-3 px-3 py-2.5 rounded-lg hover:bg-[var(--color-bg-hover)] transition-colors group">
        <span class="mt-0.5 shrink-0 text-[var(--color-accent)]" ${accentStyle}>${icon('folder', 'w-4 h-4')}</span>
        <div class="flex-1 min-w-0">
          <div class="font-medium text-sm text-[var(--color-text-primary)] truncate">${title}</div>
          ${snippet ? `<div class="text-xs text-[var(--color-text-secondary)] mt-0.5 line-clamp-1">${snippet}</div>` : ''}
          ${tags ? `<div class="flex flex-wrap gap-1 mt-1">${tags}</div>` : ''}
        </div>
        ${time ? `<span class="text-xs text-[var(--color-text-tertiary)] shrink-0 mt-0.5">${escapeHtml(time)}</span>` : ''}
      </a>
    `;
  }
}

function escapeHtml(str) {
  return String(str || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function escapeAttr(str) {
  return String(str || '')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function highlightText(text, query) {
  if (!query) return escapeHtml(text);
  const escaped = escapeHtml(text);
  const escapedQuery = query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return escaped.replace(
    new RegExp(`(${escapedQuery})`, 'gi'),
    '<mark class="bg-[var(--color-accent-subtle)] text-[var(--color-accent)] rounded px-0.5">$1</mark>'
  );
}
