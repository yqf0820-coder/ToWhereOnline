const APP_ID = 'cli_a92f9ed9b5225bc9';
const APP_SECRET = 'QrmzRu4Ndv3QR5W1X6EkWgvtGJ5K52CR';
const CHAT_ID = 'oc_3ed265b55c376794d5f9cb6fc6ce69c1';
const USER_OPEN_ID = 'ou_3a549c8c3d9868e086c93c61b9416e92';

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

  console.log('=== 添加成员到群聊 ===');
  const addRes = await fetch(`https://open.feishu.cn/open-apis/im/v1/chats/${CHAT_ID}/members?member_id_type=open_id`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json; charset=utf-8',
    },
    body: JSON.stringify({
      id_list: [USER_OPEN_ID],
    }),
  });
  const addData = await addRes.json();
  console.log(JSON.stringify(addData, null, 2));
}

main().catch(console.error);
