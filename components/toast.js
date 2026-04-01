// Toast notification system
import { t } from 'utils/i18n.js';
import { icon } from 'utils/icons.js';

let toastContainer = null;

function getContainer() {
  if (!toastContainer) {
    toastContainer = document.createElement('div');
    toastContainer.id = 'toast-container';
    toastContainer.className = 'fixed top-4 right-4 z-50 flex flex-col gap-2 pointer-events-none';
    document.body.appendChild(toastContainer);
  }
  return toastContainer;
}

const TYPE_CONFIG = {
  success: { iconName: 'check-circle', bg: 'bg-green-500', text: 'text-white' },
  error: { iconName: 'warning', bg: 'bg-red-500', text: 'text-white' },
  warning: { iconName: 'warning', bg: 'bg-amber-500', text: 'text-white' },
  info: { iconName: 'info', bg: 'bg-indigo-500', text: 'text-white' },
};

export function showToast({ message, type = 'info', duration = 3000 }) {
  const config = TYPE_CONFIG[type] || TYPE_CONFIG.info;
  const container = getContainer();

  const toast = document.createElement('div');
  toast.className = `pointer-events-auto flex items-center gap-3 px-4 py-3 rounded-lg shadow-lg ${config.bg} ${config.text} min-w-64 max-w-sm translate-x-full opacity-0 transition-all duration-300`;

  toast.innerHTML = `
    ${icon(config.iconName, 'w-5 h-5 shrink-0')}
    <span class="text-sm font-medium flex-1">${escapeHtml(message)}</span>
    <button class="shrink-0 opacity-70 hover:opacity-100" aria-label="${t('modal.close')}">
      ${icon('x', 'w-4 h-4')}
    </button>
  `;

  container.appendChild(toast);

  // Animate in
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      toast.classList.remove('translate-x-full', 'opacity-0');
    });
  });

  const remove = () => {
    toast.classList.add('translate-x-full', 'opacity-0');
    toast.addEventListener('transitionend', () => toast.remove(), { once: true });
  };

  toast.querySelector('button').addEventListener('click', remove);
  if (duration > 0) setTimeout(remove, duration);

  return remove;
}

function escapeHtml(str) {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export const toast = {
  success: (msg, opts) => showToast({ message: msg, type: 'success', ...opts }),
  error: (msg, opts) => showToast({ message: msg, type: 'error', ...opts }),
  info: (msg, opts) => showToast({ message: msg, type: 'info', ...opts }),
  warning: (msg, opts) => showToast({ message: msg, type: 'warning', ...opts }),
};
