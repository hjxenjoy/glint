import { appState } from 'store/app-state.js';
import { getProject, updateProject, deleteProject } from 'db/projects.js';
import { getDemosByProject, deleteDemo, updateDemo } from 'db/demos.js';
import { deleteAssetsByDemo } from 'db/assets.js';
import { formatRelative, formatFull } from 'utils/date.js';
import { confirm } from 'components/modal.js';
import { toast } from 'components/toast.js';
import { t } from 'utils/i18n.js';

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
    const tags = p.tags || [];

    this.container.innerHTML = `
      <div class="project-view flex flex-col h-full overflow-y-auto">
        <!-- Project header -->
        <div class="project-header px-6 pt-6 pb-5 border-b border-[var(--color-border)] bg-[var(--color-bg-secondary)]">
          <!-- Title row -->
          <div class="flex items-start gap-3 mb-4">
            <svg class="w-7 h-7 mt-0.5 shrink-0 text-[var(--color-accent)]"><use href="icons/sprite.svg#icon-folder-open"></use></svg>
            <div class="flex-1 min-w-0">
              <div class="flex items-center gap-2 group">
                <h1 class="project-title text-xl font-bold text-[var(--color-text-primary)] leading-tight cursor-pointer hover:text-[var(--color-accent)] transition-colors truncate"
                    id="project-title-display"
                    title="${escapeHtml(p.title)}">
                  ${escapeHtml(p.title)}
                </h1>
                <button class="btn btn-icon btn-ghost w-7 h-7 opacity-0 group-hover:opacity-100 transition-opacity shrink-0" id="edit-title-btn" title="${t('project.edit_title')}">
                  <svg class="w-3.5 h-3.5"><use href="icons/sprite.svg#icon-edit"></use></svg>
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
            <button class="btn btn-danger btn-sm gap-1.5 shrink-0" id="delete-project-btn">
              <svg class="w-3.5 h-3.5"><use href="icons/sprite.svg#icon-trash"></use></svg>
              ${t('project.delete')}
            </button>
          </div>

          <!-- Notes / description -->
          <div class="mb-4">
            <textarea
              class="project-notes-input w-full text-sm bg-transparent border border-transparent rounded-lg outline-none text-[var(--color-text-secondary)] px-0 py-0 resize-none leading-relaxed cursor-pointer hover:text-[var(--color-text-primary)] transition-colors placeholder:italic placeholder:text-[var(--color-text-tertiary)]"
              id="project-notes-input"
              rows="1"
              placeholder="${t('project.notes.placeholder')}"
              aria-label="${t('project.notes.placeholder')}"
              readonly
            >${escapeHtml((p.notes || '').trim())}</textarea>
          </div>

          <!-- Tags row -->
          <div class="mb-4" id="tag-input-container">
            <!-- TagInput will be mounted here if available -->
            <div class="flex flex-wrap gap-1.5 items-center" id="tags-display">
              ${tags
                .map(
                  (tag) => `
                <span class="tag-chip inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs bg-[var(--color-bg-tertiary)] text-[var(--color-text-secondary)] border border-[var(--color-border)]">
                  ${escapeHtml(tag)}
                  <button class="tag-remove-btn hover:text-[var(--color-danger)] transition-colors" data-tag="${escapeHtml(tag)}" aria-label="删除标签">
                    <svg class="w-2.5 h-2.5"><use href="icons/sprite.svg#icon-close"></use></svg>
                  </button>
                </span>
              `
                )
                .join('')}
              <button class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs border border-dashed border-[var(--color-border)] text-[var(--color-text-tertiary)] hover:border-[var(--color-accent)] hover:text-[var(--color-accent)] transition-colors" id="add-tag-btn">
                <svg class="w-2.5 h-2.5"><use href="icons/sprite.svg#icon-plus"></use></svg>
                ${t('project.add_tag')}
              </button>
            </div>
            <div class="hidden mt-2" id="tag-input-row">
              <input type="text" class="text-sm px-2 py-1 rounded-lg border border-[var(--color-accent)] bg-[var(--color-bg-primary)] outline-none text-[var(--color-text-primary)] w-36"
                     id="tag-text-input" placeholder="输入标签…" maxlength="32" />
              <span class="text-xs text-[var(--color-text-tertiary)] ml-1">Enter 确认 · Esc 取消</span>
            </div>
          </div>

          <!-- Meta info -->
          <div class="flex items-center gap-4 text-xs text-[var(--color-text-tertiary)]">
            <span title="${formatFull(p.createdAt)}">${t('project.created')} ${formatRelative(p.createdAt)}</span>
            <span title="${formatFull(p.updatedAt)}">${t('project.updated')} ${formatRelative(p.updatedAt)}</span>
            <span>${t('project.demos_count', { n: this.demos.length })}</span>
          </div>
        </div>

        <!-- New Demo button + Demo grid -->
        <div class="flex-1 px-6 py-5">
          <div class="flex items-center justify-between mb-5">
            <h2 class="text-sm font-semibold text-[var(--color-text-secondary)] uppercase tracking-wider">Demo 列表</h2>
            <a href="#/demos/new?projectId=${escapeHtml(p.id)}"
               class="btn btn-primary btn-sm gap-1.5">
              <svg class="w-3.5 h-3.5"><use href="icons/sprite.svg#icon-plus"></use></svg>
              ${t('project.new_demo')}
            </a>
          </div>

          <!-- Demo grid -->
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
          <svg class="w-12 h-12 text-[var(--color-text-tertiary)] opacity-40"><use href="icons/sprite.svg#icon-file-code"></use></svg>
          <div>
            <p class="text-sm text-[var(--color-text-secondary)] mb-1">${t('project.no_demos')}</p>
            <p class="text-xs text-[var(--color-text-tertiary)]">点击"${t('project.new_demo')}"开始创建</p>
          </div>
          <a href="#/demos/new?projectId=${escapeHtml(this.project.id)}"
             class="btn btn-primary btn-sm gap-1.5">
            <svg class="w-3.5 h-3.5"><use href="icons/sprite.svg#icon-plus"></use></svg>
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
    const tags = demo.tags || [];
    const fileCount = (demo.files || []).length;
    return `
      <div class="demo-card group relative flex flex-col rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-secondary)] hover:border-[var(--color-accent)] hover:shadow-md transition-all duration-200 overflow-hidden"
           data-demo-id="${escapeHtml(demo.id)}">
        <!-- Card body -->
        <a href="#/demos/${escapeHtml(demo.id)}" class="flex-1 p-4 block">
          <div class="flex items-start gap-2 mb-2">
            <svg class="w-4 h-4 mt-0.5 shrink-0 text-[var(--color-accent)]"><use href="icons/sprite.svg#icon-file-code"></use></svg>
            <h3 class="text-sm font-semibold text-[var(--color-text-primary)] leading-snug line-clamp-2 flex-1">${escapeHtml(demo.title)}</h3>
          </div>
          ${demo.notes ? `<p class="text-xs text-[var(--color-text-tertiary)] line-clamp-2 mb-2 leading-relaxed">${escapeHtml(demo.notes)}</p>` : ''}
          ${
            tags.length > 0
              ? `
            <div class="flex flex-wrap gap-1 mb-2">
              ${tags
                .slice(0, 3)
                .map(
                  (tag) => `
                <span class="inline-block px-1.5 py-0.5 rounded text-[10px] bg-[var(--color-bg-tertiary)] text-[var(--color-text-tertiary)] border border-[var(--color-border)]">
                  ${escapeHtml(tag)}
                </span>
              `
                )
                .join('')}
              ${tags.length > 3 ? `<span class="text-[10px] text-[var(--color-text-tertiary)]">+${tags.length - 3}</span>` : ''}
            </div>
          `
              : ''
          }
        </a>

        <!-- Card footer -->
        <div class="flex items-center justify-between px-4 py-2.5 border-t border-[var(--color-border)] bg-[var(--color-bg-tertiary)]">
          <span class="text-[10px] text-[var(--color-text-tertiary)]" title="${formatFull(demo.updatedAt)}">
            ${formatRelative(demo.updatedAt)}
          </span>
          <div class="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
            <a href="#/demos/${escapeHtml(demo.id)}/edit"
               class="btn btn-icon btn-ghost w-6 h-6"
               title="${t('demo.edit')}">
              <svg class="w-3.5 h-3.5"><use href="icons/sprite.svg#icon-edit"></use></svg>
            </a>
            <button class="btn btn-icon btn-ghost w-6 h-6 hover:text-[var(--color-danger)] demo-delete-btn"
                    data-demo-id="${escapeHtml(demo.id)}"
                    data-demo-title="${escapeHtml(demo.title)}"
                    title="${t('demo.delete')}">
              <svg class="w-3.5 h-3.5"><use href="icons/sprite.svg#icon-trash"></use></svg>
            </button>
          </div>
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

    // Notes editing — single textarea, readonly by default
    const notesInput = this.container.querySelector('#project-notes-input');

    const autoResize = () => {
      notesInput.style.height = 'auto';
      notesInput.style.height = notesInput.scrollHeight + 'px';
    };
    autoResize(); // set initial height based on content
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

    // Tags
    this.bindTagEvents();

    // Delete project
    this.container.querySelector('#delete-project-btn').addEventListener('click', () => {
      this.handleDeleteProject();
    });

    // Demo delete buttons
    this.container.querySelectorAll('.demo-delete-btn').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        this.handleDeleteDemo(btn.dataset.demoId, btn.dataset.demoTitle);
      });
    });
  }

  bindTagEvents() {
    const addTagBtn = this.container.querySelector('#add-tag-btn');
    const tagInputRow = this.container.querySelector('#tag-input-row');
    const tagTextInput = this.container.querySelector('#tag-text-input');

    addTagBtn?.addEventListener('click', () => {
      tagInputRow.classList.remove('hidden');
      tagTextInput.focus();
    });

    tagTextInput?.addEventListener('keydown', async (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        const newTag = tagTextInput.value.trim();
        if (newTag && !(this.project.tags || []).includes(newTag)) {
          await this.saveTag([...(this.project.tags || []), newTag]);
        }
        tagTextInput.value = '';
        tagInputRow.classList.add('hidden');
      }
      if (e.key === 'Escape') {
        tagTextInput.value = '';
        tagInputRow.classList.add('hidden');
      }
    });

    tagTextInput?.addEventListener('blur', () => {
      setTimeout(() => {
        tagTextInput.value = '';
        tagInputRow.classList.add('hidden');
      }, 150);
    });

    // Remove tag buttons
    this.container.querySelectorAll('.tag-remove-btn').forEach((btn) => {
      btn.addEventListener('click', async () => {
        const tagToRemove = btn.dataset.tag;
        const newTags = (this.project.tags || []).filter((tag) => tag !== tagToRemove);
        await this.saveTag(newTags);
      });
    });
  }

  async saveTag(newTags) {
    try {
      this.project = await updateProject(this.project.id, { tags: newTags });
      this.refreshTagsDisplay();
      appState.notifyDataChanged('project');
    } catch (err) {
      console.error('Update tags error:', err);
      toast.error('更新失败');
    }
  }

  refreshTagsDisplay() {
    const tagsDisplay = this.container.querySelector('#tags-display');
    if (!tagsDisplay) return;
    const tags = this.project.tags || [];
    tagsDisplay.innerHTML = `
      ${tags
        .map(
          (tag) => `
        <span class="tag-chip inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs bg-[var(--color-bg-tertiary)] text-[var(--color-text-secondary)] border border-[var(--color-border)]">
          ${escapeHtml(tag)}
          <button class="tag-remove-btn hover:text-[var(--color-danger)] transition-colors" data-tag="${escapeHtml(tag)}" aria-label="删除标签">
            <svg class="w-2.5 h-2.5"><use href="icons/sprite.svg#icon-close"></use></svg>
          </button>
        </span>
      `
        )
        .join('')}
      <button class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs border border-dashed border-[var(--color-border)] text-[var(--color-text-tertiary)] hover:border-[var(--color-accent)] hover:text-[var(--color-accent)] transition-colors" id="add-tag-btn">
        <svg class="w-2.5 h-2.5"><use href="icons/sprite.svg#icon-plus"></use></svg>
        ${t('project.add_tag')}
      </button>
    `;
    // Re-bind tag events after re-render
    this.bindTagEvents();
  }

  async handleDeleteProject() {
    const confirmed = await confirm({
      title: t('project.delete.confirm.title'),
      message: t('project.delete.confirm.message'),
      confirmText: t('project.delete'),
      cancelText: '取消',
      danger: true,
    });

    if (!confirmed) return;

    try {
      // Delete project record (does not cascade)
      await deleteProject(this.project.id);

      // Detach all demos from this project (set projectId = null)
      await Promise.all(this.demos.map((demo) => updateDemo(demo.id, { projectId: null })));

      appState.notifyDataChanged('project');
      toast.success('项目已删除，Demo 已变为独立状态');
      appState.navigate('#/');
    } catch (err) {
      console.error('Delete project error:', err);
      toast.error('删除失败，请重试');
    }
  }

  async handleDeleteDemo(demoId, demoTitle) {
    const confirmed = await confirm({
      title: t('demo.delete.confirm.title'),
      message: t('demo.delete.confirm.message', { title: demoTitle }),
      confirmText: t('demo.delete'),
      cancelText: '取消',
      danger: true,
    });

    if (!confirmed) return;

    try {
      await deleteAssetsByDemo(demoId);
      await deleteDemo(demoId);
      this.demos = this.demos.filter((d) => d.id !== demoId);
      const demoGrid = this.container.querySelector('#demo-grid');
      if (demoGrid) demoGrid.innerHTML = this.renderDemoGrid();
      // Re-bind demo delete buttons
      this.container.querySelectorAll('.demo-delete-btn').forEach((btn) => {
        btn.addEventListener('click', (e) => {
          e.preventDefault();
          e.stopPropagation();
          this.handleDeleteDemo(btn.dataset.demoId, btn.dataset.demoTitle);
        });
      });
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
        <svg class="w-12 h-12 opacity-40"><use href="icons/sprite.svg#icon-alert-circle"></use></svg>
        <p class="text-sm">${escapeHtml(message)}</p>
        <a href="#/" class="btn btn-secondary btn-sm">返回首页</a>
      </div>
    `;
  }
}
