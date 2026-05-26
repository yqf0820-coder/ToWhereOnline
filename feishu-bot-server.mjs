import express from 'express';
import crypto from 'crypto';

const APP_ID = 'cli_a92f9ed9b5225bc9';
const APP_SECRET = 'QrmzRu4Ndv3QR5W1X6EkWgvtGJ5K52CR';
const PORT = process.env.PORT || 3000;

// 飞书事件订阅的 Verification Token（在飞书开发者后台 → 事件配置 里可以看到）
// 也可以不配置，只用签名验证
const VERIFICATION_TOKEN = 'PLR5wbKv3aIP0vOtnVSrWcd41ulPlsSR';

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

// 签名验证
function verifySignature(req, res, buf) {
  const signature = req.headers['x-lark-signature'] || req.headers['x-feishu-signature'];
  if (!signature) return;

  const ts = req.headers['x-lark-request-timestamp'];
  const nonce = req.headers['x-lark-request-nonce'];

  if (!ts || !nonce) {
    console.warn('Missing timestamp or nonce in headers');
    return;
  }

  const str = `${ts}${nonce}${VERIFICATION_TOKEN}${buf}`;
  const calculated = crypto.createHash('sha256').update(str, 'utf8').digest('hex');

  if (calculated !== signature) {
    console.warn('Signature verification failed');
    // 不阻止请求，仅记录警告
  }
}

const app = express();

// 用原始 body 做签名验证
app.use(express.json({
  verify: (req, res, buf) => verifySignature(req, res, buf),
}));

// 飞书事件回调入口
app.post('/webhook/feishu', async (req, res) => {
  const body = req.body;
  const raw = JSON.stringify(body);
  console.log('收到请求:', raw.slice(0, 800));

  // 1. URL 验证
  if (body.challenge) {
    console.log('处理 URL 验证');
    return res.json({ challenge: body.challenge });
  }

  // 2. 获取事件类型（兼容 v1 和 v2）
  const eventType = body.header?.event_type || body.type;
  console.log('事件类型:', eventType);

  if (!eventType) {
    console.log('无法识别的事件格式，完整body:', raw);
    return res.json({ code: 0, msg: 'ok' });
  }

  if (eventType === 'im.message.receive_v1') {
    const event = body.event || body;
    const message = event.message;
    const sender = event.sender;

    if (!message || !sender) {
      console.log('消息事件缺少必要字段');
      return res.json({ code: 0, msg: 'ok' });
    }

    const chatId = message.chat_id;
    let content;
    try {
      content = JSON.parse(message.content);
    } catch {
      content = { text: message.content || '' };
    }
    const text = content.text || '';

    console.log(`收到消息: ${text} (来自: ${sender.sender_id?.open_id || 'unknown'})`);

    // 回复消息
    const token = await getToken();
    const replyText = `收到你的消息啦！(当前为自动回复模式)\n你说的是: ${text}`;

    await fetch(`https://open.feishu.cn/open-apis/im/v1/messages?receive_id_type=chat_id`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json; charset=utf-8',
      },
      body: JSON.stringify({
        receive_id: chatId,
        msg_type: 'text',
        content: JSON.stringify({ text: replyText }),
      }),
    });

    console.log('已回复消息');
  }

  res.json({ code: 0, msg: 'ok' });
});

// 健康检查
app.get('/health', (req, res) => {
  res.json({ status: 'ok', time: new Date().toISOString() });
});

app.listen(PORT, () => {
  console.log(`飞书机器人服务器启动: http://localhost:${PORT}`);
  console.log(`Webhook URL: http://localhost:${PORT}/webhook/feishu`);
  console.log(`健康检查: http://localhost:${PORT}/health`);
});
