import { readFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

const APP_ID = 'cli_a92f9ed9b5225bc9';
const APP_SECRET = 'QrmzRu4Ndv3QR5W1X6EkWgvtGJ5K52CR';

let tokenCache = { token: '', expires: 0 };

async function getToken() {
  if (Date.now() < tokenCache.expires) return tokenCache.token;
  const res = await fetch('https://open.feishu.cn/open-apis/auth/v3/tenant_access_token/internal', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ app_id: APP_ID, app_secret: APP_SECRET }),
  });
  const data = await res.json();
  tokenCache = { token: data.tenant_access_token, expires: Date.now() + data.expire * 900 };
  return data.tenant_access_token;
}

// 创建文档
export async function createDocument(title) {
  const token = await getToken();
  const res = await fetch('https://open.feishu.cn/open-apis/docx/v1/documents', {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json; charset=utf-8' },
    body: JSON.stringify({ title }),
  });
  return res.json();
}

// 获取文档内容
export async function getDocumentContent(documentId) {
  const token = await getToken();
  const res = await fetch(`https://open.feishu.cn/open-apis/docx/v1/documents/${documentId}/raw_content`, {
    headers: { 'Authorization': `Bearer ${token}` },
  });
  return res.json();
}

// 追加文本块
export async function appendBlocks(documentId, blocks) {
  const token = await getToken();

  // 先获取文档当前信息
  const docRes = await fetch(`https://open.feishu.cn/open-apis/docx/v1/documents/${documentId}`, {
    headers: { 'Authorization': `Bearer ${token}` },
  });
  const docData = await docRes.json();
  const revisionId = docData.data?.document?.revision_id || -1;

  // 构建 block 请求
  const res = await fetch(`https://open.feishu.cn/open-apis/docx/v1/documents/${documentId}/blocks/${documentId}/children`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json; charset=utf-8',
    },
    body: JSON.stringify({
      revision: revisionId,
      children: blocks,
    }),
  });
  return res.json();
}

// 创建文本块
export function textBlock(content, type = 'text') {
  if (type === 'heading1') {
    return {
      block_type: 3,
      heading1: {
        elements: [{ text_run: { content, text_element_style: {} } }],
        style: {},
      },
    };
  }
  if (type === 'heading2') {
    return {
      block_type: 4,
      heading2: {
        elements: [{ text_run: { content, text_element_style: {} } }],
        style: {},
      },
    };
  }
  if (type === 'bullet') {
    return {
      block_type: 12,
      bullet: {
        elements: [{ text_run: { content, text_element_style: {} } }],
        style: {},
      },
    };
  }
  if (type === 'divider') {
    return { block_type: 22, divider: {} };
  }
  // 普通段落
  return {
    block_type: 2,
    text: {
      elements: [{ text_run: { content, text_element_style: {} } }],
      style: {},
    },
  };
}

// ========== 主函数：写入 PRD 到飞书文档 ==========
async function main() {
  const action = process.argv[2];

  if (action === 'create-prd') {
    console.log('Creating PRD document...');
    const result = await createDocument('女友礼物网页 — 产品需求文档');
    console.log('Create result:', JSON.stringify(result, null, 2));

    if (result.code === 0) {
      const docId = result.data.document.document_id;
      const url = `https://bytedance.feishu.cn/docx/${docId}`;
      console.log(`\n✅ PRD 文档已创建！`);
      console.log(`📎 文档链接: ${url}`);
      console.log(`📝 文档 ID: ${docId}`);
      console.log(`\n接下来可以用以下命令写入内容:`);
      console.log(`  node feishu.js write-prd ${docId}`);
    }
  } else if (action === 'write-prd') {
    const docId = process.argv[3];
    if (!docId) {
      console.error('请提供文档 ID');
      process.exit(1);
    }

    const blocks = [
      textBlock('女友礼物网页 — 产品需求文档 (PRD)', 'heading1'),
      textBlock(''),
      textBlock('1. 项目概述', 'heading2'),
      textBlock('基于 ToWhere Online V1.0（旅行记忆存档项目）改造，打造一个专属女友的礼物网站。保留原有"互动式记忆存档"的核心定位，但将主题从"旅行地图"扩展为"我们的爱情宇宙"，包含回忆、心情、书信、纪念日等全方位功能。'),
      textBlock(''),
      textBlock('2. 技术栈', 'heading2'),
      textBlock('React 18 + Vite 5 + Three.js / React Three Fiber + Cesium / Resium + Supabase + Framer Motion + Recharts'),
      textBlock(''),
      textBlock('3. 核心功能', 'heading2'),
      textBlock(''),
      textBlock('首页 (宇宙粒子 + 纪念日倒计时)', 'heading1'),
      textBlock(''),
      textBlock('3D 粒子宇宙效果（"To Where?" 改为 "我爱你" 等自定义文字）', 'bullet'),
      textBlock('纪念日倒计时 / 在一起多少天', 'bullet'),
      textBlock('一键进入主站', 'bullet'),
      textBlock(''),
      textBlock('地球旅行地图', 'heading1'),
      textBlock(''),
      textBlock('Cesium 3D 地球，标记一起去过的城市', 'bullet'),
      textBlock('城市详情页：展示照片 + 回忆故事', 'bullet'),
      textBlock('支持直接在地球页面添加城市和上传照片 ✓', 'bullet'),
      textBlock('支持批量上传照片、管理、删除城市 ✓', 'bullet'),
      textBlock(''),
      textBlock('FIRSTS 时间线', 'heading1'),
      textBlock(''),
      textBlock('记录每一个"第一次"（第一次牵手、第一次旅行...）', 'bullet'),
      textBlock('支持图片上传、时间线浏览', 'bullet'),
      textBlock(''),
      textBlock('心情能量站', 'heading1'),
      textBlock(''),
      textBlock('每日心情打卡', 'bullet'),
      textBlock('趋势图表和日历记录', 'bullet'),
      textBlock(''),
      textBlock('书信模块', 'heading1'),
      textBlock(''),
      textBlock('电子情书互写', 'bullet'),
      textBlock('信封动画交互', 'bullet'),
      textBlock(''),
      textBlock('默契测试 / 愿望清单（待开发）', 'heading1'),
      textBlock(''),
      textBlock('双人问答，对比答案看默契度', 'bullet'),
      textBlock('一起想做的事情清单', 'bullet'),
      textBlock(''),
      textBlock('4. 数据架构', 'heading2'),
      textBlock('使用 Supabase 作为后端，包含以下数据表：'),
      textBlock('cities — 城市/地点数据', 'bullet'),
      textBlock('city_images — 城市照片', 'bullet'),
      textBlock('firsts — 第一次记录', 'bullet'),
      textBlock('letters — 书信', 'bullet'),
      textBlock('checkins — 心情打卡', 'bullet'),
      textBlock('keyword_tasks — 关键词任务', 'bullet'),
      textBlock('app_config — 应用配置', 'bullet'),
      textBlock(''),
      textBlock('5. 部署方式', 'heading2'),
      textBlock('前端：Vercel / GitHub Pages', 'bullet'),
      textBlock('后端：Supabase (BaaS)', 'bullet'),
      textBlock('图片存储：Supabase Storage', 'bullet'),
    ];

    console.log('Writing content to document...');

    // 分批写入，每次最多 50 个 block
    const BATCH_SIZE = 50;
    let successCount = 0;
    for (let i = 0; i < blocks.length; i += BATCH_SIZE) {
      const batch = blocks.slice(i, i + BATCH_SIZE);
      const result = await appendBlocks(docId, batch);
      if (result.code === 0) {
        successCount += batch.length;
        console.log(`  进度: ${successCount}/${blocks.length}`);
      } else {
        console.error(`第 ${Math.floor(i / BATCH_SIZE) + 1} 批写入失败:`, JSON.stringify(result, null, 2));
        process.exit(1);
      }
    }

    console.log('\n✅ 内容全部写入成功！');
    console.log(`📎 文档链接: https://bytedance.feishu.cn/docx/${docId}`);
  } else if (action === 'read') {
    const docId = process.argv[3];
    if (!docId) {
      console.error('请提供文档 ID');
      process.exit(1);
    }
    const result = await getDocumentContent(docId);
    console.log(JSON.stringify(result, null, 2));
  } else if (action === 'towhere-prd') {
    const docId = process.argv[3];
    if (!docId) {
      console.error('请提供文档 ID，例如 node feishu.js towhere-prd SSU1dYPeToGe4yxcnHccXMI0nPd');
      process.exit(1);
    }

    const blocks = [
      textBlock('一路向哪 — 产品需求文档 (PRD)', 'heading1'),
      textBlock(''),
      textBlock('产品概述', 'heading2'),
      textBlock('一路向哪（ToWhereOnline）是一款旅行日记 Web 应用，用户可以为去过的城市创建记录、上传照片、浏览时间轴、查看 AI 生成的回忆。当前版本：MVP 迭代中 | 平台：Web（桌面端为主，移动端适配中）'),
      textBlock(''),
      textBlock('一、Sprint 1 需求（当前执行中）', 'heading2'),
      textBlock(''),
      textBlock('P0: Bug 修复', 'heading2'),
      textBlock('BUG-01: 数据库重复城市（5个"南京"），需加 UNIQUE 约束 + 清理 — 未开始', 'bullet'),
      textBlock('BUG-02: AddCityModal 管理模式 BUCKET 常量未 import — ✅ 已修复', 'bullet'),
      textBlock('BUG-03: Cesium 在 CityDetail 显示时仍运行 RAF 循环 — 未开始', 'bullet'),
      textBlock('BUG-04: city_images 表可能缺少 taken_at 列 — 需执行 SQL', 'bullet'),
      textBlock('BUG-05: city_memories 表未创建 — 需执行 SQL', 'bullet'),
      textBlock('BUG-06: 大照片加载慢，画廊无懒加载 — ✅ 已加 loading="lazy"', 'bullet'),
      textBlock(''),
      textBlock('P0: 体验增强', 'heading2'),
      textBlock('DETAIL-06: 城市详情页顶部锚点导航（封面/精彩瞬间/时间轴） — ✅ 已完成', 'bullet'),
      textBlock('PHOTO-07: 照片拖拽排序 — ✅ 已完成', 'bullet'),
      textBlock('PHOTO-01: 批量上传照片（压缩+EXIF） — ✅ 已完成', 'bullet'),
      textBlock('PHOTO-04: 照片删除（Storage+DB 同步） — ✅ 已完成', 'bullet'),
      textBlock('PHOTO-05: 设为封面（即时生效） — ✅ 已完成', 'bullet'),
      textBlock('PHOTO-06: 修正拍摄时间 — ✅ 已完成', 'bullet'),
      textBlock('CITY-01: 添加城市（带批量照片） — ✅ 已完成', 'bullet'),
      textBlock('CITY-03: 删除城市（含关联清理） — ✅ 已完成', 'bullet'),
      textBlock(''),
      textBlock('二、Sprint 2 需求（待规划）', 'heading2'),
      textBlock(''),
      textBlock('P1: 功能缺口', 'heading2'),
      textBlock('PHOTO-09: 照片备注/故事 — 每张照片可添加一段文字描述', 'bullet'),
      textBlock('DETAIL-07: Hero 区域照片轮播 — 自动切换封面级照片', 'bullet'),
      textBlock('PHOTO-08: 批量操作 — 多选后批量删除/设时间', 'bullet'),
      textBlock('GLOBE-04: 地球侧边栏城市搜索', 'bullet'),
      textBlock('GLOBE-06: 地球性能优化 — 隐藏时暂停 RAF 循环', 'bullet'),
      textBlock('GLOBAL-07: 代码分割 — React.lazy 拆分 Cesium/Three', 'bullet'),
      textBlock('TIMELINE-02: 时间轴日期锚点导航', 'bullet'),
      textBlock('PHOTO-12: 全局上传 context — 跨页面保持上传进度', 'bullet'),
      textBlock(''),
      textBlock('P2: 体验提升', 'heading2'),
      textBlock('CITY-05: 城市手动拖拽排序', 'bullet'),
      textBlock('DETAIL-08: 回到顶部按钮', 'bullet'),
      textBlock('GLOBAL-02: 页面过渡动画（Framer Motion）', 'bullet'),
      textBlock('GLOBAL-09: 滚动位置记忆', 'bullet'),
      textBlock('DETAIL-09: 内嵌小地图（展示 GPS 定位）', 'bullet'),
      textBlock('PHOTO-10: 照片 EXIF 详情展示', 'bullet'),
      textBlock(''),
      textBlock('P3: 锦上添花', 'heading2'),
      textBlock('AI-02: AI 照片配文 — 上传后自动生成一句话描述', 'bullet'),
      textBlock('AI-03: AI 城市总结 — 综合所有照片生成城市游记', 'bullet'),
      textBlock('GLOBAL-03: 全局照片流 — 跨城市浏览所有照片', 'bullet'),
      textBlock('GLOBAL-04: 数据导出（JSON/ZIP）', 'bullet'),
      textBlock('GLOBAL-05: 分享卡片（Canvas 合成）', 'bullet'),
      textBlock('GLOBAL-06: PWA 离线支持', 'bullet'),
      textBlock('CITY-07: 同一城市多次行程', 'bullet'),
      textBlock(''),
      textBlock('三、数据库迁移（需在 Supabase SQL Editor 执行）', 'heading2'),
      textBlock(''),
      textBlock('ALTER TABLE city_images ADD COLUMN IF NOT EXISTS taken_at TIMESTAMPTZ;', 'bullet'),
      textBlock('CREATE TABLE IF NOT EXISTS city_memories (id SERIAL PRIMARY KEY, city_id INTEGER REFERENCES cities(id) ON DELETE CASCADE, date DATE NOT NULL, text TEXT NOT NULL, created_at TIMESTAMPTZ DEFAULT NOW(), UNIQUE(city_id, date));', 'bullet'),
      textBlock('DELETE FROM cities WHERE id NOT IN (SELECT MIN(id) FROM cities GROUP BY name); — 清理重复城市', 'bullet'),
      textBlock('ALTER TABLE cities ADD CONSTRAINT unique_city_name UNIQUE (name);', 'bullet'),
      textBlock(''),
      textBlock('四、技术债务', 'heading2'),
      textBlock('Cesium 构建体积过大（~6MB）', 'bullet'),
      textBlock('无测试覆盖', 'bullet'),
      textBlock('无 CI/CD', 'bullet'),
      textBlock('移动端尚未完整适配', 'bullet'),
    ];

    console.log('正在写入一路向哪 PRD 到飞书文档...');
    const BATCH_SIZE = 50;
    let successCount = 0;
    for (let i = 0; i < blocks.length; i += BATCH_SIZE) {
      const batch = blocks.slice(i, i + BATCH_SIZE);
      const result = await appendBlocks(docId, batch);
      if (result.code === 0) {
        successCount += batch.length;
        console.log(`  进度: ${successCount}/${blocks.length}`);
      } else {
        console.error(`第 ${Math.floor(i / BATCH_SIZE) + 1} 批写入失败:`, JSON.stringify(result, null, 2));
        process.exit(1);
      }
    }
    console.log('\n✅ 一路向哪 PRD 内容全部写入成功！');
    console.log(`📎 文档链接: https://v1yzlncoqjr.feishu.cn/docx/${docId}`);
  } else {
    console.log(`
用法:
  node feishu.js create-prd            创建"女友礼物"PRD 文档
  node feishu.js write-prd <docId>     写入"女友礼物"PRD
  node feishu.js towhere-prd <docId>   写入"一路向哪"PRD
  node feishu.js read <docId>          读取文档内容
    `);
  }
}

main().catch(console.error);
