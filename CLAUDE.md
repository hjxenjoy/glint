# Glint

> 一个个闪光的创意片段 — 静态 HTML Demo 管理与预览工具

纯浏览器应用，零服务端依赖，用于管理、预览、编辑 AI 生成的静态 HTML Demo。

---

## 项目概览

| 属性 | 值 |
|---|---|
| 项目名 | glint |
| 技术栈 | 原生 ES2022+ 模块、Tailwind Play CDN、IndexedDB、Service Worker |
| 构建工具 | 无（直接运行，无需编译） |
| 运行方式 | 任意静态文件服务器（`python3 -m http.server` 或 `npx serve`） |
| PWA | 支持，Service Worker 离线缓存 |

---

## 目录结构

```
glint/
├── index.html                  # 应用外壳：import map、内联主题脚本、SW 注册、Tailwind CDN
├── manifest.json               # PWA Manifest（display: standalone）
├── sw.js                       # Service Worker（根目录，不使用 ES 模块导入）
│
├── styles/
│   ├── layers.css              # @layer 声明顺序：reset, base, components, utilities
│   ├── theme.css               # CSS 自定义属性（light/dark），绑定到 [data-theme] 属性
│   ├── layout.css              # 应用级布局：侧边栏 + 主区分栏，响应式断点
│   └── components.css          # 组件样式：预览面板、卡片、对话框等
│
├── db/
│   ├── schema.js               # 常量：DB_NAME、DB_VERSION、store/index 名称
│   ├── connection.js           # IDB 单例：open/upgrade，返回 Promise<IDBDatabase>
│   ├── projects.js             # projects 增删改查
│   ├── demos.js                # demos 增删改查，含 getByProject
│   ├── assets.js               # assets 增删改查，含 getByDemo、deleteByDemo
│   ├── settings.js             # key-value 设置读写
│   └── search.js               # 内存全文搜索：加载全部 demos+projects 后客户端过滤
│
├── store/
│   └── app-state.js            # EventTarget 子类；当前视图、选中 demo/project、主题等
│
├── utils/
│   ├── id.js                   # crypto.randomUUID() 封装
│   ├── base64.js               # File→base64DataURI、base64→Blob、尺寸计算
│   ├── storage-estimate.js     # navigator.storage.estimate() + persist() 封装
│   ├── date.js                 # formatRelative（"3天前"）、formatFull（完整时间戳）
│   ├── zip.js                  # fflate 封装：packExport→Uint8Array、unpackImport→data
│   └── file-resolver.js        # 上传文件集处理：识别入口 HTML、内联图片为 base64
│
├── components/
│   ├── app.js                  # 根组件：挂载所有子组件，监听 app-state，处理路由
│   ├── sidebar.js              # 项目树 + 独立 Demo 列表 + 搜索栏 + 存储用量条
│   ├── header.js               # 顶部栏：标题、主题切换、设置按钮
│   ├── home-view.js            # 仪表盘：最近 Demo 网格、存储概览、快捷新建
│   ├── project-view.js         # 项目页：Demo 网格 + 项目元数据 + 编辑控件
│   ├── demo-view.js            # 双面板：预览（左）+ 元数据（右）
│   ├── demo-editor.js          # 文件管理标签（上传/编辑/删除）+ 元数据表单标签
│   ├── preview-panel.js        # iframe + 拖拽调整大小 + 视口预设按钮 + 缩放逻辑
│   ├── search-overlay.js       # 全屏搜索结果覆盖层，支持键盘导航
│   ├── import-export.js        # 设置标签内容：导出格式选择、导入拖放区、进度显示
│   ├── storage-indicator.js    # 存储用量进度条 + 配额数值 + persist() 提示
│   ├── theme-toggle.js         # 三态切换按钮（系统/亮/暗）
│   ├── tag-input.js            # 标签输入组件（芯片样式）
│   ├── modal.js                # 基于 <dialog> 元素的通用模态框
│   └── toast.js                # 消息提示栈（success / error / info）
│
└── icons/
    └── sprite.svg              # SVG 图标精灵（所有图标统一在此文件）
```

---

## IndexedDB 数据库设计

**数据库名：** `glint-db`　**版本：** `1`

### Object Store: `projects`
- **Key path:** `id`（`crypto.randomUUID()`）
- **字段：** `id`、`title`、`notes`、`tags`（`string[]`）、`color`（可选，十六进制强调色）、`createdAt`（ms 时间戳）、`updatedAt`
- **索引：**
  - `by_updated` on `updatedAt`（排序最近修改）
  - `by_tag` on `tags`（`multiEntry: true`，支持按标签查询）

### Object Store: `demos`
- **Key path:** `id`
- **字段：** `id`、`projectId`（`string | null`，null 表示独立 Demo）、`title`、`notes`、`tags`（`string[]`）、`createdAt`、`updatedAt`、`entryFile`（通常为 `"index.html"`）、`files`（`Array<{name, content, mimeType}>`，仅文本文件）
- **索引：**
  - `by_project` on `projectId`（主要导航查询）
  - `by_updated` on `updatedAt`
  - `by_tag` on `tags`（`multiEntry: true`）

### Object Store: `assets`
- **Key path:** `id`
- **字段：** `id`、`demoId`、`filename`、`mimeType`、`data`（base64 data URI）、`size`（原始字节数）
- **索引：**
  - `by_demo` on `demoId`（加载指定 Demo 的所有资源）

> **关键设计决策：** 图片等二进制资源存储在独立的 `assets` store，而非嵌入 `demos` store。
> 这样列表视图加载所有 Demo 时不会读取 base64 图片数据，大幅提升性能。
> 图片仅在打开 Demo 预览时才加载并内联到 srcdoc 字符串中。

### Object Store: `settings`
- **Key path:** `key`
- **记录：** `{key: 'theme', value: 'system'|'light'|'dark'}`、`{key: 'sidebarOpen', value: boolean}` 等
- 无需索引，始终通过 key 直接访问

---

## 路由与视图

基于 `location.hash` 的客户端路由，无需服务端配置。

| 视图 | Hash 路由 | 说明 |
|---|---|---|
| 首页/仪表盘 | `#/` | 最近 Demo 网格、存储概览、新建 CTA |
| 全部 Demo | `#/demos` | 完整网格 + 过滤栏（标签、排序） |
| 项目详情 | `#/projects/:id` | 项目头部 + 该项目下 Demo 网格 |
| Demo 预览 | `#/demos/:id` | 双面板：可调整大小的 iframe 预览 + 元数据侧边栏 |
| Demo 编辑 | `#/demos/:id/edit` | 标签页：文件管理 + 元数据（标题/备注/标签） |
| 新建 Demo | `#/demos/new?projectId=...` | 向导：粘贴 HTML 或上传文件 |
| 搜索 | `#/search?q=...` | 全屏搜索结果覆盖层 |
| 设置 | `#/settings` | 标签页：外观、导入/导出、存储、关于 |

**持久化布局元素（始终渲染，不随路由重新挂载）：**
- 可折叠侧边栏（项目树）
- 顶部导航栏（搜索触发、主题切换、设置图标）
- Toast 消息提示栈
- 模态框覆盖层（确认对话框、标签编辑）

---

## iframe 预览沙箱

**方案：使用 `srcdoc` 属性，不使用 Blob URL。**

```html
<iframe
  sandbox="allow-scripts allow-forms allow-modals allow-popups allow-pointer-lock"
  srcdoc="...html content..."
></iframe>
```

> **安全边界：** 刻意省略 `allow-same-origin`。没有此属性，iframe 在 null origin 下运行，
> 无法访问父页面的 IndexedDB、localStorage、Cookie 或 DOM，不论 Demo 代码写了什么。

**渲染流程：**
1. 从 IDB 加载 Demo 记录及其所有 assets
2. 将 HTML/CSS 中对图片文件的引用（`src="photo.png"`、`url('photo.png')`）替换为完整 base64 data URI
3. 将处理后的 HTML 字符串赋值给 `iframe.srcdoc`

**视口缩放（大分辨率预设）：**
- iframe 的 CSS `width`/`height` 设为逻辑分辨率（如 `1920px`），以使 Demo 内的媒体查询正确触发
- 通过 `transform: scale(factor)` + `transform-origin: top left` 将 iframe 缩放适配面板
- 容器尺寸设为 `logicalWidth * scale` 防止布局溢出

**拖拽调整大小：**
- 三个拖拽手柄：右边缘、底边缘、右下角
- `pointerdown` 时调用 `handle.setPointerCapture(event.pointerId)` — 确保 iframe 上方的 pointermove 事件正确路由
- 同时为 iframe 添加 `is-dragging` class，设置 `pointer-events: none` 双重保障
- 手动调整后清除激活的预设按钮状态

**内置视口预设：**

| 名称 | 分辨率 |
|---|---|
| 手机 | 375 × 667 |
| 平板 | 768 × 1024 |
| 笔记本 | 1280 × 800 |
| 台式机 | 1920 × 1080 |

---

## Service Worker 缓存策略

`sw.js` 在根目录，不使用 ES 模块导入（SW 限制）。

**缓存名称：** `glint-shell-v1`、`glint-cdn-v1`
（每次应用文件变更时需更新 `sw.js` 顶部的 `CACHE_VERSION` 常量）

| 策略 | 适用范围 |
|---|---|
| **Cache First（缓存优先）** | 同源静态资源（所有 JS/CSS/HTML/SVG） |
| **Stale While Revalidate** | CDN 资源（Tailwind CDN、fflate jsDelivr）|
| **Network Only（透传）** | 其他所有请求 |

**Install 事件：** 预缓存所有应用外壳文件
**Activate 事件：** 删除旧版本缓存（`glint-` 前缀但版本不匹配），调用 `clients.claim()`

> IDB 数据不经过 SW，SW 只缓存静态资源。

---

## 导入/导出格式

### 单 JSON 导出（简单，人可读）

```json
{
  "version": "1",
  "exportedAt": 1710000000000,
  "projects": [{ "id": "...", "title": "...", "...": "..." }],
  "demos": [
    {
      "id": "...", "title": "...", "projectId": "...",
      "files": [{ "name": "index.html", "content": "...", "mimeType": "text/html" }],
      "assets": [{ "filename": "photo.png", "mimeType": "image/png", "data": "data:image/png;base64,..." }]
    }
  ]
}
```

### ZIP 导出（解包文件，适合多 Demo）

使用 `fflate`（jsDelivr ESM 构建，动态导入，仅在触发导入导出时加载）：

```
glint-export-{date}.zip
├── manifest.json
├── projects/{projectId}.json
└── demos/{demoId}/
    ├── meta.json
    ├── index.html
    ├── style.css
    └── assets/photo.png
```

**导入冲突处理：** 检测 ID 冲突后展示选项：跳过 / 覆盖 / 作为新记录（生成新 ID）。在写入 IDB 前展示给用户确认。

---

## 搜索

IDB 不支持全文搜索。实现方案：查询时调用 `db.demos.getAll()` 加载所有 Demo 元数据（不含 assets），在内存中过滤：

```js
title.includes(query) || notes.includes(query) || tags.some(t => t.includes(query))
```

> **性能限制：** 适用于 ~1000 条以内的 Demo。超出此规模需要引入搜索令牌索引。

---

## 主题系统

**FOUC 防止：** 在 `<head>` 内、样式表加载之前，放置同步内联 `<script>`，从 `localStorage` 读取主题偏好并立即设置 `document.documentElement.dataset.theme`。

```html
<script>
  const t = localStorage.getItem('glint-theme') || 'system';
  if (t === 'dark' || (t === 'system' && matchMedia('(prefers-color-scheme: dark)').matches)) {
    document.documentElement.dataset.theme = 'dark';
  }
</script>
```

**主题存储：** 完整设置保存在 IDB `settings` store，同时同步到 `localStorage` 以支持上述 FOUC 防止逻辑。

---

## 技术注意事项

### IDB 事务与 async/await
IDB 事务在没有待处理请求时自动提交。在事务回调中 `await` 非 IDB Promise（如 `fetch()`）会导致事务提前关闭。所有 IDB 操作必须在事务作用域内同步发起，再统一 await 结果。

### 上传文件夹入口文件检测（`webkitdirectory`）
优先级：① 查找 `index.html`；② 若只有一个 `.html` 文件则使用该文件；③ 多个 `.html` 文件则弹出选择 UI。存储时去除顶层文件夹前缀。

### 存储配额与持久化
首次启动时调用 `navigator.storage.persist()`。若返回 `false`，展示持久性警告提示用户定期导出备份。每次保存后重新调用 `navigator.storage.estimate()` 更新用量显示。

### Tailwind CDN 与 CSS Cascade Layers
在 `styles/layers.css` 最顶部声明所有层级顺序：
```css
@layer reset, base, components, utilities;
```
在 `@layer utilities {}` 块中覆盖 Tailwind 样式，避免特异性冲突。`styles/layers.css` 必须作为第一个样式表加载。

### fflate 动态导入
```js
// utils/zip.js — 仅在需要时加载
const { zip, unzip } = await import('https://cdn.jsdelivr.net/npm/fflate@0.8.2/esm/browser.js');
```
约 30KB，按需加载，主应用包不受影响。CDN URL 由 SW 缓存入 `glint-cdn-v1`。

---

## 本地开发

```bash
# 任意静态文件服务器均可（Service Worker 要求 localhost 或 HTTPS）
python3 -m http.server 8080
# 或
npx serve .
```

访问 `http://localhost:8080` 即可。无需安装依赖，无需构建步骤。

---

## 关键文件

| 文件 | 重要性 |
|---|---|
| `index.html` | 应用入口：import map、内联主题脚本、SW 注册、Tailwind CDN 脚本标签、根挂载点 |
| `db/connection.js` | IDB 单例和 schema upgrade 逻辑；全部其他模块依赖此文件 |
| `components/preview-panel.js` | 最复杂的组件：srcdoc 渲染、缩放变换、拖拽调整大小 |
| `store/app-state.js` | 响应式状态中枢，连接所有组件（无框架） |
| `sw.js` | Service Worker，版本化预缓存；必须在根目录，版本常量需手动更新 |
