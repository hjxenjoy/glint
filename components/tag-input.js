import { t } from 'utils/i18n.js';
import { icon } from 'utils/icons.js';

export class TagInput {
  constructor(container, { value = [], onChange = null, placeholder = '' } = {}) {
    this.container = container;
    this.tags = [...value];
    this.onChange = onChange;
    this.placeholder = placeholder;
    this._localeHandler = () => this.render();
    window.addEventListener('locale-change', this._localeHandler);
    this.render();
  }

  getTags() {
    return [...this.tags];
  }

  setTags(tags) {
    this.tags = [...tags];
    this.render();
  }

  render() {
    const placeholder = this.placeholder || t('tag.placeholder');
    this.container.innerHTML = `
      <div class="tag-input-container flex flex-wrap gap-1.5 p-2 rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-secondary)] min-h-10 cursor-text focus-within:ring-2 focus-within:ring-[var(--color-accent)] focus-within:border-[var(--color-accent)] transition-colors">
        ${this.tags
          .map(
            (tag) => `
          <span class="tag flex items-center gap-1">
            ${escapeHtml(tag)}
            <button data-remove="${escapeHtml(tag)}" class="opacity-60 hover:opacity-100" aria-label="${escapeHtml(t('common.delete'))}">
              ${icon('x', 'w-3 h-3')}
            </button>
          </span>
        `
          )
          .join('')}
        <input
          type="text"
          class="flex-1 min-w-24 outline-none bg-transparent text-sm text-[var(--color-text-primary)] placeholder-[var(--color-text-tertiary)]"
          placeholder="${this.tags.length === 0 ? escapeHtml(placeholder) : ''}"
        />
      </div>
    `;

    const input = this.container.querySelector('input');

    input.addEventListener('keydown', (e) => {
      if ((e.key === 'Enter' || e.key === ',') && input.value.trim()) {
        e.preventDefault();
        this.addTag(input.value.trim().replace(/,$/, ''));
        input.value = '';
      } else if (e.key === 'Backspace' && !input.value && this.tags.length) {
        this.removeTag(this.tags[this.tags.length - 1]);
      }
    });

    this.container.querySelector('.tag-input-container').addEventListener('click', (e) => {
      if (e.target === e.currentTarget || e.target.classList.contains('tag-input-container')) {
        input.focus();
      }
    });

    this.container.querySelectorAll('[data-remove]').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        this.removeTag(btn.dataset.remove);
      });
    });
  }

  addTag(tag) {
    if (!tag || this.tags.includes(tag)) return;
    this.tags.push(tag);
    this.onChange?.(this.tags);
    this.render();
  }

  removeTag(tag) {
    this.tags = this.tags.filter((t) => t !== tag);
    this.onChange?.(this.tags);
    this.render();
  }

  destroy() {
    window.removeEventListener('locale-change', this._localeHandler);
  }
}

function escapeHtml(str) {
  return String(str || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
