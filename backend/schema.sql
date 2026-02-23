-- 账号表：每一行存储一个 2FA 凭据
CREATE TABLE IF NOT EXISTS accounts (
    id TEXT PRIMARY KEY,
    service TEXT NOT NULL,
    account TEXT NOT NULL,
    category TEXT,
    secret TEXT NOT NULL, -- 存储加密后的 JSON 字符串 {encrypted, iv, salt}
    digits INTEGER DEFAULT 6,
    period INTEGER DEFAULT 30,
    created_at INTEGER,
    created_by TEXT,
    updated_at INTEGER,
    updated_by TEXT
);

-- 备份提供商配置表 (支持多账号/多类型)
DROP TABLE IF EXISTS webdav_configs;
CREATE TABLE IF NOT EXISTS backup_providers (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    type TEXT NOT NULL,          -- 类型: 'webdav', 's3', etc.
    name TEXT NOT NULL,          -- 别名: '我的坚果云'
    is_enabled BOOLEAN DEFAULT 1,-- 开关
    config TEXT NOT NULL,        -- JSON 字符串 (敏感字段如 password 需加密存储)
    last_backup_at INTEGER,      -- 最后备份时间
    last_backup_status TEXT,     -- 'success' | 'failed'
    created_at INTEGER,
    updated_at INTEGER
);

-- 创建索引以加速查询
CREATE INDEX IF NOT EXISTS idx_accounts_service ON accounts(service);
CREATE INDEX IF NOT EXISTS idx_accounts_created_at ON accounts(created_at DESC);