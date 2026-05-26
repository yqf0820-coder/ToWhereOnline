const APP_ID = 'cli_a92f9ed9b5225bc9';
const APP_SECRET = 'QrmzRu4Ndv3QR5W1X6EkWgvtGJ5K52CR';
const CHAT_ID = 'oc_3ed265b55c376794d5f9cb6fc6ce69c1';
const OPEN_ID = 'ou_3a549c8c3d9868e086c93c61b9416e92';

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

  const res = await fetch(`https://open.feishu.cn/open-apis/im/v1/messages?receive_id_type=chat_id`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json; charset=utf-8',
    },
    body: JSON.stringify({
      receive_id: CHAT_ID,
      msg_type: 'text',
      content: JSON.stringify({
        text: `<at user_id=\"${OPEN_ID}\">杨其凡</at> 嗨！我在群里了，有什么需要尽管说～`
      }),
    }),
  });
  const data = await res.json();
  console.log(JSON.stringify(data, null, 2));
}

main().catch(console.error);
