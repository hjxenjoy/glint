import { appState } from 'store/app-state.js';
import { getProject, updateProject, deleteProject } from 'db/projects.js';
import { getDemosByProject, deleteDemo, updateDemo, cloneDemo } from 'db/demos.js';
import { deleteAssetsByDemo, cloneAssetsByDemo, getAssetsByDemo } from 'db/assets.js';
import { packExport, triggerDownload } from 'utils/zip.js';
import { formatRelative, formatFull } from 'utils/date.js';
import { confirm } from 'components/modal.js';
import { toast } from 'components/toast.js';
import { t } from 'utils/i18n.js';
import { icon } from 'utils/icons.js';

function escapeHtml(str) {
  return String(str || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export class ProjectView {
  constructor(container) {
    this.container = container;
    this.project = null;
    this.demos = [];
    this._localeHandler = () => this.init();
    window.addEventListener('locale-change', this._localeHandler);
    this.init();
  }

  destroy() {
    window.removeEventListener('locale-change', this._localeHandler);
  }

  async init() {
    const projectId = appState.get('selectedProjectId');
    if (!projectId) {
      this.renderError('未选择项目');
      return;
    }

    this.renderLoading();

    try {
      [this.project, this.demos] = await Promise.all([
        getProject(projectId),
        getDemosByProject(projectId),
      ]);

      if (!this.project) {
        this.renderError('项目不存在');
        return;
      }

      // Sort demos A-Z
      this.demos.sort((a, b) => a.title.localeCompare(b.title, 'zh'));

      this.render();
    } catch (err) {
      console.error('ProjectView init error:', err);
      this.renderError('加载项目失败');
    }
  }

  renderLoading() {
    this.container.innerHTML = `
      <div class="flex flex-col items-center justify-center h-full gap-4 text-[var(--color-text-tertiary)]">
        <p class="text-sm">${t('project.loading')}</p>
      </div>
    `;
  }

  render() {
    const p = this.project;

    this.container.innerHTML = `
      <div class="project-view flex flex-col h-full overflow-y-auto">
        <!-- Project header -->
        <div class="project-header px-6 pt-6 pb-5 border-b border-[var(--color-border)] bg-[var(--color-bg-secondary)]">
          <!-- Title row -->
          <div class="flex items-start gap-3 mb-4">
            ${icon('folder-open', 'w-7 h-7 mt-0.5 shrink-0 text-[var(--color-accent)]')}
            <div class="flex-1 min-w-0">
              <div class="flex items-center gap-2 group">
                <h1 class="project-title text-xl font-bold text-[var(--color-text-primary)] leading-tight cursor-pointer hover:text-[var(--color-accent)] transition-colors truncate"
                    id="project-title-display"
                    title="${escapeHtml(p.title)}">
                  ${escapeHtml(p.title)}
                </h1>
                <button class="btn btn-icon btn-ghost w-7 h-7 opacity-0 group-hover:opacity-100 transition-opacity shrink-0"
                        id="edit-title-btn" title="${t('project.edit_title')}">
                  ${icon('pencil-simple', 'w-3.5 h-3.5')}
                </button>
              </div>
              <input
                type="text"
                class="project-title-input hidden w-full text-xl font-bold bg-transparent border-b-2 border-[var(--color-accent)] outline-none text-[var(--color-text-primary)] py-0.5 mt-0.5"
                id="project-title-input"
                value="${escapeHtml(p.title)}"
                aria-label="项目名称"
              />
            </div>
            <div class="flex items-center gap-2 shrink-0">
              <button class="btn btn-secondary btn-sm gap-1.5" id="export-project-btn"
                      title="${t('project.export')}">
                ${icon('download', 'w-3.5 h-3.5')}
                ${t('project.export')}
              </button>
              <button class="btn btn-danger btn-sm gap-1.5" id="delete-project-btn">
                ${icon('trash', 'w-3.5 h-3.5')}
                ${t('project.delete')}
              </button>
            </div>
          </div>

          <!-- Description / notes -->
          <div class="mb-4">
            <textarea
              class="project-notes-input w-full text-sm bg-transparent border border-transparent rounded-lg outline-none text-[var(--color-text-secondary)] px-0 py-0 resize-none leading-relaxed cursor-pointer hover:text-[var(--color-text-primary)] transition-colors placeholder:italic placeholder:text-[var(--color-text-tertiary)]"
              id="project-notes-input"
              rows="1"
              placeholder="${t('project.description.placeholder')}"
              aria-label="${t('project.description')}"
              readonly
            >${escapeHtml((p.notes || '').trim())}</textarea>
          </div>

          <!-- Meta info -->
          <div class="flex items-center gap-4 text-xs text-[var(--color-text-tertiary)]">
            <span title="${formatFull(p.createdAt)}">${t('project.created')} ${formatRelative(p.createdAt)}</span>
            <span title="${formatFull(p.updatedAt)}">${t('project.updated')} ${formatRelative(p.updatedAt)}</span>
            <span>${t('project.demos_count', { n: this.demos.length })}</span>
          </div>
        </div>

        <!-- Demo list -->
        <div class="flex-1 px-6 py-5">
          <div class="flex items-center justify-between mb-5">
            <h2 class="text-sm font-semibold text-[var(--color-text-secondary)] uppercase tracking-wider">Demo 列表</h2>
            <a href="#/demos/new?projectId=${escapeHtml(p.id)}"
               class="btn btn-primary btn-sm gap-1.5">
              ${icon('plus', 'w-3.5 h-3.5')}
              ${t('project.new_demo')}
            </a>
          </div>

          <div id="demo-grid">
            ${this.renderDemoGrid()}
          </div>
        </div>
      </div>
    `;

    this.bindEvents();
  }

  renderDemoGrid() {
    if (this.demos.length === 0) {
      return `
        <div class="flex flex-col items-center justify-center py-16 text-center gap-4">
          ${icon('file-code', 'w-12 h-12 text-[var(--color-text-tertiary)] opacity-40')}
          <div>
            <p class="text-sm text-[var(--color-text-secondary)] mb-1">${t('project.no_demos')}</p>
            <p class="text-xs text-[var(--color-text-tertiary)]">点击"${t('project.new_demo')}"开始创建</p>
          </div>
          <a href="#/demos/new?projectId=${escapeHtml(this.project.id)}"
             class="btn btn-primary btn-sm gap-1.5">
            ${icon('plus', 'w-3.5 h-3.5')}
            ${t('project.new_demo')}
          </a>
        </div>
      `;
    }

    return `
      <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        ${this.demos.map((demo) => this.renderDemoCard(demo)).join('')}
      </div>
    `;
  }

  renderDemoCard(demo) {
    const entry =
      (demo.files || []).find((f) => f.name === (demo.entryFile || 'index.html')) ||
      demo.files?.[0];
    const codePreview = entry
      ? entry.content
          .split('\n')
          .slice(0, 18)
          .map((l) => l.slice(0, 72))
          .join('\n')
      : null;

    return `
      <div class="demo-card group relative flex flex-col rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-secondary)] hover:border-[var(--color-accent)] hover:shadow-md transition-all duration-200 overflow-hidden"
           data-demo-id="${escapeHtml(demo.id)}">
        <!-- Code thumbnail -->
        <a href="#/demos/${escapeHtml(demo.id)}" class="block overflow-hidden relative h-28 bg-[#13151e] select-none">
          ${
            codePreview
              ? `<pre class="text-[8px] leading-[1.5] font-mono p-2 text-[#8b9fc8] pointer-events-none whitespace-pre overflow-hidden">${escapeHtml(codePreview)}</pre>
                 <div class="absolute inset-x-0 bottom-0 h-10 bg-gradient-to-t from-[#13151e] to-transparent"></div>`
              : `<div class="h-full flex items-center justify-center">${icon('file-code', 'w-7 h-7 text-[#8b9fc8] opacity-30')}</div>`
          }
        </a>

        <!-- Card body -->
        <a href="#/demos/${escapeHtml(demo.id)}" class="flex-1 p-3 block">
          <h3 class="text-sm font-semibold text-[var(--color-text-primary)] leading-snug truncate">${escapeHtml(demo.title)}</h3>
          <p class="text-[11px] text-[var(--color-text-tertiary)] mt-0.5">${formatRelative(demo.updatedAt)}</p>
        </a>

        <!-- Hover actions -->
        <div class="absolute top-1.5 right-1.5 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          <a href="#/demos/${escapeHtml(demo.id)}/edit"
             class="btn btn-icon w-6 h-6 bg-black/60 backdrop-blur-sm border border-white/10 hover:border-[var(--color-accent)] text-white"
             title="${t('demo.edit')}">
            ${icon('pencil-simple', 'w-3 h-3')}
          </a>
          <button class="btn btn-icon w-6 h-6 bg-black/60 backdrop-blur-sm border border-white/10 hover:border-[var(--color-accent)] text-white demo-clone-btn"
                  data-demo-id="${escapeHtml(demo.id)}"
                  title="${t('demo.clone')}">
            ${icon('copy', 'w-3 h-3')}
          </button>
          <button class="btn btn-icon w-6 h-6 bg-black/60 backdrop-blur-sm border border-white/10 hover:border-red-400 hover:text-red-400 text-white demo-delete-btn"
                  data-demo-id="${escapeHtml(demo.id)}"
                  data-demo-title="${escapeHtml(demo.title)}"
                  title="${t('demo.delete')}">
            ${icon('trash', 'w-3 h-3')}
          </button>
        </div>
      </div>
    `;
  }

  bindEvents() {
    // Inline title editing
    const titleDisplay = this.container.querySelector('#project-title-display');
    const titleInput = this.container.querySelector('#project-title-input');
    const editTitleBtn = this.container.querySelector('#edit-title-btn');

    const startTitleEdit = () => {
      titleDisplay.classList.add('hidden');
      editTitleBtn.classList.add('hidden');
      titleInput.classList.remove('hidden');
      titleInput.focus();
      titleInput.select();
    };

    const saveTitleEdit = async () => {
      const newTitle = titleInput.value.trim();
      if (!newTitle || newTitle === this.project.title) {
        cancelTitleEdit();
        return;
      }
      try {
        this.project = await updateProject(this.project.id, { title: newTitle });
        titleDisplay.textContent = newTitle;
        titleDisplay.title = newTitle;
        titleInput.classList.add('hidden');
        titleDisplay.classList.remove('hidden');
        editTitleBtn.classList.remove('hidden');
        appState.notifyDataChanged('project');
        toast.success('标题已更新');
      } catch (err) {
        console.error('Update title error:', err);
        toast.error('更新失败');
        cancelTitleEdit();
      }
    };

    const cancelTitleEdit = () => {
      titleInput.value = this.project.title;
      titleInput.classList.add('hidden');
      titleDisplay.classList.remove('hidden');
      editTitleBtn.classList.remove('hidden');
    };

    titleDisplay.addEventListener('click', startTitleEdit);
    editTitleBtn.addEventListener('click', startTitleEdit);
    titleInput.addEventListener('blur', saveTitleEdit);
    titleInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        saveTitleEdit();
      }
      if (e.key === 'Escape') {
        e.preventDefault();
        cancelTitleEdit();
      }
    });

    // Notes/description editing
    const notesInput = this.container.querySelector('#project-notes-input');

    const autoResize = () => {
      notesInput.style.height = 'auto';
      notesInput.style.height = notesInput.scrollHeight + 'px';
    };
    autoResize();
    notesInput.addEventListener('input', autoResize);

    const startNotesEdit = () => {
      notesInput.removeAttribute('readonly');
      notesInput.classList.remove(
        'bg-transparent',
        'border-transparent',
        'px-0',
        'py-0',
        'cursor-pointer'
      );
      notesInput.classList.add(
        'bg-[var(--color-bg-tertiary)]',
        'border-[var(--color-border)]',
        'focus:border-[var(--color-accent)]',
        'px-2.5',
        'py-2.5',
        'cursor-text'
      );
      notesInput.focus();
    };

    const endNotesEdit = async () => {
      const newNotes = notesInput.value.trim();
      notesInput.setAttribute('readonly', '');
      notesInput.classList.add(
        'bg-transparent',
        'border-transparent',
        'px-0',
        'py-0',
        'cursor-pointer'
      );
      notesInput.classList.remove(
        'bg-[var(--color-bg-tertiary)]',
        'border-[var(--color-border)]',
        'focus:border-[var(--color-accent)]',
        'px-2.5',
        'py-2.5',
        'cursor-text'
      );
      notesInput.value = newNotes;
      if (newNotes === (this.project.notes || '').trim()) return;
      try {
        this.project = await updateProject(this.project.id, { notes: newNotes });
        appState.notifyDataChanged('project');
      } catch (err) {
        console.error('Update notes error:', err);
        toast.error('更新失败');
        notesInput.value = (this.project.notes || '').trim();
      }
    };

    notesInput.addEventListener('focus', startNotesEdit);
    notesInput.addEventListener('blur', endNotesEdit);
    notesInput.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        notesInput.blur();
      }
    });

    // Export project
    this.container.querySelector('#export-project-btn')?.addEventListener('click', () => {
      this.handleExportProject();
    });

    // Delete project
    this.container.querySelector('#delete-project-btn').addEventListener('click', () => {
      this.handleDeleteProject();
    });

    this._bindDemoCardEvents(this.container);
  }

  _bindDemoCardEvents(root) {
    root.querySelectorAll('.demo-clone-btn').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        this.handleCloneDemo(btn.dataset.demoId);
      });
    });

    root.querySelectorAll('.demo-delete-btn').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        this.handleDeleteDemo(btn.dataset.demoId, btn.dataset.demoTitle);
      });
    });
  }

  async handleExportProject() {
    const btn = this.container.querySelector('#export-project-btn');
    if (btn) btn.disabled = true;
    try {
      const demosWithAssets = await Promise.all(
        this.demos.map(async (demo) => {
          const assets = await getAssetsByDemo(demo.id);
          return { ...demo, assets };
        })
      );
      const data = { projects: [this.project], demos: demosWithAssets };
      const blob = await packExport(data);
      const safe = this.project.title.replace(/[^a-zA-Z0-9\u4e00-\u9fa5_-]/g, '_');
      triggerDownload(blob, `glint-project-${safe}.zip`);
      toast.success('项目已导出为 ZIP');
    } catch (err) {
      console.error('Export project error:', err);
      toast.error('导出失败：' + (err.message || '未知错误'));
    } finally {
      if (btn) btn.disabled = false;
    }
  }

  async handleDeleteProject() {
    const confirmed = await confirm({
      title: t('project.delete.confirm.title'),
      message: t('project.delete.confirm.message'),
      confirmText: t('project.delete'),
      cancelText: t('modal.cancel'),
      danger: true,
    });

    if (!confirmed) return;

    try {
      await deleteProject(this.project.id);
      await Promise.all(this.demos.map((demo) => updateDemo(demo.id, { projectId: null })));
      appState.notifyDataChanged('project');
      toast.success('项目已删除，Demo 已变为独立状态');
      appState.navigate('#/');
    } catch (err) {
      console.error('Delete project error:', err);
      toast.error('删除失败，请重试');
    }
  }

  async handleCloneDemo(demoId) {
    try {
      const cloned = await cloneDemo(demoId);
      await cloneAssetsByDemo(demoId, cloned.id);
      this.demos = [...this.demos, cloned].sort((a, b) => a.title.localeCompare(b.title, 'zh'));
      const demoGrid = this.container.querySelector('#demo-grid');
      if (demoGrid) {
        demoGrid.innerHTML = this.renderDemoGrid();
        this._bindDemoCardEvents(demoGrid);
      }
      appState.notifyDataChanged('demo');
      toast.success('Demo 已克隆');
    } catch (err) {
      console.error('Clone demo error:', err);
      toast.error('克隆失败，请重试');
    }
  }

  async handleDeleteDemo(demoId, demoTitle) {
    const confirmed = await confirm({
      title: t('demo.delete.confirm.title'),
      message: t('demo.delete.confirm.message'),
      confirmText: t('demo.delete'),
      cancelText: t('modal.cancel'),
      danger: true,
    });

    if (!confirmed) return;

    try {
      await deleteAssetsByDemo(demoId);
      await deleteDemo(demoId);
      this.demos = this.demos.filter((d) => d.id !== demoId);
      const demoGrid = this.container.querySelector('#demo-grid');
      if (demoGrid) {
        demoGrid.innerHTML = this.renderDemoGrid();
        this._bindDemoCardEvents(demoGrid);
      }
      appState.notifyDataChanged('demo');
      toast.success('Demo 已删除');
    } catch (err) {
      console.error('Delete demo error:', err);
      toast.error('删除失败，请重试');
    }
  }

  renderError(message) {
    this.container.innerHTML = `
      <div class="flex flex-col items-center justify-center h-full gap-4 text-[var(--color-text-tertiary)]">
        ${icon('warning', 'w-12 h-12 opacity-40')}
        <p class="text-sm">${escapeHtml(message)}</p>
        <a href="#/" class="btn btn-secondary btn-sm">${t('common.back')}</a>
      </div>
    `;
  }
}
