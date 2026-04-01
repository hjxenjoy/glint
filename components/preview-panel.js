import { t } from 'utils/i18n.js';

const PRESETS = {
  mobile: { width: 375, height: 667, label: '375 × 667' },
  tablet: { width: 768, height: 1024, label: '768 × 1024' },
  laptop: { width: 1280, height: 800, label: '1280 × 800' },
  desktop: { width: 1920, height: 1080, label: '1920 × 1080' },
};

export class PreviewPanel {
  #logicalWidth = 1280;
  #logicalHeight = 800;
  #isDragging = false;

  constructor(container) {
    this.container = container;
    this.srcdoc = '';
    this.iframe = null;
    this._localeHandler = () => this.buildDOM();
    window.addEventListener('locale-change', this._localeHandler);
    this.buildDOM();
  }

  setSrcdoc(srcdoc) {
    this.srcdoc = srcdoc;
    if (this.iframe) this.iframe.srcdoc = srcdoc;
  }

  buildDOM() {
    this.container.innerHTML = `
      <div class="preview-panel flex flex-col h-full bg-[var(--color-bg-primary)]">
        <!-- Toolbar -->
        <div class="preview-toolbar flex items-center gap-2 px-3 py-2 border-b border-[var(--color-border)] bg-[var(--color-bg-secondary)] shrink-0">
          <!-- Viewport preset buttons -->
          <div class="flex items-center gap-1">
            <button class="preview-preset-btn btn btn-icon btn-ghost w-8 h-8" data-preset="mobile" title="${t('preview.mobile')} 375×667">
              <svg class="w-4 h-4"><use href="icons/sprite.svg#icon-mobile"></use></svg>
            </button>
            <button class="preview-preset-btn btn btn-icon btn-ghost w-8 h-8" data-preset="tablet" title="${t('preview.tablet')} 768×1024">
              <svg class="w-4 h-4"><use href="icons/sprite.svg#icon-tablet"></use></svg>
            </button>
            <button class="preview-preset-btn btn btn-icon btn-ghost w-8 h-8 active" data-preset="laptop" title="${t('preview.laptop')} 1280×800">
              <svg class="w-4 h-4"><use href="icons/sprite.svg#icon-laptop"></use></svg>
            </button>
            <button class="preview-preset-btn btn btn-icon btn-ghost w-8 h-8" data-preset="desktop" title="${t('preview.desktop')} 1920×1080">
              <svg class="w-4 h-4"><use href="icons/sprite.svg#icon-monitor"></use></svg>
            </button>
          </div>

          <!-- Size display -->
          <span class="text-xs text-[var(--color-text-tertiary)] tabular-nums" id="size-display">1280 × 800</span>

          <!-- Spacer -->
          <div class="flex-1"></div>

          <!-- Refresh button -->
          <button class="btn btn-icon btn-ghost w-8 h-8" id="refresh-btn" title="${t('preview.refresh')}">
            <svg class="w-4 h-4"><use href="icons/sprite.svg#icon-refresh"></use></svg>
          </button>

          <!-- Fullscreen button -->
          <button class="btn btn-icon btn-ghost w-8 h-8" id="fullscreen-btn" title="${t('preview.fullscreen')}">
            <svg class="w-4 h-4"><use href="icons/sprite.svg#icon-maximize"></use></svg>
          </button>
        </div>

        <!-- Preview scroll area -->
        <div class="preview-scroll-area flex-1 overflow-auto flex items-start justify-center p-4 bg-[var(--color-bg-tertiary)]">
          <!-- Resizable iframe wrapper -->
          <div class="preview-container relative bg-white shadow-lg" id="preview-container" style="width:1280px; height:800px; min-width:200px; min-height:200px;">
            <iframe
              class="preview-iframe absolute inset-0 w-full h-full border-0"
              sandbox="allow-scripts allow-forms allow-modals allow-popups allow-pointer-lock"
              id="preview-iframe"
            ></iframe>
            <!-- Resize handles -->
            <div class="resize-handle resize-handle-right" id="handle-right"></div>
            <div class="resize-handle resize-handle-bottom" id="handle-bottom"></div>
            <div class="resize-handle resize-handle-corner" id="handle-corner"></div>
          </div>
        </div>
      </div>
    `;

    this.iframe = this.container.querySelector('#preview-iframe');
    if (this.srcdoc) this.iframe.srcdoc = this.srcdoc;
    this.setupPresetButtons();
    this.setupResizeHandles();
    this.setupToolbarActions();
  }

  setupPresetButtons() {
    this.container.querySelectorAll('.preview-preset-btn').forEach((btn) => {
      btn.addEventListener('click', () => {
        const preset = PRESETS[btn.dataset.preset];
        if (!preset) return;
        const previewContainer = this.container.querySelector('#preview-container');
        previewContainer.style.width = preset.width + 'px';
        previewContainer.style.height = preset.height + 'px';
        this.#logicalWidth = preset.width;
        this.#logicalHeight = preset.height;
        this.updateSizeDisplay();
        this.setActivePreset(btn.dataset.preset);
      });
    });
  }

  setActivePreset(presetName) {
    this.container.querySelectorAll('.preview-preset-btn').forEach((btn) => {
      btn.classList.toggle('active', btn.dataset.preset === presetName);
    });
  }

  clearActivePreset() {
    this.container.querySelectorAll('.preview-preset-btn').forEach((btn) => {
      btn.classList.remove('active');
    });
  }

  updateSizeDisplay() {
    const previewContainer = this.container.querySelector('#preview-container');
    const w = Math.round(previewContainer.offsetWidth);
    const h = Math.round(previewContainer.offsetHeight);
    const display = this.container.querySelector('#size-display');
    if (display) display.textContent = `${w} × ${h}`;
  }

  setupResizeHandles() {
    const previewContainer = this.container.querySelector('#preview-container');

    const startDrag = (e, mode) => {
      e.preventDefault();
      const startX = e.clientX;
      const startY = e.clientY;
      const startW = previewContainer.offsetWidth;
      const startH = previewContainer.offsetHeight;

      this.iframe.classList.add('is-dragging');
      e.target.setPointerCapture(e.pointerId);

      const onMove = (ev) => {
        if (mode === 'right' || mode === 'corner') {
          previewContainer.style.width = Math.max(200, startW + ev.clientX - startX) + 'px';
        }
        if (mode === 'bottom' || mode === 'corner') {
          previewContainer.style.height = Math.max(200, startH + ev.clientY - startY) + 'px';
        }
        this.updateSizeDisplay();
        this.clearActivePreset();
      };

      const onUp = () => {
        this.iframe.classList.remove('is-dragging');
        e.target.removeEventListener('pointermove', onMove);
        e.target.removeEventListener('pointerup', onUp);
      };

      e.target.addEventListener('pointermove', onMove);
      e.target.addEventListener('pointerup', onUp);
    };

    this.container
      .querySelector('#handle-right')
      .addEventListener('pointerdown', (e) => startDrag(e, 'right'));
    this.container
      .querySelector('#handle-bottom')
      .addEventListener('pointerdown', (e) => startDrag(e, 'bottom'));
    this.container
      .querySelector('#handle-corner')
      .addEventListener('pointerdown', (e) => startDrag(e, 'corner'));
  }

  setupToolbarActions() {
    // Refresh
    this.container.querySelector('#refresh-btn').addEventListener('click', () => {
      this.iframe.srcdoc = '';
      requestAnimationFrame(() => {
        this.iframe.srcdoc = this.srcdoc;
      });
    });

    // Fullscreen
    this.container.querySelector('#fullscreen-btn').addEventListener('click', () => {
      const panel = this.container.querySelector('.preview-panel');
      if (panel.requestFullscreen) {
        panel.requestFullscreen();
      }
    });
  }

  destroy() {
    window.removeEventListener('locale-change', this._localeHandler);
  }
}
