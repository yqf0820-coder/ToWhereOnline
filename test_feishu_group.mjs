import { writeFileSync } from 'fs';

const APP_ID = 'cli_a92f9ed9b5225bc9';
const APP_SECRET = 'QrmzRu4Ndv3QR5W1X6EkWgvtGJ5K52CR';

async function getToken() {
  const res = await fetch('https://open.feishu.cn/open-apis/auth/v3/tenant_access_token/internal', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ app_id: APP_ID, app_secret: APP_SECRET }),
  });
  return (await res.json()).tenant_access_token;
}

async function main() {
  const token = await getToken();
  
  // 1. 获取 bot 自身信息
  console.log('=== 获取 Bot 信息 ===');
  const botRes = await fetch('https://open.feishu.cn/open-apis/bot/v3/info', {
    headers: { 'Authorization': `Bearer ${token}` },
  });
  const botInfo = await botRes.json();
  console.log(JSON.stringify(botInfo, null, 2));

  // 2. 尝试创建群聊
  console.log('\n=== 创建群聊 ===');
  const createRes = await fetch('https://open.feishu.cn/open-apis/im/v1/chats', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json; charset=utf-8',
    },
    body: JSON.stringify({
      name: 'cc',
      description: '与机器人的聊天群',
      chat_mode: 'group',
      chat_type: 'private',
    }),
  });
  const createData = await createRes.json();
  console.log(JSON.stringify(createData, null, 2));
}

main().catch(console.error);
