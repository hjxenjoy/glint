import { appState } from 'store/app-state.js';
import { getAllProjects, createProject } from 'db/projects.js';
import { getAllDemos } from 'db/demos.js';
import { getSetting, setSetting } from 'db/settings.js';
import { getStorageEstimate, formatBytes } from 'utils/storage-estimate.js';
import { t } from 'utils/i18n.js';
import { icon } from 'utils/icons.js';
import { Modal } from 'components/modal.js';
import { toast } from 'components/toast.js';

export class Sidebar {
  constructor(container) {
    this.container = container;
    this.projects = [];
    this.demosByProject = new Map(); // projectId => demos[]
    this.uncategorizedDemos = [];
    this.collapsedProjects = new Set();
    this.sortMode = 'alpha'; // 'alpha' | 'updated'

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
      getSetting('sidebar-sort-mode', 'alpha'),
    ]);

    this.collapsedProjects = new Set(Array.isArray(collapsedRaw) ? collapsedRaw : []);
    this.sortMode = sortMode || 'alpha';

    if (this.sortMode === 'updated') {
      this.projects = projects.sort((a, b) => b.updatedAt - a.updatedAt);
    } else {
      this.projects = projects.sort((a, b) => a.title.localeCompare(b.title, 'zh'));
    }

    // Group demos by project
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

    // Sort each group A-Z
    for (const demos of this.demosByProject.values()) {
      demos.sort((a, b) => a.title.localeCompare(b.title, 'zh'));
    }
    this.uncategorizedDemos.sort((a, b) => a.title.localeCompare(b.title, 'zh'));

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
          <button type="button" id="new-demo-btn" class="btn btn-primary w-full justify-center gap-2">
            ${icon('plus', 'w-4 h-4')}
            ${t('sidebar.new_demo')}
          </button>
        </div>

        <!-- Navigation -->
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

    this.container.querySelector('#new-demo-btn')?.addEventListener('click', () => {
      appState.navigate('#/demos/new');
    });

    this.renderContent();
  }

  renderContent() {
    const content = this.container.querySelector('#sidebar-content');
    if (!content) return;

    const sortTitle =
      this.sortMode === 'alpha'
        ? '按字母排序（点击切换为最近更新）'
        : '按最近更新排序（点击切换为字母）';
    const sortIconName = this.sortMode === 'alpha' ? 'caret-down' : 'arrow-counter-clockwise';

    let html = `
      <div class="p-2">
        <div class="flex items-center justify-between px-2 py-1 mb-1">
          <span class="text-xs font-semibold text-[var(--color-text-tertiary)] uppercase tracking-wider">${t('sidebar.projects')}</span>
          <div class="flex items-center gap-0.5">
            <button type="button" class="btn btn-icon btn-ghost w-6 h-6" title="${sortTitle}" id="sort-projects-btn">
              ${icon(sortIconName, 'w-3.5 h-3.5')}
            </button>
            <button type="button" class="btn btn-icon btn-ghost" title="${t('sidebar.new_project')}" id="new-project-btn">
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
    return `
      <div class="mb-0.5" data-project-id="${project.id}">
        <div class="flex items-center group">
          <button type="button"
                  class="collapse-toggle shrink-0 p-1 text-[var(--color-text-tertiary)] hover:text-[var(--color-text-primary)] transition-colors"
                  data-collapse-id="${escapeHtml(project.id)}"
                  title="${isCollapsed ? '展开' : '收起'}">
            ${icon(isCollapsed ? 'caret-right' : 'caret-down', 'w-3 h-3')}
          </button>
          <a href="#/projects/${project.id}"
             class="sidebar-nav-item flex-1 min-w-0 group"
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
    this.container.querySelector('#new-project-btn')?.addEventListener('click', (e) => {
      e.preventDefault();
      this._openNewProjectModal();
    });

    this.container.querySelector('#sort-projects-btn')?.addEventListener('click', async () => {
      this.sortMode = this.sortMode === 'alpha' ? 'updated' : 'alpha';
      await setSetting('sidebar-sort-mode', this.sortMode);
      await this.loadData();
    });

    this.container.querySelectorAll('.collapse-toggle').forEach((btn) => {
      btn.addEventListener('click', async (e) => {
        e.preventDefault();
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
