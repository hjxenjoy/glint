import { appState } from 'store/app-state.js';
import { getAllDemos, deleteDemo, createDemo, cloneDemo } from 'db/demos.js';
import { getAllProjects } from 'db/projects.js';
import { deleteAssetsByDemo, cloneAssetsByDemo, saveAsset } from 'db/assets.js';
import { resolveFileSet } from 'utils/file-resolver.js';
import { formatRelative } from 'utils/date.js';
import { confirm } from 'components/modal.js';
import { toast } from 'components/toast.js';
import { t } from 'utils/i18n.js';
import { icon } from 'utils/icons.js';

function extractHtmlTitle(html) {
  const match = html.match(/<title[^>]*>([^<]+)<\/title>/i);
  return match ? match[1].trim() : '';
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function escapeHtml(str) {
  return String(str || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/**
 * Render a code-preview thumbnail for a demo card.
 * Shows the first lines of the entry HTML file in a dark code block.
 */
function renderCodeThumb(demo) {
  const entry =
    (demo.files || []).find((f) => f.name === (demo.entryFile || 'index.html')) || demo.files?.[0];

  if (!entry) {
    return `
      <div class="h-36 w-full bg-[var(--color-bg-tertiary)] flex items-center justify-center">
        ${icon('file-code', 'w-8 h-8 text-[var(--color-text-tertiary)] opacity-30')}
      </div>`;
  }

  // First 18 lines, each truncated to 72 chars
  const preview = entry.content
    .split('\n')
    .slice(0, 18)
    .map((l) => l.slice(0, 72))
    .join('\n');

  return `
    <div class="h-36 w-full overflow-hidden bg-[#13151e] relative select-none">
      <pre class="text-[8.5px] leading-[1.5] font-mono p-2.5 text-[#8b9fc8] pointer-events-none whitespace-pre overflow-hidden">${escapeHtml(preview)}</pre>
      <div class="absolute inset-x-0 bottom-0 h-12 bg-gradient-to-t from-[#13151e] to-transparent pointer-events-none"></div>
    </div>`;
}

function renderDemoCard(demo, projectsMap) {
  const project = demo.projectId ? projectsMap.get(demo.projectId) : null;

  const projectBadge = project
    ? `<span class="inline-block px-1.5 py-0.5 rounded text-[10px] font-medium bg-[var(--color-accent)]/15 text-[var(--color-accent)] truncate max-w-[100px]">${escapeHtml(project.title)}</span>`
    : '';

  return `
    <div class="demo-card group relative rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-secondary)] overflow-hidden cursor-pointer hover:border-[var(--color-accent)]/50 hover:shadow-lg transition-all duration-200"
         data-demo-id="${escapeHtml(demo.id)}">
      <!-- Code thumbnail -->
      ${renderCodeThumb(demo)}

      <!-- Card body -->
      <div class="p-3">
        ${projectBadge ? `<div class="mb-1.5">${projectBadge}</div>` : ''}
        <p class="text-sm font-semibold text-[var(--color-text-primary)] truncate leading-snug mb-1">
          ${escapeHtml(demo.title)}
        </p>
        <p class="text-[11px] text-[var(--color-text-tertiary)]">${formatRelative(demo.updatedAt)}</p>
      </div>

      <!-- Hover action buttons -->
      <div class="absolute top-2 right-2 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity duration-150">
        <a href="#/demos/${escapeHtml(demo.id)}/edit"
           class="btn btn-icon w-7 h-7 bg-black/60 backdrop-blur-sm border border-white/10 hover:border-[var(--color-accent)] text-white shadow-sm"
           title="${t('demo.edit')}"
           data-action="edit"
           data-demo-id="${escapeHtml(demo.id)}">
          ${icon('pencil-simple', 'w-3.5 h-3.5')}
        </a>
        <button class="btn btn-icon w-7 h-7 bg-black/60 backdrop-blur-sm border border-white/10 hover:border-[var(--color-accent)] text-white shadow-sm"
                title="${t('demo.clone')}"
                data-action="clone"
                data-demo-id="${escapeHtml(demo.id)}">
          ${icon('copy', 'w-3.5 h-3.5')}
        </button>
        <button class="btn btn-icon w-7 h-7 bg-black/60 backdrop-blur-sm border border-white/10 hover:border-red-400 hover:text-red-400 text-white shadow-sm"
                title="${t('demo.delete')}"
                data-action="delete"
                data-demo-id="${escapeHtml(demo.id)}">
          ${icon('trash', 'w-3.5 h-3.5')}
        </button>
      </div>
    </div>
  `;
}

function renderSkeletonCards(count = 8) {
  return Array.from(
    { length: count },
    () => `
    <div class="rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-secondary)] overflow-hidden animate-pulse">
      <div class="h-36 bg-[var(--color-bg-tertiary)]"></div>
      <div class="p-3 space-y-2">
        <div class="h-3 rounded bg-[var(--color-bg-tertiary)] w-3/4"></div>
        <div class="h-3 rounded bg-[var(--color-bg-tertiary)] w-1/2"></div>
        <div class="h-2.5 rounded bg-[var(--color-bg-tertiary)] w-1/3"></div>
      </div>
    </div>
  `
  ).join('');
}

// ---------------------------------------------------------------------------
// HomeView
// ---------------------------------------------------------------------------

export class HomeView {
  constructor(container) {
    this.container = container;
    this.demos = [];
    this._onDataChanged = () => this.loadData();
    appState.addEventListener('data-changed', this._onDataChanged);
    this._localeHandler = () => this.init();
    window.addEventListener('locale-change', this._localeHandler);
    this.init();
  }

  destroy() {
    appState.removeEventListener('data-changed', this._onDataChanged);
    window.removeEventListener('locale-change', this._localeHandler);
  }

  async init() {
    this.renderSkeleton();
    await this.loadData();
  }

  async loadData() {
    const [allDemos, allProjects] = await Promise.all([getAllDemos(), getAllProjects()]);
    this.demos = allDemos;
    this._projectsMap = new Map(allProjects.map((p) => [p.id, p]));
    this.render();
  }

  renderSkeleton() {
    this.container.innerHTML = `
      <div class="p-6 max-w-7xl mx-auto">
        <!-- Header skeleton -->
        <div class="flex items-start justify-between mb-8 animate-pulse">
          <div class="space-y-2">
            <div class="h-8 rounded bg-[var(--color-bg-tertiary)] w-48"></div>
            <div class="h-4 rounded bg-[var(--color-bg-tertiary)] w-72"></div>
          </div>
          <div class="h-9 rounded-lg bg-[var(--color-bg-tertiary)] w-28"></div>
        </div>
        <!-- Grid skeleton -->
        <div class="h-5 rounded bg-[var(--color-bg-tertiary)] w-24 mb-4 animate-pulse"></div>
        <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          ${renderSkeletonCards(8)}
        </div>
      </div>
    `;
  }

  render() {
    const projectsMap = this._projectsMap || new Map();
    const isEmpty = this.demos.length === 0;

    this.container.innerHTML = `
      <div class="relative p-6 max-w-7xl mx-auto">

        <!-- Drop overlay -->
        <div id="drop-overlay"
             class="hidden absolute inset-0 z-20 flex flex-col items-center justify-center rounded-2xl border-2 border-dashed border-[var(--color-accent)] bg-[var(--color-bg-primary)]/90 backdrop-blur-sm pointer-events-none gap-3">
          ${icon('upload-simple', 'w-12 h-12 text-[var(--color-accent)]')}
          <p class="text-lg font-semibold text-[var(--color-text-primary)]">松开即创建 Demo</p>
          <p class="text-sm text-[var(--color-text-tertiary)]">单个或多个 .html 文件，混合文件自动打包</p>
        </div>

        <!-- Page header -->
        <div class="flex items-start justify-between mb-8 gap-4">
          <div>
            <h1 class="text-2xl font-bold text-[var(--color-text-primary)] mb-1">${t('home.title')} ✦</h1>
            <p class="text-sm text-[var(--color-text-secondary)]">${t('home.subtitle')}</p>
          </div>
          <a href="#/demos/new" class="btn btn-primary shrink-0 gap-2">
            ${icon('plus', 'w-4 h-4')}
            ${t('home.new_demo')}
          </a>
        </div>

        <!-- Quick Paste -->
        <section class="mb-8">
          <div class="rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-secondary)] p-4">
            <div class="flex items-center gap-2 mb-3">
              ${icon('code', 'w-4 h-4 text-[var(--color-accent)]')}
              <span class="text-sm font-medium text-[var(--color-text-primary)]">粘贴 HTML，快速创建 Demo</span>
            </div>
            <textarea id="quick-paste-input"
                      class="w-full h-24 font-mono text-xs bg-[var(--color-bg-tertiary)] rounded-lg border border-[var(--color-border)] outline-none focus:border-[var(--color-accent)] p-3 resize-none transition-colors text-[var(--color-text-secondary)] placeholder:text-[var(--color-text-tertiary)]"
                      placeholder="粘贴 HTML 代码...（自动提取 <title> 作为名称）"
                      spellcheck="false"></textarea>
            <div id="quick-paste-actions" class="hidden mt-2 flex items-center gap-3">
              <button id="quick-create-btn" class="btn btn-primary btn-sm gap-1.5">
                ${icon('plus', 'w-3.5 h-3.5')}
                立即创建
              </button>
              <span id="quick-title-preview" class="text-xs text-[var(--color-text-tertiary)] truncate"></span>
            </div>
          </div>
        </section>

        ${
          isEmpty
            ? this._renderEmptyState()
            : `
          <!-- All demos, sorted by recent -->
          <section>
            <div class="flex items-center justify-between mb-4">
              <h2 class="text-sm font-semibold text-[var(--color-text-secondary)] uppercase tracking-wider">
                ${t('home.recent_demos')}
                <span class="ml-1.5 font-normal normal-case text-[var(--color-text-tertiary)]">(${this.demos.length})</span>
              </h2>
              <a href="#/demos" class="text-xs text-[var(--color-accent)] hover:underline">${t('demos.title')} →</a>
            </div>
            <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4" id="recent-demos-grid">
              ${this.demos.map((d) => renderDemoCard(d, projectsMap)).join('')}
            </div>
          </section>
        `
        }

      </div>
    `;

    this._bindEvents();
  }

  _renderEmptyState() {
    return `
      <div class="flex flex-col items-center justify-center py-24 text-center">
        <div class="w-16 h-16 rounded-2xl bg-[var(--color-accent)]/10 flex items-center justify-center mb-5">
          ${icon('sparkle', 'w-8 h-8 text-[var(--color-accent)]')}
        </div>
        <h2 class="text-xl font-semibold text-[var(--color-text-primary)] mb-2">${t('home.empty.title')}</h2>
        <p class="text-sm text-[var(--color-text-secondary)] mb-6 max-w-xs">
          ${t('home.empty.description')}
        </p>
        <a href="#/demos/new" class="btn btn-primary gap-2">
          ${icon('plus', 'w-4 h-4')}
          ${t('home.empty.cta')}
        </a>
      </div>
    `;
  }

  _bindEvents() {
    // Quick paste widget
    const quickInput = this.container.querySelector('#quick-paste-input');
    const quickActions = this.container.querySelector('#quick-paste-actions');
    const quickCreateBtn = this.container.querySelector('#quick-create-btn');
    const quickTitlePreview = this.container.querySelector('#quick-title-preview');
    let _quickTitle = '';

    quickInput?.addEventListener('input', () => {
      const html = quickInput.value.trim();
      if (html) {
        quickActions.classList.remove('hidden');
        _quickTitle =
          extractHtmlTitle(html) ||
          `未命名 Demo ${new Date().toLocaleString('zh-CN', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' })}`;
        quickTitlePreview.textContent = `"${_quickTitle}"`;
      } else {
        quickActions.classList.add('hidden');
      }
    });

    quickCreateBtn?.addEventListener('click', async () => {
      const html = quickInput.value.trim();
      if (!html) return;
      quickCreateBtn.disabled = true;
      quickCreateBtn.textContent = '创建中...';
      try {
        const demo = await createDemo({
          title: _quickTitle,
          notes: '',
          entryFile: 'index.html',
          files: [{ name: 'index.html', content: html, mimeType: 'text/html' }],
          projectId: null,
        });
        appState.notifyDataChanged('demos');
        appState.navigate(`#/demos/${demo.id}`);
      } catch (err) {
        toast.error('创建失败: ' + err.message);
        quickCreateBtn.disabled = false;
        quickCreateBtn.textContent = '立即创建';
      }
    });

    // Navigate to demo on card click (excluding action buttons)
    this.container.querySelectorAll('.demo-card').forEach((card) => {
      card.addEventListener('click', (e) => {
        if (e.target.closest('[data-action]')) return;
        const id = card.dataset.demoId;
        appState.navigate(`#/demos/${id}`);
      });
    });

    // Delete buttons
    this.container.querySelectorAll('[data-action="delete"]').forEach((btn) => {
      btn.addEventListener('click', async (e) => {
        e.stopPropagation();
        const id = btn.dataset.demoId;
        const demo = this.demos.find((d) => d.id === id);
        const ok = await confirm({
          title: t('demo.delete.confirm.title'),
          message: t('demo.delete.confirm.message', { title: demo?.title || id }),
          confirmText: t('demo.delete'),
          danger: true,
        });
        if (!ok) return;
        try {
          await deleteDemo(id);
          await deleteAssetsByDemo(id);
          appState.notifyDataChanged('demos');
          toast.success('Demo 已删除');
        } catch (err) {
          console.error(err);
          toast.error('删除失败，请重试');
        }
      });
    });

    // Clone buttons
    this.container.querySelectorAll('[data-action="clone"]').forEach((btn) => {
      btn.addEventListener('click', async (e) => {
        e.stopPropagation();
        const id = btn.dataset.demoId;
        try {
          const cloned = await cloneDemo(id);
          await cloneAssetsByDemo(id, cloned.id);
          appState.notifyDataChanged('demos');
          toast.success('Demo 已克隆');
        } catch (err) {
          console.error(err);
          toast.error('克隆失败，请重试');
        }
      });
    });

    // Edit button click — stop propagation so card click doesn't also fire
    this.container.querySelectorAll('[data-action="edit"]').forEach((btn) => {
      btn.addEventListener('click', (e) => e.stopPropagation());
    });

    this._bindDragDrop();
  }

  _bindDragDrop() {
    let dragCounter = 0;
    const overlay = this.container.querySelector('#drop-overlay');
    const showOverlay = () => overlay?.classList.remove('hidden');
    const hideOverlay = () => overlay?.classList.add('hidden');

    this.container.addEventListener('dragenter', (e) => {
      if (!e.dataTransfer?.types.includes('Files')) return;
      e.preventDefault();
      dragCounter++;
      if (dragCounter === 1) showOverlay();
    });

    this.container.addEventListener('dragover', (e) => {
      if (!e.dataTransfer?.types.includes('Files')) return;
      e.preventDefault();
      e.dataTransfer.dropEffect = 'copy';
    });

    this.container.addEventListener('dragleave', () => {
      dragCounter--;
      if (dragCounter <= 0) {
        dragCounter = 0;
        hideOverlay();
      }
    });

    this.container.addEventListener('drop', async (e) => {
      e.preventDefault();
      dragCounter = 0;
      hideOverlay();
      const files = [...(e.dataTransfer?.files || [])];
      if (files.length > 0) await this._handleFileDrop(files);
    });
  }

  async _handleFileDrop(files) {
    const htmlFiles = files.filter((f) => /\.html?$/i.test(f.name));
    const isAllHtml = htmlFiles.length === files.length;

    if (htmlFiles.length === 0) {
      toast.error('请拖入 HTML 文件');
      return;
    }

    if (isAllHtml) {
      // Each HTML file → one separate demo
      const toastMsg =
        files.length > 1 ? `正在创建 ${files.length} 个 Demo...` : '正在创建 Demo...';
      const tid = toast.info(toastMsg);
      try {
        await Promise.all(files.map((f) => this._createDemoFromHtmlFile(f)));
        appState.notifyDataChanged('demos');
        toast.success(files.length > 1 ? `已创建 ${files.length} 个 Demo` : 'Demo 已创建');
      } catch (err) {
        console.error('Drop create error:', err);
        toast.error('创建失败，请重试');
      }
    } else {
      // Mixed files (html + css/images) → one multi-file demo
      try {
        const resolved = await resolveFileSet(files);
        const entryContent =
          resolved.files.find((f) => f.name === resolved.entryFile)?.content || '';
        const title =
          extractHtmlTitle(entryContent) ||
          resolved.entryFile.replace(/\.html?$/i, '') ||
          '拖入的 Demo';
        const demo = await createDemo({
          title,
          entryFile: resolved.entryFile,
          files: resolved.files,
        });
        await Promise.all(resolved.assets.map((a) => saveAsset({ demoId: demo.id, ...a })));
        appState.notifyDataChanged('demos');
        appState.navigate(`#/demos/${demo.id}`);
      } catch (err) {
        console.error('Drop multi-file error:', err);
        toast.error('创建失败：' + (err.message || '未知错误'));
      }
    }
  }

  async _createDemoFromHtmlFile(file) {
    const content = await file.text();
    const title = extractHtmlTitle(content) || file.name.replace(/\.html?$/i, '');
    return createDemo({
      title,
      entryFile: file.name,
      files: [{ name: file.name, content, mimeType: 'text/html' }],
    });
  }
}

// ---------------------------------------------------------------------------
// AllDemosView
// ---------------------------------------------------------------------------

export class AllDemosView {
  constructor(container) {
    this.container = container;
    this.allDemos = [];
    this.allProjects = [];
    this.projectsMap = new Map();
    this.filtered = [];
    this.filterQuery = '';
    this.sortBy = 'updated'; // 'updated' | 'created' | 'title'
    this.groupByProject = false;
    this._onDataChanged = () => this.loadData();
    appState.addEventListener('data-changed', this._onDataChanged);
    this._localeHandler = () => this.init();
    window.addEventListener('locale-change', this._localeHandler);
    this.init();
  }

  destroy() {
    appState.removeEventListener('data-changed', this._onDataChanged);
    window.removeEventListener('locale-change', this._localeHandler);
  }

  async init() {
    this.renderSkeleton();
    await this.loadData();
  }

  async loadData() {
    const [allDemos, allProjects] = await Promise.all([getAllDemos(), getAllProjects()]);
    this.allDemos = allDemos;
    this.allProjects = allProjects;
    this.projectsMap = new Map(allProjects.map((p) => [p.id, p]));
    this._computeFiltered();
    this.render();
  }

  applyFilters() {
    this._computeFiltered();
    this.renderContent();
  }

  _computeFiltered() {
    let results = [...this.allDemos];
    const q = this.filterQuery.trim().toLowerCase();
    if (q) {
      results = results.filter(
        (d) =>
          d.title.toLowerCase().includes(q) ||
          (d.notes || '').toLowerCase().includes(q) ||
          (d.tags || []).some((tag) => tag.toLowerCase().includes(q))
      );
    }
    if (this.sortBy === 'created') {
      results.sort((a, b) => b.createdAt - a.createdAt);
    } else if (this.sortBy === 'title') {
      results.sort((a, b) => a.title.localeCompare(b.title, 'zh'));
    } else {
      results.sort((a, b) => b.updatedAt - a.updatedAt);
    }
    this.filtered = results;
  }

  renderSkeleton() {
    this.container.innerHTML = `
      <div class="p-6 max-w-7xl mx-auto">
        <div class="flex items-center justify-between mb-6 animate-pulse">
          <div class="space-y-2">
            <div class="h-7 rounded bg-[var(--color-bg-tertiary)] w-32"></div>
            <div class="h-4 rounded bg-[var(--color-bg-tertiary)] w-20"></div>
          </div>
          <div class="h-9 rounded-lg bg-[var(--color-bg-tertiary)] w-28"></div>
        </div>
        <div class="h-10 rounded-lg bg-[var(--color-bg-tertiary)] w-full mb-6 animate-pulse"></div>
        <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          ${renderSkeletonCards(12)}
        </div>
      </div>
    `;
  }

  render() {
    this.container.innerHTML = `
      <div class="p-6 max-w-7xl mx-auto">

        <!-- Header -->
        <div class="flex items-start justify-between mb-6 gap-4">
          <div>
            <h1 class="text-2xl font-bold text-[var(--color-text-primary)]">${t('demos.title')}</h1>
            <p class="text-sm text-[var(--color-text-secondary)] mt-0.5">${t('demos.count', { n: this.allDemos.length })}</p>
          </div>
          <a href="#/demos/new" class="btn btn-primary shrink-0 gap-2">
            ${icon('plus', 'w-4 h-4')}
            ${t('demos.all_new_demo')}
          </a>
        </div>

        <!-- Filter bar -->
        <div class="flex flex-wrap items-center gap-2 mb-6">
          <!-- Search -->
          <div class="relative flex-1 min-w-48">
            <span class="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none text-[var(--color-text-tertiary)]">
              ${icon('magnifying-glass', 'w-4 h-4')}
            </span>
            <input id="filter-search"
                   type="search"
                   placeholder="${t('demos.filter.search')}"
                   value="${escapeHtml(this.filterQuery)}"
                   class="w-full pl-9 pr-3 h-9 rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-secondary)] text-sm text-[var(--color-text-primary)] placeholder:text-[var(--color-text-tertiary)] focus:outline-none focus:border-[var(--color-accent)] transition-colors" />
          </div>

          <!-- Sort -->
          <select id="filter-sort"
                  class="h-9 px-3 rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-secondary)] text-sm text-[var(--color-text-primary)] focus:outline-none focus:border-[var(--color-accent)] transition-colors cursor-pointer">
            <option value="updated" ${this.sortBy === 'updated' ? 'selected' : ''}>${t('demos.filter.sort.updated')}</option>
            <option value="created" ${this.sortBy === 'created' ? 'selected' : ''}>${t('demos.filter.sort.created')}</option>
            <option value="title"   ${this.sortBy === 'title' ? 'selected' : ''}>${t('demos.filter.sort.name')}</option>
          </select>

          <!-- Group by project toggle -->
          <button id="toggle-group"
                  class="h-9 px-3 rounded-lg border text-sm transition-colors gap-2 flex items-center
                         ${this.groupByProject ? 'border-[var(--color-accent)] bg-[var(--color-accent)]/10 text-[var(--color-accent)]' : 'border-[var(--color-border)] bg-[var(--color-bg-secondary)] text-[var(--color-text-secondary)]'}">
            ${icon('folder', 'w-4 h-4')}
            ${t('demos.filter.group')}
          </button>
        </div>

        <!-- Demo grid / grouped list -->
        <div id="demos-grid-area">
          <!-- rendered by renderContent() -->
        </div>

      </div>
    `;

    this._bindFilterEvents();
    this.renderContent();
  }

  renderContent() {
    const area = this.container.querySelector('#demos-grid-area');
    if (!area) {
      // Full render not done yet (skeleton), skip
      return;
    }

    if (this.filtered.length === 0) {
      area.innerHTML = this._renderEmptyState();
      return;
    }

    if (this.groupByProject) {
      area.innerHTML = this._renderGrouped();
    } else {
      area.innerHTML = `
        <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          ${this.filtered.map((d) => renderDemoCard(d, this.projectsMap)).join('')}
        </div>
      `;
    }

    this._bindCardEvents(area);
  }

  _renderGrouped() {
    // Group filtered demos by projectId (null = standalone)
    const groups = new Map(); // projectId | '__standalone__' => demo[]
    for (const d of this.filtered) {
      const key = d.projectId || '__standalone__';
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key).push(d);
    }

    let html = '';
    for (const [key, demos] of groups) {
      const label =
        key === '__standalone__'
          ? t('demos.standalone')
          : (this.projectsMap.get(key)?.title ?? '未知项目');

      html += `
        <section class="mb-8">
          <h3 class="text-xs font-semibold text-[var(--color-text-secondary)] uppercase tracking-wider mb-3">${escapeHtml(label)}</h3>
          <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            ${demos.map((d) => renderDemoCard(d, this.projectsMap)).join('')}
          </div>
        </section>
      `;
    }
    return html;
  }

  _renderEmptyState() {
    const hasFilters = !!this.filterQuery;
    return `
      <div class="flex flex-col items-center justify-center py-20 text-center">
        <div class="w-14 h-14 rounded-2xl bg-[var(--color-bg-tertiary)] flex items-center justify-center mb-4">
          ${icon(hasFilters ? 'magnifying-glass' : 'sparkle', 'w-7 h-7 text-[var(--color-text-tertiary)]')}
        </div>
        ${
          hasFilters
            ? `<h2 class="text-base font-semibold text-[var(--color-text-primary)] mb-1">${t('demos.empty.no_match')}</h2>
               <p class="text-sm text-[var(--color-text-secondary)]">${t('demos.empty.clear_filter')}</p>`
            : `<h2 class="text-base font-semibold text-[var(--color-text-primary)] mb-1">${t('demos.empty.no_demos')}</h2>
               <p class="text-sm text-[var(--color-text-secondary)] mb-5">新建你的第一个 Demo 开始使用吧</p>
               <a href="#/demos/new" class="btn btn-primary gap-2">
                 ${icon('plus', 'w-4 h-4')}
                 ${t('demos.all_new_demo')}
               </a>`
        }
      </div>
    `;
  }

  _bindFilterEvents() {
    const searchInput = this.container.querySelector('#filter-search');
    const sortSelect = this.container.querySelector('#filter-sort');
    const groupToggle = this.container.querySelector('#toggle-group');

    let searchDebounce;
    searchInput?.addEventListener('input', () => {
      clearTimeout(searchDebounce);
      searchDebounce = setTimeout(() => {
        this.filterQuery = searchInput.value;
        this.applyFilters();
      }, 180);
    });

    sortSelect?.addEventListener('change', () => {
      this.sortBy = sortSelect.value;
      this.applyFilters();
    });

    groupToggle?.addEventListener('click', () => {
      this.groupByProject = !this.groupByProject;
      // Update button visual
      groupToggle.classList.toggle('border-[var(--color-accent)]', this.groupByProject);
      groupToggle.classList.toggle('bg-[var(--color-accent)]/10', this.groupByProject);
      groupToggle.classList.toggle('text-[var(--color-accent)]', this.groupByProject);
      groupToggle.classList.toggle('border-[var(--color-border)]', !this.groupByProject);
      groupToggle.classList.toggle('bg-[var(--color-bg-secondary)]', !this.groupByProject);
      groupToggle.classList.toggle('text-[var(--color-text-secondary)]', !this.groupByProject);
      this.renderContent();
    });
  }

  _bindCardEvents(root = this.container) {
    root.querySelectorAll('.demo-card').forEach((card) => {
      card.addEventListener('click', (e) => {
        if (e.target.closest('[data-action]')) return;
        const id = card.dataset.demoId;
        appState.navigate(`#/demos/${id}`);
      });
    });

    root.querySelectorAll('[data-action="delete"]').forEach((btn) => {
      btn.addEventListener('click', async (e) => {
        e.stopPropagation();
        const id = btn.dataset.demoId;
        const demo = this.allDemos.find((d) => d.id === id);
        const ok = await confirm({
          title: t('demo.delete.confirm.title'),
          message: t('demo.delete.confirm.message', { title: demo?.title || id }),
          confirmText: t('demo.delete'),
          danger: true,
        });
        if (!ok) return;
        try {
          await deleteDemo(id);
          await deleteAssetsByDemo(id);
          appState.notifyDataChanged('demos');
          toast.success('Demo 已删除');
        } catch (err) {
          console.error(err);
          toast.error('删除失败，请重试');
        }
      });
    });

    root.querySelectorAll('[data-action="clone"]').forEach((btn) => {
      btn.addEventListener('click', async (e) => {
        e.stopPropagation();
        const id = btn.dataset.demoId;
        try {
          const cloned = await cloneDemo(id);
          await cloneAssetsByDemo(id, cloned.id);
          appState.notifyDataChanged('demos');
          toast.success('Demo 已克隆');
        } catch (err) {
          console.error(err);
          toast.error('克隆失败，请重试');
        }
      });
    });

    root.querySelectorAll('[data-action="edit"]').forEach((btn) => {
      btn.addEventListener('click', (e) => e.stopPropagation());
    });
  }

  // Called by the router/app when switching away from this view
  // Re-renders from scratch so filter bar is fresh if data changed while away
  refresh() {
    this.render();
  }
}
