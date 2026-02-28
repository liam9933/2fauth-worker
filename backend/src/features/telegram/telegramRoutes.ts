import { Hono } from 'hono';
import { EnvBindings } from '@/app/config';

const telegram = new Hono<{ Bindings: EnvBindings }>();

// 处理 Telegram Webhook
telegram.post('/webhook', async (c) => {
    const token = c.env.OAUTH_TELEGRAM_BOT_TOKEN;
    if (!token) return c.text('Bot Token not configured', 500);

    // 1. 安全校验 (可选，建议在 setWebhook 时设置 secret_token)
    // const secretToken = c.req.header('X-Telegram-Bot-Api-Secret-Token');
    // if (secretToken !== c.env.TELEGRAM_WEBHOOK_SECRET) return c.text('Unauthorized', 403);

    const update = await c.req.json();

    // 只处理 Message 类型的 Update
    if (!update.message) return c.json({ ok: true });

    const chatId = update.message.chat.id;
    const text = update.message.text || '';

    // 2. 处理 /start 命令
    if (text.startsWith('/start')) {
        // 提取参数: /start <state>
        const args = text.split(' ');
        const state = args[1];

        if (!state) {
            await sendTelegramMessage(token, chatId, '欢迎使用 2FAuth Worker Bot！\n请从网页端发起登录请求。');
            return c.json({ ok: true });
        }

        // 3. 构造 Login URL 按钮
        // 这个 URL 必须是你的前端回调地址，Telegram 会在用户点击时验证域名
        // 注意：这里我们需要知道前端的域名。通常可以从环境变量或请求头获取，
        // 但在 Webhook 中获取请求头可能不准确。建议在 env 中配置 FRONTEND_URL，
        // 或者这里暂时硬编码/从 KV 获取。
        // 假设我们通过 Referer 或 Origin 无法获取，这里需要你确保配置了 OAUTH_TELEGRAM_BOT_DOMAIN (即你的网站域名)
        // 如果没有配置，尝试从 request url 推断 (不一定准)
        
        // ⚠️ 关键：Login URL 必须是 HTTPS 且域名与 setdomain 一致
        // 我们构造前端的回调地址，让 Telegram 带着 hash 跳转回来
        // 格式: https://your-domain.com/callback/telegram
        
        // 这里的 state 参数其实不需要传给 callback，因为 Telegram 验证通过后，
        // 前端拿到的是 hash 数据。state 主要用于防止 CSRF，但在 Login Widget 模式下，
        // state 的传递比较特殊。
        // 实际上，Login URL 按钮点击后，Telegram 会请求该 URL，并附带 hash 参数。
        
        // 为了简化，我们假设你的 Worker 域名就是你的前端域名
        const url = new URL(c.req.url);
        const origin = `${url.protocol}//${url.hostname}`; 
        // 或者使用配置的域名
        // const origin = `https://${c.env.OAUTH_TELEGRAM_BOT_DOMAIN}`;

        const callbackUrl = `${origin}/callback/telegram?state=${state}`;

        await sendTelegramMessage(token, chatId, '请点击下方按钮完成登录验证：', {
            inline_keyboard: [[
                {
                    text: '🔐 确认登录',
                    login_url: { url: callbackUrl, request_write_access: true }
                }
            ]]
        });
    }

    return c.json({ ok: true });
});

async function sendTelegramMessage(token: string, chatId: number, text: string, replyMarkup?: any) {
    const url = `https://api.telegram.org/bot${token}/sendMessage`;
    await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            chat_id: chatId,
            text: text,
            reply_markup: replyMarkup
        })
    });
}

export default telegram;