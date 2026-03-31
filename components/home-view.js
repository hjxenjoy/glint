import { appState } from 'store/app-state.js';
import { getAllDemos, deleteDemo } from 'db/demos.js';
import { getAllProjects } from 'db/projects.js';
import { deleteAssetsByDemo } from 'db/assets.js';
import { formatRelative } from 'utils/date.js';
import { confirm } from 'components/modal.js';
import { toast } from 'components/toast.js';

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

function demoGradient(id) {
  const hue = parseInt(id.slice(0, 8), 16) % 360;
  return `linear-gradient(135deg, hsl(${hue}, 70%, 60%), hsl(${(hue + 60) % 360}, 70%, 50%))`;
}

function renderDemoCard(demo, projectsMap) {
  const project = demo.projectId ? projectsMap.get(demo.projectId) : null;
  const tags = demo.tags || [];
  const visibleTags = tags.slice(0, 3);
  const extraTags = tags.length - visibleTags.length;
  const gradient = demoGradient(demo.id);

  const tagBadges = visibleTags
    .map(
      (t) =>
        `<span class="inline-block px-1.5 py-0.5 rounded text-[10px] font-medium bg-[var(--color-bg-tertiary)] text-[var(--color-text-secondary)] truncate max-w-[80px]">${escapeHtml(t)}</span>`
    )
    .join('');

  const extraBadge =
    extraTags > 0
      ? `<span class="inline-block px-1.5 py-0.5 rounded text-[10px] font-medium bg-[var(--color-bg-tertiary)] text-[var(--color-text-tertiary)]">+${extraTags}</span>`
      : '';

  const projectBadge = project
    ? `<span class="inline-block px-1.5 py-0.5 rounded text-[10px] font-medium bg-[var(--color-accent)]/15 text-[var(--color-accent)] truncate max-w-[100px]">${escapeHtml(project.title)}</span>`
    : '';

  return `
    <div class="demo-card group relative rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-secondary)] overflow-hidden cursor-pointer hover:border-[var(--color-accent)]/50 hover:shadow-lg transition-all duration-200"
         data-demo-id="${escapeHtml(demo.id)}">
      <!-- Thumbnail -->
      <div class="h-36 w-full" style="background:${gradient}"></div>

      <!-- Card body -->
      <div class="p-3">
        <!-- Project badge -->
        ${projectBadge ? `<div class="mb-1.5">${projectBadge}</div>` : ''}

        <!-- Title -->
        <p class="text-sm font-semibold text-[var(--color-text-primary)] truncate leading-snug mb-1.5">
          ${escapeHtml(demo.title)}
        </p>

        <!-- Tags -->
        ${
          tags.length > 0
            ? `<div class="flex flex-wrap gap-1 mb-2">${tagBadges}${extraBadge}</div>`
            : ''
        }

        <!-- Updated time -->
        <p class="text-[11px] text-[var(--color-text-tertiary)]">${formatRelative(demo.updatedAt)}</p>
      </div>

      <!-- Hover action buttons -->
      <div class="absolute top-2 right-2 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity duration-150">
        <a href="#/demos/${escapeHtml(demo.id)}/edit"
           class="btn btn-icon w-7 h-7 bg-[var(--color-bg-primary)]/90 backdrop-blur-sm border border-[var(--color-border)] hover:border-[var(--color-accent)] shadow-sm"
           title="编辑"
           data-action="edit"
           data-demo-id="${escapeHtml(demo.id)}">
          <svg class="w-3.5 h-3.5"><use href="icons/sprite.svg#icon-pencil"></use></svg>
        </a>
        <button class="btn btn-icon w-7 h-7 bg-[var(--color-bg-primary)]/90 backdrop-blur-sm border border-[var(--color-border)] hover:border-red-400 hover:text-red-400 shadow-sm"
                title="删除"
                data-action="delete"
                data-demo-id="${escapeHtml(demo.id)}">
          <svg class="w-3.5 h-3.5"><use href="icons/sprite.svg#icon-trash"></use></svg>
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
    this.projects = [];
    this._onDataChanged = () => this.loadData();
    appState.addEventListener('data-changed', this._onDataChanged);
    this.init();
  }

  destroy() {
    appState.removeEventListener('data-changed', this._onDataChanged);
  }

  async init() {
    this.renderSkeleton();
    await this.loadData();
  }

  async loadData() {
    const [allDemos, allProjects] = await Promise.all([getAllDemos(), getAllProjects()]);
    this.demos = allDemos.slice(0, 8);
    this.projects = allProjects.slice(0, 4);
    // Build a demo count map per project
    this._projectDemoCount = new Map();
    for (const d of allDemos) {
      if (d.projectId) {
        this._projectDemoCount.set(d.projectId, (this._projectDemoCount.get(d.projectId) || 0) + 1);
      }
    }
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
    const projectsMap = new Map(this.projects.map((p) => [p.id, p]));
    // Use full projects from demos too — build a broader map
    // (projects slice is only 4 but demos may reference others; we only have the top 4 here,
    //  which is fine for badge display)
    const isEmpty = this.demos.length === 0;

    this.container.innerHTML = `
      <div class="p-6 max-w-7xl mx-auto">

        <!-- Page header -->
        <div class="flex items-start justify-between mb-8 gap-4">
          <div>
            <h1 class="text-2xl font-bold text-[var(--color-text-primary)] mb-1">你好，Glint ✦</h1>
            <p class="text-sm text-[var(--color-text-secondary)]">管理和预览你的静态 HTML Demo</p>
          </div>
          <a href="#/demos/new" class="btn btn-primary shrink-0 gap-2">
            <svg class="w-4 h-4"><use href="icons/sprite.svg#icon-plus"></use></svg>
            新建 Demo
          </a>
        </div>

        ${
          isEmpty
            ? this._renderEmptyState()
            : `
          <!-- Recent demos -->
          <section class="mb-10">
            <div class="flex items-center justify-between mb-4">
              <h2 class="text-sm font-semibold text-[var(--color-text-secondary)] uppercase tracking-wider">最近 Demo</h2>
              <a href="#/demos" class="text-xs text-[var(--color-accent)] hover:underline">查看全部</a>
            </div>
            <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4" id="recent-demos-grid">
              ${this.demos.map((d) => renderDemoCard(d, projectsMap)).join('')}
            </div>
          </section>

          ${
            this.projects.length > 0
              ? `
          <!-- Projects section -->
          <section>
            <div class="flex items-center justify-between mb-4">
              <h2 class="text-sm font-semibold text-[var(--color-text-secondary)] uppercase tracking-wider">项目</h2>
              <a href="#/demos/new" class="text-xs text-[var(--color-accent)] hover:underline">新建项目</a>
            </div>
            <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              ${this.projects.map((p) => this._renderProjectCard(p)).join('')}
            </div>
          </section>
          `
              : ''
          }
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
          <svg class="w-8 h-8 text-[var(--color-accent)]"><use href="icons/sprite.svg#icon-sparkles"></use></svg>
        </div>
        <h2 class="text-xl font-semibold text-[var(--color-text-primary)] mb-2">还没有 Demo</h2>
        <p class="text-sm text-[var(--color-text-secondary)] mb-6 max-w-xs">
          粘贴 HTML 代码或上传文件，开始管理你的静态 Demo 作品集。
        </p>
        <a href="#/demos/new" class="btn btn-primary gap-2">
          <svg class="w-4 h-4"><use href="icons/sprite.svg#icon-plus"></use></svg>
          立即新建你的第一个 Demo
        </a>
      </div>
    `;
  }

  _renderProjectCard(project) {
    const demoCount = this._projectDemoCount?.get(project.id) || 0;
    return `
      <a href="#/projects/${escapeHtml(project.id)}"
         class="block rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-secondary)] p-4 hover:border-[var(--color-accent)]/50 hover:shadow-md transition-all duration-200">
        <div class="flex items-start gap-3">
          <div class="w-9 h-9 rounded-lg flex items-center justify-center shrink-0"
               style="background:${project.color ? project.color + '22' : 'var(--color-bg-tertiary)'}">
            <svg class="w-4 h-4" style="color:${project.color || 'var(--color-accent)'}">
              <use href="icons/sprite.svg#icon-folder"></use>
            </svg>
          </div>
          <div class="flex-1 min-w-0">
            <p class="text-sm font-semibold text-[var(--color-text-primary)] truncate">${escapeHtml(project.title)}</p>
            <p class="text-[11px] text-[var(--color-text-tertiary)] mt-0.5">
              ${demoCount} 个 Demo · ${formatRelative(project.updatedAt)}
            </p>
          </div>
        </div>
      </a>
    `;
  }

  _bindEvents() {
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
          title: '删除 Demo',
          message: `确定要删除「${demo?.title || id}」吗？此操作无法撤销。`,
          confirmText: '删除',
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

    // Edit button click — stop propagation so card click doesn't also fire
    this.container.querySelectorAll('[data-action="edit"]').forEach((btn) => {
      btn.addEventListener('click', (e) => e.stopPropagation());
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
    this.filterTag = '';
    this.sortBy = 'updated'; // 'updated' | 'created' | 'title'
    this.groupByProject = false;
    this._onDataChanged = () => this.loadData();
    appState.addEventListener('data-changed', this._onDataChanged);
    this.init();
  }

  destroy() {
    appState.removeEventListener('data-changed', this._onDataChanged);
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
          (d.tags || []).some((t) => t.toLowerCase().includes(q))
      );
    }
    if (this.filterTag) {
      results = results.filter((d) => (d.tags || []).includes(this.filterTag));
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
    // Gather all unique tags from allDemos
    const allTags = [...new Set(this.allDemos.flatMap((d) => d.tags || []))].sort((a, b) =>
      a.localeCompare(b, 'zh')
    );

    this.container.innerHTML = `
      <div class="p-6 max-w-7xl mx-auto">

        <!-- Header -->
        <div class="flex items-start justify-between mb-6 gap-4">
          <div>
            <h1 class="text-2xl font-bold text-[var(--color-text-primary)]">全部 Demo</h1>
            <p class="text-sm text-[var(--color-text-secondary)] mt-0.5">${this.allDemos.length} 个 Demo</p>
          </div>
          <a href="#/demos/new" class="btn btn-primary shrink-0 gap-2">
            <svg class="w-4 h-4"><use href="icons/sprite.svg#icon-plus"></use></svg>
            新建 Demo
          </a>
        </div>

        <!-- Filter bar -->
        <div class="flex flex-wrap items-center gap-2 mb-6">
          <!-- Search -->
          <div class="relative flex-1 min-w-48">
            <svg class="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--color-text-tertiary)] pointer-events-none">
              <use href="icons/sprite.svg#icon-search"></use>
            </svg>
            <input id="filter-search"
                   type="search"
                   placeholder="搜索标题、备注、标签…"
                   value="${escapeHtml(this.filterQuery)}"
                   class="w-full pl-9 pr-3 h-9 rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-secondary)] text-sm text-[var(--color-text-primary)] placeholder:text-[var(--color-text-tertiary)] focus:outline-none focus:border-[var(--color-accent)] transition-colors" />
          </div>

          <!-- Tag filter -->
          ${
            allTags.length > 0
              ? `<select id="filter-tag"
                         class="h-9 px-3 rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-secondary)] text-sm text-[var(--color-text-primary)] focus:outline-none focus:border-[var(--color-accent)] transition-colors cursor-pointer">
                   <option value="">全部标签</option>
                   ${allTags.map((t) => `<option value="${escapeHtml(t)}" ${this.filterTag === t ? 'selected' : ''}>${escapeHtml(t)}</option>`).join('')}
                 </select>`
              : ''
          }

          <!-- Sort -->
          <select id="filter-sort"
                  class="h-9 px-3 rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-secondary)] text-sm text-[var(--color-text-primary)] focus:outline-none focus:border-[var(--color-accent)] transition-colors cursor-pointer">
            <option value="updated" ${this.sortBy === 'updated' ? 'selected' : ''}>最近更新</option>
            <option value="created" ${this.sortBy === 'created' ? 'selected' : ''}>最近创建</option>
            <option value="title"   ${this.sortBy === 'title' ? 'selected' : ''}>名称</option>
          </select>

          <!-- Group by project toggle -->
          <button id="toggle-group"
                  class="h-9 px-3 rounded-lg border text-sm transition-colors gap-2 flex items-center
                         ${this.groupByProject ? 'border-[var(--color-accent)] bg-[var(--color-accent)]/10 text-[var(--color-accent)]' : 'border-[var(--color-border)] bg-[var(--color-bg-secondary)] text-[var(--color-text-secondary)]'}">
            <svg class="w-4 h-4"><use href="icons/sprite.svg#icon-folder"></use></svg>
            按项目分组
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
        key === '__standalone__' ? '独立 Demo' : (this.projectsMap.get(key)?.title ?? '未知项目');

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
    const hasFilters = this.filterQuery || this.filterTag;
    return `
      <div class="flex flex-col items-center justify-center py-20 text-center">
        <div class="w-14 h-14 rounded-2xl bg-[var(--color-bg-tertiary)] flex items-center justify-center mb-4">
          <svg class="w-7 h-7 text-[var(--color-text-tertiary)]"><use href="icons/sprite.svg#icon-${hasFilters ? 'search' : 'sparkles'}"></use></svg>
        </div>
        ${
          hasFilters
            ? `<h2 class="text-base font-semibold text-[var(--color-text-primary)] mb-1">没有匹配的 Demo</h2>
               <p class="text-sm text-[var(--color-text-secondary)]">尝试修改搜索词或清除过滤条件</p>`
            : `<h2 class="text-base font-semibold text-[var(--color-text-primary)] mb-1">还没有 Demo</h2>
               <p class="text-sm text-[var(--color-text-secondary)] mb-5">新建你的第一个 Demo 开始使用吧</p>
               <a href="#/demos/new" class="btn btn-primary gap-2">
                 <svg class="w-4 h-4"><use href="icons/sprite.svg#icon-plus"></use></svg>
                 新建 Demo
               </a>`
        }
      </div>
    `;
  }

  _bindFilterEvents() {
    const searchInput = this.container.querySelector('#filter-search');
    const tagSelect = this.container.querySelector('#filter-tag');
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

    tagSelect?.addEventListener('change', () => {
      this.filterTag = tagSelect.value;
      this.applyFilters();
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
          title: '删除 Demo',
          message: `确定要删除「${demo?.title || id}」吗？此操作无法撤销。`,
          confirmText: '删除',
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
