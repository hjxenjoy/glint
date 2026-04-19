import { appState } from 'store/app-state.js';
import { getDemo, updateDemo, deleteDemo, cloneDemo } from 'db/demos.js';
import {
  getAssetsByDemo,
  deleteAssetsByDemo,
  saveAsset,
  deleteAsset,
  cloneAssetsByDemo,
} from 'db/assets.js';
import { getAllProjects } from 'db/projects.js';
import { buildSrcdoc, resolveFileSet } from 'utils/file-resolver.js';
import { triggerDownload } from 'utils/zip.js';
import { formatBytes } from 'utils/base64.js';
import { formatFull } from 'utils/date.js';
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

// View modes: 'preview' | 'code' | 'files' | 'info'
const MODES = ['preview', 'code', 'files', 'info'];

export class DemoView {
  constructor(container) {
    this.container = container;
    this.demo = null;
    this.assets = [];
    this.projects = [];
    this.activeFileName = null;
    this.viewMode = 'preview';
    this.previewPanel = null;
    this._unsaved = false;
    // Files tab: which text file is being inline-edited (name string or null)
    this._editingFileName = null;
    this._tagInput = null;
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
      this._editingFileName = null;
    }

    try {
      [this.demo, this.assets, this.projects] = await Promise.all([
        getDemo(demoId),
        getAssetsByDemo(demoId),
        getAllProjects(),
      ]);
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
    const project = this.demo?.projectId
      ? this.projects.find((p) => p.id === this.demo.projectId)
      : null;
    const srcdoc = buildSrcdoc(this.demo, this.assets, this.activeFileName, project?.sharedFiles);
    this.previewPanel.setSrcdoc(srcdoc);
  }

  get _currentFile() {
    const files = this.demo?.files || [];
    if (this.activeFileName) return files.find((f) => f.name === this.activeFileName) || files[0];
    return files[0] || null;
  }

  // ─── Render ────────────────────────────────────────────────────────────────

  render() {
    const activeClass =
      'bg-[var(--color-bg-secondary)] text-[var(--color-text-primary)] shadow-sm font-medium';
    const inactiveClass =
      'text-[var(--color-text-tertiary)] hover:text-[var(--color-text-secondary)]';

    const tabBtn = (id, mode, iconName, label) => `
      <button type="button" id="${id}"
              class="flex items-center gap-1 px-2 py-1 rounded text-xs transition-colors ${this.viewMode === mode ? activeClass : inactiveClass}">
        ${icon(iconName, 'w-3.5 h-3.5')}
        ${label}
      </button>`;

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

          <!-- Tab toggle: Preview / Code / Files / Info -->
          <div class="flex items-center gap-0.5 rounded-lg border border-[var(--color-border)] p-0.5 bg-[var(--color-bg-tertiary)] shrink-0">
            ${tabBtn('toggle-preview', 'preview', 'eye', t('demo.view.preview'))}
            ${tabBtn('toggle-code', 'code', 'code', t('demo.view.code'))}
            ${tabBtn('toggle-files', 'files', 'folder-open', t('editor.tab.files'))}
            ${tabBtn('toggle-info', 'info', 'info', t('editor.tab.metadata'))}
          </div>

          <button type="button" id="export-html-btn"
                  class="btn btn-icon btn-ghost shrink-0"
                  title="导出为独立 HTML 文件">
            ${icon('download', 'w-4 h-4')}
          </button>

          <button type="button" id="clone-demo-btn"
                  class="btn btn-icon btn-ghost shrink-0"
                  title="${t('demo.clone')}">
            ${icon('copy', 'w-4 h-4')}
          </button>

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
    if (this.viewMode === 'files') this._bindFilesEvents();
    if (this.viewMode === 'info') this._bindInfoEvents();
  }

  _renderBody() {
    switch (this.viewMode) {
      case 'preview':
        return `<div class="w-full h-full" id="demo-preview-area"></div>`;
      case 'code':
        return this._renderCodeBody();
      case 'files':
        return this._renderFilesBody();
      case 'info':
        return this._renderInfoBody();
      default:
        return `<div class="w-full h-full" id="demo-preview-area"></div>`;
    }
  }

  // ─── Code view ─────────────────────────────────────────────────────────────

  _renderCodeBody() {
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
          <div class="flex-1 flex overflow-hidden font-mono text-sm leading-relaxed">
            <div id="line-numbers"
                 class="shrink-0 w-10 py-4 text-right select-none overflow-hidden bg-[var(--color-bg-secondary)] border-r border-[var(--color-border)] text-[var(--color-text-tertiary)] text-[11px] leading-relaxed pr-2"
                 aria-hidden="true"></div>
            <textarea id="code-editor"
                      class="flex-1 px-4 py-4 bg-[var(--color-bg-primary)] text-[var(--color-text-primary)] resize-none outline-none leading-relaxed"
                      spellcheck="false"
                      wrap="off"
            >${current ? escapeHtml(current.content) : ''}</textarea>
          </div>
        </div>
      </div>
    `;
  }

  // ─── Files view ────────────────────────────────────────────────────────────

  _renderFilesBody() {
    const files = this.demo?.files || [];
    const assets = this.assets || [];

    const renderFileRow = (f) => {
      const isEditing = this._editingFileName === f.name;
      const isEntry = f.name === (this.demo.entryFile || files[0]?.name);
      return `
        <div class="file-row border-b border-[var(--color-border)] last:border-b-0" data-file="${escapeHtml(f.name)}">
          <div class="flex items-center gap-2 px-4 py-2.5">
            ${icon('file-code', 'w-4 h-4 shrink-0 text-[var(--color-text-tertiary)]')}
            <button type="button"
                    class="flex-1 text-left text-sm font-mono truncate ${isEditing ? 'text-[var(--color-accent)]' : 'text-[var(--color-text-primary)] hover:text-[var(--color-accent)]'} transition-colors"
                    data-edit-file="${escapeHtml(f.name)}">
              ${escapeHtml(f.name)}
              ${isEntry ? `<span class="ml-1.5 text-xs text-[var(--color-accent)] opacity-70">${t('editor.entry_file')}</span>` : ''}
            </button>
            <div class="flex items-center gap-1 shrink-0">
              ${
                !isEntry
                  ? `
              <button type="button"
                      class="btn btn-icon btn-ghost btn-xs opacity-60 hover:opacity-100"
                      title="${t('editor.set_entry')}"
                      data-set-entry="${escapeHtml(f.name)}">
                ${icon('star', 'w-3.5 h-3.5')}
              </button>`
                  : ''
              }
              <button type="button"
                      class="btn btn-icon btn-ghost btn-xs opacity-60 hover:opacity-100 hover:text-[var(--color-danger)]"
                      title="${t('editor.file.delete')}"
                      data-delete-file="${escapeHtml(f.name)}">
                ${icon('trash', 'w-3.5 h-3.5')}
              </button>
            </div>
          </div>
          ${
            isEditing
              ? `
          <div class="px-4 pb-3">
            <textarea id="inline-file-editor"
                      class="w-full h-64 p-3 font-mono text-xs bg-[var(--color-bg-tertiary)] text-[var(--color-text-primary)] border border-[var(--color-border)] rounded-lg resize-y outline-none focus:ring-2 focus:ring-[var(--color-accent)] focus:border-[var(--color-accent)] leading-relaxed"
                      spellcheck="false"
                      wrap="off"
                      data-editing-file="${escapeHtml(f.name)}"
            >${escapeHtml(f.content)}</textarea>
            <div class="flex items-center gap-2 mt-2">
              <button type="button" id="inline-save-btn" class="btn btn-primary btn-sm gap-1" data-save-file="${escapeHtml(f.name)}">
                ${icon('floppy-disk', 'w-3.5 h-3.5')}
                ${t('common.save')}
              </button>
              <button type="button" id="inline-cancel-btn" class="btn btn-secondary btn-sm">
                ${t('common.cancel')}
              </button>
            </div>
          </div>`
              : ''
          }
        </div>
      `;
    };

    const renderAssetRow = (a) => `
      <div class="flex items-center gap-2 px-4 py-2.5 border-b border-[var(--color-border)] last:border-b-0">
        ${icon('image', 'w-4 h-4 shrink-0 text-[var(--color-text-tertiary)]')}
        <span class="flex-1 text-sm font-mono truncate text-[var(--color-text-primary)]">${escapeHtml(a.filename)}</span>
        <span class="text-xs text-[var(--color-text-tertiary)] shrink-0">${formatBytes(a.size || 0)}</span>
        <button type="button"
                class="btn btn-icon btn-ghost btn-xs opacity-60 hover:opacity-100 hover:text-[var(--color-danger)] shrink-0"
                title="${t('editor.file.delete')}"
                data-delete-asset="${escapeHtml(a.id)}">
          ${icon('trash', 'w-3.5 h-3.5')}
        </button>
      </div>
    `;

    return `
      <div class="h-full overflow-y-auto">
        <!-- Upload zone -->
        <div id="files-drop-zone"
             class="mx-4 mt-4 mb-3 border-2 border-dashed border-[var(--color-border)] rounded-xl p-6 flex flex-col items-center gap-2 text-center transition-colors cursor-pointer hover:border-[var(--color-accent)] hover:bg-[var(--color-accent)]/5">
          ${icon('upload-simple', 'w-6 h-6 text-[var(--color-text-tertiary)]')}
          <p class="text-sm text-[var(--color-text-secondary)]">${t('editor.drop_zone')}</p>
          <input id="files-input" type="file" multiple class="hidden"
                 accept=".html,.css,.js,.json,.txt,.md,.svg,.xml,.png,.jpg,.jpeg,.gif,.webp" />
          <button type="button" id="files-upload-btn" class="btn btn-secondary btn-sm mt-1">
            ${icon('folder-open', 'w-3.5 h-3.5')}
            ${t('editor.upload')}
          </button>
        </div>

        <!-- Text files section -->
        <div class="mx-4 mb-3 rounded-xl border border-[var(--color-border)] overflow-hidden">
          <div class="flex items-center justify-between px-4 py-2 bg-[var(--color-bg-secondary)] border-b border-[var(--color-border)]">
            <span class="text-xs font-semibold text-[var(--color-text-secondary)] uppercase tracking-wide">${t('editor.tab.files')} (${files.length})</span>
          </div>
          ${
            files.length === 0
              ? `<p class="px-4 py-4 text-sm text-[var(--color-text-tertiary)]">${t('editor.no_files')}</p>`
              : files.map(renderFileRow).join('')
          }
        </div>

        <!-- Assets section -->
        <div class="mx-4 mb-4 rounded-xl border border-[var(--color-border)] overflow-hidden">
          <div class="flex items-center justify-between px-4 py-2 bg-[var(--color-bg-secondary)] border-b border-[var(--color-border)]">
            <span class="text-xs font-semibold text-[var(--color-text-secondary)] uppercase tracking-wide">${t('editor.assets_section')} (${assets.length})</span>
          </div>
          ${
            assets.length === 0
              ? `<p class="px-4 py-4 text-sm text-[var(--color-text-tertiary)]">${t('common.empty')}</p>`
              : assets.map(renderAssetRow).join('')
          }
        </div>
      </div>
    `;
  }

  // ─── Info view ─────────────────────────────────────────────────────────────

  _renderInfoBody() {
    const demo = this.demo;
    const projects = this.projects || [];

    const projectOptions = [
      `<option value="" ${!demo.projectId ? 'selected' : ''}>${t('editor.no_project')}</option>`,
      ...projects.map(
        (p) =>
          `<option value="${escapeHtml(p.id)}" ${demo.projectId === p.id ? 'selected' : ''}>${escapeHtml(p.title)}</option>`
      ),
    ].join('');

    return `
      <div class="h-full overflow-y-auto">
        <div class="max-w-2xl mx-auto px-4 py-6 flex flex-col gap-5">

          <!-- Notes -->
          <div class="flex flex-col gap-1.5">
            <label class="text-xs font-semibold text-[var(--color-text-secondary)] uppercase tracking-wide">${t('editor.notes')}</label>
            <textarea id="info-notes"
                      class="w-full p-3 text-sm rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-secondary)] text-[var(--color-text-primary)] resize-none outline-none focus:ring-2 focus:ring-[var(--color-accent)] focus:border-[var(--color-accent)] transition-colors leading-relaxed min-h-24"
                      placeholder="${t('editor.notes.placeholder')}"
                      rows="4"
            >${escapeHtml(demo.notes || '')}</textarea>
          </div>

          <!-- Project assignment -->
          <div class="flex flex-col gap-1.5">
            <label class="text-xs font-semibold text-[var(--color-text-secondary)] uppercase tracking-wide">${t('editor.project')}</label>
            <select id="info-project"
                    class="w-full px-3 py-2 text-sm rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-secondary)] text-[var(--color-text-primary)] outline-none focus:ring-2 focus:ring-[var(--color-accent)] focus:border-[var(--color-accent)] transition-colors">
              ${projectOptions}
            </select>
          </div>

          <!-- Timestamps -->
          <div class="flex flex-col gap-2 pt-2 border-t border-[var(--color-border)]">
            <div class="flex items-center justify-between text-xs">
              <span class="text-[var(--color-text-tertiary)]">${t('editor.created')}</span>
              <span class="text-[var(--color-text-secondary)] font-mono">${formatFull(demo.createdAt)}</span>
            </div>
            <div class="flex items-center justify-between text-xs">
              <span class="text-[var(--color-text-tertiary)]">${t('editor.updated')}</span>
              <span class="text-[var(--color-text-secondary)] font-mono">${formatFull(demo.updatedAt)}</span>
            </div>
          </div>

        </div>
      </div>
    `;
  }

  // ─── Header events ─────────────────────────────────────────────────────────

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

    // Tab toggle buttons
    for (const mode of MODES) {
      this.container.querySelector(`#toggle-${mode}`)?.addEventListener('click', () => {
        if (this.viewMode === mode) return;
        this.viewMode = mode;
        this._switchView();
      });
    }

    this.container.querySelector('#export-html-btn')?.addEventListener('click', () => {
      this._exportHtml();
    });

    this.container.querySelector('#clone-demo-btn')?.addEventListener('click', () => {
      this._handleClone();
    });

    this.container.querySelector('#delete-demo-btn')?.addEventListener('click', () => {
      this._handleDelete();
    });
  }

  async _handleClone() {
    try {
      const cloned = await cloneDemo(this.demo.id);
      await cloneAssetsByDemo(this.demo.id, cloned.id);
      appState.notifyDataChanged('demos');
      toast.success('Demo 已克隆');
      appState.navigate(`#/demos/${cloned.id}`);
    } catch (err) {
      console.error('Clone error:', err);
      toast.error('克隆失败，请重试');
    }
  }

  async _exportHtml() {
    try {
      const srcdoc = buildSrcdoc(this.demo, this.assets);
      const blob = new Blob([srcdoc], { type: 'text/html;charset=utf-8' });
      const filename = `${this.demo.title.replace(/[^a-zA-Z0-9\u4e00-\u9fa5_-]/g, '_')}.html`;
      await triggerDownload(blob, filename);
      toast.success('已导出为独立 HTML 文件');
    } catch (err) {
      console.error('Export HTML error:', err);
      toast.error('导出失败');
    }
  }

  // ─── Code events ────────────────────────────────────────────────────────────

  _bindCodeEvents() {
    this.container.querySelectorAll('[data-filename]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const filename = btn.dataset.filename;
        if (filename === this._currentFile?.name) return;
        this.activeFileName = filename;
        const body = this.container.querySelector('#demo-body');
        if (body) {
          body.innerHTML = this._renderCodeBody();
          this._bindCodeEvents();
        }
      });
    });

    const textarea = this.container.querySelector('#code-editor');
    const lineNumbers = this.container.querySelector('#line-numbers');

    const updateLineNumbers = () => {
      if (!lineNumbers || !textarea) return;
      const count = textarea.value.split('\n').length;
      lineNumbers.innerHTML = Array.from({ length: count }, (_, i) => `<div>${i + 1}</div>`).join(
        ''
      );
      lineNumbers.scrollTop = textarea.scrollTop;
    };
    updateLineNumbers();

    textarea?.addEventListener('input', () => {
      updateLineNumbers();
      if (!this._unsaved) {
        this._unsaved = true;
        const indicator = this.container.querySelector('#unsaved-indicator');
        if (indicator) indicator.classList.remove('hidden');
      }
    });

    textarea?.addEventListener('scroll', () => {
      if (lineNumbers) lineNumbers.scrollTop = textarea.scrollTop;
    });

    textarea?.addEventListener('keydown', (e) => {
      if (e.key === 'Tab') {
        e.preventDefault();
        const start = textarea.selectionStart;
        const end = textarea.selectionEnd;
        textarea.value = textarea.value.slice(0, start) + '  ' + textarea.value.slice(end);
        textarea.selectionStart = textarea.selectionEnd = start + 2;
        textarea.dispatchEvent(new Event('input'));
      }
    });

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

  // ─── Files tab events ──────────────────────────────────────────────────────

  _bindFilesEvents() {
    const body = this.container.querySelector('#demo-body');

    // Drop zone click → open file input
    const dropZone = body.querySelector('#files-drop-zone');
    const fileInput = body.querySelector('#files-input');
    const uploadBtn = body.querySelector('#files-upload-btn');

    uploadBtn?.addEventListener('click', (e) => {
      e.stopPropagation();
      fileInput?.click();
    });

    dropZone?.addEventListener('click', () => fileInput?.click());

    dropZone?.addEventListener('dragover', (e) => {
      e.preventDefault();
      dropZone.classList.add('border-[var(--color-accent)]', 'bg-[var(--color-accent)]/10');
    });

    dropZone?.addEventListener('dragleave', () => {
      dropZone.classList.remove('border-[var(--color-accent)]', 'bg-[var(--color-accent)]/10');
    });

    dropZone?.addEventListener('drop', async (e) => {
      e.preventDefault();
      dropZone.classList.remove('border-[var(--color-accent)]', 'bg-[var(--color-accent)]/10');
      if (e.dataTransfer?.files?.length) {
        await this._handleFileUpload(e.dataTransfer.files);
      }
    });

    fileInput?.addEventListener('change', async () => {
      if (fileInput.files?.length) {
        await this._handleFileUpload(fileInput.files);
        fileInput.value = '';
      }
    });

    // Inline file editor open
    body.querySelectorAll('[data-edit-file]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const filename = btn.dataset.editFile;
        this._editingFileName = this._editingFileName === filename ? null : filename;
        this._refreshFilesBody();
      });
    });

    // Inline save
    body.querySelector('#inline-save-btn')?.addEventListener('click', async () => {
      await this._saveInlineFile();
    });

    // Inline cancel
    body.querySelector('#inline-cancel-btn')?.addEventListener('click', () => {
      this._editingFileName = null;
      this._refreshFilesBody();
    });

    // Tab key in inline editor → insert spaces
    body.querySelector('#inline-file-editor')?.addEventListener('keydown', (e) => {
      if (e.key === 'Tab') {
        e.preventDefault();
        const ta = e.currentTarget;
        const start = ta.selectionStart;
        const end = ta.selectionEnd;
        ta.value = ta.value.slice(0, start) + '  ' + ta.value.slice(end);
        ta.selectionStart = ta.selectionEnd = start + 2;
      }
    });

    // Set entry file
    body.querySelectorAll('[data-set-entry]').forEach((btn) => {
      btn.addEventListener('click', async () => {
        const filename = btn.dataset.setEntry;
        try {
          this.demo = await updateDemo(this.demo.id, { entryFile: filename });
          appState.notifyDataChanged('demo');
          this._refreshFilesBody();
        } catch (err) {
          console.error('Set entry error:', err);
          toast.error(t('common.error'));
        }
      });
    });

    // Delete text file
    body.querySelectorAll('[data-delete-file]').forEach((btn) => {
      btn.addEventListener('click', async () => {
        const filename = btn.dataset.deleteFile;
        const confirmed = await confirm({
          title: t('common.delete'),
          message: `${t('editor.file.delete')} "${filename}"?`,
          confirmText: t('common.delete'),
          cancelText: t('modal.cancel'),
          danger: true,
        });
        if (!confirmed) return;
        try {
          const files = (this.demo.files || []).filter((f) => f.name !== filename);
          // If deleted file was entry, reset entryFile
          const entryFile =
            this.demo.entryFile === filename
              ? files.find((f) => f.name.endsWith('.html'))?.name || files[0]?.name || ''
              : this.demo.entryFile;
          this.demo = await updateDemo(this.demo.id, { files, entryFile });
          if (this._editingFileName === filename) this._editingFileName = null;
          appState.notifyDataChanged('demo');
          this._refreshFilesBody();
        } catch (err) {
          console.error('Delete file error:', err);
          toast.error(t('common.error'));
        }
      });
    });

    // Delete asset
    body.querySelectorAll('[data-delete-asset]').forEach((btn) => {
      btn.addEventListener('click', async () => {
        const assetId = btn.dataset.deleteAsset;
        const asset = this.assets.find((a) => a.id === assetId);
        const confirmed = await confirm({
          title: t('common.delete'),
          message: `${t('editor.file.delete')} "${asset?.filename}"?`,
          confirmText: t('common.delete'),
          cancelText: t('modal.cancel'),
          danger: true,
        });
        if (!confirmed) return;
        try {
          await deleteAsset(assetId);
          this.assets = this.assets.filter((a) => a.id !== assetId);
          appState.notifyDataChanged('demo');
          this._refreshFilesBody();
        } catch (err) {
          console.error('Delete asset error:', err);
          toast.error(t('common.error'));
        }
      });
    });
  }

  _refreshFilesBody() {
    const body = this.container.querySelector('#demo-body');
    if (!body) return;
    body.innerHTML = this._renderFilesBody();
    this._bindFilesEvents();
  }

  async _handleFileUpload(fileList) {
    try {
      const { files: newTextFiles, assets: newAssets } = await resolveFileSet(fileList);

      // Merge text files (replace existing by name)
      const existingFiles = this.demo.files || [];
      const mergedFiles = [...existingFiles];
      for (const nf of newTextFiles) {
        const idx = mergedFiles.findIndex((f) => f.name === nf.name);
        if (idx >= 0) mergedFiles[idx] = nf;
        else mergedFiles.push(nf);
      }

      // Determine if entryFile needs updating
      let entryFile = this.demo.entryFile;
      if (!entryFile || !mergedFiles.find((f) => f.name === entryFile)) {
        entryFile =
          mergedFiles.find((f) => f.name === 'index.html')?.name ||
          mergedFiles.find((f) => f.name.endsWith('.html'))?.name ||
          mergedFiles[0]?.name ||
          '';
      }

      this.demo = await updateDemo(this.demo.id, { files: mergedFiles, entryFile });

      // Save assets
      for (const a of newAssets) {
        const saved = await saveAsset({ demoId: this.demo.id, ...a });
        const idx = this.assets.findIndex((ex) => ex.filename === a.filename);
        if (idx >= 0) this.assets[idx] = saved;
        else this.assets.push(saved);
      }

      appState.notifyDataChanged('demo');
      toast.success(t('editor.save.success'));
      this._refreshFilesBody();
    } catch (err) {
      console.error('File upload error:', err);
      toast.error(t('editor.save.error'));
    }
  }

  async _saveInlineFile() {
    const textarea = this.container.querySelector('#inline-file-editor');
    if (!textarea) return;
    const filename = textarea.dataset.editingFile;
    if (!filename) return;
    const newContent = textarea.value;
    try {
      const files = (this.demo.files || []).map((f) =>
        f.name === filename ? { ...f, content: newContent } : f
      );
      this.demo = await updateDemo(this.demo.id, { files });
      toast.success(t('editor.save.success'));
      this._editingFileName = null;
      appState.notifyDataChanged('demo');
      this._refreshFilesBody();
    } catch (err) {
      console.error('Inline save error:', err);
      toast.error(t('editor.save.error'));
    }
  }

  // ─── Info tab events ───────────────────────────────────────────────────────

  _bindInfoEvents() {
    const body = this.container.querySelector('#demo-body');

    // Notes — save on blur
    const notesEl = body.querySelector('#info-notes');
    notesEl?.addEventListener('blur', async () => {
      const notes = notesEl.value;
      if (notes === (this.demo.notes || '')) return;
      try {
        this.demo = await updateDemo(this.demo.id, { notes });
        appState.notifyDataChanged('demo');
      } catch (err) {
        console.error('Save notes error:', err);
        toast.error(t('common.error'));
        notesEl.value = this.demo.notes || '';
      }
    });

    // Auto-resize notes textarea
    notesEl?.addEventListener('input', () => {
      notesEl.style.height = 'auto';
      notesEl.style.height = notesEl.scrollHeight + 'px';
    });

    // Project assignment — save on change
    const projectSelect = body.querySelector('#info-project');
    projectSelect?.addEventListener('change', async () => {
      const projectId = projectSelect.value || null;
      try {
        this.demo = await updateDemo(this.demo.id, { projectId });
        appState.notifyDataChanged('demo');
      } catch (err) {
        console.error('Save project error:', err);
        toast.error(t('common.error'));
        projectSelect.value = this.demo.projectId || '';
      }
    });
  }

  // ─── View switching ────────────────────────────────────────────────────────

  async _switchView() {
    // Update all toggle button styles
    const activeClass =
      'bg-[var(--color-bg-secondary)] text-[var(--color-text-primary)] shadow-sm font-medium';
    const inactiveClass =
      'text-[var(--color-text-tertiary)] hover:text-[var(--color-text-secondary)]';

    for (const mode of MODES) {
      const btn = this.container.querySelector(`#toggle-${mode}`);
      if (btn) {
        btn.className = `flex items-center gap-1 px-2 py-1 rounded text-xs transition-colors ${this.viewMode === mode ? activeClass : inactiveClass}`;
      }
    }

    // Destroy existing tag input if switching away from info
    if (this.viewMode !== 'info' && this._tagInput) {
      this._tagInput.destroy();
      this._tagInput = null;
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
    } else if (this.viewMode === 'code') {
      this._bindCodeEvents();
    } else if (this.viewMode === 'files') {
      this._bindFilesEvents();
    } else if (this.viewMode === 'info') {
      this._bindInfoEvents();
    }
  }

  // ─── Delete demo ──────────────────────────────────────────────────────────

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

  // ─── Error state ──────────────────────────────────────────────────────────

  renderError(message) {
    this.container.innerHTML = `
      <div class="flex flex-col items-center justify-center h-full gap-4 text-[var(--color-text-tertiary)]">
        ${icon('warning', 'w-12 h-12 opacity-40')}
        <p class="text-sm">${escapeHtml(message)}</p>
        <a href="#/" class="btn btn-secondary btn-sm">${t('common.back')}</a>
      </div>
    `;
  }

  // ─── Lifecycle ────────────────────────────────────────────────────────────

  destroy() {
    window.removeEventListener('locale-change', this._localeHandler);
    if (this._tagInput) {
      this._tagInput.destroy();
      this._tagInput = null;
    }
  }
}
