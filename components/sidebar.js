import { appState } from 'store/app-state.js';
import { getAllProjects, createProject, updateProject } from 'db/projects.js';
import { getAllDemos } from 'db/demos.js';
import { getSetting, setSetting } from 'db/settings.js';
import { getStorageEstimate, formatBytes } from 'utils/storage-estimate.js';
import { t } from 'utils/i18n.js';
import { icon } from 'utils/icons.js';
import { Modal } from 'components/modal.js';
import { toast } from 'components/toast.js';

// Sort modes: 'manual' | 'alpha' | 'updated'
const SORT_LABELS = { manual: '手动', alpha: 'A-Z', updated: '最近' };
const SORT_CYCLE = ['manual', 'alpha', 'updated'];

export class Sidebar {
  constructor(container) {
    this.container = container;
    this.projects = [];
    this.demosByProject = new Map();
    this.uncategorizedDemos = [];
    this.collapsedProjects = new Set();
    this.sortMode = 'manual';
    this._dragSrcId = null;

    this._localeHandler = () => {
      this.render();
      this.loadData();
    };
    window.addEventListener('locale-change', this._localeHandler);
    this.render();
    this.loadData();

    appState.addEventListener('data-changed', () => this.loadData());
    appState.addEventListener('change', (e) => {
      if (['currentView', 'selectedDemoId', 'selectedProjectId'].includes(e.detail.key)) {
        this.updateActiveState();
      }
    });
  }

  async loadData() {
    const [projects, allDemos, collapsedRaw, sortMode] = await Promise.all([
      getAllProjects(),
      getAllDemos(),
      getSetting('sidebar-collapsed-projects', []),
      getSetting('sidebar-sort-mode', 'manual'),
    ]);

    this.collapsedProjects = new Set(Array.isArray(collapsedRaw) ? collapsedRaw : []);
    this.sortMode = SORT_CYCLE.includes(sortMode) ? sortMode : 'manual';

    this.projects = this._sortProjects(projects);

    this.demosByProject = new Map();
    this.uncategorizedDemos = [];

    for (const demo of allDemos) {
      if (demo.projectId) {
        if (!this.demosByProject.has(demo.projectId)) {
          this.demosByProject.set(demo.projectId, []);
        }
        this.demosByProject.get(demo.projectId).push(demo);
      } else {
        this.uncategorizedDemos.push(demo);
      }
    }

    for (const demos of this.demosByProject.values()) {
      demos.sort((a, b) => a.title.localeCompare(b.title, 'zh'));
    }
    this.uncategorizedDemos.sort((a, b) => a.title.localeCompare(b.title, 'zh'));

    this.renderContent();
    this.loadStorageInfo();
  }

  _sortProjects(projects) {
    if (this.sortMode === 'alpha') {
      return [...projects].sort((a, b) => a.title.localeCompare(b.title, 'zh'));
    }
    if (this.sortMode === 'updated') {
      return [...projects].sort((a, b) => b.updatedAt - a.updatedAt);
    }
    // 'manual': sort by order field, fallback to updatedAt for projects without order
    return [...projects].sort((a, b) => (a.order ?? a.updatedAt) - (b.order ?? b.updatedAt));
  }

  async loadStorageInfo() {
    const estimate = await getStorageEstimate();
    if (!estimate) return;
    const bar = this.container.querySelector('#storage-bar-fill');
    const label = this.container.querySelector('#storage-label');
    if (bar) bar.style.width = `${Math.min(estimate.percent, 100)}%`;
    if (label)
      label.textContent = `${formatBytes(estimate.usage)} / ${formatBytes(estimate.quota)}`;
  }

  render() {
    this.container.innerHTML = `
      <div class="flex flex-col h-full">
        <div class="p-3 border-b border-[var(--color-border)]">
          <button type="button" id="new-demo-btn" class="btn btn-primary w-full justify-center gap-2">
            ${icon('plus', 'w-4 h-4')}
            ${t('sidebar.new_demo')}
          </button>
        </div>

        <nav class="p-2 border-b border-[var(--color-border)]">
          <a href="#/" class="sidebar-nav-item" data-view="home">
            ${icon('house', 'w-4 h-4')}
            <span>${t('sidebar.home')}</span>
          </a>
          <a href="#/demos" class="sidebar-nav-item" data-view="all-demos">
            ${icon('squares-four', 'w-4 h-4')}
            <span>${t('sidebar.all_demos')}</span>
          </a>
        </nav>

        <div class="flex-1 overflow-y-auto" id="sidebar-content"></div>

        <div class="p-3 border-t border-[var(--color-border)]">
          <div class="flex items-center justify-between mb-1">
            <span class="text-xs text-[var(--color-text-tertiary)]">${t('sidebar.storage')}</span>
            <span class="text-xs text-[var(--color-text-tertiary)]" id="storage-label">-</span>
          </div>
          <div class="h-1.5 rounded-full bg-[var(--color-bg-tertiary)] overflow-hidden">
            <div id="storage-bar-fill" class="h-full bg-[var(--color-accent)] rounded-full transition-all duration-500" style="width:0%"></div>
          </div>
        </div>
      </div>
    `;

    this.container.querySelector('#new-demo-btn')?.addEventListener('click', () => {
      appState.navigate('#/demos/new');
    });

    this.renderContent();
  }

  renderContent() {
    const content = this.container.querySelector('#sidebar-content');
    if (!content) return;

    const nextMode = SORT_CYCLE[(SORT_CYCLE.indexOf(this.sortMode) + 1) % SORT_CYCLE.length];
    const sortLabel = SORT_LABELS[this.sortMode];
    const sortTitle = `当前：按${sortLabel}排序，点击切换为「${SORT_LABELS[nextMode]}」`;

    let html = `
      <div class="p-2">
        <div class="flex items-center justify-between px-2 py-1 mb-1">
          <span class="text-xs font-semibold text-[var(--color-text-tertiary)] uppercase tracking-wider">${t('sidebar.projects')}</span>
          <div class="flex items-center gap-0.5">
            <button type="button" class="btn btn-ghost h-6 px-1.5 rounded text-[10px] font-medium text-[var(--color-text-tertiary)] hover:text-[var(--color-text-primary)]"
                    title="${sortTitle}" id="sort-projects-btn">
              ${sortLabel}
            </button>
            <button type="button" class="btn btn-icon btn-ghost w-7 h-7" title="${t('sidebar.new_project')}" id="new-project-btn">
              ${icon('folder-plus', 'w-3.5 h-3.5')}
            </button>
          </div>
        </div>
    `;

    if (this.projects.length === 0 && this.uncategorizedDemos.length === 0) {
      html += `<p class="text-xs text-[var(--color-text-tertiary)] px-2 py-1">${t('sidebar.no_projects')}</p>`;
    }

    for (const project of this.projects) {
      const demos = this.demosByProject.get(project.id) || [];
      html += this._renderProjectGroup(project, demos);
    }

    if (this.uncategorizedDemos.length > 0) {
      html += `
        <div class="mt-1 pt-1 border-t border-[var(--color-border)]">
          <div class="px-2 py-1 mb-0.5">
            <span class="text-xs font-medium text-[var(--color-text-tertiary)]">${t('project.uncategorized')}</span>
          </div>
          ${this.uncategorizedDemos.map((d) => this._renderDemoItem(d)).join('')}
        </div>
      `;
    }

    html += `</div>`;
    content.innerHTML = html;
    this._bindContentEvents();
    this.updateActiveState();
  }

  _renderProjectGroup(project, demos) {
    const isCollapsed = this.collapsedProjects.has(project.id);
    const isManual = this.sortMode === 'manual';

    return `
      <div class="mb-0.5 project-group" data-project-id="${escapeHtml(project.id)}"
           ${isManual ? 'draggable="true"' : ''}>
        <div class="flex items-center group">
          ${
            isManual
              ? `
            <span class="shrink-0 px-0.5 cursor-grab text-[var(--color-text-tertiary)] opacity-0 group-hover:opacity-60 transition-opacity select-none"
                  title="拖拽排序">
              ${icon('dots-three-vertical', 'w-3.5 h-3.5')}
            </span>
          `
              : ''
          }
          <button type="button"
                  class="collapse-toggle shrink-0 p-1 text-[var(--color-text-tertiary)] hover:text-[var(--color-text-primary)] transition-colors"
                  data-collapse-id="${escapeHtml(project.id)}"
                  title="${isCollapsed ? '展开' : '收起'}">
            ${icon(isCollapsed ? 'caret-right' : 'caret-down', 'w-3 h-3')}
          </button>
          <a href="#/projects/${project.id}"
             class="sidebar-nav-item flex-1 min-w-0"
             data-view="project" data-id="${project.id}">
            ${icon('folder', 'w-4 h-4 text-[var(--color-accent)] shrink-0')}
            <span class="flex-1 truncate text-sm">${escapeHtml(project.title)}</span>
          </a>
        </div>
        ${
          !isCollapsed
            ? `
          <div class="pl-8">
            ${
              demos.length === 0
                ? `<p class="text-xs text-[var(--color-text-tertiary)] px-2 py-0.5">${t('sidebar.no_demos')}</p>`
                : demos.map((d) => this._renderDemoItem(d)).join('')
            }
          </div>
        `
            : ''
        }
      </div>
    `;
  }

  _renderDemoItem(demo) {
    const isActive = appState.get('selectedDemoId') === demo.id;
    return `
      <a href="#/demos/${demo.id}"
         class="sidebar-nav-item text-xs py-1 ${isActive ? 'active' : ''}"
         data-view="demo-preview" data-id="${demo.id}">
        ${icon('file-code', 'w-3.5 h-3.5 shrink-0 text-[var(--color-text-tertiary)]')}
        <span class="flex-1 truncate">${escapeHtml(demo.title)}</span>
      </a>
    `;
  }

  _bindContentEvents() {
    const content = this.container.querySelector('#sidebar-content');

    this.container.querySelector('#new-project-btn')?.addEventListener('click', (e) => {
      e.preventDefault();
      this._openNewProjectModal();
    });

    this.container.querySelector('#sort-projects-btn')?.addEventListener('click', async () => {
      const nextIdx = (SORT_CYCLE.indexOf(this.sortMode) + 1) % SORT_CYCLE.length;
      this.sortMode = SORT_CYCLE[nextIdx];
      await setSetting('sidebar-sort-mode', this.sortMode);
      this.projects = this._sortProjects(this.projects);
      this.renderContent();
    });

    // Collapse toggles
    content?.querySelectorAll('.collapse-toggle').forEach((btn) => {
      btn.addEventListener('click', async (e) => {
        e.preventDefault();
        e.stopPropagation();
        const projectId = btn.dataset.collapseId;
        if (this.collapsedProjects.has(projectId)) {
          this.collapsedProjects.delete(projectId);
        } else {
          this.collapsedProjects.add(projectId);
        }
        await setSetting('sidebar-collapsed-projects', [...this.collapsedProjects]);
        this.renderContent();
      });
    });

    // Drag-to-reorder (only in manual mode)
    if (this.sortMode === 'manual') {
      this._bindDragReorder(content);
    }
  }

  _bindDragReorder(content) {
    if (!content) return;

    content.addEventListener('dragstart', (e) => {
      const group = e.target.closest('.project-group[draggable]');
      if (!group) return;
      this._dragSrcId = group.dataset.projectId;
      e.dataTransfer.effectAllowed = 'move';
      setTimeout(() => group.classList.add('opacity-50'), 0);
    });

    content.addEventListener('dragend', (e) => {
      const group = e.target.closest('.project-group');
      if (group) group.classList.remove('opacity-50');
      content.querySelectorAll('.drag-over-top, .drag-over-bottom').forEach((el) => {
        el.classList.remove('drag-over-top', 'drag-over-bottom');
      });
      this._dragSrcId = null;
    });

    content.addEventListener('dragover', (e) => {
      const group = e.target.closest('.project-group[draggable]');
      if (!group || group.dataset.projectId === this._dragSrcId) return;
      e.preventDefault();
      e.dataTransfer.dropEffect = 'move';
      // Determine if dragging above or below the midpoint
      content.querySelectorAll('.drag-over-top, .drag-over-bottom').forEach((el) => {
        el.classList.remove('drag-over-top', 'drag-over-bottom');
      });
      const rect = group.getBoundingClientRect();
      const mid = rect.top + rect.height / 2;
      group.classList.add(e.clientY < mid ? 'drag-over-top' : 'drag-over-bottom');
    });

    content.addEventListener('dragleave', (e) => {
      const group = e.target.closest('.project-group');
      if (group) {
        group.classList.remove('drag-over-top', 'drag-over-bottom');
      }
    });

    content.addEventListener('drop', async (e) => {
      const group = e.target.closest('.project-group[draggable]');
      if (!group || !this._dragSrcId) return;
      e.preventDefault();
      const targetId = group.dataset.projectId;
      if (targetId === this._dragSrcId) return;

      const rect = group.getBoundingClientRect();
      const insertBefore = e.clientY < rect.top + rect.height / 2;

      group.classList.remove('drag-over-top', 'drag-over-bottom');
      await this._reorderProject(this._dragSrcId, targetId, insertBefore);
    });
  }

  async _reorderProject(draggedId, targetId, insertBefore) {
    const newOrder = [...this.projects];
    const draggedIdx = newOrder.findIndex((p) => p.id === draggedId);
    const targetIdx = newOrder.findIndex((p) => p.id === targetId);
    if (draggedIdx < 0 || targetIdx < 0) return;

    const [moved] = newOrder.splice(draggedIdx, 1);
    const insertAt = newOrder.findIndex((p) => p.id === targetId);
    newOrder.splice(insertBefore ? insertAt : insertAt + 1, 0, moved);

    // Assign sequential order values and persist
    try {
      await Promise.all(newOrder.map((p, i) => updateProject(p.id, { order: i * 10 })));
      this.projects = newOrder;
      this.renderContent();
    } catch (err) {
      console.error('Reorder error:', err);
      toast.error('排序保存失败');
    }
  }

  _openNewProjectModal() {
    const formEl = document.createElement('div');
    formEl.innerHTML = `
      <div class="flex flex-col gap-3">
        <div>
          <label class="block text-sm font-medium text-[var(--color-text-secondary)] mb-1">${t('project.new.title_label')}</label>
          <input id="new-project-title" type="text" class="input w-full"
                 placeholder="${t('project.new.title_placeholder')}" maxlength="100" />
        </div>
      </div>
    `;

    const modal = new Modal({
      title: t('project.new'),
      content: formEl,
      actions: [
        { label: t('modal.cancel'), variant: 'secondary', onClick: (m) => m.close() },
        {
          label: t('project.new.create'),
          variant: 'primary',
          onClick: async (m) => {
            const titleInput = formEl.querySelector('#new-project-title');
            const title = titleInput.value.trim();
            if (!title) {
              titleInput.classList.add('border-red-500');
              titleInput.focus();
              return;
            }
            try {
              // New projects get order value after all existing projects
              const maxOrder = this.projects.reduce((max, p) => Math.max(max, p.order ?? 0), 0);
              await createProject({ title, order: maxOrder + 10 });
              appState.notifyDataChanged('projects');
              toast.success(t('project.new.success'));
              m.close();
            } catch {
              toast.error(t('project.new.error'));
            }
          },
        },
      ],
      onClose: () => modal.destroy(),
    });

    modal.open();
    requestAnimationFrame(() => formEl.querySelector('#new-project-title')?.focus());
  }

  updateActiveState() {
    const currentView = appState.get('currentView');
    const selectedProjectId = appState.get('selectedProjectId');
    const selectedDemoId = appState.get('selectedDemoId');

    this.container.querySelectorAll('.sidebar-nav-item').forEach((el) => {
      const view = el.dataset.view;
      const id = el.dataset.id;
      let isActive = false;

      if (view === 'home' && currentView === 'home') isActive = true;
      else if (view === 'all-demos' && currentView === 'all-demos') isActive = true;
      else if (view === 'project' && id === selectedProjectId) isActive = true;
      else if (view === 'demo-preview' && id === selectedDemoId) isActive = true;

      el.classList.toggle('active', isActive);
    });
  }

  destroy() {
    window.removeEventListener('locale-change', this._localeHandler);
  }
}

function escapeHtml(str) {
  return String(str || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
