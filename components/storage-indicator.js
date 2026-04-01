import { getStorageEstimate, formatBytes } from 'utils/storage-estimate.js';
import { t } from 'utils/i18n.js';

export class StorageIndicator {
  constructor(container) {
    this.container = container;
    this._localeHandler = () => {
      this.render();
      this.refresh();
    };
    window.addEventListener('locale-change', this._localeHandler);
    this.render();
    this.refresh();
  }

  destroy() {
    window.removeEventListener('locale-change', this._localeHandler);
  }

  async refresh() {
    const estimate = await getStorageEstimate();
    if (!estimate) return;

    const bar = this.container.querySelector('.storage-bar-fill');
    const label = this.container.querySelector('.storage-label');

    if (bar) {
      bar.style.width = `${Math.min(estimate.percent, 100)}%`;
      // Color the bar based on usage level
      bar.classList.remove('danger', 'warning');
      if (estimate.percent > 90) {
        bar.classList.add('danger');
      } else if (estimate.percent > 70) {
        bar.classList.add('warning');
      }
    }

    if (label) {
      label.textContent = `${formatBytes(estimate.usage)} / ${formatBytes(estimate.quota)}`;
    }
  }

  render() {
    this.container.innerHTML = `
      <div>
        <div class="flex justify-between text-xs text-[var(--color-text-tertiary)] mb-1">
          <span>${t('sidebar.storage')}</span>
          <span class="storage-label">-</span>
        </div>
        <div class="h-1.5 rounded-full bg-[var(--color-bg-tertiary)] overflow-hidden">
          <div class="storage-bar-fill h-full bg-[var(--color-accent)] rounded-full transition-all duration-500" style="width:0%"></div>
        </div>
      </div>
    `;
  }
}
