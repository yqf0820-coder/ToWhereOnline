# ToWhereOnline — 一路向哪

旅行日记 Web 应用，记录与展示去过的城市、照片时间轴、信件、首次打卡等。

## 技术栈

- **前端**: Vite 5 + React 18 (no React Router, 手写 hash-based routing)
- **数据库/存储**: Supabase (PostgreSQL + Storage)
- **3D**: Cesium.js (resium), Three.js (@react-three/fiber + drei)
- **动画**: Framer Motion, GSAP
- **图像**: browser-image-compression, exifr (EXIF 解析)
- **图表**: recharts, date-fns

## 项目结构

```
src/
  App.jsx              — 根组件, hash路由: #keywords #towhere #breaking #letters
  main.jsx             — 入口
  style.css            — 全局样式
  pages/
    CityDetail.jsx     — 城市详情页 (画廊/时间轴/上传/照片管理/AI回忆)
    Story.jsx, End.jsx — 故事/结语页
    EnergyStation.jsx  — 能量站
  components/
    PinkAnimationHome.jsx — 主页面 (CesiumGlobe + 侧边栏城市列表)
    CesiumGlobe.jsx       — 3D 地球 (Cesium)
    AddCityModal.jsx      — 添加/管理地点弹窗 (含批量上传)
    Navbar.jsx, HeroSection.jsx, MusicPlayer.jsx
    KeywordsParticle.jsx  — 粒子效果首页
    letters/              — 信件模块 (LettersModule, WriteLetter, Envelope)
    firsts/               — 首次打卡 (FirstsTimeline, CameraCapture)
    energy/               — 能量站 (CheckInPanel, EnergyCalendar, GravityChart)
    game/                 — 星舰小游戏
    admin/                — 管理工具 (CityUploadPanel, AdminTokenManager)
  lib/
    supabaseClient.js     — Supabase 客户端
    uploadUtils.js        — 图片上传 (压缩+EXIF+Storage)
    memoryService.js      — AI 回忆生成 (OpenRouter)
    githubApi.js, githubStorage.js — GitHub 备用存储
  context/
    EnergyContext.jsx     — 能量站全局状态
```

## 关键数据表 (Supabase)

```sql
cities (id, name, description, main_image, lng, lat, sort_order, departure)
city_images (id, city_id FK, url, sort_order, taken_at TIMESTAMPTZ)
city_memories (id, city_id FK, date DATE, text TEXT, created_at, UNIQUE(city_id,date))
```

## 最近完成的功能 (2026-05-24)

### 照片管理 (CityDetail)
- **设为封面**: ⭐ 按钮，即时更新 `cities.main_image`
- **删除照片**: ✕ 按钮，确认后删 Storage + DB，自动处理主图回退
- **修正时间**: 🕐 按钮 → datetime-local 弹窗，支持清除时间
- **批量上传**: 右下角悬浮 ＋ 按钮，节流进度更新 (300ms/3张)
- 画廊瀑布流 (CSS columns), 时间轴按日期分组, 图片查看器

### AI 回忆生成
- `src/lib/memoryService.js`: 调用 OpenRouter API 生成每天回忆文字
- 时间轴中按日期显示回忆卡片，支持全部/单日生成

### 地点管理 (AddCityModal)
- 添加模式支持批量选图，每张可单独移除，第一张自动为封面
- 管理模式支持城市列表删除、城市内照片批量上传

### 首页 (PinkAnimationHome)
- 侧边栏城市列表带删除按钮
- 城市名称去重显示 (Set)

### Bug 修复
- Hash 路由初始化读 URL hash (`getInitialTab()`)
- 上传从 fetch REST API 改为 supabase.storage SDK
- 城市删除先清 city_images 再删 cities (外键约束)

## 待完成

1. **SQL 迁移** (在 Supabase SQL Editor 执行):
   - `ALTER TABLE city_images ADD COLUMN IF NOT EXISTS taken_at TIMESTAMPTZ;`
   - 创建 `city_memories` 表 (见上方 DDL)
   - 清理重复的"南京"数据

2. **配置 API Key**: `.env` 中设置 `VITE_AI_API_KEY=sk-or-v1-xxx` (openrouter.ai)

3. **性能优化**:
   - CityDetail 显示时暂停 Cesium RAF 循环
   - 全局上传 context (跨页面导航保持上传进度)

4. **AddCityModal 管理模式**: storage 文件清理使用 `BUCKET` 常量但未 import (需要修复)

## 飞书机器人 (Openclaw)

当用户要求写文档、发消息、拉群时，使用此机器人。脚本在 `feishu.js`。

### 凭据
- **App ID**: `cli_a92f9ed9b5225bc9`
- **App Secret**: `QrmzRu4Ndv3QR5W1X6EkWgvtGJ5K52CR`
- **Bot OpenID**: `ou_406f6f06b00feddc8ae6f807258e72b5`

### 用户信息
- **杨其凡** OpenID: `ou_3a549c8c3d9868e086c93c61b9416e92`

### 常用 API
- **获取 Token**: `POST /open-apis/auth/v3/tenant_access_token/internal`
- **创建文档**: `POST /open-apis/docx/v1/documents`
- **写入文档**: `POST /open-apis/docx/v1/documents/{docId}/blocks/{docId}/children` (每次最多 50 block)
- **创建群聊**: `POST /open-apis/im/v1/chats`
- **发消息**: `POST /open-apis/im/v1/messages?receive_id_type=chat_id`
- **加群成员**: `POST /open-apis/im/v1/chats/{chatId}/members?member_id_type=open_id`
- **@提及**: content 中用 `<at user_id="ou_xxx">名字</at>`

### 已创建群聊
- **cc**: `oc_3ed265b55c376794d5f9cb6fc6ce69c1` (含用户+机器人)

### 脚本命令
```bash
node feishu.js create-prd          # 创建 PRD 文档
node feishu.js write-prd <docId>   # 写入 PRD 内容
node feishu.js read <docId>        # 读取文档内容
```

## 开发命令

```bash
npm run dev      # 启动 Vite dev server
npm run build    # 生产构建
```

## 路由说明

- `/` 或 `/#towhere` → 3D 地球主页面
- `/#keywords` → 粒子效果首页 (仅桌面端)
- `/#breaking` → 首次打卡时间轴
- `/#letters` → 信件模块
- `/city/<城市名>` → 城市详情页 (路径自动识别)
- `page=story / end / annual` → 故事/结语/能量站
