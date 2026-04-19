import { appState } from 'store/app-state.js';
import { getAllProjects, createProject } from 'db/projects.js';
import { getAllDemos, createDemo } from 'db/demos.js';
import { getAssetsByDemo, saveAsset } from 'db/assets.js';
import { exportAsJSON, triggerDownload, packExport, unpackImport } from 'utils/zip.js';
import { getStorageEstimate, requestPersistence, formatBytes } from 'utils/storage-estimate.js';
import { toast } from 'components/toast.js';
import { t, getLocale, setLocale, getSupportedLocales } from 'utils/i18n.js';
import { icon } from 'utils/icons.js';

function escapeHtml(str) {
  return String(str || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

const TABS = () => [
  { id: 'import-export', label: t('settings.tab.import_export') },
  { id: 'storage', label: t('settings.tab.storage') },
  { id: 'about', label: t('settings.tab.about') },
];

export class SettingsView {
  constructor(container) {
    this.container = container;
    this.activeTab = 'import-export';
    this._localeHandler = () => this.render();
    window.addEventListener('locale-change', this._localeHandler);
    this.render();
  }

  destroy() {
    window.removeEventListener('locale-change', this._localeHandler);
  }

  render() {
    this.container.innerHTML = `
      <div class="max-w-2xl mx-auto px-6 py-8">
        <h1 class="text-2xl font-bold text-[var(--color-text-primary)] mb-6">设置</h1>

        <!-- Tab bar -->
        <div class="flex gap-1 p-1 rounded-xl bg-[var(--color-bg-secondary)] mb-6 border border-[var(--color-border)]">
          ${TABS()
            .map(
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
            )
            .join('')}
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
      <!-- Language -->
      <div class="card p-6 mb-4">
        <h3 class="font-semibold text-[var(--color-text-primary)] mb-3">${t('settings.language.title')}</h3>
        <div class="flex gap-2">
          <button data-lang="zh" class="btn ${getLocale() === 'zh' ? 'btn-primary' : 'btn-secondary'}">${t('settings.language.zh')}</button>
          <button data-lang="en" class="btn ${getLocale() === 'en' ? 'btn-primary' : 'btn-secondary'}">${t('settings.language.en')}</button>
        </div>
      </div>

      <!-- Export -->
      <div class="card p-6 mb-4">
        <h3 class="font-semibold text-[var(--color-text-primary)] mb-1">${t('settings.export.title')}</h3>
        <p class="text-sm text-[var(--color-text-secondary)] mb-4">${t('settings.export.description')}</p>
        <div class="flex gap-3 flex-wrap">
          <button id="export-json" class="btn btn-primary gap-2">
            ${icon('upload-simple', 'w-4 h-4')}
            ${t('settings.export.json')}
          </button>
          <button id="export-zip" class="btn btn-secondary gap-2">
            ${icon('download', 'w-4 h-4')}
            ${t('settings.export.zip')}
          </button>
        </div>
        <div id="export-status" class="hidden mt-3 flex items-center gap-2 text-sm text-[var(--color-text-secondary)]">
          <div class="w-4 h-4 border-2 border-[var(--color-accent)] border-t-transparent rounded-full animate-spin"></div>
          <span>${t('settings.export.exporting')}</span>
        </div>
      </div>

      <!-- Import -->
      <div class="card p-6">
        <h3 class="font-semibold text-[var(--color-text-primary)] mb-1">${t('settings.import.title')}</h3>
        <p class="text-sm text-[var(--color-text-secondary)] mb-4">从 JSON 或 ZIP 文件恢复数据</p>
        <div id="import-dropzone"
             class="border-2 border-dashed border-[var(--color-border)] rounded-xl p-8 text-center cursor-pointer
                    hover:border-[var(--color-accent)] hover:bg-[var(--color-accent-subtle)] transition-colors">
          <span class="w-10 h-10 mx-auto mb-3 text-[var(--color-text-tertiary)] flex justify-center">${icon('upload-simple', 'w-10 h-10')}</span>
          <p class="text-sm text-[var(--color-text-secondary)]">
            ${t('settings.import.drop_zone')}
          </p>
          <p class="text-xs text-[var(--color-text-tertiary)] mt-1">${t('settings.import.formats')}</p>
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
        <div class="card p-6 max-w-md w-full mx-4">
          <h3 class="font-semibold text-[var(--color-text-primary)] mb-1">${t('settings.import.conflict.title')}</h3>
          <p class="text-sm text-[var(--color-text-secondary)] mb-3" id="conflict-desc"></p>
          <div id="conflict-list"
               class="max-h-40 overflow-y-auto rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-tertiary)] text-xs text-[var(--color-text-secondary)] mb-4 divide-y divide-[var(--color-border)]">
          </div>
          <p class="text-xs text-[var(--color-text-tertiary)] mb-3">${t('settings.import.conflict.choose')}</p>
          <div class="flex flex-col gap-2">
            <button id="conflict-skip" class="btn btn-secondary w-full">${t('settings.import.conflict.skip')}</button>
            <button id="conflict-overwrite" class="btn btn-secondary w-full">${t('settings.import.conflict.overwrite')}</button>
            <button id="conflict-new" class="btn btn-primary w-full">${t('settings.import.conflict.new')}</button>
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
        <h3 class="font-semibold text-[var(--color-text-primary)] mb-4">${t('settings.storage.title')}</h3>
        <div class="mb-4">
          <div class="flex justify-between text-sm mb-1">
            <span id="usage-text" class="text-[var(--color-text-secondary)]">-</span>
            <span id="quota-text" class="text-[var(--color-text-tertiary)]">${t('settings.storage.quota')}: -</span>
          </div>
          <div class="h-3 rounded-full bg-[var(--color-bg-tertiary)] overflow-hidden">
            <div id="usage-bar" class="h-full rounded-full bg-[var(--color-accent)] transition-all duration-500" style="width:0%"></div>
          </div>
        </div>
        <div id="persistence-status" class="text-sm text-[var(--color-text-secondary)] mb-4"></div>
        <button id="request-persist-btn" class="btn btn-secondary gap-2">
          ${icon('check', 'w-4 h-4')}
          ${t('settings.storage.request_persist')}
        </button>
      </div>
    `;
  }

  // ─── Tab: About ──────────────────────────────────────────────────────────

  renderAboutTab() {
    const featureItem = (text) => `
      <li class="flex items-start gap-1.5 text-sm text-[var(--color-text-secondary)]">
        <span class="text-[var(--color-accent)] mt-0.5 shrink-0">${icon('check', 'w-3.5 h-3.5')}</span>
        ${text}
      </li>`;

    const section = (iconName, title, items) => `
      <div class="rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-secondary)] p-4">
        <div class="flex items-center gap-2 mb-3">
          <span class="text-[var(--color-accent)]">${icon(iconName, 'w-4 h-4')}</span>
          <h4 class="text-sm font-semibold text-[var(--color-text-primary)]">${title}</h4>
        </div>
        <ul class="space-y-1.5">${items.map(featureItem).join('')}</ul>
      </div>`;

    return `
      <div class="space-y-6">
        <!-- Header -->
        <div class="card p-6 flex items-center gap-4">
          <span class="text-[var(--color-accent)]">${icon('sparkle', 'w-10 h-10')}</span>
          <div class="flex-1">
            <h2 class="text-xl font-bold text-[var(--color-text-primary)]">Glint</h2>
            <p class="text-xs text-[var(--color-text-tertiary)] mt-0.5">${t('settings.about.version')} v1.0.0 · 纯浏览器应用，零服务端依赖</p>
          </div>
        </div>

        <!-- Feature grid -->
        <div>
          <h3 class="text-xs font-semibold text-[var(--color-text-tertiary)] uppercase tracking-wider mb-3">功能一览</h3>
          <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">

            ${section('file-code', 'Demo 管理', [
              '粘贴 HTML 代码快速创建（自动提取 &lt;title&gt;）',
              '拖拽单个或多个 .html 文件批量创建',
              '拖拽混合文件（html + css + 图片）打包为多文件 Demo',
              '上传文件 / 上传文件夹（自动识别入口文件）',
              '克隆 Demo，一键生成副本（含所有资源）',
              '导出为独立 HTML 文件（所有资源内联，可直接分享）',
              '删除 Demo',
            ])}

            ${section('arrows-out', '预览与编辑', [
              '沙箱 iframe 预览（null origin，无法访问父页面数据）',
              '4 种设备视口预设：手机 / 平板 / 笔记本 / 桌面',
              '可拖拽调整预览区大小（右/下/右下三个手柄）',
              '代码编辑器：行号显示 + Tab 键缩进（2 空格）',
              '文件管理标签：上传 / 删除文本文件和图片资源',
              '信息标签：备注编辑、归属项目切换',
            ])}

            ${section('folder-open', '项目与组织', [
              '创建 / 重命名 / 删除项目（删除后 Demo 变为独立状态）',
              '项目描述点击即编辑（自动保存）',
              'Demo 可归属项目或保持独立（未分组）',
              '一键将整个项目导出为 ZIP',
              '侧边栏项目树，始终展开展示所有 Demo（A-Z 排序）',
            ])}

            ${section('magnifying-glass', '搜索与导航', [
              '全局搜索（/ 键唤起），支持标题 / 备注全文匹配',
              '全部 Demo 视图：关键词搜索、排序（更新/创建/名称）',
              '按项目分组切换视图',
              '首页展示全部最近 Demo，快速回到上次工作',
            ])}

            ${section('upload-simple', '导入 / 导出', [
              '全量导出为 JSON（可读格式）或 ZIP（含原始文件）',
              '导入 JSON / ZIP，冲突时展示具体冲突项名称',
              '冲突处理策略：跳过 / 覆盖 / 全部作为新记录',
              '项目级导出：仅打包指定项目的所有 Demo',
            ])}

            ${section('sparkle', '系统与体验', [
              '主题：亮色 / 暗色 / 跟随系统（防 FOUC 处理）',
              '中文 / 英文界面实时切换',
              'PWA 支持，Service Worker 离线缓存全部静态资源',
              '存储用量实时显示，首次使用申请持久化存储',
              '纯浏览器运行，零服务端，数据全部存于本地 IndexedDB',
            ])}

          </div>
        </div>

        <!-- Tech stack -->
        <div class="card p-4">
          <h4 class="text-xs font-semibold text-[var(--color-text-tertiary)] uppercase tracking-wider mb-3">${t('settings.about.tech_stack')}</h4>
          <div class="flex flex-wrap gap-2">
            ${[
              'Vanilla JS (ES2022+)',
              'IndexedDB',
              'Service Worker',
              'Tailwind CSS v4',
              'fflate (ZIP)',
              'Phosphor Icons',
            ]
              .map(
                (s) =>
                  `<span class="px-2.5 py-1 rounded-full text-xs bg-[var(--color-bg-tertiary)] text-[var(--color-text-secondary)] border border-[var(--color-border)]">${s}</span>`
              )
              .join('')}
          </div>
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

    // Language switcher
    this.container.querySelectorAll('[data-lang]').forEach((btn) => {
      btn.addEventListener('click', () => {
        setLocale(btn.dataset.lang);
      });
    });

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
      await exportAsJSON(data);
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
      await triggerDownload(blob, `glint-export-${date}.zip`);
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
      toast.error(t('settings.import.error', { msg: err.message }));
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
      const strategy = await this.showConflictDialog(conflictingDemos, conflictingProjects);
      if (strategy === null) return; // user cancelled
      await this.doImport(data, strategy);
    } else {
      await this.doImport(data, 'skip');
    }
  }

  showConflictDialog(conflictingDemos, conflictingProjects) {
    return new Promise((resolve) => {
      const dialog = this.container.querySelector('#conflict-dialog');
      const descEl = this.container.querySelector('#conflict-desc');
      const listEl = this.container.querySelector('#conflict-list');
      const totalConflicts = conflictingDemos.length + conflictingProjects.length;

      if (!dialog) {
        resolve('skip');
        return;
      }

      if (descEl) descEl.textContent = t('settings.import.conflict.message', { n: totalConflicts });

      if (listEl) {
        const rows = [];
        if (conflictingProjects.length > 0) {
          rows.push(
            `<div class="px-3 py-1.5 font-medium text-[var(--color-text-tertiary)] uppercase tracking-wide text-[10px]">项目 (${conflictingProjects.length})</div>`
          );
          for (const p of conflictingProjects) {
            rows.push(
              `<div class="px-3 py-1.5 flex items-center gap-2">${icon('folder', 'w-3.5 h-3.5 shrink-0 text-[var(--color-accent)]')}<span class="truncate">${escapeHtml(p.title)}</span></div>`
            );
          }
        }
        if (conflictingDemos.length > 0) {
          rows.push(
            `<div class="px-3 py-1.5 font-medium text-[var(--color-text-tertiary)] uppercase tracking-wide text-[10px]">Demo (${conflictingDemos.length})</div>`
          );
          for (const d of conflictingDemos) {
            rows.push(
              `<div class="px-3 py-1.5 flex items-center gap-2">${icon('file-code', 'w-3.5 h-3.5 shrink-0 text-[var(--color-text-tertiary)]')}<span class="truncate">${escapeHtml(d.title)}</span></div>`
            );
          }
        }
        listEl.innerHTML = rows.join('');
      }

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
          const created = await createProject({
            title: project.title,
            notes: project.notes,
            tags: project.tags,
            color: project.color,
            sharedFiles: project.sharedFiles,
          });
          projectIdMap[project.id] = created.id;
        } else if (exists && strategy === 'new') {
          const created = await createProject({
            title: project.title,
            notes: project.notes,
            tags: project.tags,
            color: project.color,
            sharedFiles: project.sharedFiles,
          });
          projectIdMap[project.id] = created.id;
        } else {
          // No conflict — import as new
          const created = await createProject({
            title: project.title,
            notes: project.notes,
            tags: project.tags,
            color: project.color,
            sharedFiles: project.sharedFiles,
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
      toast.success(t('settings.import.success', { n: demoCount }));
      appState.notifyDataChanged('demos');
    } catch (err) {
      console.error('Import failed:', err);
      toast.error(t('settings.import.error', { msg: err.message }));
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

    if (usageEl)
      usageEl.textContent = `${t('settings.storage.used')} ${formatBytes(estimate.usage)}`;
    if (quotaEl)
      quotaEl.textContent = `${t('settings.storage.quota')}: ${formatBytes(estimate.quota)}`;
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
             ${icon('check', 'w-3.5 h-3.5')}
             ${t('settings.storage.persistent')}
           </span>`
        : `<span class="text-[var(--color-text-secondary)]">${t('settings.storage.not_persistent')}</span>`;
    }
  }
}
