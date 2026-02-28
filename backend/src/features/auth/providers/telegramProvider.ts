import { BaseOAuthProvider, OAuthUserInfo } from '@/features/auth/providers/baseOAuthProvider';
import { EnvBindings, AppError } from '@/app/config';

export class TelegramProvider extends BaseOAuthProvider {
    readonly id = 'telegram';
    readonly name = 'Telegram';
    readonly color = '#54a9eb';
    readonly icon = '<svg xmlns="http://www.w3.org/2000/svg" width="1em" height="1em" viewBox="0 0 24 24" fill="currentColor"><path d="M11.944 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12a12 12 0 0 0 12-12A12 12 0 0 0 11.944 0zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 0 1 .171.325c.016.093.036.306.02.472c-.18 1.898-.962 6.502-1.36 8.627c-.168.9-.499 1.201-.82 1.23c-.696.065-1.225-.46-1.9-.902c-1.056-.693-1.653-1.124-2.678-1.8c-1.185-.78-.417-1.21.258-1.91c.177-.184 3.247-2.977 3.307-3.23c.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345c-.48.33-.913.49-1.302.48c-.428-.008-1.252-.241-1.865-.44c-.752-.245-1.349-.374-1.297-.789c.027-.216.325-.437.893-.663c3.498-1.524 5.83-2.529 6.998-3.014c3.332-1.386 4.025-1.627 4.476-1.635z"/></svg>';
    readonly whitelistFields = ['id']; // Telegram 不保证提供 email

    constructor(env: EnvBindings) {
        super(env);
    }

    // 修改为 Deep Link 模式：生成跳转到 Bot 的链接，并携带 state 参数
    // 例如：https://t.me/MyAuthBot?start=state_value
    getAuthorizeUrl(state: string) {
        const botName = this.env.OAUTH_TELEGRAM_BOT_NAME;
        if (!botName) throw new AppError('Telegram Bot Name not configured', 500);

        // 注意：Telegram start 参数只允许 [A-Za-z0-9_-]，UUID 通常符合，但最好移除连字符以防万一
        // 这里我们直接使用 state，但在前端生成 state 时最好确保它是 URL 安全的
        return { url: `https://t.me/${botName}?start=${state}` };
    }

    async handleCallback(params: string | URLSearchParams, _codeVerifier?: string): Promise<OAuthUserInfo> {
        if (typeof params === 'string') {
            throw new AppError('Telegram provider requires full query parameters, not just code', 400);
        }

        const botToken = this.env.OAUTH_TELEGRAM_BOT_TOKEN;
        if (!botToken) throw new AppError('Telegram Bot Token not configured', 500);

        // 1. 提取并验证必要字段
        const hash = params.get('hash');
        if (!hash) throw new AppError('Missing hash signature', 400);

        const dataCheckArr: string[] = [];
        const allowedKeys = ['auth_date', 'first_name', 'id', 'last_name', 'photo_url', 'username'];

        // 2. 构造 data-check-string (按字母顺序排序 key=value)
        params.forEach((value, key) => {
            if (key !== 'hash' && allowedKeys.includes(key)) {
                dataCheckArr.push(`${key}=${value}`);
            }
        });
        dataCheckArr.sort();
        const dataCheckString = dataCheckArr.join('\n');

        // 3. 验证签名 (HMAC-SHA256)
        // Secret key 是 Bot Token 的 SHA256 哈希
        const encoder = new TextEncoder();
        const secretKeyData = await crypto.subtle.digest('SHA-256', encoder.encode(botToken));

        const key = await crypto.subtle.importKey(
            'raw',
            secretKeyData,
            { name: 'HMAC', hash: 'SHA-256' },
            false,
            ['verify']
        );

        const signature = this.hexToBuf(hash);
        const isValid = await crypto.subtle.verify(
            'HMAC',
            key,
            signature,
            encoder.encode(dataCheckString)
        );

        if (!isValid) {
            throw new AppError('Telegram signature verification failed', 403);
        }

        // 4. 检查时效性 (Telegram 建议检查 auth_date)
        const authDate = parseInt(params.get('auth_date') || '0');
        const now = Math.floor(Date.now() / 1000);
        if (now - authDate > 86400) { // 24小时过期
            throw new AppError('Telegram login data expired', 401);
        }

        // 5. 返回用户信息
        // 注意：Telegram 默认不返回 Email，除非使用 Passport (复杂)
        // 这里我们只能依赖 ID 或 Username
        return {
            id: params.get('id')!,
            username: params.get('username') || `tg_user_${params.get('id')}`,
            email: '', // Telegram 登录通常没有 Email
            avatar: params.get('photo_url') || undefined,
            provider: this.id
        };
    }

    private hexToBuf(hex: string): ArrayBuffer {
        const view = new Uint8Array(hex.length / 2);
        for (let i = 0; i < hex.length; i += 2) {
            view[i / 2] = parseInt(hex.substring(i, i + 2), 16);
        }
        return view.buffer;
    }
}