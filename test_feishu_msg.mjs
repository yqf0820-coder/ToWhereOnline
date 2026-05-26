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
  const chatId = 'oc_3ed265b55c376794d5f9cb6fc6ce69c1';

  // 发送消息到群聊
  console.log('=== 发送消息 ===');
  const res = await fetch(`https://open.feishu.cn/open-apis/im/v1/messages?receive_id_type=chat_id`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json; charset=utf-8',
    },
    body: JSON.stringify({
      receive_id: chatId,
      msg_type: 'text',
      content: JSON.stringify({ text: '你好！我是 Openclaw 机器人，已经成功接入群聊 🎉\n有什么需要的可以在这个群里和我沟通～' }),
    }),
  });
  const data = await res.json();
  console.log(JSON.stringify(data, null, 2));
}

main().catch(console.error);
