// Generic modal using native <dialog>
import { t } from 'utils/i18n.js';
import { icon } from 'utils/icons.js';

export class Modal {
  constructor({ title, content, actions = [], onClose = null, size = 'md' }) {
    this.onClose = onClose;
    const sizeClass =
      { sm: 'max-w-sm', md: 'max-w-md', lg: 'max-w-lg', xl: 'max-w-2xl' }[size] || 'max-w-md';

    this.dialog = document.createElement('dialog');
    this.dialog.className = `modal-dialog rounded-xl shadow-2xl border border-[var(--color-border)] bg-[var(--color-bg-secondary)] p-0 w-full ${sizeClass} backdrop:bg-slate-900/60 backdrop:backdrop-blur-sm`;

    this.dialog.innerHTML = `
      <div class="flex items-center justify-between px-6 py-4 border-b border-[var(--color-border)]">
        <h2 class="text-base font-semibold text-[var(--color-text-primary)]">${escapeHtml(title)}</h2>
        <button class="btn btn-icon btn-ghost" data-close aria-label="${t('modal.close')}">
          ${icon('x', 'w-5 h-5')}
        </button>
      </div>
      <div class="modal-content px-6 py-4">${typeof content === 'string' ? content : ''}</div>
      ${actions.length ? `<div class="flex justify-end gap-2 px-6 py-4 border-t border-[var(--color-border)]" data-actions></div>` : ''}
    `;

    if (typeof content !== 'string' && content instanceof Element) {
      this.dialog.querySelector('.modal-content').appendChild(content);
    }

    if (actions.length) {
      const actionsEl = this.dialog.querySelector('[data-actions]');
      actions.forEach(({ label, variant = 'secondary', onClick }) => {
        const btn = document.createElement('button');
        btn.className = `btn btn-${variant}`;
        btn.textContent = label;
        btn.addEventListener('click', () => onClick?.(this));
        actionsEl.appendChild(btn);
      });
    }

    this.dialog.querySelector('[data-close]').addEventListener('click', () => this.close());
    this.dialog.addEventListener('click', (e) => {
      if (e.target === this.dialog) this.close();
    });
    this.dialog.addEventListener('close', () => {
      this.onClose?.();
    });

    document.body.appendChild(this.dialog);
  }

  open() {
    this.dialog.showModal();
    requestAnimationFrame(() => this.dialog.classList.add('modal-open'));
  }

  close() {
    this.dialog.classList.remove('modal-open');
    // Use a short timeout to allow any CSS exit transition, then close
    setTimeout(() => {
      if (this.dialog.open) this.dialog.close();
    }, 150);
  }

  destroy() {
    this.dialog.remove();
  }
}

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export function confirm({
  title,
  message,
  confirmText = t('modal.confirm'),
  cancelText = t('modal.cancel'),
  danger = false,
}) {
  return new Promise((resolve) => {
    const contentEl = document.createElement('p');
    contentEl.className = 'text-sm text-[var(--color-text-secondary)]';
    contentEl.textContent = message;

    const modal = new Modal({
      title,
      content: contentEl,
      actions: [
        {
          label: cancelText,
          variant: 'secondary',
          onClick: () => {
            modal.close();
            resolve(false);
          },
        },
        {
          label: confirmText,
          variant: danger ? 'danger' : 'primary',
          onClick: () => {
            modal.close();
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

export function showAlert({ title, message }) {
  return new Promise((resolve) => {
    const contentEl = document.createElement('p');
    contentEl.className = 'text-sm text-[var(--color-text-secondary)]';
    contentEl.textContent = message;

    const modal = new Modal({
      title,
      content: contentEl,
      actions: [
        {
          label: t('modal.alert_confirm'),
          variant: 'primary',
          onClick: () => {
            modal.close();
            resolve();
          },
        },
      ],
      onClose: () => {
        resolve();
        modal.destroy();
      },
    });
    modal.open();
  });
}
