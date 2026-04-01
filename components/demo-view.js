import { appState } from 'store/app-state.js';
import { getDemo, updateDemo, deleteDemo } from 'db/demos.js';
import { getAssetsByDemo, deleteAssetsByDemo } from 'db/assets.js';
import { buildSrcdoc } from 'utils/file-resolver.js';
import { PreviewPanel } from 'components/preview-panel.js';
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

export class DemoView {
  constructor(container) {
    this.container = container;
    this.demo = null;
    this.assets = [];
    this.activeFileName = null;
    this.viewMode = 'preview'; // 'preview' | 'code'
    this.previewPanel = null;
    this._unsaved = false;
    this._localeHandler = () => this.init();
    window.addEventListener('locale-change', this._localeHandler);
    this.init();
  }

  async init() {
    const demoId = appState.get('selectedDemoId');
    if (!demoId) {
      this.renderError('未选择 Demo');
      return;
    }

    const prevDemoId = this.demo?.id;
    if (prevDemoId !== demoId) {
      this.activeFileName = null;
      this.viewMode = 'preview';
      this._unsaved = false;
    }

    try {
      [this.demo, this.assets] = await Promise.all([getDemo(demoId), getAssetsByDemo(demoId)]);
      if (!this.demo) {
        this.renderError(t('demo.not_found'));
        return;
      }
      this.render();
      if (this.viewMode === 'preview') await this._loadPreview();
    } catch (err) {
      console.error('DemoView init error:', err);
      this.renderError(t('demo.load_error'));
    }
  }

  async _loadPreview() {
    if (!this.previewPanel) return;
    const srcdoc = await buildSrcdoc(this.demo, this.assets, this.activeFileName);
    this.previewPanel.setSrcdoc(srcdoc);
  }

  get _currentFile() {
    const files = this.demo?.files || [];
    if (this.activeFileName) return files.find((f) => f.name === this.activeFileName) || files[0];
    return files[0] || null;
  }

  render() {
    this.container.innerHTML = `
      <div class="demo-view flex flex-col h-full overflow-hidden">
        <!-- Header -->
        <div class="shrink-0 flex items-center gap-2 px-3 h-12 border-b border-[var(--color-border)] bg-[var(--color-bg-secondary)]">
          <a href="#/" class="btn btn-icon btn-ghost shrink-0" title="${t('common.back')}">
            ${icon('arrow-left', 'w-4 h-4')}
          </a>

          <div class="flex-1 min-w-0 flex items-center">
            <h1 id="demo-title-display"
                class="text-sm font-semibold text-[var(--color-text-primary)] truncate cursor-pointer hover:text-[var(--color-accent)] transition-colors"
                title="${escapeHtml(this.demo.title)}">${escapeHtml(this.demo.title)}</h1>
            <input id="demo-title-input"
                   type="text"
                   class="hidden text-sm font-semibold bg-transparent border-b border-[var(--color-accent)] outline-none text-[var(--color-text-primary)] w-full"
                   value="${escapeHtml(this.demo.title)}" maxlength="200" />
          </div>

          <!-- Code/Preview toggle -->
          <div class="flex items-center gap-0.5 rounded-lg border border-[var(--color-border)] p-0.5 bg-[var(--color-bg-tertiary)] shrink-0">
            <button type="button" id="toggle-preview"
                    class="flex items-center gap-1 px-2 py-1 rounded text-xs transition-colors ${this.viewMode === 'preview' ? 'bg-[var(--color-bg-secondary)] text-[var(--color-text-primary)] shadow-sm font-medium' : 'text-[var(--color-text-tertiary)] hover:text-[var(--color-text-secondary)]'}">
              ${icon('eye', 'w-3.5 h-3.5')}
              ${t('demo.view.preview')}
            </button>
            <button type="button" id="toggle-code"
                    class="flex items-center gap-1 px-2 py-1 rounded text-xs transition-colors ${this.viewMode === 'code' ? 'bg-[var(--color-bg-secondary)] text-[var(--color-text-primary)] shadow-sm font-medium' : 'text-[var(--color-text-tertiary)] hover:text-[var(--color-text-secondary)]'}">
              ${icon('code', 'w-3.5 h-3.5')}
              ${t('demo.view.code')}
            </button>
          </div>

          <a href="#/demos/${escapeHtml(this.demo.id)}/edit"
             class="btn btn-icon btn-ghost shrink-0"
             title="${t('demo.edit_btn')}">
            ${icon('pencil-simple', 'w-4 h-4')}
          </a>

          <button type="button" id="delete-demo-btn"
                  class="btn btn-icon btn-ghost hover:text-[var(--color-danger)] shrink-0"
                  title="${t('demo.delete_btn')}">
            ${icon('trash', 'w-4 h-4')}
          </button>
        </div>

        <!-- Body -->
        <div class="flex-1 overflow-hidden" id="demo-body">
          ${this._renderBody()}
        </div>
      </div>
    `;

    if (this.viewMode === 'preview') {
      const previewArea = this.container.querySelector('#demo-preview-area');
      if (previewArea) this.previewPanel = new PreviewPanel(previewArea);
    }

    this._bindHeaderEvents();
    if (this.viewMode === 'code') this._bindCodeEvents();
  }

  _renderBody() {
    if (this.viewMode === 'preview') {
      return `<div class="w-full h-full" id="demo-preview-area"></div>`;
    }

    const files = this.demo?.files || [];
    const current = this._currentFile;

    return `
      <div class="flex h-full overflow-hidden">
        <!-- File list sidebar -->
        <div class="w-44 shrink-0 border-r border-[var(--color-border)] bg-[var(--color-bg-secondary)] overflow-y-auto">
          ${
            files.length === 0
              ? `<p class="px-3 py-3 text-xs text-[var(--color-text-tertiary)]">${t('editor.no_files')}</p>`
              : files
                  .map(
                    (f) => `
                <button type="button"
                        class="w-full text-left px-3 py-2 text-xs flex items-center gap-2 transition-colors
                               ${f.name === current?.name ? 'bg-[var(--color-accent)]/10 text-[var(--color-accent)] font-medium' : 'text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-hover)] hover:text-[var(--color-text-primary)]'}"
                        data-filename="${escapeHtml(f.name)}">
                  ${icon('file-code', 'w-3.5 h-3.5 shrink-0')}
                  <span class="truncate">${escapeHtml(f.name)}</span>
                </button>
              `
                  )
                  .join('')
          }
        </div>

        <!-- Editor area -->
        <div class="flex-1 flex flex-col overflow-hidden">
          <div class="shrink-0 flex items-center justify-between px-3 py-1.5 border-b border-[var(--color-border)] bg-[var(--color-bg-secondary)]">
            <span class="text-xs text-[var(--color-text-tertiary)] font-mono">${escapeHtml(current?.name || '')}</span>
            <div class="flex items-center gap-2">
              <span id="unsaved-indicator" class="text-xs text-amber-500 ${this._unsaved ? '' : 'hidden'}">${t('demo.view.unsaved')}</span>
              <button type="button" id="save-code-btn" class="btn btn-primary btn-sm gap-1">
                ${icon('floppy-disk', 'w-3.5 h-3.5')}
                ${t('demo.view.save')}
              </button>
            </div>
          </div>
          <textarea id="code-editor"
                    class="flex-1 w-full p-4 font-mono text-sm bg-[var(--color-bg-primary)] text-[var(--color-text-primary)] resize-none outline-none leading-relaxed"
                    spellcheck="false"
                    wrap="off"
          >${current ? escapeHtml(current.content) : ''}</textarea>
        </div>
      </div>
    `;
  }

  _bindHeaderEvents() {
    const titleDisplay = this.container.querySelector('#demo-title-display');
    const titleInput = this.container.querySelector('#demo-title-input');

    titleDisplay?.addEventListener('click', () => {
      titleDisplay.classList.add('hidden');
      titleInput.classList.remove('hidden');
      titleInput.focus();
      titleInput.select();
    });

    const saveTitle = async () => {
      const newTitle = titleInput.value.trim();
      titleInput.classList.add('hidden');
      titleDisplay.classList.remove('hidden');
      if (!newTitle || newTitle === this.demo.title) return;
      try {
        this.demo = await updateDemo(this.demo.id, { title: newTitle });
        titleDisplay.textContent = newTitle;
        titleDisplay.title = newTitle;
        appState.notifyDataChanged('demo');
      } catch (err) {
        console.error('Update title error:', err);
        toast.error(t('common.error'));
        titleInput.value = this.demo.title;
      }
    };

    titleInput?.addEventListener('blur', saveTitle);
    titleInput?.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        titleInput.blur();
      }
      if (e.key === 'Escape') {
        titleInput.value = this.demo.title;
        titleInput.blur();
      }
    });

    this.container.querySelector('#toggle-preview')?.addEventListener('click', () => {
      if (this.viewMode === 'preview') return;
      this.viewMode = 'preview';
      this._switchView();
    });

    this.container.querySelector('#toggle-code')?.addEventListener('click', () => {
      if (this.viewMode === 'code') return;
      this.viewMode = 'code';
      this._switchView();
    });

    this.container.querySelector('#delete-demo-btn')?.addEventListener('click', () => {
      this._handleDelete();
    });
  }

  _bindCodeEvents() {
    // File switching
    this.container.querySelectorAll('[data-filename]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const filename = btn.dataset.filename;
        if (filename === this._currentFile?.name) return;
        this.activeFileName = filename;
        const body = this.container.querySelector('#demo-body');
        if (body) {
          body.innerHTML = this._renderBody();
          this._bindCodeEvents();
        }
      });
    });

    // Track unsaved changes
    const textarea = this.container.querySelector('#code-editor');
    textarea?.addEventListener('input', () => {
      if (!this._unsaved) {
        this._unsaved = true;
        const indicator = this.container.querySelector('#unsaved-indicator');
        if (indicator) indicator.classList.remove('hidden');
      }
    });

    // Save
    this.container.querySelector('#save-code-btn')?.addEventListener('click', () => {
      this._saveCode();
    });
  }

  async _saveCode() {
    const textarea = this.container.querySelector('#code-editor');
    const current = this._currentFile;
    if (!textarea || !current) return;

    const newContent = textarea.value;
    try {
      const files = (this.demo.files || []).map((f) =>
        f.name === current.name ? { ...f, content: newContent } : f
      );
      this.demo = await updateDemo(this.demo.id, { files });
      this._unsaved = false;
      const indicator = this.container.querySelector('#unsaved-indicator');
      if (indicator) indicator.classList.add('hidden');
      toast.success(t('editor.save.success'));
      appState.notifyDataChanged('demo');
    } catch (err) {
      console.error('Save code error:', err);
      toast.error(t('editor.save.error'));
    }
  }

  async _switchView() {
    // Update toggle button styles
    const togglePreview = this.container.querySelector('#toggle-preview');
    const toggleCode = this.container.querySelector('#toggle-code');
    const activeClass =
      'bg-[var(--color-bg-secondary)] text-[var(--color-text-primary)] shadow-sm font-medium';
    const inactiveClass =
      'text-[var(--color-text-tertiary)] hover:text-[var(--color-text-secondary)]';

    if (togglePreview) {
      togglePreview.className = `flex items-center gap-1 px-2 py-1 rounded text-xs transition-colors ${this.viewMode === 'preview' ? activeClass : inactiveClass}`;
    }
    if (toggleCode) {
      toggleCode.className = `flex items-center gap-1 px-2 py-1 rounded text-xs transition-colors ${this.viewMode === 'code' ? activeClass : inactiveClass}`;
    }

    // Re-render body
    const body = this.container.querySelector('#demo-body');
    if (!body) return;
    this.previewPanel = null;
    body.innerHTML = this._renderBody();

    if (this.viewMode === 'preview') {
      const previewArea = this.container.querySelector('#demo-preview-area');
      if (previewArea) {
        this.previewPanel = new PreviewPanel(previewArea);
        await this._loadPreview();
      }
    } else {
      this._bindCodeEvents();
    }
  }

  async _handleDelete() {
    const confirmed = await confirm({
      title: t('demo.delete.confirm.title'),
      message: t('demo.delete.confirm.message'),
      confirmText: t('demo.delete_btn'),
      cancelText: t('modal.cancel'),
      danger: true,
    });
    if (!confirmed) return;

    try {
      await deleteAssetsByDemo(this.demo.id);
      await deleteDemo(this.demo.id);
      appState.notifyDataChanged('demo');
      toast.success(t('common.success'));
      appState.navigate('#/');
    } catch (err) {
      console.error('Delete demo error:', err);
      toast.error(t('common.error'));
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

  destroy() {
    window.removeEventListener('locale-change', this._localeHandler);
  }
}
