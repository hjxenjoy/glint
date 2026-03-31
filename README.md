# Glint ✦

> 一个个闪光的创意片段 — 静态 HTML Demo 管理与预览工具

Glint 是一个纯浏览器应用，用于管理、预览和编辑 AI 生成的静态 HTML Demo。无需服务器，无需安装，打开即用。

![Glint Screenshot](https://via.placeholder.com/1200x630/6366f1/ffffff?text=Glint+%E2%9C%A6)

## 功能特性

- **Demo 管理** — 上传或直接编写 HTML/CSS/JS Demo，支持项目分组归类
- **实时预览** — 通过 iframe 沙箱安全预览 Demo，内置手机/平板/笔记本/台式机四种视口预设
- **可调整预览尺寸** — 拖拽调整 iframe 大小，精确模拟不同分辨率
- **代码编辑** — 内置文件管理器，可直接编辑 HTML、CSS、JS 文件
- **图片资源支持** — 上传图片自动转为 base64，完整保存在浏览器本地
- **项目组织** — 通过项目对 Demo 分组，支持标签、备注、创建/更新时间
- **全局搜索** — 跨项目、跨 Demo 搜索标题、备注、标签
- **导入/导出** — 支持 JSON 和 ZIP 两种格式备份与迁移数据
- **存储用量监控** — 实时显示 IndexedDB 占用空间
- **离线访问** — Service Worker 缓存，断网后仍可正常使用
- **明暗模式** — 支持跟随系统或手动切换亮色/暗色主题
- **响应式布局** — 适配桌面、平板、移动设备

## 快速开始

无需安装任何依赖，克隆后用任意静态文件服务器启动即可：

```bash
git clone git@github.com:hjxenjoy/glint.git
cd glint

# 任选其一：
python3 -m http.server 8080
npx serve .
# 或直接用 VS Code Live Server 插件
```

访问 `http://localhost:8080`

> **注意：** Service Worker 要求运行在 `localhost` 或 HTTPS 环境下。

## 技术栈

| 技术 | 说明 |
|---|---|
| 原生 ES2022+ 模块 | 无构建工具，浏览器直接运行 |
| IndexedDB | 所有数据（含 base64 图片）本地持久化 |
| Service Worker | 离线缓存，PWA 支持 |
| Tailwind CSS v4 | 本地编译，输出 `styles/tailwind.css` |
| CSS Cascade Layers | 样式层级管理 |
| Web Crypto API | `crypto.randomUUID()` 生成唯一 ID |
| fflate | ZIP 导入/导出（按需动态加载） |

## 项目结构

```
glint/
├── index.html              # 应用入口（含 import map、FOUC 防闪）
├── manifest.json           # PWA Manifest
├── sw.js                   # Service Worker
├── styles/
│   ├── tailwind-input.css  # Tailwind 编译入口
│   ├── tailwind.css        # 编译输出（受 git 版本控制）
│   ├── theme.css           # 明暗主题 CSS 变量
│   ├── layout.css          # 应用布局
│   └── components.css      # 组件样式
├── db/                     # IndexedDB 数据层
│   ├── connection.js       # 数据库连接单例
│   ├── projects.js         # 项目 CRUD
│   ├── demos.js            # Demo CRUD
│   ├── assets.js           # 图片资源 CRUD
│   ├── settings.js         # 设置读写
│   └── search.js           # 全文搜索
├── store/
│   └── app-state.js        # 响应式状态管理 + hash 路由
├── utils/                  # 工具函数
├── components/             # UI 组件（15 个）
└── icons/
    └── sprite.svg          # SVG 图标精灵（42 个图标）
```

## 开发

修改 Tailwind 类名后需重新编译 CSS：

```bash
# 安装开发依赖
npm install

# 一次性编译
npm run build:css

# 开发时监听变化
npm run watch:css

# 格式化代码
npm run format
```

### Git 提交规范

每次提交前 pre-commit hook 会自动运行 prettier 格式化。手动格式化：

```bash
npm run format
```

## 数据存储

所有数据保存在浏览器 IndexedDB（数据库名：`glint-db`）：

| Store | 内容 |
|---|---|
| `projects` | 项目元数据（标题、备注、标签、颜色） |
| `demos` | Demo 元数据 + 文本文件内容（HTML/CSS/JS） |
| `assets` | 图片等二进制资源（base64 data URI） |
| `settings` | 主题等用户偏好 |

> 图片资源与 Demo 文本文件分开存储，列表加载时不读取 base64 数据，保证性能。

## 浏览器支持

仅支持现代浏览器（Chrome 105+、Edge 105+、Firefox 110+、Safari 16+），不考虑兼容性。

## License

MIT
