/**
 * Glint i18n — Bilingual support (zh / en)
 * - Reads browser language on first load
 * - Manual override persisted to localStorage('glint-locale')
 * - t(key, vars?) for translation with optional interpolation: t('foo.bar', { n: 3 })
 * - Listen to window 'locale-change' CustomEvent to re-render on switch
 */

const LOCALE_KEY = 'glint-locale';

function detectLocale() {
  const saved = localStorage.getItem(LOCALE_KEY);
  if (saved === 'zh' || saved === 'en') return saved;
  const lang = navigator.language || navigator.languages?.[0] || 'zh';
  return lang.startsWith('zh') ? 'zh' : 'en';
}

const translations = {
  zh: {
    // App
    'app.name': 'Glint',
    'app.tagline': '一个个闪光的创意片段',

    // Header
    'header.search.placeholder': '搜索 Demo 和项目...',
    'header.search.shortcut': '/',
    'header.theme.system': '跟随系统',
    'header.theme.light': '亮色模式',
    'header.theme.dark': '暗色模式',
    'header.settings': '设置',
    'header.sidebar.toggle': '切换侧边栏',

    // Sidebar
    'sidebar.new_demo': '新建 Demo',
    'sidebar.home': '首页',
    'sidebar.all_demos': '全部 Demo',
    'sidebar.projects': '项目',
    'sidebar.new_project': '新建项目',
    'sidebar.standalone_demos': '独立 Demo',
    'sidebar.no_projects': '暂无项目',
    'sidebar.storage': '存储用量',
    'sidebar.loading': '加载中...',
    'sidebar.no_demos': '暂无 Demo',

    // Home View
    'home.title': '你好，Glint',
    'home.subtitle': '管理你的静态 HTML Demo 创意片段',
    'home.new_demo': '新建 Demo',
    'home.recent_demos': '最近 Demo',
    'home.recent_projects': '最近项目',
    'home.empty.title': '还没有 Demo',
    'home.empty.description': '上传或创建你的第一个静态 HTML Demo',
    'home.empty.cta': '立即新建你的第一个 Demo',
    'home.demos_count': '{n} 个 Demo',

    // All Demos View
    'demos.title': '全部 Demo',
    'demos.count': '{n} 个 Demo',
    'demos.filter.search': '搜索...',
    'demos.filter.tag_all': '全部标签',
    'demos.filter.sort': '排序',
    'demos.filter.sort.updated': '最近更新',
    'demos.filter.sort.created': '最近创建',
    'demos.filter.sort.name': '名称',
    'demos.filter.group': '按项目分组',
    'demos.empty.no_demos': '还没有 Demo',
    'demos.empty.no_match': '没有匹配的 Demo',
    'demos.empty.clear_filter': '清除筛选',
    'demos.standalone': '独立 Demo',
    'demos.all_new_demo': '新建 Demo',

    // Demo Card
    'demo.edit': '编辑',
    'demo.clone': '克隆',
    'demo.delete': '删除',
    'demo.updated': '更新于 {time}',
    'demo.no_project': '无项目',

    // Project View
    'project.new_demo': '新建 Demo',
    'project.edit_title': '点击编辑标题',
    'project.no_demos': '该项目还没有 Demo',
    'project.export': '导出项目',
    'project.delete': '删除项目',
    'project.delete.confirm.title': '删除项目',
    'project.delete.confirm.message': '删除项目将不会删除其中的 Demo，Demo 将变为独立状态',
    'project.add_tag': '添加标签',
    'project.notes.placeholder': '添加项目备注...',
    'project.demos_count': '{n} 个 Demo',
    'project.created': '创建于',
    'project.updated': '更新于',
    'project.color': '颜色',
    'project.loading': '加载中...',

    // Demo View
    'demo.preview.title': '预览',
    'demo.edit_btn': '编辑',
    'demo.delete_btn': '删除',
    'demo.delete.confirm.title': '删除 Demo',
    'demo.delete.confirm.message': '此操作不可恢复，确认删除吗？',
    'demo.files': '文件',
    'demo.files_count': '{n} 个文件',
    'demo.assets_count': '{n} 个资源',
    'demo.assets': '资源',
    'demo.created': '创建于',
    'demo.updated': '更新于',
    'demo.loading': '加载中...',
    'demo.load_error': 'Demo 加载失败',
    'demo.not_found': 'Demo 不存在',

    // Preview Panel
    'preview.mobile': '手机',
    'preview.tablet': '平板',
    'preview.laptop': '笔记本',
    'preview.desktop': '台式机',
    'preview.refresh': '刷新预览',
    'preview.fullscreen': '全屏预览',

    // Demo Editor
    'editor.tab.files': '文件',
    'editor.tab.metadata': '元数据',
    'editor.save': '保存',
    'editor.cancel': '取消',
    'editor.back': '返回预览',
    'editor.upload': '上传文件',
    'editor.upload_folder': '上传文件夹',
    'editor.drop_zone': '拖放文件到此处，或点击上传',
    'editor.entry_file': '默认文件',
    'editor.set_entry': '设为默认',
    'editor.file.edit': '编辑',
    'editor.file.delete': '删除',
    'editor.total_size': '文件总大小',
    'editor.title': '标题',
    'editor.title.placeholder': '输入 Demo 标题',
    'editor.notes': '备注',
    'editor.notes.placeholder': '添加备注...',
    'editor.tags': '标签',
    'editor.project': '所属项目',
    'editor.no_project': '无项目（独立 Demo）',
    'editor.entry_file_label': '默认文件',
    'editor.created': '创建时间',
    'editor.updated': '更新时间',
    'editor.save.success': '已保存',
    'editor.save.error': '保存失败',
    'editor.validation.title': '请输入标题',
    'editor.code.placeholder': '在此输入 HTML 代码...',
    'editor.assets_section': '图片资源',
    'editor.no_files': '暂无文件，请上传',

    // New Demo
    'new_demo.title': '新建 Demo',
    'new_demo.step1': '选择创建方式',
    'new_demo.step2': '填写信息',
    'new_demo.method.paste': '粘贴 HTML',
    'new_demo.method.paste.desc': '直接粘贴 HTML 代码',
    'new_demo.method.upload': '上传文件',
    'new_demo.method.upload.desc': '上传 HTML、CSS、JS 等文件',
    'new_demo.method.folder': '上传文件夹',
    'new_demo.method.folder.desc': '上传整个项目文件夹',
    'new_demo.method.blank': '空白 Demo',
    'new_demo.method.blank.desc': '从基础模板开始',
    'new_demo.preview': '预览',
    'new_demo.create': '创建 Demo',
    'new_demo.creating': '创建中...',
    'new_demo.success': 'Demo 创建成功',
    'new_demo.error': '创建失败: {msg}',
    'new_demo.back': '重新选择',
    'new_demo.title_label': '标题',
    'new_demo.title_placeholder': '输入 Demo 标题',
    'new_demo.notes_label': '备注',
    'new_demo.notes_placeholder': '添加备注（可选）',
    'new_demo.tags_label': '标签',
    'new_demo.project_label': '所属项目',
    'new_demo.no_project': '无项目（独立 Demo）',
    'new_demo.validation.title': '请输入标题',
    'new_demo.validation.files': '请先选择或输入文件内容',

    // Search
    'search.placeholder': '搜索 Demo、项目、标签...',
    'search.shortcut_hint': 'Esc 返回',
    'search.demos_section': 'Demo',
    'search.projects_section': '项目',
    'search.recent': '最近访问',
    'search.empty': '没有找到匹配的内容',
    'search.empty.hint': '试试搜索其他关键词',
    'search.result.demo': '跳转到 Demo',
    'search.result.project': '跳转到项目',

    // Settings
    'settings.title': '设置',
    'settings.tab.import_export': '导入/导出',
    'settings.tab.storage': '存储',
    'settings.tab.about': '关于',
    'settings.export.title': '导出数据',
    'settings.export.description': '将所有项目和 Demo 导出为文件',
    'settings.export.json': '导出为 JSON',
    'settings.export.zip': '导出为 ZIP',
    'settings.export.exporting': '导出中...',
    'settings.import.title': '导入数据',
    'settings.import.drop_zone': '拖放 JSON 或 ZIP 文件到此处，或 点击选择文件',
    'settings.import.formats': '支持 .json 和 .zip 格式',
    'settings.import.conflict.title': '数据冲突',
    'settings.import.conflict.message': '以下 {n} 条记录已存在，请选择处理方式：',
    'settings.import.conflict.choose': '选择导入策略',
    'settings.import.conflict.skip': '跳过已存在',
    'settings.import.conflict.overwrite': '覆盖',
    'settings.import.conflict.new': '全部导入为新记录',
    'settings.import.success': '导入完成，共导入 {n} 个 Demo',
    'settings.import.error': '导入失败: {msg}',
    'settings.storage.title': '存储用量',
    'settings.storage.used': '已用',
    'settings.storage.quota': '配额',
    'settings.storage.persistent': '已持久化',
    'settings.storage.not_persistent': '未持久化，建议定期导出备份',
    'settings.storage.request_persist': '请求持久化存储',
    'settings.about.version': '版本',
    'settings.about.description': '一个用于管理和预览静态 HTML Demo 的浏览器工具',
    'settings.about.tech_stack': '技术栈',
    'settings.language.title': '语言',
    'settings.language.zh': '中文',
    'settings.language.en': 'English',

    // Project extras
    'project.uncategorized': '未分组',
    'project.description': '项目描述',
    'project.description.placeholder': '添加项目描述...',
    'demo.view.preview': '预览',
    'demo.view.code': '代码',
    'demo.view.save': '保存',
    'demo.view.unsaved': '有未保存的更改',
    'demo.move_to': '移动到项目',
    'demo.rename': '重命名',

    // New Project Modal
    'project.new': '新建项目',
    'project.new.title_label': '项目名称',
    'project.new.title_placeholder': '输入项目名称',
    'project.new.create': '创建',
    'project.new.success': '项目已创建',
    'project.new.error': '创建失败',
    'project.new.validation.title': '请输入项目名称',

    // File switcher in preview
    'demo.file_tabs.default': '默认',
    'demo.file_tabs.open': '在预览中打开',
    'demo.file_tabs.all_files': '所有文件',

    // Tag Input
    'tag.placeholder': '添加标签...',

    // Modal
    'modal.confirm': '确认',
    'modal.cancel': '取消',
    'modal.close': '关闭',
    'modal.alert_confirm': '确定',

    // Toast
    'toast.persist_warning': '存储未持久化，浏览器可能在空间不足时清除数据，建议定期导出备份',

    // Common
    'common.loading': '加载中...',
    'common.empty': '暂无内容',
    'common.no_tags': '无标签',
    'common.unnamed': '未命名',
    'common.delete': '删除',
    'common.edit': '编辑',
    'common.save': '保存',
    'common.cancel': '取消',
    'common.confirm': '确认',
    'common.close': '关闭',
    'common.back': '返回',
    'common.create': '创建',
    'common.upload': '上传',
    'common.download': '下载',
    'common.refresh': '刷新',
    'common.search': '搜索',
    'common.settings': '设置',
    'common.error': '出错了',
    'common.success': '操作成功',
    'common.unknown_error': '未知错误',

    // Language toggle (shown in header)
    'lang.current': 'EN',
    'lang.zh': '中文',
    'lang.en': 'English',
    'lang.toggle': '切换语言',
  },

  en: {
    // App
    'app.name': 'Glint',
    'app.tagline': 'Flash of creative inspiration',

    // Header
    'header.search.placeholder': 'Search demos and projects...',
    'header.search.shortcut': '/',
    'header.theme.system': 'System',
    'header.theme.light': 'Light',
    'header.theme.dark': 'Dark',
    'header.settings': 'Settings',
    'header.sidebar.toggle': 'Toggle sidebar',

    // Sidebar
    'sidebar.new_demo': 'New Demo',
    'sidebar.home': 'Home',
    'sidebar.all_demos': 'All Demos',
    'sidebar.projects': 'Projects',
    'sidebar.new_project': 'New Project',
    'sidebar.standalone_demos': 'Standalone Demos',
    'sidebar.no_projects': 'No projects yet',
    'sidebar.storage': 'Storage',
    'sidebar.loading': 'Loading...',
    'sidebar.no_demos': 'No demos yet',

    // Home View
    'home.title': 'Hello, Glint',
    'home.subtitle': 'Manage your static HTML demo snippets',
    'home.new_demo': 'New Demo',
    'home.recent_demos': 'Recent Demos',
    'home.recent_projects': 'Recent Projects',
    'home.empty.title': 'No demos yet',
    'home.empty.description': 'Upload or create your first static HTML demo',
    'home.empty.cta': 'Create your first demo',
    'home.demos_count': '{n} demo(s)',

    // All Demos View
    'demos.title': 'All Demos',
    'demos.count': '{n} demo(s)',
    'demos.filter.search': 'Search...',
    'demos.filter.tag_all': 'All Tags',
    'demos.filter.sort': 'Sort',
    'demos.filter.sort.updated': 'Recently Updated',
    'demos.filter.sort.created': 'Recently Created',
    'demos.filter.sort.name': 'Name',
    'demos.filter.group': 'Group by Project',
    'demos.empty.no_demos': 'No demos yet',
    'demos.empty.no_match': 'No matching demos',
    'demos.empty.clear_filter': 'Clear filters',
    'demos.standalone': 'Standalone Demos',
    'demos.all_new_demo': 'New Demo',

    // Demo Card
    'demo.edit': 'Edit',
    'demo.clone': 'Clone',
    'demo.delete': 'Delete',
    'demo.updated': 'Updated {time}',
    'demo.no_project': 'No project',

    // Project View
    'project.new_demo': 'New Demo',
    'project.edit_title': 'Click to edit title',
    'project.no_demos': 'No demos in this project yet',
    'project.export': 'Export Project',
    'project.delete': 'Delete Project',
    'project.delete.confirm.title': 'Delete Project',
    'project.delete.confirm.message':
      'Deleting this project will not delete its demos. Demos will become standalone.',
    'project.add_tag': 'Add tag',
    'project.notes.placeholder': 'Add project notes...',
    'project.demos_count': '{n} demo(s)',
    'project.created': 'Created',
    'project.updated': 'Updated',
    'project.color': 'Color',
    'project.loading': 'Loading...',

    // Demo View
    'demo.preview.title': 'Preview',
    'demo.edit_btn': 'Edit',
    'demo.delete_btn': 'Delete',
    'demo.delete.confirm.title': 'Delete Demo',
    'demo.delete.confirm.message': 'This action cannot be undone. Are you sure?',
    'demo.files': 'Files',
    'demo.files_count': '{n} file(s)',
    'demo.assets_count': '{n} asset(s)',
    'demo.assets': 'Assets',
    'demo.created': 'Created',
    'demo.updated': 'Updated',
    'demo.loading': 'Loading...',
    'demo.load_error': 'Failed to load demo',
    'demo.not_found': 'Demo not found',

    // Preview Panel
    'preview.mobile': 'Mobile',
    'preview.tablet': 'Tablet',
    'preview.laptop': 'Laptop',
    'preview.desktop': 'Desktop',
    'preview.refresh': 'Refresh preview',
    'preview.fullscreen': 'Fullscreen',

    // Demo Editor
    'editor.tab.files': 'Files',
    'editor.tab.metadata': 'Metadata',
    'editor.save': 'Save',
    'editor.cancel': 'Cancel',
    'editor.back': 'Back to preview',
    'editor.upload': 'Upload files',
    'editor.upload_folder': 'Upload folder',
    'editor.drop_zone': 'Drop files here, or click to upload',
    'editor.entry_file': 'Default file',
    'editor.set_entry': 'Set as default',
    'editor.file.edit': 'Edit',
    'editor.file.delete': 'Delete',
    'editor.total_size': 'Total size',
    'editor.title': 'Title',
    'editor.title.placeholder': 'Enter demo title',
    'editor.notes': 'Notes',
    'editor.notes.placeholder': 'Add notes...',
    'editor.tags': 'Tags',
    'editor.project': 'Project',
    'editor.no_project': 'No project (standalone)',
    'editor.entry_file_label': 'Default file',
    'editor.created': 'Created',
    'editor.updated': 'Updated',
    'editor.save.success': 'Saved',
    'editor.save.error': 'Failed to save',
    'editor.validation.title': 'Please enter a title',
    'editor.code.placeholder': 'Enter HTML code here...',
    'editor.assets_section': 'Image assets',
    'editor.no_files': 'No files yet, please upload',

    // New Demo
    'new_demo.title': 'New Demo',
    'new_demo.step1': 'Choose creation method',
    'new_demo.step2': 'Fill in details',
    'new_demo.method.paste': 'Paste HTML',
    'new_demo.method.paste.desc': 'Paste HTML code directly',
    'new_demo.method.upload': 'Upload files',
    'new_demo.method.upload.desc': 'Upload HTML, CSS, JS files',
    'new_demo.method.folder': 'Upload folder',
    'new_demo.method.folder.desc': 'Upload an entire project folder',
    'new_demo.method.blank': 'Blank demo',
    'new_demo.method.blank.desc': 'Start from a basic template',
    'new_demo.preview': 'Preview',
    'new_demo.create': 'Create Demo',
    'new_demo.creating': 'Creating...',
    'new_demo.success': 'Demo created successfully',
    'new_demo.error': 'Failed to create: {msg}',
    'new_demo.back': 'Back',
    'new_demo.title_label': 'Title',
    'new_demo.title_placeholder': 'Enter demo title',
    'new_demo.notes_label': 'Notes',
    'new_demo.notes_placeholder': 'Add notes (optional)',
    'new_demo.tags_label': 'Tags',
    'new_demo.project_label': 'Project',
    'new_demo.no_project': 'No project (standalone)',
    'new_demo.validation.title': 'Please enter a title',
    'new_demo.validation.files': 'Please select or enter file content first',

    // Search
    'search.placeholder': 'Search demos, projects, tags...',
    'search.shortcut_hint': 'Esc to go back',
    'search.demos_section': 'Demos',
    'search.projects_section': 'Projects',
    'search.recent': 'Recent',
    'search.empty': 'No results found',
    'search.empty.hint': 'Try a different search term',
    'search.result.demo': 'Go to demo',
    'search.result.project': 'Go to project',

    // Settings
    'settings.title': 'Settings',
    'settings.tab.import_export': 'Import / Export',
    'settings.tab.storage': 'Storage',
    'settings.tab.about': 'About',
    'settings.export.title': 'Export Data',
    'settings.export.description': 'Export all projects and demos to a file',
    'settings.export.json': 'Export as JSON',
    'settings.export.zip': 'Export as ZIP',
    'settings.export.exporting': 'Exporting...',
    'settings.import.title': 'Import Data',
    'settings.import.drop_zone': 'Drop a JSON or ZIP file here, or click to select',
    'settings.import.formats': 'Supports .json and .zip formats',
    'settings.import.conflict.title': 'Data Conflict',
    'settings.import.conflict.message': 'The following {n} record(s) already exist:',
    'settings.import.conflict.choose': 'Choose import strategy',
    'settings.import.conflict.skip': 'Skip existing',
    'settings.import.conflict.overwrite': 'Overwrite',
    'settings.import.conflict.new': 'Import all as new records',
    'settings.import.success': 'Import complete. {n} demo(s) imported.',
    'settings.import.error': 'Import failed: {msg}',
    'settings.storage.title': 'Storage Usage',
    'settings.storage.used': 'Used',
    'settings.storage.quota': 'Quota',
    'settings.storage.persistent': 'Storage is persistent',
    'settings.storage.not_persistent':
      'Storage is not persistent. Consider exporting backups regularly.',
    'settings.storage.request_persist': 'Request Persistent Storage',
    'settings.about.version': 'Version',
    'settings.about.description':
      'A browser-based tool for managing and previewing static HTML demos',
    'settings.about.tech_stack': 'Tech Stack',
    'settings.language.title': 'Language',
    'settings.language.zh': '中文',
    'settings.language.en': 'English',

    // Project extras
    'project.uncategorized': 'Uncategorized',
    'project.description': 'Description',
    'project.description.placeholder': 'Add a project description...',
    'demo.view.preview': 'Preview',
    'demo.view.code': 'Code',
    'demo.view.save': 'Save',
    'demo.view.unsaved': 'Unsaved changes',
    'demo.move_to': 'Move to project',
    'demo.rename': 'Rename',

    // New Project Modal
    'project.new': 'New Project',
    'project.new.title_label': 'Project name',
    'project.new.title_placeholder': 'Enter project name',
    'project.new.create': 'Create',
    'project.new.success': 'Project created',
    'project.new.error': 'Failed to create project',
    'project.new.validation.title': 'Please enter a project name',

    // File switcher in preview
    'demo.file_tabs.default': 'Default',
    'demo.file_tabs.open': 'Open in preview',
    'demo.file_tabs.all_files': 'All files',

    // Tag Input
    'tag.placeholder': 'Add tags...',

    // Modal
    'modal.confirm': 'Confirm',
    'modal.cancel': 'Cancel',
    'modal.close': 'Close',
    'modal.alert_confirm': 'OK',

    // Toast
    'toast.persist_warning':
      'Storage is not persistent. Browser may clear data under storage pressure. Consider exporting backups.',

    // Common
    'common.loading': 'Loading...',
    'common.empty': 'Nothing here',
    'common.no_tags': 'No tags',
    'common.unnamed': 'Untitled',
    'common.delete': 'Delete',
    'common.edit': 'Edit',
    'common.save': 'Save',
    'common.cancel': 'Cancel',
    'common.confirm': 'Confirm',
    'common.close': 'Close',
    'common.back': 'Back',
    'common.create': 'Create',
    'common.upload': 'Upload',
    'common.download': 'Download',
    'common.refresh': 'Refresh',
    'common.search': 'Search',
    'common.settings': 'Settings',
    'common.error': 'Error',
    'common.success': 'Success',
    'common.unknown_error': 'Unknown error',

    // Language toggle (shown in header)
    'lang.current': '中文',
    'lang.zh': '中文',
    'lang.en': 'English',
    'lang.toggle': 'Switch language',
  },
};

let currentLocale = detectLocale();

/**
 * Translate a key with optional variable interpolation.
 * e.g. t('home.demos_count', { n: 5 }) → "5 个 Demo"
 */
export function t(key, vars = {}) {
  let str = translations[currentLocale]?.[key] ?? translations.zh[key] ?? key;
  for (const [k, v] of Object.entries(vars)) {
    str = str.replaceAll(`{${k}}`, String(v));
  }
  return str;
}

export function getLocale() {
  return currentLocale;
}

export function setLocale(locale) {
  if (locale !== 'zh' && locale !== 'en') return;
  if (locale === currentLocale) return;
  currentLocale = locale;
  localStorage.setItem(LOCALE_KEY, locale);
  window.dispatchEvent(new CustomEvent('locale-change', { detail: { locale } }));
}

export function getSupportedLocales() {
  return [
    { code: 'zh', label: '中文' },
    { code: 'en', label: 'English' },
  ];
}
