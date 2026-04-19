import { appState } from 'store/app-state.js';
import { getProject, getAllProjects, updateProject, deleteProject } from 'db/projects.js';
import { getDemosByProject, deleteDemo, updateDemo, cloneDemo } from 'db/demos.js';
import { deleteAssetsByDemo, cloneAssetsByDemo, getAssetsByDemo } from 'db/assets.js';
import { packExport, triggerDownload } from 'utils/zip.js';
import { formatRelative, formatFull } from 'utils/date.js';
import { confirm, Modal } from 'components/modal.js';
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
    this.selectionMode = false;
    this.selectedDemoIds = new Set();
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

      this.selectionMode = false;
      this.selectedDemoIds = new Set();
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
          <div class="flex items-center justify-between mb-5" id="demo-list-header">
            ${this._renderDemoListHeader()}
          </div>

          <div id="demo-grid">
            ${this.renderDemoGrid()}
          </div>
        </div>
      </div>
    `;

    this.bindEvents();
  }

  _renderDemoListHeader() {
    if (this.selectionMode) {
      const count = this.selectedDemoIds.size;
      return `
        <h2 class="text-sm font-semibold text-[var(--color-text-secondary)] uppercase tracking-wider">
          已选 ${count} 个
        </h2>
        <div class="flex items-center gap-2">
          <button id="batch-delete-btn" class="btn btn-danger btn-sm gap-1.5" ${count === 0 ? 'disabled' : ''}>
            ${icon('trash', 'w-3.5 h-3.5')}
            删除
          </button>
          <button id="batch-move-btn" class="btn btn-secondary btn-sm gap-1.5" ${count === 0 ? 'disabled' : ''}>
            ${icon('folder', 'w-3.5 h-3.5')}
            移动到
          </button>
          <button id="select-cancel-btn" class="btn btn-secondary btn-sm">取消</button>
        </div>
      `;
    }
    return `
      <h2 class="text-sm font-semibold text-[var(--color-text-secondary)] uppercase tracking-wider">Demo 列表</h2>
      <div class="flex items-center gap-2">
        <button id="select-mode-btn" class="btn btn-secondary btn-sm gap-1.5" ${this.demos.length === 0 ? 'disabled' : ''}>
          ${icon('check', 'w-3.5 h-3.5')}
          选择
        </button>
        <a href="#/demos/new?projectId=${escapeHtml(this.project.id)}"
           class="btn btn-primary btn-sm gap-1.5">
          ${icon('plus', 'w-3.5 h-3.5')}
          ${t('project.new_demo')}
        </a>
      </div>
    `;
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

    const isSelected = this.selectedDemoIds.has(demo.id);

    return `
      <div class="demo-card group relative flex flex-col rounded-xl border ${isSelected ? 'border-[var(--color-accent)] ring-2 ring-[var(--color-accent)]/30' : 'border-[var(--color-border)]'} bg-[var(--color-bg-secondary)] hover:border-[var(--color-accent)] hover:shadow-md transition-all duration-200 overflow-hidden"
           data-demo-id="${escapeHtml(demo.id)}">
        ${
          this.selectionMode
            ? `
          <label class="absolute top-2 left-2 z-10 cursor-pointer">
            <input type="checkbox" class="demo-select-checkbox w-4 h-4 accent-[var(--color-accent)]"
                   data-demo-id="${escapeHtml(demo.id)}" ${isSelected ? 'checked' : ''} />
          </label>
        `
            : ''
        }

        <!-- Code thumbnail -->
        <a href="#/demos/${escapeHtml(demo.id)}" class="block overflow-hidden relative h-28 bg-[#13151e] select-none ${this.selectionMode ? 'pointer-events-none' : ''}">
          ${
            codePreview
              ? `<pre class="text-[8px] leading-[1.5] font-mono p-2 text-[#8b9fc8] pointer-events-none whitespace-pre overflow-hidden">${escapeHtml(codePreview)}</pre>
                 <div class="absolute inset-x-0 bottom-0 h-10 bg-gradient-to-t from-[#13151e] to-transparent"></div>`
              : `<div class="h-full flex items-center justify-center">${icon('file-code', 'w-7 h-7 text-[#8b9fc8] opacity-30')}</div>`
          }
        </a>

        <!-- Card body -->
        <a href="#/demos/${escapeHtml(demo.id)}" class="flex-1 p-3 block ${this.selectionMode ? 'pointer-events-none' : ''}">
          <h3 class="text-sm font-semibold text-[var(--color-text-primary)] leading-snug truncate">${escapeHtml(demo.title)}</h3>
          <p class="text-[11px] text-[var(--color-text-tertiary)] mt-0.5">${formatRelative(demo.updatedAt)}</p>
        </a>

        <!-- Hover actions (hidden in selection mode) -->
        ${
          !this.selectionMode
            ? `
          <div class="absolute top-1.5 right-1.5 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
            <a href="#/demos/${escapeHtml(demo.id)}/edit"
               class="btn btn-icon w-6 h-6 bg-black/60 backdrop-blur-sm border border-white/10 hover:border-[var(--color-accent)] text-white"
               title="${t('demo.edit')}">
              ${icon('code', 'w-3 h-3')}
            </a>
            <button class="btn btn-icon w-6 h-6 bg-black/60 backdrop-blur-sm border border-white/10 hover:border-[var(--color-accent)] text-white demo-rename-btn"
                    data-demo-id="${escapeHtml(demo.id)}"
                    data-demo-title="${escapeHtml(demo.title)}"
                    title="重命名">
              ${icon('pencil-simple', 'w-3 h-3')}
            </button>
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
        `
            : ''
        }
      </div>
    `;
  }

  _refreshDemoArea() {
    const header = this.container.querySelector('#demo-list-header');
    if (header) header.innerHTML = this._renderDemoListHeader();
    const demoGrid = this.container.querySelector('#demo-grid');
    if (demoGrid) {
      demoGrid.innerHTML = this.renderDemoGrid();
      this._bindDemoCardEvents(demoGrid);
    }
    this._bindDemoListHeaderEvents();
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
    this._bindDemoListHeaderEvents();
  }

  _bindDemoListHeaderEvents() {
    this.container.querySelector('#select-mode-btn')?.addEventListener('click', () => {
      this.selectionMode = true;
      this.selectedDemoIds = new Set();
      this._refreshDemoArea();
    });

    this.container.querySelector('#select-cancel-btn')?.addEventListener('click', () => {
      this.selectionMode = false;
      this.selectedDemoIds = new Set();
      this._refreshDemoArea();
    });

    this.container.querySelector('#batch-delete-btn')?.addEventListener('click', () => {
      this.handleBatchDelete();
    });

    this.container.querySelector('#batch-move-btn')?.addEventListener('click', () => {
      this.handleBatchMove();
    });
  }

  _bindDemoCardEvents(root) {
    // Checkbox selection
    root.querySelectorAll('.demo-select-checkbox').forEach((cb) => {
      cb.addEventListener('change', (e) => {
        e.stopPropagation();
        const id = cb.dataset.demoId;
        if (cb.checked) {
          this.selectedDemoIds.add(id);
        } else {
          this.selectedDemoIds.delete(id);
        }
        // Update batch action buttons
        const header = this.container.querySelector('#demo-list-header');
        if (header) header.innerHTML = this._renderDemoListHeader();
        this._bindDemoListHeaderEvents();
      });
    });

    // Click card in selection mode → toggle checkbox
    root.querySelectorAll('.demo-card').forEach((card) => {
      card.addEventListener('click', (e) => {
        if (!this.selectionMode) return;
        if (e.target.closest('input[type="checkbox"]')) return;
        const id = card.dataset.demoId;
        const cb = card.querySelector('.demo-select-checkbox');
        if (cb) {
          cb.checked = !cb.checked;
          if (cb.checked) this.selectedDemoIds.add(id);
          else this.selectedDemoIds.delete(id);
          const header = this.container.querySelector('#demo-list-header');
          if (header) header.innerHTML = this._renderDemoListHeader();
          this._bindDemoListHeaderEvents();
        }
      });
    });

    root.querySelectorAll('.demo-rename-btn').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        this.handleRenameDemo(btn.dataset.demoId, btn.dataset.demoTitle);
      });
    });

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
      await triggerDownload(blob, `glint-project-${safe}.zip`);
      toast.success('项目已导出为 ZIP');
    } catch (err) {
      console.error('Export project error:', err);
      toast.error('导出失败：' + (err.message || '未知错误'));
    } finally {
      if (btn) btn.disabled = false;
    }
  }

  async handleDeleteProject() {
    let deleteAllDemos = false;
    const demoCount = this.demos.length;

    const formEl = document.createElement('div');
    formEl.innerHTML = `
      <p class="text-sm text-[var(--color-text-secondary)] mb-4">
        确定要删除项目 <strong>${escapeHtml(this.project.title)}</strong> 吗？
      </p>
      ${
        demoCount > 0
          ? `
        <label class="flex items-start gap-2.5 cursor-pointer select-none">
          <input type="checkbox" id="delete-demos-toggle"
                 class="mt-0.5 w-4 h-4 accent-[var(--color-danger)] shrink-0" />
          <span class="text-sm text-[var(--color-text-secondary)]">
            同时删除项目内全部 <strong>${demoCount}</strong> 个 Demo<br/>
            <span class="text-xs text-[var(--color-text-tertiary)]">不勾选则 Demo 保留为独立状态</span>
          </span>
        </label>
      `
          : ''
      }
    `;

    if (demoCount > 0) {
      formEl.querySelector('#delete-demos-toggle').addEventListener('change', (e) => {
        deleteAllDemos = e.target.checked;
      });
    }

    return new Promise((resolve) => {
      const modal = new Modal({
        title: t('project.delete.confirm.title'),
        content: formEl,
        actions: [
          {
            label: t('modal.cancel'),
            variant: 'secondary',
            onClick: (m) => {
              m.close();
              resolve(false);
            },
          },
          {
            label: t('project.delete'),
            variant: 'danger',
            onClick: async (m) => {
              m.close();
              try {
                await deleteProject(this.project.id);
                if (deleteAllDemos) {
                  await Promise.all(
                    this.demos.map(async (demo) => {
                      await deleteAssetsByDemo(demo.id);
                      await deleteDemo(demo.id);
                    })
                  );
                  toast.success(`项目及 ${demoCount} 个 Demo 已全部删除`);
                } else {
                  await Promise.all(
                    this.demos.map((demo) => updateDemo(demo.id, { projectId: null }))
                  );
                  toast.success('项目已删除，Demo 已变为独立状态');
                }
                appState.notifyDataChanged('project');
                appState.navigate('#/');
              } catch (err) {
                console.error('Delete project error:', err);
                toast.error('删除失败，请重试');
              }
              resolve(true);
            },
          },
        ],
        onClose: () => {
          resolve(false);
          modal.destroy();
        },
      });
      modal.open();
    });
  }

  async handleCloneDemo(demoId) {
    try {
      const cloned = await cloneDemo(demoId);
      await cloneAssetsByDemo(demoId, cloned.id);
      this.demos = [...this.demos, cloned].sort((a, b) => a.title.localeCompare(b.title, 'zh'));
      this._refreshDemoArea();
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
      this._refreshDemoArea();
      appState.notifyDataChanged('demo');
      toast.success('Demo 已删除');
    } catch (err) {
      console.error('Delete demo error:', err);
      toast.error('删除失败，请重试');
    }
  }

  async handleRenameDemo(demoId, currentTitle) {
    const formEl = document.createElement('div');
    formEl.innerHTML = `
      <input id="rename-demo-input" type="text" class="input w-full"
             value="${escapeHtml(currentTitle || '')}"
             maxlength="200" placeholder="Demo 名称" />
    `;
    const modal = new Modal({
      title: '重命名 Demo',
      content: formEl,
      actions: [
        { label: t('modal.cancel'), variant: 'secondary', onClick: (m) => m.close() },
        {
          label: '确认',
          variant: 'primary',
          onClick: async (m) => {
            const input = formEl.querySelector('#rename-demo-input');
            const newTitle = input.value.trim();
            if (!newTitle) {
              input.focus();
              return;
            }
            try {
              const updated = await updateDemo(demoId, { title: newTitle });
              this.demos = this.demos.map((d) => (d.id === demoId ? { ...d, title: newTitle } : d));
              this._refreshDemoArea();
              appState.notifyDataChanged('demo');
              toast.success('已重命名');
              m.close();
            } catch (err) {
              console.error('Rename error:', err);
              toast.error('重命名失败');
            }
          },
        },
      ],
      onClose: () => modal.destroy(),
    });
    modal.open();
    requestAnimationFrame(() => {
      const input = formEl.querySelector('#rename-demo-input');
      input?.focus();
      input?.select();
    });
  }

  async handleBatchDelete() {
    const ids = [...this.selectedDemoIds];
    if (ids.length === 0) return;

    const confirmed = await confirm({
      title: '批量删除',
      message: `确定要删除选中的 ${ids.length} 个 Demo 吗？此操作不可撤销。`,
      confirmText: '全部删除',
      cancelText: t('modal.cancel'),
      danger: true,
    });
    if (!confirmed) return;

    try {
      await Promise.all(
        ids.map(async (id) => {
          await deleteAssetsByDemo(id);
          await deleteDemo(id);
        })
      );
      this.demos = this.demos.filter((d) => !ids.includes(d.id));
      this.selectedDemoIds = new Set();
      this.selectionMode = false;
      this._refreshDemoArea();
      appState.notifyDataChanged('demo');
      toast.success(`已删除 ${ids.length} 个 Demo`);
    } catch (err) {
      console.error('Batch delete error:', err);
      toast.error('批量删除失败，请重试');
    }
  }

  async handleBatchMove() {
    const ids = [...this.selectedDemoIds];
    if (ids.length === 0) return;

    let allProjects;
    try {
      allProjects = await getAllProjects();
    } catch (err) {
      toast.error('加载项目列表失败');
      return;
    }

    const otherProjects = allProjects.filter((p) => p.id !== this.project.id);
    const projectOptions = [
      `<option value="">无项目（独立 Demo）</option>`,
      ...otherProjects.map(
        (p) => `<option value="${escapeHtml(p.id)}">${escapeHtml(p.title)}</option>`
      ),
    ].join('');

    const formEl = document.createElement('div');
    formEl.innerHTML = `
      <p class="text-sm text-[var(--color-text-secondary)] mb-3">
        将 ${ids.length} 个 Demo 移动到：
      </p>
      <select id="move-project-select" class="input w-full">
        ${projectOptions}
      </select>
    `;

    const modal = new Modal({
      title: '批量移动',
      content: formEl,
      actions: [
        { label: t('modal.cancel'), variant: 'secondary', onClick: (m) => m.close() },
        {
          label: '移动',
          variant: 'primary',
          onClick: async (m) => {
            const select = formEl.querySelector('#move-project-select');
            const targetProjectId = select.value || null;
            const targetName = targetProjectId
              ? otherProjects.find((p) => p.id === targetProjectId)?.title || '目标项目'
              : '独立 Demo';
            try {
              await Promise.all(ids.map((id) => updateDemo(id, { projectId: targetProjectId })));
              this.demos = this.demos.filter((d) => !ids.includes(d.id));
              this.selectedDemoIds = new Set();
              this.selectionMode = false;
              this._refreshDemoArea();
              appState.notifyDataChanged('demo');
              toast.success(`已将 ${ids.length} 个 Demo 移动到「${targetName}」`);
              m.close();
            } catch (err) {
              console.error('Batch move error:', err);
              toast.error('移动失败，请重试');
            }
          },
        },
      ],
      onClose: () => modal.destroy(),
    });
    modal.open();
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
