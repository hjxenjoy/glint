import { appState } from 'store/app-state.js';
import { getAllProjects, createProject } from 'db/projects.js';
import { getDemosByProject, getStandaloneDemos } from 'db/demos.js';
import { getStorageEstimate, formatBytes } from 'utils/storage-estimate.js';
import { t } from 'utils/i18n.js';
import { Modal } from 'components/modal.js';
import { toast } from 'components/toast.js';

export class Sidebar {
  constructor(container) {
    this.container = container;
    this.projects = [];
    this.standaloneDemos = [];
    this.expandedProjects = new Set();
    this.projectDemosCache = {}; // projectId -> demos[]
    this._localeHandler = () => {
      this.render();
      this.loadData();
    };
    window.addEventListener('locale-change', this._localeHandler);
    this.render();
    this.loadData();

    appState.addEventListener('data-changed', () => this.loadData());
    appState.addEventListener('change', (e) => {
      if (
        e.detail.key === 'currentView' ||
        e.detail.key === 'selectedDemoId' ||
        e.detail.key === 'selectedProjectId'
      ) {
        this.updateActiveState();
      }
    });
  }

  async loadData() {
    [this.projects, this.standaloneDemos] = await Promise.all([
      getAllProjects(),
      getStandaloneDemos(),
    ]);
    this.renderContent();
    this.loadStorageInfo();
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
        <!-- New Demo button -->
        <div class="p-3 border-b border-[var(--color-border)]">
          <a href="#/demos/new" class="btn btn-primary w-full justify-center gap-2">
            <svg class="w-4 h-4"><use href="icons/sprite.svg#icon-plus"></use></svg>
            ${t('sidebar.new_demo')}
          </a>
        </div>

        <!-- Navigation -->
        <nav class="p-2 border-b border-[var(--color-border)]">
          <a href="#/" class="sidebar-nav-item" data-view="home">
            <svg class="w-4 h-4"><use href="icons/sprite.svg#icon-home"></use></svg>
            <span>${t('sidebar.home')}</span>
          </a>
          <a href="#/demos" class="sidebar-nav-item" data-view="all-demos">
            <svg class="w-4 h-4"><use href="icons/sprite.svg#icon-grid"></use></svg>
            <span>${t('sidebar.all_demos')}</span>
          </a>
        </nav>

        <!-- Projects & Demos list (scrollable) -->
        <div class="flex-1 overflow-y-auto" id="sidebar-content">
          <!-- Dynamic content rendered by renderContent() -->
        </div>

        <!-- Storage indicator -->
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

    this.bindNavEvents();
    this.renderContent();
  }

  renderContent() {
    const content = this.container.querySelector('#sidebar-content');
    if (!content) return;

    let html = '';

    // Projects section
    html += `
      <div class="p-2">
        <div class="flex items-center justify-between px-2 py-1 mb-1">
          <span class="text-xs font-semibold text-[var(--color-text-tertiary)] uppercase tracking-wider">${t('sidebar.projects')}</span>
          <button type="button" class="btn btn-icon btn-ghost" title="${t('sidebar.new_project')}" id="new-project-btn">
            <svg class="w-3.5 h-3.5"><use href="icons/sprite.svg#icon-folder-plus"></use></svg>
          </button>
        </div>
        ${this.projects.length === 0 ? `<p class="text-xs text-[var(--color-text-tertiary)] px-2 py-1">${t('sidebar.no_projects')}</p>` : ''}
        ${this.projects.map((p) => this.renderProjectItem(p)).join('')}
      </div>
    `;

    // Standalone demos section
    if (this.standaloneDemos.length > 0) {
      html += `
        <div class="p-2 border-t border-[var(--color-border)]">
          <div class="px-2 py-1 mb-1">
            <span class="text-xs font-semibold text-[var(--color-text-tertiary)] uppercase tracking-wider">${t('sidebar.standalone_demos')}</span>
          </div>
          ${this.standaloneDemos.map((d) => this.renderDemoItem(d)).join('')}
        </div>
      `;
    }

    content.innerHTML = html;
    this.bindContentEvents();
    this.updateActiveState();
  }

  renderProjectItem(project) {
    const isExpanded = this.expandedProjects.has(project.id);
    return `
      <div class="sidebar-project" data-project-id="${project.id}">
        <div class="sidebar-nav-item group" data-view="project" data-id="${project.id}">
          <button class="sidebar-expand-btn p-0.5 rounded hover:bg-[var(--color-bg-hover)] transition-colors" data-expand="${project.id}" aria-label="展开">
            <svg class="w-3.5 h-3.5 transition-transform ${isExpanded ? 'rotate-90' : ''}"><use href="icons/sprite.svg#icon-chevron-right"></use></svg>
          </button>
          <svg class="w-4 h-4 text-[var(--color-accent)]"><use href="icons/sprite.svg#icon-folder${isExpanded ? '-open' : ''}"></use></svg>
          <a href="#/projects/${project.id}" class="flex-1 truncate text-sm">${escapeHtml(project.title)}</a>
        </div>
        ${
          isExpanded
            ? `<div class="pl-6" data-demo-list="${project.id}">
          ${this._renderCachedDemos(project.id)}
        </div>`
            : ''
        }
      </div>
    `;
  }

  renderDemoItem(demo, indent = false) {
    const currentDemoId = appState.get('selectedDemoId');
    const isActive = currentDemoId === demo.id;
    return `
      <a href="#/demos/${demo.id}"
         class="sidebar-nav-item text-sm ${isActive ? 'active' : ''} ${indent ? 'pl-8' : ''}"
         data-view="demo-preview" data-id="${demo.id}">
        <svg class="w-3.5 h-3.5 shrink-0"><use href="icons/sprite.svg#icon-file-code"></use></svg>
        <span class="flex-1 truncate">${escapeHtml(demo.title)}</span>
      </a>
    `;
  }

  _renderCachedDemos(projectId) {
    const demos = this.projectDemosCache[projectId];
    if (!demos) return ''; // not yet loaded — show nothing
    if (demos.length === 0)
      return `<p class="text-xs text-[var(--color-text-tertiary)] px-2 py-1">${t('sidebar.no_demos')}</p>`;
    return demos.map((d) => this.renderDemoItem(d, true)).join('');
  }

  async bindContentEvents() {
    // Expand/collapse project
    this.container.querySelectorAll('[data-expand]').forEach((btn) => {
      btn.addEventListener('click', async (e) => {
        e.preventDefault();
        e.stopPropagation();
        const projectId = btn.dataset.expand;
        if (this.expandedProjects.has(projectId)) {
          this.expandedProjects.delete(projectId);
          delete this.projectDemosCache[projectId];
          this.renderContent();
        } else {
          this.expandedProjects.add(projectId);
          // Load demos then cache and re-render (no loading flash)
          const demos = await getDemosByProject(projectId);
          this.projectDemosCache[projectId] = demos;
          this.renderContent();
        }
      });
    });

    // New project button
    this.container.querySelector('#new-project-btn')?.addEventListener('click', (e) => {
      e.preventDefault();
      this._openNewProjectModal();
    });
  }

  _openNewProjectModal() {
    const formEl = document.createElement('div');
    formEl.innerHTML = `
      <div class="flex flex-col gap-3">
        <div>
          <label class="block text-sm font-medium text-[var(--color-text-secondary)] mb-1">${t('project.new.title_label')}</label>
          <input id="new-project-title" type="text" class="input w-full" placeholder="${t('project.new.title_label')}" maxlength="100" autofocus />
        </div>
      </div>
    `;

    const modal = new Modal({
      title: t('project.new'),
      content: formEl,
      actions: [
        {
          label: t('modal.cancel'),
          variant: 'secondary',
          onClick: (m) => m.close(),
        },
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
              await createProject({ title });
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

    // Focus input after modal opens
    requestAnimationFrame(() => {
      formEl.querySelector('#new-project-title')?.focus();
    });
  }

  bindNavEvents() {
    // (Navigation links use href, no extra events needed)
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
