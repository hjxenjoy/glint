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

    try {
      [this.demo, this.assets] = await Promise.all([getDemo(demoId), getAssetsByDemo(demoId)]);

      if (!this.demo) {
        this.renderError(t('demo.not_found'));
        return;
      }

      if (this.demo.projectId) {
        this.project = await getProject(this.demo.projectId);
      }

      this.render();

      const srcdoc = await buildSrcdoc(this.demo, this.assets);
      if (this.previewPanel) {
        this.previewPanel.setSrcdoc(srcdoc);
      }
    } catch (err) {
      console.error('DemoView init error:', err);
      this.renderError(t('demo.load_error'));
    }
  }

  render() {
    this.container.innerHTML = `
      <div class="demo-view h-full flex flex-col overflow-hidden">
        <div class="demo-view-body flex-1 overflow-hidden" style="display:grid; grid-template-columns:1fr 320px;">
          <!-- Left: Preview Panel -->
          <div class="demo-preview-area h-full overflow-hidden" id="demo-preview-area"></div>

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

    // Mount preview panel
    const previewArea = this.container.querySelector('#demo-preview-area');
    this.previewPanel = new PreviewPanel(previewArea);

    this.bindEvents();
    this.setupMobileDrawer();
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

      <!-- Files list -->
      <div class="px-4 py-3 border-b border-[var(--color-border)]">
        <div class="flex items-center justify-between mb-2">
          <span class="text-xs font-medium text-[var(--color-text-tertiary)] uppercase tracking-wider">${t('demo.files')}</span>
          <span class="text-xs text-[var(--color-text-tertiary)]">${t('demo.files_count', { n })}${an > 0 ? ' / ' + t('demo.assets_count', { n: an }) : ''}</span>
        </div>
        <ul class="space-y-1">
          ${files
            .map(
              (f) => `
            <li class="flex items-center gap-2 text-sm text-[var(--color-text-secondary)]">
              <svg class="w-3.5 h-3.5 shrink-0 text-[var(--color-text-tertiary)]"><use href="icons/sprite.svg#icon-file-code"></use></svg>
              <span class="truncate" title="${escapeHtml(f.name)}">${escapeHtml(f.name)}</span>
              ${f.name === demo.entryFile ? `<span class="ml-auto text-xs text-[var(--color-accent)] shrink-0">入口</span>` : ''}
            </li>
          `
            )
            .join('')}
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
      toast.success('Demo 已删除');
      appState.navigate('#/');
    } catch (err) {
      console.error('Delete demo error:', err);
      toast.error('删除失败，请重试');
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
        <svg class="w-12 h-12 opacity-40"><use href="icons/sprite.svg#icon-alert-circle"></use></svg>
        <p class="text-sm">${escapeHtml(message)}</p>
        <a href="#/" class="btn btn-secondary btn-sm">返回首页</a>
      </div>
    `;
  }

  destroy() {
    window.removeEventListener('locale-change', this._localeHandler);
  }
}
