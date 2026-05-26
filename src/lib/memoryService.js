import { getProfile } from './profileStore';

const API_BASE = import.meta.env.VITE_AI_API_BASE || 'https://api.deepseek.com/v1';
const API_KEY = import.meta.env.VITE_AI_API_KEY || '';
const MODEL = import.meta.env.VITE_AI_MODEL || 'deepseek-v4-flash';

function buildProfileContext() {
  const p = getProfile();
  if (!p.setup) return '';

  let ctx = `${p.name1}（女生）和${p.name2}（男生）是一对恋人。`;

  if (p.metYear && p.metMonth) {
    ctx += `他们于${p.metYear}年${p.metMonth}月`;
    if (p.metDay) ctx += `${p.metDay}日`;
    ctx += '相识。';
  }

  if (p.relYear && p.relMonth) {
    ctx += `于${p.relYear}年${p.relMonth}月`;
    if (p.relDay) ctx += `${p.relDay}日`;
    ctx += '确认恋爱关系。';

    // 计算在一起多久
    const relDate = new Date(parseInt(p.relYear), parseInt(p.relMonth) - 1, parseInt(p.relDay) || 1);
    const now = new Date();
    const years = now.getFullYear() - relDate.getFullYear();
    const months = now.getMonth() - relDate.getMonth();
    const totalMonths = years * 12 + months;
    if (totalMonths > 0) {
      ctx += `至今已在一起约${Math.floor(totalMonths / 12)}年${totalMonths % 12}个月。`;
    }
  }

  ctx += `两人感情深厚，十年相伴，彼此深爱，是让人羡慕的一对。`;
  return ctx;
}

export async function generateDayMemories(items) {
  if (!items || items.length === 0) return [];
  if (!API_KEY) throw new Error('请先在 .env 中配置 VITE_AI_API_KEY');

  const profileCtx = buildProfileContext();

  const itemsList = items.map((it, i) =>
    `${i + 1}. ${it.date} — ${it.cityName}，共 ${it.photoCount} 张照片${it.description ? `，城市描述：${it.description}` : ''}`
  ).join('\n');

  const prompt = `你是一位温暖的恋爱日记写手，正在帮一对恋人记录他们的旅行回忆。

${profileCtx || '这是一对恋人，喜欢一起旅行。'}

请为每一天的旅行照片写一小段日记式的回忆文字。

写作要求：
- 用中文，以第一人称日记的口吻（"我们..."）
- 笔触温柔、充满爱意，像在翻看相册时的轻声感慨
- 每天2-4句话，控制在80字以内
- 结合地点名称和照片数量来还原那天的感受
- 体现出两人在一起的美好时光，让人读起来感到温暖和羡慕
- 可以适当加入对天气、心情、两个人互动的小细节的想象
- 语气自然、生活化，不要太文艺或夸张

日期列表：
${itemsList}

按顺序为每一天返回，每行一条，格式为 "YYYY-MM-DD：回忆内容"（一行写完，不要换行）：`;

  const res = await fetch(`${API_BASE}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${API_KEY}`,
    },
    body: JSON.stringify({
      model: MODEL,
      messages: [{ role: 'user', content: prompt }],
      max_tokens: 2000,
      temperature: 0.8,
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`AI 请求失败 (${res.status}): ${err.slice(0, 200)}`);
  }

  const data = await res.json();
  const text = data.choices?.[0]?.message?.content || '';

  const result = [];
  const lines = text.split('\n').filter(Boolean);
  for (const line of lines) {
    const match = line.match(/^(\d{4}-\d{2}-\d{2})[：:]\s*(.+)/);
    if (match) {
      result.push({ date: match[1], text: match[2].trim() });
    }
  }
  return result;
}
