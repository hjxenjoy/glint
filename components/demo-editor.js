import { appState } from 'store/app-state.js';
import { getDemo, updateDemo, createDemo } from 'db/demos.js';
import { getAssetsByDemo, saveAsset, deleteAsset } from 'db/assets.js';
import { getAllProjects } from 'db/projects.js';
import { resolveFileSet } from 'utils/file-resolver.js';
import { base64Size, formatBytes } from 'utils/base64.js';
import { formatFull } from 'utils/date.js';
import { toast } from 'components/toast.js';
import { confirm } from 'components/modal.js';
import { TagInput } from 'components/tag-input.js';
import { t } from 'utils/i18n.js';

// ---------------------------------------------------------------------------
// Shared helpers
// ---------------------------------------------------------------------------

function escapeHtml(str) {
  return String(str || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

const TEXT_EXTS = new Set(['html', 'htm', 'css', 'js', 'json', 'txt', 'md', 'svg', 'xml']);
const IMAGE_EXTS = new Set(['png', 'jpg', 'jpeg', 'gif', 'webp', 'avif', 'ico', 'svg']);

function fileExt(name) {
  return (name || '').split('.').pop().toLowerCase();
}

function isTextFile(name) {
  return TEXT_EXTS.has(fileExt(name));
}

function isImageFile(name) {
  return IMAGE_EXTS.has(fileExt(name));
}

function fileIconId(name) {
  const ext = fileExt(name);
  if (['js', 'html', 'htm', 'css'].includes(ext)) return 'icon-file-code';
  return 'icon-file';
}

function calcTotalSize(files, assets) {
  let bytes = 0;
  for (const f of files) bytes += (f.content || '').length;
  for (const a of assets) bytes += a.size || base64Size(a.data || '');
  return bytes;
}

// ---------------------------------------------------------------------------
// DemoEditor — route #/demos/:id/edit
// ---------------------------------------------------------------------------

export class DemoEditor {
  constructor(container) {
    this.container = container;
    this.demo = null;
    this.assets = [];
    this.projects = [];
    this.activeTab = 'files';
    this.unsavedChanges = false;
    /** Map of filename -> edited content (in-memory before save) */
    this.editedContent = {};
    /** Set of asset IDs pending deletion */
    this.deletedAssetIds = new Set();
    /** Inline editor open for this filename, or null */
    this.openEditorFile = null;
    this.tagInput = null;
    this._localeHandler = () => this.render();
    window.addEventListener('locale-change', this._localeHandler);
    this.init();
  }

  async init() {
    const demoId = appState.get('selectedDemoId');
    if (!demoId) {
      this.renderError('未找到 Demo ID');
      return;
    }

    try {
      [this.demo, this.assets, this.projects] = await Promise.all([
        getDemo(demoId),
        getAssetsByDemo(demoId),
        getAllProjects(),
      ]);
    } catch (err) {
      this.renderError('加载 Demo 失败: ' + err.message);
      return;
    }

    if (!this.demo) {
      this.renderError('Demo 不存在');
      return;
    }

    this.render();
  }

  renderError(msg) {
    this.container.innerHTML = `
      <div class="flex items-center justify-center h-full text-[var(--color-text-tertiary)]">
        <p>${escapeHtml(msg)}</p>
      </div>
    `;
  }

  render() {
    this.container.innerHTML = `
      <div class="flex flex-col h-full overflow-hidden">
        <!-- Header bar -->
        <div class="flex items-center gap-3 px-4 py-3 border-b border-[var(--color-border)] bg-[var(--color-bg-secondary)] shrink-0">
          <a href="#/demos/${escapeHtml(this.demo.id)}"
             class="btn btn-icon btn-ghost"
             title="${escapeHtml(t('editor.back'))}"
             aria-label="${escapeHtml(t('editor.back'))}">
            <svg class="w-4 h-4"><use href="icons/sprite.svg#icon-arrow-left"></use></svg>
          </a>
          <h1 class="flex-1 text-sm font-semibold text-[var(--color-text-primary)] truncate" id="editor-title-display">
            ${escapeHtml(this.demo.title)}
          </h1>
          <button class="btn btn-primary btn-sm" id="save-btn">${t('editor.save')}</button>
          <a href="#/demos/${escapeHtml(this.demo.id)}" class="btn btn-secondary btn-sm">${t('editor.cancel')}</a>
        </div>

        <!-- Tabs -->
        <div class="flex gap-0 border-b border-[var(--color-border)] bg-[var(--color-bg-secondary)] shrink-0 px-4">
          <button class="tab-btn px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${this.activeTab === 'files' ? 'border-[var(--color-accent)] text-[var(--color-accent)]' : 'border-transparent text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]'}"
                  data-tab="files">${t('editor.tab.files')}</button>
          <button class="tab-btn px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${this.activeTab === 'meta' ? 'border-[var(--color-accent)] text-[var(--color-accent)]' : 'border-transparent text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]'}"
                  data-tab="meta">${t('editor.tab.metadata')}</button>
        </div>

        <!-- Tab content -->
        <div class="flex-1 overflow-y-auto" id="tab-content">
        </div>
      </div>
    `;

    this.container.querySelectorAll('.tab-btn').forEach((btn) => {
      btn.addEventListener('click', () => {
        this.activeTab = btn.dataset.tab;
        this.render();
      });
    });

    this.container.querySelector('#save-btn').addEventListener('click', () => this.save());

    this.renderTabContent();
  }

  renderTabContent() {
    const content = this.container.querySelector('#tab-content');
    if (this.activeTab === 'files') {
      content.innerHTML = this.buildFilesTabHtml();
      this.bindFilesTabEvents();
    } else {
      content.innerHTML = this.buildMetaTabHtml();
      this.bindMetaTabEvents();
    }
  }

  // ---- Files tab ----

  buildFilesTabHtml() {
    const files = this.demo.files || [];
    const assets = this.assets.filter((a) => !this.deletedAssetIds.has(a.id));
    const totalBytes = calcTotalSize(files, assets);

    const fileRows = files.map((f) => this.buildFileRowHtml(f)).join('');
    const assetRows = assets.map((a) => this.buildAssetRowHtml(a)).join('');

    return `
      <div class="p-4 space-y-6">
        <!-- Upload zone -->
        <div class="space-y-2">
          <h2 class="text-xs font-semibold uppercase tracking-wider text-[var(--color-text-tertiary)]">${t('editor.upload')}</h2>
          <div id="drop-zone"
               class="border-2 border-dashed border-[var(--color-border)] rounded-xl p-8 text-center cursor-pointer hover:border-[var(--color-accent)] hover:bg-[var(--color-bg-hover)] transition-colors">
            <svg class="w-8 h-8 mx-auto mb-2 text-[var(--color-text-tertiary)]">
              <use href="icons/sprite.svg#icon-upload"></use>
            </svg>
            <p class="text-sm text-[var(--color-text-secondary)] mb-3">${t('editor.drop_zone')}</p>
            <div class="flex justify-center gap-2">
              <label class="btn btn-secondary btn-sm cursor-pointer">
                ${t('editor.upload')}
                <input type="file" class="hidden" id="file-input" multiple
                       accept=".html,.css,.js,.json,.png,.jpg,.jpeg,.gif,.svg,.webp">
              </label>
              <label class="btn btn-secondary btn-sm cursor-pointer">
                ${t('editor.upload_folder')}
                <input type="file" class="hidden" id="folder-input" multiple webkitdirectory>
              </label>
            </div>
          </div>
        </div>

        <!-- File list -->
        ${
          files.length > 0
            ? `
        <div class="space-y-2">
          <h2 class="text-xs font-semibold uppercase tracking-wider text-[var(--color-text-tertiary)]">${t('editor.tab.files')}</h2>
          <div class="rounded-lg border border-[var(--color-border)] divide-y divide-[var(--color-border)]" id="file-list">
            ${fileRows}
          </div>
        </div>
        `
            : `<p class="text-sm text-[var(--color-text-tertiary)]">${t('editor.no_files')}</p>`
        }

        <!-- Assets -->
        ${
          assets.length > 0
            ? `
        <div class="space-y-2">
          <h2 class="text-xs font-semibold uppercase tracking-wider text-[var(--color-text-tertiary)]">${t('editor.assets_section')}</h2>
          <div class="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4" id="asset-list">
            ${assetRows}
          </div>
        </div>
        `
            : ''
        }

        <!-- Total size -->
        <p class="text-xs text-[var(--color-text-tertiary)]">
          ${t('editor.total_size')}: <span class="font-medium">${escapeHtml(formatBytes(totalBytes))}</span>
        </p>
      </div>
    `;
  }

  buildFileRowHtml(file) {
    const isEntry = file.name === this.demo.entryFile;
    const isHtml = file.name.endsWith('.html') || file.name.endsWith('.htm');
    const isText = isTextFile(file.name);
    const sizeBytes = (this.editedContent[file.name] ?? file.content ?? '').length;
    const isEditorOpen = this.openEditorFile === file.name;
    const content = this.editedContent[file.name] ?? file.content ?? '';

    return `
      <div class="file-row" data-filename="${escapeHtml(file.name)}">
        <div class="flex items-center gap-3 px-4 py-3 bg-[var(--color-bg-secondary)] hover:bg-[var(--color-bg-hover)] transition-colors">
          <svg class="w-4 h-4 shrink-0 text-[var(--color-text-tertiary)]">
            <use href="icons/sprite.svg#${fileIconId(file.name)}"></use>
          </svg>
          <span class="flex-1 text-sm text-[var(--color-text-primary)] truncate font-mono">${escapeHtml(file.name)}</span>
          <span class="text-xs text-[var(--color-text-tertiary)] shrink-0">${escapeHtml(formatBytes(sizeBytes))}</span>
          ${isEntry ? `<span class="shrink-0 text-xs px-1.5 py-0.5 rounded bg-[var(--color-accent)] text-white font-medium">⭐ ${t('editor.entry_file')}</span>` : ''}
          <div class="flex items-center gap-1 shrink-0">
            ${
              isText
                ? `
            <button class="btn btn-icon btn-ghost w-7 h-7 edit-file-btn" data-filename="${escapeHtml(file.name)}" title="${escapeHtml(t('editor.file.edit'))}">
              <svg class="w-3.5 h-3.5"><use href="icons/sprite.svg#icon-edit"></use></svg>
            </button>`
                : ''
            }
            ${
              isHtml && !isEntry
                ? `
            <button class="btn btn-ghost btn-sm text-xs set-entry-btn" data-filename="${escapeHtml(file.name)}" title="${escapeHtml(t('editor.set_entry'))}">
              ${t('editor.set_entry')}
            </button>`
                : ''
            }
            <button class="btn btn-icon btn-ghost w-7 h-7 text-red-500 hover:text-red-600 delete-file-btn" data-filename="${escapeHtml(file.name)}" title="${escapeHtml(t('editor.file.delete'))}">
              <svg class="w-3.5 h-3.5"><use href="icons/sprite.svg#icon-trash"></use></svg>
            </button>
          </div>
        </div>
        ${
          isEditorOpen
            ? `
        <div class="border-t border-[var(--color-border)] bg-[var(--color-bg-primary)]">
          <div class="flex items-center justify-between px-4 py-2 bg-[var(--color-bg-tertiary)] border-b border-[var(--color-border)]">
            <span class="text-xs text-[var(--color-text-tertiary)] font-mono">${escapeHtml(file.name)}</span>
            <button class="btn btn-sm btn-primary save-inline-btn" data-filename="${escapeHtml(file.name)}">${t('editor.save')}</button>
          </div>
          <textarea
            class="w-full h-64 p-3 text-xs font-mono bg-[var(--color-bg-primary)] text-[var(--color-text-primary)] resize-y outline-none border-none"
            spellcheck="false"
            placeholder="${escapeHtml(t('editor.code.placeholder'))}"
            data-editor="${escapeHtml(file.name)}"
          >${escapeHtml(content)}</textarea>
        </div>
        `
            : ''
        }
      </div>
    `;
  }

  buildAssetRowHtml(asset) {
    const sizeBytes = asset.size || base64Size(asset.data || '');
    const isImg = asset.mimeType && asset.mimeType.startsWith('image/');
    return `
      <div class="asset-card rounded-lg border border-[var(--color-border)] overflow-hidden bg-[var(--color-bg-secondary)] group" data-asset-id="${escapeHtml(asset.id)}">
        ${
          isImg
            ? `
        <div class="aspect-video bg-[var(--color-bg-tertiary)] flex items-center justify-center overflow-hidden">
          <img src="${asset.data}" alt="${escapeHtml(asset.filename)}" class="max-w-full max-h-full object-contain">
        </div>
        `
            : `
        <div class="aspect-video bg-[var(--color-bg-tertiary)] flex items-center justify-center">
          <svg class="w-8 h-8 text-[var(--color-text-tertiary)]"><use href="icons/sprite.svg#icon-file"></use></svg>
        </div>
        `
        }
        <div class="px-2 py-2 flex items-center gap-1">
          <div class="flex-1 min-w-0">
            <p class="text-xs text-[var(--color-text-primary)] truncate font-mono">${escapeHtml(asset.filename)}</p>
            <p class="text-xs text-[var(--color-text-tertiary)]">${escapeHtml(formatBytes(sizeBytes))}</p>
          </div>
          <button class="btn btn-icon btn-ghost w-6 h-6 text-red-500 hover:text-red-600 delete-asset-btn shrink-0" data-asset-id="${escapeHtml(asset.id)}" title="${escapeHtml(t('editor.file.delete'))}">
            <svg class="w-3.5 h-3.5"><use href="icons/sprite.svg#icon-trash"></use></svg>
          </button>
        </div>
      </div>
    `;
  }

  bindFilesTabEvents() {
    const content = this.container.querySelector('#tab-content');

    // Drag and drop zone
    const dropZone = content.querySelector('#drop-zone');
    if (dropZone) {
      dropZone.addEventListener('dragover', (e) => {
        e.preventDefault();
        dropZone.classList.add('border-[var(--color-accent)]', 'bg-[var(--color-bg-hover)]');
      });
      dropZone.addEventListener('dragleave', () => {
        dropZone.classList.remove('border-[var(--color-accent)]', 'bg-[var(--color-bg-hover)]');
      });
      dropZone.addEventListener('drop', async (e) => {
        e.preventDefault();
        dropZone.classList.remove('border-[var(--color-accent)]', 'bg-[var(--color-bg-hover)]');
        if (e.dataTransfer.files.length) {
          await this.handleFileUpload(e.dataTransfer.files);
        }
      });
    }

    // File input
    const fileInput = content.querySelector('#file-input');
    fileInput?.addEventListener('change', async () => {
      if (fileInput.files.length) await this.handleFileUpload(fileInput.files);
      fileInput.value = '';
    });

    // Folder input
    const folderInput = content.querySelector('#folder-input');
    folderInput?.addEventListener('change', async () => {
      if (folderInput.files.length) await this.handleFileUpload(folderInput.files);
      folderInput.value = '';
    });

    // Edit file buttons
    content.querySelectorAll('.edit-file-btn').forEach((btn) => {
      btn.addEventListener('click', () => {
        const filename = btn.dataset.filename;
        this.openEditorFile = this.openEditorFile === filename ? null : filename;
        this.renderTabContent();
      });
    });

    // Inline editor save
    content.querySelectorAll('.save-inline-btn').forEach((btn) => {
      btn.addEventListener('click', () => {
        const filename = btn.dataset.filename;
        const textarea = content.querySelector(`[data-editor="${CSS.escape(filename)}"]`);
        if (textarea) {
          this.editedContent[filename] = textarea.value;
          this.unsavedChanges = true;
          // Patch demo.files in memory
          const fileObj = this.demo.files.find((f) => f.name === filename);
          if (fileObj) fileObj.content = textarea.value;
          toast.success('内容已更新（尚未保存到数据库）');
        }
      });
    });

    // Textarea live edits — track in editedContent
    content.querySelectorAll('textarea[data-editor]').forEach((ta) => {
      ta.addEventListener('input', () => {
        this.editedContent[ta.dataset.editor] = ta.value;
        this.unsavedChanges = true;
      });
    });

    // Set entry file buttons
    content.querySelectorAll('.set-entry-btn').forEach((btn) => {
      btn.addEventListener('click', () => {
        this.demo.entryFile = btn.dataset.filename;
        this.unsavedChanges = true;
        this.renderTabContent();
      });
    });

    // Delete file buttons
    content.querySelectorAll('.delete-file-btn').forEach((btn) => {
      btn.addEventListener('click', async () => {
        const filename = btn.dataset.filename;
        const ok = await confirm({
          title: '删除文件',
          message: `确定要删除文件 "${filename}" 吗？`,
          confirmText: '删除',
          danger: true,
        });
        if (!ok) return;
        this.demo.files = this.demo.files.filter((f) => f.name !== filename);
        delete this.editedContent[filename];
        if (this.demo.entryFile === filename) {
          const htmlFiles = this.demo.files.filter((f) => f.name.endsWith('.html'));
          this.demo.entryFile = htmlFiles[0]?.name || 'index.html';
        }
        this.unsavedChanges = true;
        this.renderTabContent();
      });
    });

    // Delete asset buttons
    content.querySelectorAll('.delete-asset-btn').forEach((btn) => {
      btn.addEventListener('click', async () => {
        const assetId = btn.dataset.assetId;
        const asset = this.assets.find((a) => a.id === assetId);
        const ok = await confirm({
          title: '删除资源',
          message: `确定要删除资源 "${asset?.filename || assetId}" 吗？`,
          confirmText: '删除',
          danger: true,
        });
        if (!ok) return;
        this.deletedAssetIds.add(assetId);
        this.unsavedChanges = true;
        this.renderTabContent();
      });
    });
  }

  async handleFileUpload(fileList) {
    try {
      const result = await resolveFileSet(fileList);

      // Merge text files (overwrite existing by name)
      for (const f of result.files) {
        const existing = this.demo.files.findIndex((x) => x.name === f.name);
        if (existing >= 0) {
          this.demo.files[existing] = f;
        } else {
          this.demo.files.push(f);
        }
      }

      // Merge assets (overwrite existing by filename)
      for (const a of result.assets) {
        const existing = this.assets.findIndex((x) => x.filename === a.filename);
        if (existing >= 0) {
          this.assets[existing] = { ...this.assets[existing], ...a };
        } else {
          this.assets.push({ id: crypto.randomUUID(), demoId: this.demo.id, ...a });
        }
      }

      // Update entry file if a better one was detected
      if (result.entryFile && result.files.some((f) => f.name === result.entryFile)) {
        this.demo.entryFile = result.entryFile;
      }

      this.unsavedChanges = true;
      this.renderTabContent();
      toast.success(`已上传 ${result.files.length + result.assets.length} 个文件`);
    } catch (err) {
      toast.error('上传失败: ' + err.message);
    }
  }

  // ---- Metadata tab ----

  buildMetaTabHtml() {
    const d = this.demo;
    const htmlFiles = (d.files || []).filter(
      (f) => f.name.endsWith('.html') || f.name.endsWith('.htm')
    );
    const projectOptions = this.projects
      .map(
        (p) =>
          `<option value="${escapeHtml(p.id)}" ${d.projectId === p.id ? 'selected' : ''}>${escapeHtml(p.title)}</option>`
      )
      .join('');

    return `
      <div class="p-4 max-w-xl space-y-5">
        <!-- Title -->
        <div class="space-y-1.5">
          <label class="block text-sm font-medium text-[var(--color-text-primary)]" for="meta-title">
            ${t('editor.title')} <span class="text-red-500">*</span>
          </label>
          <input
            type="text"
            id="meta-title"
            class="input w-full"
            value="${escapeHtml(d.title)}"
            placeholder="${escapeHtml(t('editor.title.placeholder'))}"
            required
          >
        </div>

        <!-- Notes -->
        <div class="space-y-1.5">
          <label class="block text-sm font-medium text-[var(--color-text-primary)]" for="meta-notes">
            ${t('editor.notes')}
          </label>
          <textarea
            id="meta-notes"
            class="input w-full h-24 resize-y"
            placeholder="${escapeHtml(t('editor.notes.placeholder'))}"
          >${escapeHtml(d.notes || '')}</textarea>
        </div>

        <!-- Tags -->
        <div class="space-y-1.5">
          <label class="block text-sm font-medium text-[var(--color-text-primary)]">${t('editor.tags')}</label>
          <div id="tag-input-host"></div>
        </div>

        <!-- Project selector -->
        <div class="space-y-1.5">
          <label class="block text-sm font-medium text-[var(--color-text-primary)]" for="meta-project">
            ${t('editor.project')}
          </label>
          <select id="meta-project" class="input w-full">
            <option value="" ${!d.projectId ? 'selected' : ''}>${t('editor.no_project')}</option>
            ${projectOptions}
          </select>
        </div>

        <!-- Entry file selector -->
        ${
          htmlFiles.length > 0
            ? `
        <div class="space-y-1.5">
          <label class="block text-sm font-medium text-[var(--color-text-primary)]" for="meta-entry">
            ${t('editor.entry_file_label')}
          </label>
          <select id="meta-entry" class="input w-full">
            ${htmlFiles
              .map(
                (f) =>
                  `<option value="${escapeHtml(f.name)}" ${d.entryFile === f.name ? 'selected' : ''}>${escapeHtml(f.name)}</option>`
              )
              .join('')}
          </select>
        </div>
        `
            : ''
        }

        <!-- Timestamps -->
        <div class="grid grid-cols-2 gap-4 pt-2 border-t border-[var(--color-border)]">
          <div>
            <p class="text-xs text-[var(--color-text-tertiary)] mb-0.5">${t('editor.created')}</p>
            <p class="text-sm text-[var(--color-text-secondary)]">${escapeHtml(formatFull(d.createdAt))}</p>
          </div>
          <div>
            <p class="text-xs text-[var(--color-text-tertiary)] mb-0.5">${t('editor.updated')}</p>
            <p class="text-sm text-[var(--color-text-secondary)]">${escapeHtml(formatFull(d.updatedAt))}</p>
          </div>
        </div>
      </div>
    `;
  }

  bindMetaTabEvents() {
    const content = this.container.querySelector('#tab-content');
    const tagHost = content.querySelector('#tag-input-host');

    this.tagInput = new TagInput(tagHost, {
      value: this.demo.tags || [],
      onChange: (tags) => {
        this.demo.tags = tags;
        this.unsavedChanges = true;
      },
    });

    const titleEl = content.querySelector('#meta-title');
    const notesEl = content.querySelector('#meta-notes');
    const projectEl = content.querySelector('#meta-project');
    const entryEl = content.querySelector('#meta-entry');

    titleEl?.addEventListener('input', () => {
      this.demo.title = titleEl.value;
      const display = this.container.querySelector('#editor-title-display');
      if (display) display.textContent = titleEl.value || '（无标题）';
      this.unsavedChanges = true;
    });

    notesEl?.addEventListener('input', () => {
      this.demo.notes = notesEl.value;
      this.unsavedChanges = true;
    });

    projectEl?.addEventListener('change', () => {
      this.demo.projectId = projectEl.value || null;
      this.unsavedChanges = true;
    });

    entryEl?.addEventListener('change', () => {
      this.demo.entryFile = entryEl.value;
      this.unsavedChanges = true;
    });
  }

  // ---- Save ----

  async save() {
    const title = (this.demo.title || '').trim();
    if (!title) {
      toast.error(t('editor.validation.title'));
      // Switch to meta tab so user can see the issue
      this.activeTab = 'meta';
      this.render();
      return;
    }

    const saveBtn = this.container.querySelector('#save-btn');
    if (saveBtn) {
      saveBtn.disabled = true;
      saveBtn.textContent = '保存中…';
    }

    try {
      // Apply any in-memory edits to files array
      for (const [filename, content] of Object.entries(this.editedContent)) {
        const fileObj = this.demo.files.find((f) => f.name === filename);
        if (fileObj) fileObj.content = content;
      }

      await updateDemo(this.demo.id, {
        title: this.demo.title,
        notes: this.demo.notes,
        tags: this.demo.tags,
        projectId: this.demo.projectId,
        entryFile: this.demo.entryFile,
        files: this.demo.files,
      });

      // Save modified/new assets
      const assetsToSave = this.assets.filter((a) => !this.deletedAssetIds.has(a.id));
      await Promise.all(
        assetsToSave.map((a) =>
          saveAsset({
            demoId: this.demo.id,
            filename: a.filename,
            mimeType: a.mimeType,
            data: a.data,
            size: a.size,
          })
        )
      );

      // Delete removed assets
      await Promise.all([...this.deletedAssetIds].map((id) => deleteAsset(id)));

      this.unsavedChanges = false;
      this.editedContent = {};
      this.deletedAssetIds.clear();

      toast.success(t('editor.save.success'));
      appState.notifyDataChanged('demos');
      appState.navigate(`#/demos/${this.demo.id}`);
    } catch (err) {
      toast.error(t('editor.save.error'));
    } finally {
      if (saveBtn) {
        saveBtn.disabled = false;
        saveBtn.textContent = t('editor.save');
      }
    }
  }

  destroy() {
    window.removeEventListener('locale-change', this._localeHandler);
  }
}

// ---------------------------------------------------------------------------
// NewDemoView — route #/demos/new
// ---------------------------------------------------------------------------

const BLANK_TEMPLATE = `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>新建 Demo</title>
  <style>
    body { font-family: system-ui, sans-serif; padding: 2rem; }
  </style>
</head>
<body>
  <h1>Hello, Glint!</h1>
</body>
</html>`;

export class NewDemoView {
  constructor(container) {
    this.container = container;
    this.step = 1;
    this.method = null;
    this.files = [];
    this.assets = [];
    this.entryFile = 'index.html';
    this.title = '新建 Demo';
    this.notes = '';
    this.tags = [];
    this.projectId = appState.get('selectedProjectId') || null;
    this.htmlContent = '';
    this.projects = [];
    this.tagInput = null;
    this._localeHandler = () => this.render();
    window.addEventListener('locale-change', this._localeHandler);
    this.init();
  }

  async init() {
    this.projects = await getAllProjects();
    this.render();
  }

  render() {
    if (this.step === 1) {
      this.renderStep1();
    } else {
      this.renderStep2();
    }
  }

  // ---- Step 1: choose creation method ----

  renderStep1() {
    this.container.innerHTML = `
      <div class="flex flex-col h-full overflow-hidden">
        <!-- Header -->
        <div class="flex items-center gap-3 px-4 py-3 border-b border-[var(--color-border)] bg-[var(--color-bg-secondary)] shrink-0">
          <a href="#/" class="btn btn-icon btn-ghost" aria-label="${escapeHtml(t('editor.back'))}">
            <svg class="w-4 h-4"><use href="icons/sprite.svg#icon-arrow-left"></use></svg>
          </a>
          <h1 class="text-sm font-semibold text-[var(--color-text-primary)]">${t('new_demo.title')}</h1>
        </div>

        <!-- Method cards -->
        <div class="flex-1 overflow-y-auto p-6">
          <p class="text-sm text-[var(--color-text-secondary)] mb-6">${t('new_demo.step1')}</p>
          <div class="grid grid-cols-1 gap-4 sm:grid-cols-2 max-w-2xl">

            <!-- Paste HTML -->
            <button class="method-card text-left p-5 rounded-xl border-2 border-[var(--color-border)] bg-[var(--color-bg-secondary)] hover:border-[var(--color-accent)] hover:bg-[var(--color-bg-hover)] transition-colors group"
                    data-method="paste">
              <div class="flex items-start gap-3">
                <div class="w-9 h-9 rounded-lg bg-blue-500/10 flex items-center justify-center shrink-0">
                  <svg class="w-5 h-5 text-blue-500"><use href="icons/sprite.svg#icon-code"></use></svg>
                </div>
                <div>
                  <h3 class="text-sm font-semibold text-[var(--color-text-primary)] mb-1">${t('new_demo.method.paste')}</h3>
                  <p class="text-xs text-[var(--color-text-secondary)]">${t('new_demo.method.paste.desc')}</p>
                </div>
              </div>
            </button>

            <!-- Upload files -->
            <label class="method-card text-left p-5 rounded-xl border-2 border-[var(--color-border)] bg-[var(--color-bg-secondary)] hover:border-[var(--color-accent)] hover:bg-[var(--color-bg-hover)] transition-colors cursor-pointer group">
              <div class="flex items-start gap-3">
                <div class="w-9 h-9 rounded-lg bg-green-500/10 flex items-center justify-center shrink-0">
                  <svg class="w-5 h-5 text-green-500"><use href="icons/sprite.svg#icon-upload"></use></svg>
                </div>
                <div>
                  <h3 class="text-sm font-semibold text-[var(--color-text-primary)] mb-1">${t('new_demo.method.upload')}</h3>
                  <p class="text-xs text-[var(--color-text-secondary)]">${t('new_demo.method.upload.desc')}</p>
                </div>
              </div>
              <input type="file" class="hidden" id="new-file-input" multiple
                     accept=".html,.css,.js,.json,.png,.jpg,.jpeg,.gif,.svg,.webp">
            </label>

            <!-- Upload folder -->
            <label class="method-card text-left p-5 rounded-xl border-2 border-[var(--color-border)] bg-[var(--color-bg-secondary)] hover:border-[var(--color-accent)] hover:bg-[var(--color-bg-hover)] transition-colors cursor-pointer group">
              <div class="flex items-start gap-3">
                <div class="w-9 h-9 rounded-lg bg-amber-500/10 flex items-center justify-center shrink-0">
                  <svg class="w-5 h-5 text-amber-500"><use href="icons/sprite.svg#icon-folder-plus"></use></svg>
                </div>
                <div>
                  <h3 class="text-sm font-semibold text-[var(--color-text-primary)] mb-1">${t('new_demo.method.folder')}</h3>
                  <p class="text-xs text-[var(--color-text-secondary)]">${t('new_demo.method.folder.desc')}</p>
                </div>
              </div>
              <input type="file" class="hidden" id="new-folder-input" multiple webkitdirectory>
            </label>

            <!-- Blank demo -->
            <button class="method-card text-left p-5 rounded-xl border-2 border-[var(--color-border)] bg-[var(--color-bg-secondary)] hover:border-[var(--color-accent)] hover:bg-[var(--color-bg-hover)] transition-colors group"
                    data-method="blank">
              <div class="flex items-start gap-3">
                <div class="w-9 h-9 rounded-lg bg-purple-500/10 flex items-center justify-center shrink-0">
                  <svg class="w-5 h-5 text-purple-500"><use href="icons/sprite.svg#icon-file"></use></svg>
                </div>
                <div>
                  <h3 class="text-sm font-semibold text-[var(--color-text-primary)] mb-1">${t('new_demo.method.blank')}</h3>
                  <p class="text-xs text-[var(--color-text-secondary)]">${t('new_demo.method.blank.desc')}</p>
                </div>
              </div>
            </button>

          </div>
        </div>
      </div>
    `;

    // Paste / Blank card buttons
    this.container.querySelectorAll('.method-card[data-method]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const method = btn.dataset.method;
        if (method === 'paste') {
          this.method = 'paste';
          this.step = 2;
          this.render();
        } else if (method === 'blank') {
          this.method = 'blank';
          this.files = [{ name: 'index.html', content: BLANK_TEMPLATE, mimeType: 'text/html' }];
          this.assets = [];
          this.entryFile = 'index.html';
          this.title = '新建 Demo';
          this.step = 2;
          this.render();
        }
      });
    });

    // File input
    this.container.querySelector('#new-file-input')?.addEventListener('change', async (e) => {
      if (e.target.files.length) await this.handleUpload(e.target.files);
    });

    // Folder input
    this.container.querySelector('#new-folder-input')?.addEventListener('change', async (e) => {
      if (e.target.files.length) await this.handleUpload(e.target.files);
    });
  }

  async handleUpload(fileList) {
    try {
      const result = await resolveFileSet(fileList);
      this.files = result.files;
      this.assets = result.assets;
      this.entryFile = result.entryFile;
      this.method = 'upload';

      // Pre-fill title from entry file name (strip extension)
      const htmlFile = result.files.find((f) => f.name === result.entryFile);
      if (htmlFile) {
        this.title = htmlFile.name.replace(/\.[^.]+$/, '');
      } else if (result.files.length > 0) {
        this.title = result.files[0].name.replace(/\.[^.]+$/, '');
      }

      this.step = 2;
      this.render();
    } catch (err) {
      toast.error('上传失败: ' + err.message);
    }
  }

  // ---- Step 2: metadata + confirm ----

  renderStep2() {
    const projectOptions = this.projects
      .map(
        (p) =>
          `<option value="${escapeHtml(p.id)}" ${this.projectId === p.id ? 'selected' : ''}>${escapeHtml(p.title)}</option>`
      )
      .join('');

    const htmlFiles = this.files.filter((f) => f.name.endsWith('.html') || f.name.endsWith('.htm'));
    const showPasteArea = this.method === 'paste';
    const entryContent = this.files.find((f) => f.name === this.entryFile)?.content || '';

    this.container.innerHTML = `
      <div class="flex flex-col h-full overflow-hidden">
        <!-- Header -->
        <div class="flex items-center gap-3 px-4 py-3 border-b border-[var(--color-border)] bg-[var(--color-bg-secondary)] shrink-0">
          <button class="btn btn-icon btn-ghost" id="back-to-step1" aria-label="${escapeHtml(t('new_demo.back'))}">
            <svg class="w-4 h-4"><use href="icons/sprite.svg#icon-arrow-left"></use></svg>
          </button>
          <h1 class="text-sm font-semibold text-[var(--color-text-primary)]">${t('new_demo.title')} — ${t('new_demo.step2')}</h1>
        </div>

        <div class="flex-1 overflow-y-auto p-4">
          <div class="max-w-xl space-y-5">

            ${
              showPasteArea
                ? `
            <!-- Paste HTML area -->
            <div class="space-y-1.5">
              <label class="block text-sm font-medium text-[var(--color-text-primary)]" for="paste-html">
                HTML 代码 <span class="text-red-500">*</span>
              </label>
              <textarea
                id="paste-html"
                class="input w-full h-48 font-mono text-xs resize-y"
                placeholder="${escapeHtml(t('editor.code.placeholder'))}"
                spellcheck="false"
              >${escapeHtml(entryContent)}</textarea>
            </div>
            `
                : `
            <!-- Uploaded files summary -->
            <div class="rounded-lg border border-[var(--color-border)] p-3 bg-[var(--color-bg-secondary)]">
              <p class="text-xs font-semibold uppercase tracking-wider text-[var(--color-text-tertiary)] mb-2">已选文件</p>
              <ul class="space-y-1">
                ${this.files
                  .map(
                    (f) => `
                  <li class="flex items-center gap-2 text-xs text-[var(--color-text-secondary)]">
                    <svg class="w-3.5 h-3.5 shrink-0 text-[var(--color-text-tertiary)]"><use href="icons/sprite.svg#${fileIconId(f.name)}"></use></svg>
                    <span class="font-mono truncate">${escapeHtml(f.name)}</span>
                    ${f.name === this.entryFile ? `<span class="ml-auto text-xs px-1 py-0.5 rounded bg-[var(--color-accent)]/10 text-[var(--color-accent)]">入口</span>` : ''}
                  </li>
                `
                  )
                  .join('')}
                ${this.assets
                  .map(
                    (a) => `
                  <li class="flex items-center gap-2 text-xs text-[var(--color-text-secondary)]">
                    <svg class="w-3.5 h-3.5 shrink-0 text-[var(--color-text-tertiary)]"><use href="icons/sprite.svg#icon-file"></use></svg>
                    <span class="font-mono truncate">${escapeHtml(a.filename)}</span>
                    <span class="ml-auto text-xs text-[var(--color-text-tertiary)]">${escapeHtml(formatBytes(a.size || base64Size(a.data || '')))}</span>
                  </li>
                `
                  )
                  .join('')}
              </ul>
            </div>
            `
            }

            ${
              htmlFiles.length > 1
                ? `
            <!-- Multiple HTML files: let user pick entry -->
            <div class="space-y-1.5">
              <label class="block text-sm font-medium text-[var(--color-text-primary)]" for="new-entry-select">${t('new_demo.title_label')}</label>
              <select id="new-entry-select" class="input w-full">
                ${htmlFiles
                  .map(
                    (f) =>
                      `<option value="${escapeHtml(f.name)}" ${this.entryFile === f.name ? 'selected' : ''}>${escapeHtml(f.name)}</option>`
                  )
                  .join('')}
              </select>
            </div>
            `
                : ''
            }

            <!-- Title -->
            <div class="space-y-1.5">
              <label class="block text-sm font-medium text-[var(--color-text-primary)]" for="new-title">
                ${t('new_demo.title_label')} <span class="text-red-500">*</span>
              </label>
              <input type="text" id="new-title" class="input w-full" value="${escapeHtml(this.title)}" placeholder="${escapeHtml(t('new_demo.title_placeholder'))}" required>
            </div>

            <!-- Notes -->
            <div class="space-y-1.5">
              <label class="block text-sm font-medium text-[var(--color-text-primary)]" for="new-notes">${t('new_demo.notes_label')}</label>
              <textarea id="new-notes" class="input w-full h-20 resize-y" placeholder="${escapeHtml(t('new_demo.notes_placeholder'))}">${escapeHtml(this.notes)}</textarea>
            </div>

            <!-- Tags -->
            <div class="space-y-1.5">
              <label class="block text-sm font-medium text-[var(--color-text-primary)]">${t('new_demo.tags_label')}</label>
              <div id="new-tag-host"></div>
            </div>

            <!-- Project -->
            <div class="space-y-1.5">
              <label class="block text-sm font-medium text-[var(--color-text-primary)]" for="new-project">${t('new_demo.project_label')}</label>
              <select id="new-project" class="input w-full">
                <option value="" ${!this.projectId ? 'selected' : ''}>${t('new_demo.no_project')}</option>
                ${projectOptions}
              </select>
            </div>

            <!-- Preview -->
            <div class="space-y-1.5">
              <div class="flex items-center justify-between">
                <label class="block text-sm font-medium text-[var(--color-text-primary)]">${t('new_demo.preview')}</label>
                <button class="btn btn-secondary btn-sm" id="refresh-preview-btn">${t('preview.refresh')}</button>
              </div>
              <div class="rounded-lg border border-[var(--color-border)] overflow-hidden bg-[var(--color-bg-tertiary)]">
                <iframe
                  id="new-demo-preview"
                  sandbox="allow-scripts allow-forms allow-modals allow-popups"
                  class="w-full"
                  style="height: 400px; border: none;"
                ></iframe>
              </div>
            </div>

            <!-- Create button -->
            <div class="flex gap-3 pt-2">
              <button class="btn btn-primary flex-1" id="create-btn">${t('new_demo.create')}</button>
              <a href="#/" class="btn btn-secondary">${t('editor.cancel')}</a>
            </div>

          </div>
        </div>
      </div>
    `;

    this.bindStep2Events();
    this.updatePreview();
  }

  bindStep2Events() {
    const c = this.container;

    c.querySelector('#back-to-step1')?.addEventListener('click', () => {
      this.step = 1;
      this.render();
    });

    const tagHost = c.querySelector('#new-tag-host');
    this.tagInput = new TagInput(tagHost, {
      value: this.tags,
      onChange: (tags) => {
        this.tags = tags;
      },
    });

    const titleEl = c.querySelector('#new-title');
    const notesEl = c.querySelector('#new-notes');
    const projectEl = c.querySelector('#new-project');
    const entryEl = c.querySelector('#new-entry-select');
    const pasteEl = c.querySelector('#paste-html');

    titleEl?.addEventListener('input', () => {
      this.title = titleEl.value;
    });
    notesEl?.addEventListener('input', () => {
      this.notes = notesEl.value;
    });
    projectEl?.addEventListener('change', () => {
      this.projectId = projectEl.value || null;
    });
    entryEl?.addEventListener('change', () => {
      this.entryFile = entryEl.value;
      this.updatePreview();
    });

    if (pasteEl) {
      pasteEl.addEventListener('input', () => {
        // Keep in-memory for preview
        this._pastedHtml = pasteEl.value;
        this.updatePreview();
      });
    }

    c.querySelector('#refresh-preview-btn')?.addEventListener('click', () => this.updatePreview());
    c.querySelector('#create-btn')?.addEventListener('click', () => this.create());
  }

  updatePreview() {
    const iframe = this.container.querySelector('#new-demo-preview');
    if (!iframe) return;

    let htmlContent = '';

    if (this.method === 'paste') {
      htmlContent = this._pastedHtml ?? this.container.querySelector('#paste-html')?.value ?? '';
    } else {
      const entry =
        this.files.find((f) => f.name === this.entryFile) ||
        this.files.find((f) => f.name.endsWith('.html'));
      htmlContent = entry?.content || '';
    }

    if (!htmlContent) {
      iframe.srcdoc =
        '<html><body style="font-family:system-ui;padding:2rem;color:#888"><p>暂无内容</p></body></html>';
      return;
    }

    // Build asset map for inline preview
    const assetsMap = {};
    for (const a of this.assets) {
      assetsMap[a.filename] = a.data;
      assetsMap[a.filename.split('/').pop()] = a.data;
    }

    // Simple inline for preview: replace src/url references
    let previewHtml = htmlContent;
    for (const [filename, dataUri] of Object.entries(assetsMap)) {
      previewHtml = previewHtml.split(filename).join(dataUri);
    }

    iframe.srcdoc = previewHtml;
  }

  async create() {
    const titleEl = this.container.querySelector('#new-title');
    const title = (titleEl?.value || this.title || '').trim();

    if (!title) {
      toast.error(t('new_demo.validation.title'));
      titleEl?.focus();
      return;
    }

    let filesToSave = [...this.files];
    let assetsToSave = [...this.assets];

    if (this.method === 'paste') {
      const pasteEl = this.container.querySelector('#paste-html');
      const pastedContent = pasteEl?.value || this._pastedHtml || '';
      if (!pastedContent.trim()) {
        toast.error(t('new_demo.validation.files'));
        pasteEl?.focus();
        return;
      }
      filesToSave = [{ name: 'index.html', content: pastedContent, mimeType: 'text/html' }];
      assetsToSave = [];
      this.entryFile = 'index.html';
    }

    const createBtn = this.container.querySelector('#create-btn');
    if (createBtn) {
      createBtn.disabled = true;
      createBtn.textContent = t('new_demo.creating');
    }

    try {
      const newDemo = await createDemo({
        projectId: this.projectId,
        title,
        notes: this.container.querySelector('#new-notes')?.value || this.notes,
        tags: this.tagInput ? this.tagInput.getTags() : this.tags,
        entryFile: this.entryFile,
        files: filesToSave,
      });

      await Promise.all(
        assetsToSave.map((a) =>
          saveAsset({
            demoId: newDemo.id,
            filename: a.filename,
            mimeType: a.mimeType,
            data: a.data,
            size: a.size,
          })
        )
      );

      toast.success(t('new_demo.success'));
      appState.notifyDataChanged('demos');
      appState.navigate(`#/demos/${newDemo.id}`);
    } catch (err) {
      toast.error(t('new_demo.error', { msg: err.message }));
      if (createBtn) {
        createBtn.disabled = false;
        createBtn.textContent = t('new_demo.create');
      }
    }
  }

  destroy() {
    window.removeEventListener('locale-change', this._localeHandler);
  }
}
