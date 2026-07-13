# NextFile Web

NextFile 的前端单页应用，基于 **Vue 3 + Vite + Pinia + Tabler**，提供文件管理、智能体对话与管理后台。

GitHub：[filenext/frontend](https://github.com/filenext/frontend)

---

## 技术栈

| 类别 | 技术 |
|------|------|
| 框架 | Vue 3.5（Composition API + `<script setup>`） |
| 构建 | Vite 6 |
| 状态 | Pinia |
| 路由 | Vue Router 4 |
| UI | [Tabler](https://tabler.io) + Bootstrap 5 |
| 图标 | [@tabler/icons-vue](https://tabler.io/icons) |
| 语言 | TypeScript |

---

## 快速开始

```bash
cd frontend
npm install
npm run dev
```

开发服务器：**http://127.0.0.1:5434**

API 请求通过 Vite 代理转发到后端 `http://127.0.0.1:8080`（需先启动 [nextfile](../nextfile/README.md)）。

### 其他命令

```bash
npm run build    # 生产构建 → dist/
npm run preview  # 预览构建产物
```

生产环境由 Go 服务托管 `dist/` 静态文件，或使用 `npm run build` 后配置 `STATIC_WEB_DIR`。

---

## 目录结构

```
frontend/
├── public/              # 静态资源（favicon 等）
├── src/
│   ├── api/             # API 客户端（auth、files、settings…）
│   ├── components/      # 通用组件（AppBrand、CdModal、DirectoryAIPanel…）
│   ├── composables/     # 组合式函数（toast、分页、上传队列…）
│   ├── constants/       # OAuth / 云盘预设配置
│   ├── layouts/         # 布局（MainLayout）
│   ├── router/          # 路由定义
│   ├── stores/          # Pinia 状态（auth、branding、agents）
│   ├── styles/          # 全局样式 app.css
│   ├── types/           # TypeScript 类型
│   ├── utils/           # 工具函数
│   └── views/           # 页面视图
│       ├── admin/       # 管理后台
│       │   └── config/  # 系统配置各分区面板
│       ├── FilesView.vue
│       ├── LoginView.vue
│       └── ...
├── index.html
├── vite.config.ts
└── package.json
```

---

## 路由表

| 路径 | 页面 | 权限 |
|------|------|------|
| `/login` | 登录 / 注册 / 重置密码 | 游客 |
| `/s/:token` | 公开分享 | 游客 |
| `/files` | 文件管理 | 登录 |
| `/agents/:slug` | 智能体对话 | 登录 |
| `/profile` | 个人设置 | 登录 |
| `/admin/users` | 用户管理 | 管理员 |
| `/admin/configs` | 系统配置 | 管理员 |
| `/admin/appearance` | 品牌与主题 | 管理员 |
| `/admin/storages` | 存储源 / 云盘对接 / 同步任务 | 管理员 |
| `/admin/departments` | 部门 | 管理员 |
| `/admin/permissions` | 权限分配 | 管理员 |
| `/admin/agents` | 智能体 | 管理员 |
| `/admin/plugins` | 插件 | 管理员 |
| `/admin/logs` | 系统日志 | 管理员 |

---

## 主要功能模块

### 文件管理（`FilesView`）

- 列表 / 网格视图、面包屑导航、多选与右键菜单
- 文件夹上传、拖拽上传、上传队列面板
- 图片 / PDF / 音视频 / 文本预览
- ONLYOFFICE 在线编辑（Office 文档）
- 分享、直链、打包下载
- **目录 AI 面板**（`DirectoryAIPanel`）：对已配置 AI 索引的目录发起问答

### 智能体对话（`AgentView`）

- OpenAI 兼容 API 流式对话（SSE）
- 对话页文件上传与解析问答
- 多智能体切换（侧边栏入口）

### 登录页（`LoginView`）

- 账号密码登录、记住密码
- 注册、忘记密码 / 重置密码
- 验证码（按后台配置显示）
- OAuth 第三方登录按钮
- 管理员 TOTP 二次验证

### 存储源（`StoragesView`）

三个 Tab，通过 `?tab=` 切换：

| Tab | 说明 |
|-----|------|
| 存储源 | 卡片列表，支持本地 / 协议 / 云盘驱动创建与 OAuth 授权 |
| 云盘对接 | `CloudStoragePanel`，配置 OneDrive / Google / 百度应用凭证 |
| 同步任务 | `StorageSyncPanel`，跨存储目录同步、定时调度、手动执行 |

### 系统配置（`ConfigsView`）

左侧导航 + 右侧配置面板：

| 分区 | 组件 |
|------|------|
| 常规 | `GeneralPanel` |
| OAuth | `OAuthPanel` |
| 安全 | `SecurityPanel` |
| 访问控制 | `AccessPanel` |
| 发件邮箱 | `EmailPanel` |
| LDAP | `LDAPPanel` |
| ONLYOFFICE | `OnlyOfficePanel` |

### 系统日志（`LogsView`）

四个 Tab，通过 `?tab=` 切换：

| Tab | category | 说明 |
|-----|----------|------|
| 操作日志 | `log` | 文件、存储、配置等常规操作 |
| 同步日志 | `sync` | 同步任务创建、触发、执行结果 |
| 登录日志 | `login` | 登录 / 登出 |
| 审计日志 | `audit` | 安全审计事件 |

### 品牌定制（`AppearanceView`）

站点名称、副标题、主题色、Logo、Favicon、登录页介绍、页脚信息。

---

## API 客户端

所有请求封装在 `src/api/`：

| 模块 | 文件 | 说明 |
|------|------|------|
| 基础 | `client.ts` | Token 管理、`request` / `publicRequest` |
| 认证 | `auth.ts` | 登录、注册、OAuth、2FA |
| 文件 | `files.ts` | 列表、上传、预览、ONLYOFFICE |
| 配置 | `settings.ts` | 管理后台系统配置 |
| 同步 | `storageSyncs.ts` | 跨存储同步任务 |
| AI | `ai.ts` | 目录 AI 索引与文档 |
| 其他 | `users.ts`、`storages.ts`、`agents.ts`、`sysLogs.ts`… | 各业务模块 |

开发时 API 基址为空（同源），由 Vite 代理：

```ts
// vite.config.ts
proxy: {
  '/api': { target: 'http://127.0.0.1:8080' },
  '/avatars': { target: 'http://127.0.0.1:8080' },
}
```

SSE 流式对话已配置 `no-cache` 与 `x-accel-buffering: no`，避免代理缓冲。

---

## 环境要求

- Node.js 20+
- npm 10+

---

## 构建与部署

```bash
npm run build
```

产物输出到 `frontend/dist/`，由后端 `STATIC_WEB_DIR` 托管，或自行部署到 Nginx 等静态服务器（需反向代理 `/api` 与 `/avatars` 到后端）。

---

## 相关文档

- [后端 API](https://github.com/filenext/nextfile)
- [部署仓库](https://github.com/filenext/deploy)
