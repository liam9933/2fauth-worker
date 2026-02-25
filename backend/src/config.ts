export const BASE32_CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';

export const SECURITY_CONFIG = {
    MAX_LOGIN_ATTEMPTS: 5,
    LOCKOUT_TIME: 15 * 60 * 1000,
    JWT_EXPIRY: 2 * 60 * 60, // 2小时
    MAX_INPUT_LENGTH: 100,
    MIN_EXPORT_PASSWORD_LENGTH: 12,
    MAX_OAUTH_ATTEMPTS: 3,
    OAUTH_LOCKOUT_TIME: 10 * 60 * 1000,
    MAX_FILE_SIZE: 10 * 1024 * 1024,
};

// ==========================================
// CSP 内容安全策略配置 (集中管理域名白名单)
// ==========================================
export const CSP_POLICY = {
    // 脚本源: 允许本站、内联脚本(Vue必需) 以及 Cloudflare 统计脚本
    SCRIPTS: [
        "'self'",
        "'unsafe-inline'",
        "'unsafe-eval'",
        "https://static.cloudflareinsights.com",
    ],
    // 图片源: 允许本站、GitHub 头像、NodeLoc 头像
    IMAGES: [
        "'self'",
        "data:",
        "blob:",
        "https://avatars.githubusercontent.com",
        "https://www.nodeloc.com",
    ],
    // 连接源: 允许 API 请求、Cloudflare 统计上报
    CONNECT: [
        "'self'",
        "https://api.github.com",
        "https://github.com",
        "https://cloudflareinsights.com",
        "https://static.cloudflareinsights.com",
    ],
};

// Cloudflare Workers 环境变量类型定义
export type EnvBindings = {
    DB: D1Database;
    OAUTH_GITHUB_CLIENT_ID: string;
    OAUTH_GITHUB_CLIENT_SECRET: string;
    OAUTH_GITHUB_REDIRECT_URI: string;
    OAUTH_CLOUDFLARE_CLIENT_ID?: string;
    OAUTH_CLOUDFLARE_CLIENT_SECRET?: string;
    OAUTH_CLOUDFLARE_ORG_DOMAIN?: string; // 例如 https://your-team.cloudflareaccess.com
    OAUTH_CLOUDFLARE_REDIRECT_URI?: string;
    OAUTH_NODELOC_CLIENT_ID?: string;
    OAUTH_NODELOC_CLIENT_SECRET?: string;
    OAUTH_NODELOC_REDIRECT_URI?: string;
    OAUTH_GITEE_CLIENT_ID?: string;
    OAUTH_GITEE_CLIENT_SECRET?: string;
    OAUTH_GITEE_REDIRECT_URI?: string;
    OAUTH_ALLOWED_USERS: string;    // 允许登录的 Email 或 Username 白名单 (必填)
    JWT_SECRET: string;
    ENCRYPTION_KEY: string;
};

// 自定义错误类
export class AppError extends Error {
    statusCode: number;
    constructor(message: string, statusCode = 500) {
        super(message);
        this.name = 'AppError';
        this.statusCode = statusCode;
    }
}