# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## 技术栈与关键依赖

- **Vite 5 + React 18** — 无 React Router，手写 hash-based routing
- **Supabase** — PostgreSQL + Storage（图片上传、数据持久化）
- **Cesium.js / Resium** — 3D 地球，静态资源放在 `public/cesium/`
- **Three.js** — `@react-three/fiber` + `drei`，用于 KeywordsParticle 粒子场景
- **AI** — DeepSeek API（`memoryService.js`）生成旅行日记回忆文字
- **动画** — Framer Motion + GSAP
- **部署** — GitHub Pages（`.github/workflows/deploy.yml`）

## 环境变量

```env
VITE_SUPABASE_URL=           # Supabase 项目 URL
VITE_SUPABASE_ANON_KEY=      # Supabase 匿名密钥
VITE_GITHUB_OWNER=           # GitHub 用户名
VITE_GITHUB_REPO=            # 仓库名
VITE_GITHUB_BRANCH=main      # 分支名
VITE_AI_API_KEY=             # DeepSeek API key（默认 deepseek-v4-flash）
VITE_AI_API_BASE=            # 可选，默认 https://api.deepseek.com/v1
VITE_AI_MODEL=               # 可选，默认 deepseek-v4-flash
```

## 命令

```bash
npm run dev        # 启动开发服务器
npm run build      # 生产构建（输出到 dist/）
npm run preview    # 预览构建产物
```

## 路由系统

手写 hash 路由，无 React Router。`App.jsx` 是唯一路由中枢。

- `/#towhere` → 3D 地球主页（移动端默认）
- `/#keywords` → 粒子关键词首页（桌面端默认，移动端自动跳转 towhere）
- `/#breaking` → FIRSTS 首次打卡时间轴
- `/#letters` → 信件模块（仅桌面端）
- `/city/<城市名>` → 城市详情页（pathname 路由，非 hash）
- `page=story / end / annual` → story/end/energy 页面状态

**关键实现细节**：
- 城市详情页打开时不卸载地球组件（`display: none` 隐藏），保持 Cesium 实例存活，返回时无需重新加载
- `getInitialTab()` 读取 URL hash 初始化 tab，`hashchange` 事件同步状态
- 移动端检测 `window.innerWidth < 768`，keywords tab 在移动端自动跳转 towhere

## 数据层

### Supabase 表
```sql
cities (id, name, description, main_image, lng, lat, sort_order, departure)
city_images (id, city_id FK, url, sort_order, taken_at TIMESTAMPTZ)
city_memories (id, city_id FK, date DATE, text TEXT, UNIQUE(city_id,date))
checkins (id, user_id, date, keyword, quality)
firsts (id, date, description)
letters (id, sender, recipient, date, content, is_draft)
```

完整 DDL 在 `supabase-schema.sql`。注意所有表开启了 RLS 并允许匿名全权限（个人项目，非生产安全模式）。

### 存储层
- **Supabase Storage**：`city-images` bucket 用于城市照片上传
- **GitHub Contents API**：`src/lib/githubApi.js` 提供备用图片管理
- **LocalStorage**：`authStore.js`（登录状态）、`profileStore.js`（用户档案）

### AI 回忆生成 (`src/lib/memoryService.js`)
- 调用 DeepSeek API，根据照片日期、城市名、用户档案生成日记式回忆
- `buildProfileContext()` 从 profileStore 读取恋人信息构建 prompt 上下文
- 返回格式：`[{ date: 'YYYY-MM-DD', text: '...' }]`

## 关键架构模式

### 地球常驻挂载
CityDetail 页面不会卸载 CesiumGlobe——`App.jsx` 中地球外层 div 在 city 模式下设为 `display: none`。这避免了 Cesium 重新初始化（WebGL 上下文重建很昂贵）。

### 图片上传流程 (`src/lib/uploadUtils.js`)
1. 浏览器端压缩（>300KB → browser-image-compression，1920px/0.5MB）
2. 解析 EXIF 提取拍摄时间
3. 上传到 Supabase Storage `city-images` bucket
4. 返回 public URL 和 taken_at

### 能量站 Context (`src/context/EnergyContext.jsx`)
全局状态管理能量站数据，在 `App.jsx` 最外层包裹，所有子组件可访问。

## 飞书机器人

`feishu.js` — 使用飞书开放 API 的脚本集合（创建文档、发消息、拉群）。
`feishu-bot-server.mjs` — Express 服务器，处理飞书事件回调。

API 要点：先获取 tenant_access_token，再调各业务接口。文档写入接口每次最多 50 个 block。

## Git 工作流

```bash
# 代理已配置在 git config 中（http.proxy = 127.0.0.1:7897）
git add <files>
git commit -m "message"
git push origin main
```

远程仓库：`https://github.com/yqf0820-coder/ToWhereOnline`
