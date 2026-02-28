import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { logger } from 'hono/logger';
import { secureHeaders } from 'hono/secure-headers';
import { EnvBindings, CSP_POLICY } from '@/app/config';

// 稍后我们会在这里引入拆分好的路由模块
import authRoutes from '@/features/auth/authRoutes';
import vaultRoutes from '@/features/vault/vaultRoutes';
import backupRoutes, { handleScheduledBackup } from '@/features/backup/backupRoutes';
import telegramRoutes from '@/features/telegram/telegramRoutes';
import toolsRoutes from '@/features/tools/toolsRoutes';

// 扩展 EnvBindings 以包含 ASSETS (Cloudflare Pages/Workers Assets)
type Bindings = EnvBindings & { ASSETS: { fetch: (req: Request) => Promise<Response> } };

// 初始化 Hono 应用，并绑定 Cloudflare 的环境变量类型
const app = new Hono<{ Bindings: Bindings }>();

// 1. 全局中间件
app.use('*', logger()); // 自动打印请求日志
app.use('/api/*', cors({
    origin: (origin) => origin, // 允许携带 Cookie 时，Origin 不能为 *，这里改为动态反射
    credentials: true, // 允许浏览器发送 Cookie
    allowHeaders: ['Content-Type', 'Authorization', 'X-CSRF-Token'], // 允许自定义 CSRF 头
    allowMethods: ['POST', 'GET', 'OPTIONS', 'PUT', 'DELETE'],
    maxAge: 86400,
}));

// 1.1 安全头配置 (CSP & Security Headers)
app.use('*', secureHeaders({
    contentSecurityPolicy: {
        defaultSrc: ["'self'"],
        scriptSrc: CSP_POLICY.SCRIPTS, // 使用 config.ts 中的配置
        styleSrc: ["'self'", "'unsafe-inline'"], // Element Plus 需要 unsafe-inline
        imgSrc: CSP_POLICY.IMAGES,     // 使用 config.ts 中的配置
        connectSrc: CSP_POLICY.CONNECT,// 使用 config.ts 中的配置
        fontSrc: ["'self'", "data:"],
        frameSrc: CSP_POLICY.FRAMES,   // 使用 config.ts 中的配置
        workerSrc: ["'self'", "blob:"], // 允许 Service Worker
        objectSrc: ["'none'"], // 禁止 Flash 等插件
    },
}));

// 2. 健康检查接口 (用于测试后端是否正常启动)
app.get('/api', (c) => c.text('🔐 2FA Secure Manager API is running!'));

// 3. 挂载子路由
app.route('/api/oauth', authRoutes);
app.route('/api/vault', vaultRoutes); // 'accounts' is now 'vault'
app.route('/api/backups', backupRoutes);
app.route('/api/telegram', telegramRoutes);
app.route('/api/tools', toolsRoutes);

// 4. API 404 处理 (必须在静态资源 fallback 之前，确保 API 路径返回 JSON)
app.all('/api/*', (c) => {
    return c.json({ success: false, error: 'API Not Found' }, 404);
});

// 5. 静态资源托管 (让 Hono 接管所有非 API 请求，以便应用 CSP 安全头)
app.get('*', async (c) => {
    const res = await c.env.ASSETS.fetch(c.req.raw);
    // 关键修复：ASSETS 返回的 Response 可能是不可变的。创建副本以允许 Hono 中间件添加 CSP 头。
    return new Response(res.body, res);
});

// 4. 全局错误处理
app.onError((err, c) => {
    const statusCode = (err as any).statusCode || (err as any).status || 500;

    // 特殊处理: WebDAV list 接口如果返回 404，说明目录不存在，视为无备份，返回空列表
    if (c.req.path.includes('/files') && (Number(statusCode) === 404 || err.message.includes('404'))) {
        return c.json({ success: true, backups: [] });
    }

    console.error(`[Server Error] ${err.message}`);
    // 标准化响应
    return c.json({
        code: statusCode,
        success: false,
        message: err.message || 'Internal Server Error',
        data: null
    }, statusCode as any);
});

// 6. 导出默认处理函数，实现前后端路由分发
export default {
    async fetch(request: Request, env: Bindings, ctx: any) {
        // 将所有请求交给 Hono 处理
        // Hono 会根据路由规则：
        // 1. /api/* -> API 路由
        // 2. * -> 静态资源 (env.ASSETS) + 全局中间件 (CSP)
        return app.fetch(request, env, ctx);
    },

    // 定时任务入口
    async scheduled(event: any, env: Bindings, ctx: any) {
        console.log(`[Cron] Scheduled event triggered at ${new Date().toISOString()}`);
        ctx.waitUntil(handleScheduledBackup(env));
    }
};