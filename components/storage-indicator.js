import { getStorageEstimate, formatBytes } from 'utils/storage-estimate.js';

export class StorageIndicator {
  constructor(container) {
    this.container = container;
    this.render();
    this.refresh();
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
          <span>存储</span>
          <span class="storage-label">-</span>
        </div>
        <div class="h-1.5 rounded-full bg-[var(--color-bg-tertiary)] overflow-hidden">
          <div class="storage-bar-fill h-full bg-[var(--color-accent)] rounded-full transition-all duration-500" style="width:0%"></div>
        </div>
      </div>
    `;
  }
}
