# Glint ✦

> 一个个闪光的创意片段 — 纯浏览器 HTML Demo 管理工具

**[在线体验 →](https://glint.enjoy666.online)** · [English](README.md)

Glint 是一个零服务端、零安装的 Web 应用，用于管理、预览和编辑 AI 生成的静态 HTML Demo。所有数据保存在浏览器本地 IndexedDB，无需账号、无需网络、无数据锁定。

## 功能特性

### Demo 管理
- **快速粘贴** — 粘贴 HTML 代码一键创建，自动提取 `<title>` 作为 Demo 名称
- **拖拽创建** — 将一个或多个 `.html` 文件拖拽到首页批量创建（每个 HTML 各建一个 Demo）；拖拽混合文件（html + css + 图片）自动打包为多文件 Demo；多个 HTML 同时上传时 CSS 共享到项目
- **文件上传** — 支持单文件和文件夹上传，自动识别入口 HTML
- **多选操作** — 在项目页选中多个 Demo，批量删除或批量移动到其他项目
- **克隆** — 一键深度复制任意 Demo（含所有图片资源）
- **导出独立文件** — 将 Demo 下载为单个 HTML 文件（所有资源内联，可直接分享）
- **删除**

### 预览与编辑（4 标签页合一）
- **预览标签** — 沙箱 `srcdoc` iframe（null origin，Demo 代码无法访问父页面数据）
- **设备预设** — 手机（375×667）/ 平板（768×1024）/ 笔记本（1280×800）/ 桌面（1920×1080）
- **可调整大小** — 拖拽右边缘、下边缘或右下角手柄自由调整预览尺寸
- **代码标签** — 带行号的全文件编辑器，支持 Tab 键缩进（2 空格）
- **文件标签** — 内联上传/删除文本文件和图片资源
- **信息标签** — 编辑备注、切换所属项目

### 项目与组织
- 创建、重命名、删除项目；删除时可选是否同时清除其下所有 Demo
- 点击即可编辑项目描述（自动保存）
- Demo 可归属某个项目，或保持独立状态（"未分组"）
- **项目一键导出** — 将整个项目及其所有 Demo 打包为 ZIP
- 侧边栏项目树支持折叠/展开，可手动拖拽排序

### 搜索与导航
- **全局搜索** — 任意位置按 `/` 唤起，搜索所有 Demo 的标题和备注
- **全部 Demo 视图** — 关键词过滤、排序（更新/创建/名称）、按项目分组切换
- 首页集成快速粘贴、拖拽创建和完整的最近 Demo 网格

### 导入 / 导出
- 全量导出为 **JSON**（可读格式）或 **ZIP**（保留原始文件）
- 导入 JSON 或 ZIP，冲突时显示具体冲突项名称
- 冲突处理：**跳过** / **覆盖** / **全部作为新记录**
- 支持仅导出指定项目的 ZIP

### 系统体验
- **主题** — 亮色 / 暗色 / 跟随系统（内置防 FOUC 处理）
- **多语言** — 中文 / 英文，实时切换无需刷新
- **PWA** — Service Worker 缓存全部静态资源，完全离线可用
- 存储用量实时显示，首次启动自动申请持久化存储
- 纯浏览器技术栈：零服务端，运行时无需构建

## 在线体验

**[https://glint.enjoy666.online](https://glint.enjoy666.online)**

## 快速开始

无需安装任何依赖，用任意静态文件服务器启动即可：

```bash
git clone git@github.com:hjxenjoy/glint.git
cd glint

python3 -m http.server 8080
# 或：npx serve .
# 或：VS Code Live Server 插件
```

访问 `http://localhost:8080`。

> **注意：** Service Worker 要求运行在 `localhost` 或 HTTPS 环境下。

## 技术栈

| 技术 | 说明 |
|---|---|
| 原生 JS（ES2022+ 模块） | 无构建工具，浏览器直接运行 |
| IndexedDB | 所有数据（含 base64 图片）本地持久化 |
| Service Worker | 离线缓存，PWA 支持 |
| Tailwind CSS v4 | 本地编译，输出 `styles/tailwind.css` |
| CSS Cascade Layers | 样式层级管理 |
| Web Crypto API | `crypto.randomUUID()` 生成唯一 ID |
| fflate | ZIP 导入/导出（按需动态加载） |
| Phosphor Icons | 内联 SVG 图标集，通过 `utils/icons.js` 使用 |

## 项目结构

```
glint/
├── index.html              # 应用入口（import map、FOUC 防闪、SW 注册）
├── manifest.json           # PWA Manifest
├── sw.js                   # Service Worker（缓存优先 + stale-while-revalidate）
├── styles/
│   ├── tailwind-input.css  # Tailwind 编译入口
│   ├── tailwind.css        # 编译输出（受 git 版本控制）
│   ├── theme.css           # 明暗主题 CSS 变量
│   ├── layout.css          # 应用级布局
│   └── components.css      # 组件样式
├── db/                     # IndexedDB 数据层
│   ├── connection.js       # 数据库连接单例 + upgrade 逻辑
│   ├── projects.js         # 项目 CRUD
│   ├── demos.js            # Demo CRUD + 克隆
│   ├── assets.js           # 图片资源 CRUD + 克隆
│   ├── settings.js         # 设置读写
│   └── search.js           # 内存全文搜索
├── store/
│   └── app-state.js        # 响应式状态管理 + hash 路由
├── utils/
│   ├── icons.js            # 内联 SVG 图标工具
│   ├── i18n.js             # 中英双语翻译字典
│   ├── file-resolver.js    # 文件集处理 + srcdoc 构建
│   ├── zip.js              # fflate 封装（打包/解包）
│   ├── base64.js           # File→base64、尺寸计算
│   ├── date.js             # 相对/完整日期格式化
│   └── storage-estimate.js # navigator.storage 封装
├── components/             # 16 个 UI 组件
│   ├── app.js              # 根组件：布局、路由、视图挂载
│   ├── sidebar.js          # 项目树 + Demo 列表 + 存储用量条
│   ├── header.js           # 顶部栏：搜索、主题切换、设置
│   ├── home-view.js        # 首页：快速粘贴、拖拽创建、最近 Demo
│   ├── demo-view.js        # 4 标签视图：预览/代码/文件/信息
│   ├── project-view.js     # 项目页：Demo 网格 + 项目元数据
│   ├── demo-editor.js      # 新建 Demo 向导（粘贴/上传）
│   ├── preview-panel.js    # 沙箱 iframe + 拖拽调整 + 视口预设
│   ├── search-overlay.js   # 全屏搜索结果
│   ├── import-export.js    # 设置标签：导入导出/存储/关于
│   ├── modal.js            # 通用 <dialog> 模态框
│   └── toast.js            # Toast 消息提示栈
└── icons/
    ├── icon-192.png        # PWA 图标
    ├── icon-512.png        # PWA 图标（maskable）
    └── apple-touch-icon.png
```

## 开发

修改 Tailwind 类名后需重新编译 CSS：

```bash
npm install          # 安装开发依赖（tailwindcss + prettier）
npm run build:css    # 一次性编译
npm run watch:css    # 开发时监听变化
npm run format       # 运行 prettier
```

每次提交前 pre-commit hook 会自动运行 prettier 格式化。

## 数据模型

所有数据存储在浏览器 **IndexedDB**（`glint-db`）。图片资源与 Demo 文本文件分开存储，列表加载时不读取 base64 数据，保证性能。

| Store | 内容 |
|---|---|
| `projects` | 标题、备注、时间戳 |
| `demos` | 标题、备注、入口文件名、`files[]`（文本内容） |
| `assets` | `demoId`、文件名、MIME 类型、base64 data URI、文件大小 |
| `settings` | 主题偏好、侧边栏状态等 |

## 浏览器支持

仅支持现代浏览器：Chrome 105+、Edge 105+、Firefox 110+、Safari 16+。

## License

MIT
