import { Context, Next } from 'hono';
import { getCookie } from 'hono/cookie';
import { AppError, EnvBindings } from '@/app/config';
import { verifySecureJWT } from '@/shared/utils/crypto';

export async function authMiddleware(c: Context<{ Bindings: EnvBindings, Variables: { user: any } }>, next: Next) {
    // 1. 从 Cookie 获取 JWT
    const token = getCookie(c, 'auth_token');
    if (!token) {
        throw new AppError('Unauthorized: Missing session cookie', 401);
    }

    // 2. CSRF 校验 (Double Submit Cookie)
    const csrfCookie = getCookie(c, 'csrf_token');
    const csrfHeader = c.req.header('X-CSRF-Token');
    if (!csrfCookie || !csrfHeader || csrfCookie !== csrfHeader) {
        throw new AppError('Forbidden: CSRF token mismatch', 403);
    }

    // 3. 验证 JWT
    const payload = await verifySecureJWT(token, c.env.JWT_SECRET);

    if (!payload || !payload.userInfo) {
        throw new AppError('Unauthorized: Token expired or invalid', 401);
    }

    // 验证通过，将用户信息挂载到上下文，供后续路由使用
    c.set('user', payload.userInfo);
    await next();
}
