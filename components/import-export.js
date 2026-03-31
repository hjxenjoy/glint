import { appState } from 'store/app-state.js';
import { getAllProjects, createProject } from 'db/projects.js';
import { getAllDemos, createDemo } from 'db/demos.js';
import { getAssetsByDemo, saveAsset } from 'db/assets.js';
import { exportAsJSON, triggerDownload, packExport, unpackImport } from 'utils/zip.js';
import { getStorageEstimate, requestPersistence, formatBytes } from 'utils/storage-estimate.js';
import { toast } from 'components/toast.js';

const TABS = [
  { id: 'import-export', label: '导入/导出' },
  { id: 'storage', label: '存储' },
  { id: 'about', label: '关于' },
];

export class SettingsView {
  constructor(container) {
    this.container = container;
    this.activeTab = 'import-export';
    this.render();
  }

  render() {
    this.container.innerHTML = `
      <div class="max-w-2xl mx-auto px-6 py-8">
        <h1 class="text-2xl font-bold text-[var(--color-text-primary)] mb-6">设置</h1>

        <!-- Tab bar -->
        <div class="flex gap-1 p-1 rounded-xl bg-[var(--color-bg-secondary)] mb-6 border border-[var(--color-border)]">
          ${TABS.map(
            (tab) => `
            <button
              class="settings-tab flex-1 py-2 px-4 rounded-lg text-sm font-medium transition-colors
                     ${
                       this.activeTab === tab.id
                         ? 'bg-[var(--color-bg-primary)] text-[var(--color-text-primary)] shadow-sm'
                         : 'text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] hover:bg-[var(--color-bg-hover)]'
                     }"
              data-tab="${tab.id}">
              ${tab.label}
            </button>
          `
          ).join('')}
        </div>

        <!-- Tab content -->
        <div id="settings-tab-content">
          ${this.renderTabContent()}
        </div>
      </div>
    `;

    this.bindTabEvents();
    this.bindTabContentEvents();
  }

  renderTabContent() {
    switch (this.activeTab) {
      case 'import-export':
        return this.renderImportExportTab();
      case 'storage':
        return this.renderStorageTab();
      case 'about':
        return this.renderAboutTab();
      default:
        return '';
    }
  }

  // ─── Tab: Import / Export ────────────────────────────────────────────────

  renderImportExportTab() {
    return `
      <!-- Export -->
      <div class="card p-6 mb-4">
        <h3 class="font-semibold text-[var(--color-text-primary)] mb-1">导出数据</h3>
        <p class="text-sm text-[var(--color-text-secondary)] mb-4">将所有项目和 Demo 导出为文件</p>
        <div class="flex gap-3 flex-wrap">
          <button id="export-json" class="btn btn-primary gap-2">
            <svg class="w-4 h-4"><use href="icons/sprite.svg#icon-export"></use></svg>
            导出为 JSON
          </button>
          <button id="export-zip" class="btn btn-secondary gap-2">
            <svg class="w-4 h-4"><use href="icons/sprite.svg#icon-download"></use></svg>
            导出为 ZIP
          </button>
        </div>
        <div id="export-status" class="hidden mt-3 flex items-center gap-2 text-sm text-[var(--color-text-secondary)]">
          <div class="w-4 h-4 border-2 border-[var(--color-accent)] border-t-transparent rounded-full animate-spin"></div>
          <span>正在导出...</span>
        </div>
      </div>

      <!-- Import -->
      <div class="card p-6">
        <h3 class="font-semibold text-[var(--color-text-primary)] mb-1">导入数据</h3>
        <p class="text-sm text-[var(--color-text-secondary)] mb-4">从 JSON 或 ZIP 文件恢复数据</p>
        <div id="import-dropzone"
             class="border-2 border-dashed border-[var(--color-border)] rounded-xl p-8 text-center cursor-pointer
                    hover:border-[var(--color-accent)] hover:bg-[var(--color-accent-subtle)] transition-colors">
          <svg class="w-10 h-10 mx-auto mb-3 text-[var(--color-text-tertiary)]">
            <use href="icons/sprite.svg#icon-upload"></use>
          </svg>
          <p class="text-sm text-[var(--color-text-secondary)]">
            拖放 JSON 或 ZIP 文件到此处，或
            <span class="text-[var(--color-accent)] cursor-pointer">点击选择文件</span>
          </p>
          <p class="text-xs text-[var(--color-text-tertiary)] mt-1">支持 .json 和 .zip 格式</p>
          <input type="file" accept=".json,.zip" class="hidden" id="import-file-input" />
        </div>

        <!-- Import progress -->
        <div id="import-progress" class="hidden mt-4">
          <div class="flex justify-between text-sm text-[var(--color-text-secondary)] mb-1">
            <span>正在导入...</span>
            <span id="import-progress-text">0 / 0</span>
          </div>
          <div class="h-2 rounded-full bg-[var(--color-bg-tertiary)] overflow-hidden">
            <div id="import-progress-bar" class="h-full bg-[var(--color-accent)] rounded-full transition-all duration-300" style="width:0%"></div>
          </div>
        </div>
      </div>

      <!-- Conflict dialog (hidden by default) -->
      <div id="conflict-dialog" class="hidden fixed inset-0 bg-black/50 flex items-center justify-center z-50">
        <div class="card p-6 max-w-sm w-full mx-4">
          <h3 class="font-semibold text-[var(--color-text-primary)] mb-2">检测到重复数据</h3>
          <p class="text-sm text-[var(--color-text-secondary)] mb-4" id="conflict-desc"></p>
          <div class="flex flex-col gap-2">
            <button id="conflict-skip" class="btn btn-secondary w-full">跳过已存在</button>
            <button id="conflict-overwrite" class="btn btn-secondary w-full">覆盖</button>
            <button id="conflict-new" class="btn btn-primary w-full">全部导入为新记录</button>
          </div>
          <button id="conflict-cancel" class="btn btn-ghost w-full mt-2 text-sm">取消导入</button>
        </div>
      </div>
    `;
  }

  // ─── Tab: Storage ────────────────────────────────────────────────────────

  renderStorageTab() {
    return `
      <div class="card p-6">
        <h3 class="font-semibold text-[var(--color-text-primary)] mb-4">存储用量</h3>
        <div class="mb-4">
          <div class="flex justify-between text-sm mb-1">
            <span id="usage-text" class="text-[var(--color-text-secondary)]">-</span>
            <span id="quota-text" class="text-[var(--color-text-tertiary)]">配额: -</span>
          </div>
          <div class="h-3 rounded-full bg-[var(--color-bg-tertiary)] overflow-hidden">
            <div id="usage-bar" class="h-full rounded-full bg-[var(--color-accent)] transition-all duration-500" style="width:0%"></div>
          </div>
        </div>
        <div id="persistence-status" class="text-sm text-[var(--color-text-secondary)] mb-4"></div>
        <button id="request-persist-btn" class="btn btn-secondary gap-2">
          <svg class="w-4 h-4"><use href="icons/sprite.svg#icon-check"></use></svg>
          请求持久化存储
        </button>
      </div>
    `;
  }

  // ─── Tab: About ──────────────────────────────────────────────────────────

  renderAboutTab() {
    return `
      <div class="card p-6">
        <div class="flex items-center gap-3 mb-4">
          <svg class="w-8 h-8 text-[var(--color-accent)]">
            <use href="icons/sprite.svg#icon-sparkle"></use>
          </svg>
          <div>
            <h2 class="text-xl font-bold text-[var(--color-text-primary)]">Glint</h2>
            <span class="text-xs text-[var(--color-text-tertiary)]">v1.0.0</span>
          </div>
        </div>
        <p class="text-sm text-[var(--color-text-secondary)] mb-6">
          一个用于管理和预览静态 HTML Demo 的浏览器工具
        </p>

        <div class="mb-6">
          <h4 class="text-xs font-semibold text-[var(--color-text-tertiary)] uppercase tracking-wider mb-3">技术栈</h4>
          <ul class="space-y-1.5 text-sm text-[var(--color-text-secondary)]">
            <li class="flex items-center gap-2">
              <svg class="w-3.5 h-3.5 text-[var(--color-accent)]"><use href="icons/sprite.svg#icon-check"></use></svg>
              Vanilla JS (ES2022+)
            </li>
            <li class="flex items-center gap-2">
              <svg class="w-3.5 h-3.5 text-[var(--color-accent)]"><use href="icons/sprite.svg#icon-check"></use></svg>
              IndexedDB
            </li>
            <li class="flex items-center gap-2">
              <svg class="w-3.5 h-3.5 text-[var(--color-accent)]"><use href="icons/sprite.svg#icon-check"></use></svg>
              Service Worker
            </li>
            <li class="flex items-center gap-2">
              <svg class="w-3.5 h-3.5 text-[var(--color-accent)]"><use href="icons/sprite.svg#icon-check"></use></svg>
              Tailwind CSS
            </li>
          </ul>
        </div>

        <div>
          <a href="#" class="btn btn-secondary gap-2 inline-flex">
            <svg class="w-4 h-4"><use href="icons/sprite.svg#icon-github"></use></svg>
            GitHub
          </a>
        </div>
      </div>
    `;
  }

  // ─── Event binding ───────────────────────────────────────────────────────

  bindTabEvents() {
    this.container.querySelectorAll('.settings-tab').forEach((btn) => {
      btn.addEventListener('click', () => {
        this.activeTab = btn.dataset.tab;
        // Re-render tab bar active states
        this.container.querySelectorAll('.settings-tab').forEach((b) => {
          const isActive = b.dataset.tab === this.activeTab;
          b.className = `settings-tab flex-1 py-2 px-4 rounded-lg text-sm font-medium transition-colors ${
            isActive
              ? 'bg-[var(--color-bg-primary)] text-[var(--color-text-primary)] shadow-sm'
              : 'text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] hover:bg-[var(--color-bg-hover)]'
          }`;
        });
        // Re-render content
        const contentEl = this.container.querySelector('#settings-tab-content');
        if (contentEl) {
          contentEl.innerHTML = this.renderTabContent();
          this.bindTabContentEvents();
        }
      });
    });
  }

  bindTabContentEvents() {
    switch (this.activeTab) {
      case 'import-export':
        this.bindImportExportEvents();
        break;
      case 'storage':
        this.bindStorageEvents();
        break;
    }
  }

  // ─── Import/Export events ────────────────────────────────────────────────

  bindImportExportEvents() {
    const exportJsonBtn = this.container.querySelector('#export-json');
    const exportZipBtn = this.container.querySelector('#export-zip');
    const dropzone = this.container.querySelector('#import-dropzone');
    const fileInput = this.container.querySelector('#import-file-input');

    exportJsonBtn?.addEventListener('click', () => this.handleExportJson());
    exportZipBtn?.addEventListener('click', () => this.handleExportZip());

    // Dropzone click
    dropzone?.addEventListener('click', () => fileInput?.click());

    // Dropzone drag & drop
    dropzone?.addEventListener('dragover', (e) => {
      e.preventDefault();
      dropzone.classList.add('border-[var(--color-accent)]', 'bg-[var(--color-accent-subtle)]');
    });
    dropzone?.addEventListener('dragleave', () => {
      dropzone.classList.remove('border-[var(--color-accent)]', 'bg-[var(--color-accent-subtle)]');
    });
    dropzone?.addEventListener('drop', (e) => {
      e.preventDefault();
      dropzone.classList.remove('border-[var(--color-accent)]', 'bg-[var(--color-accent-subtle)]');
      const file = e.dataTransfer?.files?.[0];
      if (file) this.handleImportFile(file);
    });

    // File input change
    fileInput?.addEventListener('change', (e) => {
      const file = e.target.files?.[0];
      if (file) this.handleImportFile(file);
      e.target.value = '';
    });
  }

  async handleExportJson() {
    const statusEl = this.container.querySelector('#export-status');
    const btn = this.container.querySelector('#export-json');
    try {
      if (statusEl) statusEl.classList.remove('hidden');
      if (btn) btn.disabled = true;

      const data = await this.gatherExportData();
      const blob = exportAsJSON(data);
      const date = new Date().toISOString().slice(0, 10);
      triggerDownload(blob, `glint-export-${date}.json`);
      toast.success('JSON 导出成功');
    } catch (err) {
      console.error('Export JSON failed:', err);
      toast.error('导出失败：' + (err.message || '未知错误'));
    } finally {
      if (statusEl) statusEl.classList.add('hidden');
      if (btn) btn.disabled = false;
    }
  }

  async handleExportZip() {
    const statusEl = this.container.querySelector('#export-status');
    const btn = this.container.querySelector('#export-zip');
    try {
      if (statusEl) statusEl.classList.remove('hidden');
      if (btn) btn.disabled = true;

      const data = await this.gatherExportData();
      const blob = await packExport(data);
      const date = new Date().toISOString().slice(0, 10);
      triggerDownload(blob, `glint-export-${date}.zip`);
      toast.success('ZIP 导出成功');
    } catch (err) {
      console.error('Export ZIP failed:', err);
      toast.error('导出失败：' + (err.message || '未知错误'));
    } finally {
      if (statusEl) statusEl.classList.add('hidden');
      if (btn) btn.disabled = false;
    }
  }

  async gatherExportData() {
    const [projects, allDemos] = await Promise.all([getAllProjects(), getAllDemos()]);

    const demosWithAssets = await Promise.all(
      allDemos.map(async (demo) => {
        const assets = await getAssetsByDemo(demo.id);
        return { ...demo, assets };
      })
    );

    return { projects, demos: demosWithAssets };
  }

  async handleImportFile(file) {
    let data;
    try {
      if (file.name.endsWith('.zip')) {
        const buffer = await file.arrayBuffer();
        data = await unpackImport(buffer);
      } else {
        const text = await file.text();
        data = JSON.parse(text);
      }
    } catch (err) {
      toast.error('文件解析失败：' + (err.message || '格式错误'));
      return;
    }

    if (!data || !Array.isArray(data.demos)) {
      toast.error('无效的导出文件格式');
      return;
    }

    // Check for ID conflicts
    const [existingProjects, existingDemos] = await Promise.all([getAllProjects(), getAllDemos()]);
    const existingProjectIds = new Set(existingProjects.map((p) => p.id));
    const existingDemoIds = new Set(existingDemos.map((d) => d.id));

    const conflictingDemos = (data.demos || []).filter((d) => existingDemoIds.has(d.id));
    const conflictingProjects = (data.projects || []).filter((p) => existingProjectIds.has(p.id));
    const totalConflicts = conflictingDemos.length + conflictingProjects.length;

    if (totalConflicts > 0) {
      const strategy = await this.showConflictDialog(
        totalConflicts,
        conflictingDemos.length,
        conflictingProjects.length
      );
      if (strategy === null) return; // user cancelled
      await this.doImport(data, strategy);
    } else {
      await this.doImport(data, 'skip');
    }
  }

  showConflictDialog(totalConflicts, demosCount, projectsCount) {
    return new Promise((resolve) => {
      const dialog = this.container.querySelector('#conflict-dialog');
      const descEl = this.container.querySelector('#conflict-desc');

      if (!dialog) {
        resolve('skip');
        return;
      }

      const parts = [];
      if (demosCount > 0) parts.push(`${demosCount} 个 Demo`);
      if (projectsCount > 0) parts.push(`${projectsCount} 个项目`);
      if (descEl)
        descEl.textContent = `检测到 ${parts.join('和')} 与现有数据 ID 重复，请选择处理方式：`;

      dialog.classList.remove('hidden');

      const cleanup = (strategy) => {
        dialog.classList.add('hidden');
        resolve(strategy);
      };

      dialog
        .querySelector('#conflict-skip')
        ?.addEventListener('click', () => cleanup('skip'), { once: true });
      dialog
        .querySelector('#conflict-overwrite')
        ?.addEventListener('click', () => cleanup('overwrite'), { once: true });
      dialog
        .querySelector('#conflict-new')
        ?.addEventListener('click', () => cleanup('new'), { once: true });
      dialog
        .querySelector('#conflict-cancel')
        ?.addEventListener('click', () => cleanup(null), { once: true });
    });
  }

  async doImport(data, strategy) {
    const progressEl = this.container.querySelector('#import-progress');
    const progressBar = this.container.querySelector('#import-progress-bar');
    const progressText = this.container.querySelector('#import-progress-text');

    const projects = data.projects || [];
    const demos = data.demos || [];
    const total = projects.length + demos.length;
    let imported = 0;

    const updateProgress = () => {
      if (progressBar) progressBar.style.width = `${Math.round((imported / total) * 100)}%`;
      if (progressText) progressText.textContent = `${imported} / ${total}`;
    };

    try {
      if (progressEl) progressEl.classList.remove('hidden');
      updateProgress();

      // Import projects
      const [existingProjects, existingDemos] = await Promise.all([
        getAllProjects(),
        getAllDemos(),
      ]);
      const existingProjectIds = new Set(existingProjects.map((p) => p.id));
      const existingDemoIds = new Set(existingDemos.map((d) => d.id));

      // Build a projectId remap table (for 'new' strategy)
      const projectIdMap = {};

      for (const project of projects) {
        const exists = existingProjectIds.has(project.id);
        if (exists && strategy === 'skip') {
          projectIdMap[project.id] = project.id;
        } else if (exists && strategy === 'overwrite') {
          // createProject doesn't do upsert; import the raw record via createProject then patch.
          // For simplicity, use the same ID by calling createProject with a forced ID isn't supported;
          // we create a new record and remap.
          const created = await createProject({
            title: project.title,
            notes: project.notes,
            tags: project.tags,
            color: project.color,
          });
          projectIdMap[project.id] = created.id;
        } else if (exists && strategy === 'new') {
          const created = await createProject({
            title: project.title,
            notes: project.notes,
            tags: project.tags,
            color: project.color,
          });
          projectIdMap[project.id] = created.id;
        } else {
          // No conflict — import as new
          const created = await createProject({
            title: project.title,
            notes: project.notes,
            tags: project.tags,
            color: project.color,
          });
          projectIdMap[project.id] = created.id;
        }
        imported++;
        updateProgress();
      }

      // Import demos
      for (const demo of demos) {
        const exists = existingDemoIds.has(demo.id);
        if (exists && strategy === 'skip') {
          imported++;
          updateProgress();
          continue;
        }

        // Remap projectId if needed
        const newProjectId = demo.projectId
          ? (projectIdMap[demo.projectId] ?? demo.projectId)
          : null;

        const created = await createDemo({
          projectId: newProjectId,
          title: demo.title,
          notes: demo.notes || '',
          tags: demo.tags || [],
          entryFile: demo.entryFile || 'index.html',
          files: demo.files || [],
        });

        // Import assets
        if (Array.isArray(demo.assets)) {
          for (const asset of demo.assets) {
            await saveAsset({
              demoId: created.id,
              filename: asset.filename,
              mimeType: asset.mimeType,
              data: asset.data,
              size: asset.size || 0,
            });
          }
        }

        imported++;
        updateProgress();
      }

      const demoCount = demos.filter(
        (d) => !(existingDemoIds.has(d.id) && strategy === 'skip')
      ).length;
      toast.success(`导入完成，共导入 ${demoCount} 个 Demo`);
      appState.notifyDataChanged('demos');
    } catch (err) {
      console.error('Import failed:', err);
      toast.error('导入失败：' + (err.message || '未知错误'));
    } finally {
      if (progressEl) progressEl.classList.add('hidden');
    }
  }

  // ─── Storage events ──────────────────────────────────────────────────────

  bindStorageEvents() {
    this.loadStorageInfo();

    this.container.querySelector('#request-persist-btn')?.addEventListener('click', async () => {
      try {
        const granted = await requestPersistence();
        if (granted) {
          toast.success('已开启持久化存储');
          this.loadStorageInfo();
        } else {
          toast.info('浏览器拒绝了持久化存储请求，建议定期导出备份');
        }
      } catch (err) {
        toast.error('请求持久化存储失败');
      }
    });
  }

  async loadStorageInfo() {
    const estimate = await getStorageEstimate();
    const usageEl = this.container.querySelector('#usage-text');
    const quotaEl = this.container.querySelector('#quota-text');
    const barEl = this.container.querySelector('#usage-bar');
    const persistStatusEl = this.container.querySelector('#persistence-status');

    if (!estimate) return;

    if (usageEl) usageEl.textContent = `已用 ${formatBytes(estimate.usage)}`;
    if (quotaEl) quotaEl.textContent = `配额: ${formatBytes(estimate.quota)}`;
    if (barEl) {
      barEl.style.width = `${Math.min(estimate.percent, 100)}%`;
      if (estimate.percent > 90) {
        barEl.classList.remove('bg-[var(--color-accent)]');
        barEl.classList.add('bg-red-500');
      } else if (estimate.percent > 70) {
        barEl.classList.remove('bg-[var(--color-accent)]');
        barEl.classList.add('bg-yellow-500');
      }
    }

    if (persistStatusEl) {
      const persisted = estimate.persisted ?? false;
      persistStatusEl.innerHTML = persisted
        ? `<span class="text-green-600 dark:text-green-400 flex items-center gap-1">
             <svg class="w-3.5 h-3.5"><use href="icons/sprite.svg#icon-check"></use></svg>
             已持久化存储
           </span>`
        : `<span class="text-[var(--color-text-secondary)]">未持久化 — 建议定期导出备份，以防浏览器清理数据</span>`;
    }
  }
}
