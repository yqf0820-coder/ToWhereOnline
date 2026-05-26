const APP_ID = 'cli_a92f9ed9b5225bc9';
const APP_SECRET = 'QrmzRu4Ndv3QR5W1X6EkWgvtGJ5K52CR';
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

  // 尝试不同的查用户方式
  // 1. v1 batch_get
  console.log('=== v1 batch_get ===');
  const r1 = await fetch(`https://open.feishu.cn/open-apis/user/v1/batch_get?mobiles=${PHONE}`, {
    headers: { 'Authorization': `Bearer ${token}` },
  });
  console.log(await r1.text());

  // 2. 列出用户
  console.log('\n=== 列出通讯录用户 ===');
  const r2 = await fetch(`https://open.feishu.cn/open-apis/contact/v3/users?page_size=10`, {
    headers: { 'Authorization': `Bearer ${token}` },
  });
  console.log(await r2.text());
}

main().catch(console.error);
