import { appState } from 'store/app-state.js';
import { getDemo, deleteDemo } from 'db/demos.js';
import { getAssetsByDemo } from 'db/assets.js';
import { getProject } from 'db/projects.js';
import { deleteAssetsByDemo } from 'db/assets.js';
import { buildSrcdoc } from 'utils/file-resolver.js';
import { formatRelative, formatFull } from 'utils/date.js';
import { PreviewPanel } from 'components/preview-panel.js';
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

export class DemoView {
  constructor(container) {
    this.container = container;
    this.demo = null;
    this.assets = [];
    this.project = null;
    this.previewPanel = null;
    // Currently previewed file name (null = use default/entryFile)
    this.activeFileName = null;
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

    // Reset active file on fresh load (keep it if re-rendering for locale change)
    const prevDemoId = this.demo?.id;
    if (prevDemoId !== demoId) this.activeFileName = null;

    try {
      [this.demo, this.assets] = await Promise.all([getDemo(demoId), getAssetsByDemo(demoId)]);

      if (!this.demo) {
        this.renderError(t('demo.not_found'));
        return;
      }

      if (this.demo.projectId) {
        this.project = await getProject(this.demo.projectId).catch(() => null);
      } else {
        this.project = null;
      }

      this.render();
      await this.loadPreview();
    } catch (err) {
      console.error('DemoView init error:', err);
      this.renderError(t('demo.load_error'));
    }
  }

  /** Build and set srcdoc for the currently active file */
  async loadPreview() {
    if (!this.previewPanel) return;
    const srcdoc = await buildSrcdoc(this.demo, this.assets, this.activeFileName);
    this.previewPanel.setSrcdoc(srcdoc);
  }

  /** All HTML files in the demo — these can be individually previewed */
  get htmlFiles() {
    return (this.demo?.files || []).filter((f) => f.name.endsWith('.html'));
  }

  render() {
    this.container.innerHTML = `
      <div class="demo-view h-full flex flex-col overflow-hidden">
        <div class="demo-view-body flex-1 overflow-hidden" style="display:grid; grid-template-columns:1fr 320px;">
          <!-- Left: Preview area + file tabs -->
          <div class="flex flex-col h-full overflow-hidden">
            <!-- File switcher tabs (only shown when demo has multiple HTML files) -->
            <div id="file-tabs-bar" class="shrink-0"></div>
            <!-- Preview Panel -->
            <div class="flex-1 overflow-hidden" id="demo-preview-area"></div>
          </div>

          <!-- Right: Metadata Panel -->
          <div class="demo-meta-panel flex flex-col border-l border-[var(--color-border)] bg-[var(--color-bg-secondary)] overflow-y-auto" id="demo-meta-panel">
            ${this.renderMetaPanel()}
          </div>
        </div>

        <!-- Mobile: bottom drawer toggle -->
        <div class="demo-meta-drawer-toggle md:hidden flex items-center justify-center py-2 border-t border-[var(--color-border)] bg-[var(--color-bg-secondary)]" id="meta-drawer-toggle">
          <button class="btn btn-ghost text-xs gap-1 text-[var(--color-text-secondary)]" id="meta-toggle-btn">
            <svg class="w-4 h-4" id="meta-toggle-icon"><use href="icons/sprite.svg#icon-chevron-up"></use></svg>
            <span id="meta-toggle-label">查看详情</span>
          </button>
        </div>
      </div>
    `;

    // Render file tabs
    this.renderFileTabs();

    // Mount preview panel
    const previewArea = this.container.querySelector('#demo-preview-area');
    this.previewPanel = new PreviewPanel(previewArea);

    this.bindEvents();
    this.setupMobileDrawer();
  }

  /**
   * File switcher tabs bar.
   * Shows only when the demo has HTML files.
   * Each tab is a clickable button that switches the preview.
   * The default file gets a small star indicator.
   */
  renderFileTabs() {
    const bar = this.container.querySelector('#file-tabs-bar');
    if (!bar) return;

    const files = this.htmlFiles;
    // If there's only one (or zero) HTML file, no tabs needed
    if (files.length <= 1) {
      bar.innerHTML = '';
      return;
    }

    const defaultFile = this.demo.entryFile || files[0]?.name;
    const active = this.activeFileName || defaultFile;

    bar.innerHTML = `
      <div class="flex items-center gap-0.5 px-2 py-1.5 border-b border-[var(--color-border)] bg-[var(--color-bg-secondary)] overflow-x-auto shrink-0" role="tablist" aria-label="${t('demo.file_tabs.all_files')}">
        ${files
          .map((f) => {
            const isActive = f.name === active;
            const isDefault = f.name === defaultFile;
            return `
            <button
              role="tab"
              aria-selected="${isActive}"
              data-filename="${escapeHtml(f.name)}"
              title="${t('demo.file_tabs.open')}: ${escapeHtml(f.name)}"
              class="file-tab flex items-center gap-1 px-3 py-1.5 rounded-md text-xs whitespace-nowrap transition-colors shrink-0
                ${isActive ? 'bg-[var(--color-accent-subtle)] text-[var(--color-accent)] font-medium' : 'text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-hover)] hover:text-[var(--color-text-primary)]'}"
            >
              <svg class="w-3 h-3 shrink-0"><use href="icons/sprite.svg#icon-file-code"></use></svg>
              <span>${escapeHtml(f.name)}</span>
              ${
                isDefault
                  ? `<span class="ml-0.5 text-[var(--color-accent)] opacity-70" title="${t('demo.file_tabs.default')}">★</span>`
                  : ''
              }
            </button>
          `;
          })
          .join('')}
      </div>
    `;

    // Bind tab click events
    bar.querySelectorAll('.file-tab').forEach((btn) => {
      btn.addEventListener('click', () => {
        const filename = btn.dataset.filename;
        if (filename === this.activeFileName) return;
        this.activeFileName = filename;
        this.renderFileTabs(); // update active state
        this.loadPreview();
        // Also update the clickable file list in meta panel
        this.updateMetaFileList();
      });
    });
  }

  /** Re-render the files list in meta panel to reflect active file */
  updateMetaFileList() {
    const listContainer = this.container.querySelector('#meta-files-list');
    if (!listContainer) return;
    listContainer.innerHTML = this.renderFilesList();
    this.bindFileListEvents();
  }

  /** Files list HTML (used in meta panel) */
  renderFilesList() {
    const demo = this.demo;
    const files = demo.files || [];
    const defaultFile = demo.entryFile || files[0]?.name;
    const active = this.activeFileName || defaultFile;

    return files
      .map((f) => {
        const isHtml = f.name.endsWith('.html');
        const isDefault = f.name === defaultFile;
        const isActive = isHtml && f.name === active;
        return `
        <li class="flex items-center gap-2 text-sm group ${isHtml ? 'cursor-pointer' : ''}">
          <svg class="w-3.5 h-3.5 shrink-0 ${isActive ? 'text-[var(--color-accent)]' : 'text-[var(--color-text-tertiary)]'}">
            <use href="icons/sprite.svg#icon-file-code"></use>
          </svg>
          ${
            isHtml
              ? `<button
                  data-filename="${escapeHtml(f.name)}"
                  class="file-list-btn truncate text-left flex-1 ${isActive ? 'text-[var(--color-accent)] font-medium' : 'text-[var(--color-text-secondary)] hover:text-[var(--color-accent)]'} transition-colors"
                  title="${t('demo.file_tabs.open')}: ${escapeHtml(f.name)}"
                >${escapeHtml(f.name)}</button>`
              : `<span class="truncate text-[var(--color-text-secondary)] flex-1" title="${escapeHtml(f.name)}">${escapeHtml(f.name)}</span>`
          }
          ${
            isDefault
              ? `<span class="text-xs text-[var(--color-accent)] opacity-60 shrink-0" title="${t('demo.file_tabs.default')}">★</span>`
              : ''
          }
        </li>
      `;
      })
      .join('');
  }

  bindFileListEvents() {
    this.container.querySelectorAll('.file-list-btn').forEach((btn) => {
      btn.addEventListener('click', () => {
        const filename = btn.dataset.filename;
        if (filename === this.activeFileName) return;
        this.activeFileName = filename;
        this.renderFileTabs();
        this.loadPreview();
        this.updateMetaFileList();
      });
    });
  }

  renderMetaPanel() {
    const demo = this.demo;
    const files = demo.files || [];
    const tags = demo.tags || [];
    const n = files.length;
    const an = this.assets.length;

    return `
      <!-- Title + actions -->
      <div class="px-4 pt-5 pb-3 border-b border-[var(--color-border)]">
        <div class="flex items-start justify-between gap-2 mb-3">
          <h1 class="text-base font-semibold text-[var(--color-text-primary)] leading-snug break-words min-w-0" title="${escapeHtml(demo.title)}">
            ${escapeHtml(demo.title)}
          </h1>
          <a href="#/demos/${escapeHtml(demo.id)}/edit"
             class="btn btn-secondary btn-sm shrink-0 gap-1"
             title="${escapeHtml(t('demo.edit_btn'))}">
            <svg class="w-3.5 h-3.5"><use href="icons/sprite.svg#icon-edit"></use></svg>
            ${t('demo.edit_btn')}
          </a>
        </div>

        ${
          this.project
            ? `
          <a href="#/projects/${escapeHtml(this.project.id)}"
             class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border border-[var(--color-border)] hover:bg-[var(--color-bg-hover)] transition-colors text-[var(--color-text-secondary)] mb-1"
             style="${this.project.color ? `border-color:${this.project.color}; color:${this.project.color};` : ''}">
            <svg class="w-3 h-3"><use href="icons/sprite.svg#icon-folder"></use></svg>
            ${escapeHtml(this.project.title)}
          </a>
        `
            : `
          <span class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border border-[var(--color-border)] text-[var(--color-text-tertiary)] mb-1">
            ${t('demo.no_project')}
          </span>
        `
        }
      </div>

      <!-- Notes -->
      ${
        demo.notes
          ? `
        <div class="px-4 py-3 border-b border-[var(--color-border)]">
          <p class="text-sm text-[var(--color-text-secondary)] whitespace-pre-wrap leading-relaxed">${escapeHtml(demo.notes)}</p>
        </div>
      `
          : ''
      }

      <!-- Tags -->
      ${
        tags.length > 0
          ? `
        <div class="px-4 py-3 border-b border-[var(--color-border)]">
          <div class="flex flex-wrap gap-1.5">
            ${tags
              .map(
                (tag) => `
              <span class="inline-flex items-center px-2 py-0.5 rounded-full text-xs bg-[var(--color-bg-tertiary)] text-[var(--color-text-secondary)] border border-[var(--color-border)]">
                ${escapeHtml(tag)}
              </span>
            `
              )
              .join('')}
          </div>
        </div>
      `
          : ''
      }

      <!-- Files list (HTML files are clickable to switch preview) -->
      <div class="px-4 py-3 border-b border-[var(--color-border)]">
        <div class="flex items-center justify-between mb-2">
          <span class="text-xs font-medium text-[var(--color-text-tertiary)] uppercase tracking-wider">${t('demo.files')}</span>
          <span class="text-xs text-[var(--color-text-tertiary)]">${t('demo.files_count', { n })}${an > 0 ? ' / ' + t('demo.assets_count', { n: an }) : ''}</span>
        </div>
        <ul class="space-y-1" id="meta-files-list">
          ${this.renderFilesList()}
        </ul>
        ${
          this.assets.length > 0
            ? `
          <ul class="space-y-1 mt-1 pt-1 border-t border-[var(--color-border-subtle,var(--color-border))]">
            ${this.assets
              .map(
                (a) => `
              <li class="flex items-center gap-2 text-sm text-[var(--color-text-secondary)]">
                <svg class="w-3.5 h-3.5 shrink-0 text-[var(--color-text-tertiary)]"><use href="icons/sprite.svg#icon-image"></use></svg>
                <span class="truncate" title="${escapeHtml(a.filename)}">${escapeHtml(a.filename)}</span>
              </li>
            `
              )
              .join('')}
          </ul>
        `
            : ''
        }
      </div>

      <!-- Timestamps -->
      <div class="px-4 py-3 border-b border-[var(--color-border)] space-y-2">
        <div class="flex items-center justify-between text-xs">
          <span class="text-[var(--color-text-tertiary)]">${t('demo.created')}</span>
          <span class="text-[var(--color-text-secondary)]" title="${formatFull(demo.createdAt)}">${formatRelative(demo.createdAt)}</span>
        </div>
        <div class="flex items-center justify-between text-xs">
          <span class="text-[var(--color-text-tertiary)]">${t('demo.updated')}</span>
          <span class="text-[var(--color-text-secondary)]" title="${formatFull(demo.updatedAt)}">${formatRelative(demo.updatedAt)}</span>
        </div>
      </div>

      <!-- Spacer -->
      <div class="flex-1"></div>

      <!-- Delete button -->
      <div class="px-4 py-4 border-t border-[var(--color-border)]">
        <button class="btn btn-danger w-full gap-2 justify-center" id="delete-demo-btn">
          <svg class="w-4 h-4"><use href="icons/sprite.svg#icon-trash"></use></svg>
          ${t('demo.delete_btn')}
        </button>
      </div>
    `;
  }

  bindEvents() {
    const deleteBtn = this.container.querySelector('#delete-demo-btn');
    deleteBtn?.addEventListener('click', () => this.handleDelete());
    this.bindFileListEvents();
  }

  async handleDelete() {
    const confirmed = await confirm({
      title: t('demo.delete.confirm.title'),
      message: t('demo.delete.confirm.message'),
      confirmText: t('demo.delete_btn'),
      cancelText: t('editor.cancel'),
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

  setupMobileDrawer() {
    const toggleBtn = this.container.querySelector('#meta-toggle-btn');
    const metaPanel = this.container.querySelector('#demo-meta-panel');
    const toggleIcon = this.container.querySelector('#meta-toggle-icon');
    const toggleLabel = this.container.querySelector('#meta-toggle-label');
    if (!toggleBtn || !metaPanel) return;

    let isOpen = false;

    const applyMobileState = () => {
      if (window.innerWidth < 768) {
        metaPanel.style.position = 'fixed';
        metaPanel.style.bottom = '0';
        metaPanel.style.left = '0';
        metaPanel.style.right = '0';
        metaPanel.style.zIndex = '40';
        metaPanel.style.maxHeight = isOpen ? '70vh' : '0';
        metaPanel.style.overflow = isOpen ? 'auto' : 'hidden';
        metaPanel.style.transition = 'max-height 0.3s ease';
        toggleIcon
          .querySelector('use')
          .setAttribute(
            'href',
            isOpen ? 'icons/sprite.svg#icon-chevron-down' : 'icons/sprite.svg#icon-chevron-up'
          );
        toggleLabel.textContent = isOpen ? '收起详情' : '查看详情';
      } else {
        metaPanel.style.position = '';
        metaPanel.style.bottom = '';
        metaPanel.style.left = '';
        metaPanel.style.right = '';
        metaPanel.style.zIndex = '';
        metaPanel.style.maxHeight = '';
        metaPanel.style.overflow = '';
        metaPanel.style.transition = '';
      }
    };

    toggleBtn.addEventListener('click', () => {
      isOpen = !isOpen;
      applyMobileState();
    });

    window.addEventListener('resize', applyMobileState);
    applyMobileState();
  }

  renderError(message) {
    this.container.innerHTML = `
      <div class="flex flex-col items-center justify-center h-full gap-4 text-[var(--color-text-tertiary)]">
        <svg class="w-12 h-12 opacity-40"><use href="icons/sprite.svg#icon-warning"></use></svg>
        <p class="text-sm">${escapeHtml(message)}</p>
        <a href="#/" class="btn btn-secondary btn-sm">${t('common.back')}</a>
      </div>
    `;
  }

  destroy() {
    window.removeEventListener('locale-change', this._localeHandler);
  }
}
