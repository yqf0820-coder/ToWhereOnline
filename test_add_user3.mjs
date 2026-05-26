const APP_ID = 'cli_a92f9ed9b5225bc9';
const APP_SECRET = 'QrmzRu4Ndv3QR5W1X6EkWgvtGJ5K52CR';
const CHAT_ID = 'oc_3ed265b55c376794d5f9cb6fc6ce69c1';
const PHONE = '15006726934';

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

  // 用 mobile 类型直接加群（不先查 user）
  console.log('=== 添加成员到群聊(member_id_type=mobile) ===');
  const addRes = await fetch(`https://open.feishu.cn/open-apis/im/v1/chats/${CHAT_ID}/members?member_id_type=mobile`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json; charset=utf-8',
    },
    body: JSON.stringify({
      id_list: [PHONE],
    }),
  });
  const text = await addRes.text();
  console.log(text);
}

main().catch(console.error);
