import { Hono } from 'hono';
import { EnvBindings, AppError, SECURITY_CONFIG } from '../config';
import { authMiddleware, sanitizeInput } from '../utils/helper';
import { encryptData, decryptData } from '../utils/crypto';
import { BackupProvider } from '../providers/BackupProvider';
import { WebDavProvider } from '../providers/WebDavProvider';
import { S3Provider } from '../providers/S3Provider';
import { batchInsertAccounts, decryptField } from '../utils/db';

const backups = new Hono<{ Bindings: EnvBindings, Variables: { user: any } }>();

backups.use('*', authMiddleware);

// 工厂函数：根据类型获取 Provider 实例
async function getProvider(type: string, config: any): Promise<BackupProvider> {
    switch (type) {
        case 'webdav':
            return new WebDavProvider(config);
        case 's3':
            return new S3Provider(config);
        default:
            throw new AppError(`Unknown provider type: ${type}`, 400);
    }
}

// 辅助函数：处理配置存储（加密敏感字段）
async function processConfigForStorage(type: string, config: any, key: string) {
    const processed = { ...config };
    if (type === 'webdav') {
        if (processed.password) {
            processed.password = await encryptData(processed.password, key);
        }
    }
    if (type === 's3') {
        if (processed.secretAccessKey) {
            processed.secretAccessKey = await encryptData(processed.secretAccessKey, key);
        }
    }
    return JSON.stringify(processed);
}

// 辅助函数：处理配置读取（解密敏感字段）
async function processConfigForUsage(type: string, configStr: string, key: string) {
    const config = JSON.parse(configStr);
    if (type === 'webdav') {
        if (config.password) {
            config.password = await decryptData(config.password, key);
        }
    }
    if (type === 's3') {
        if (config.secretAccessKey) {
            config.secretAccessKey = await decryptData(config.secretAccessKey, key);
        }
    }
    return config;
}

// ==========================================
// 1. 获取所有备份源列表
// ==========================================
backups.get('/providers', async (c) => {
    const { results } = await c.env.DB.prepare("SELECT * FROM backup_providers ORDER BY created_at DESC").all();
    
    const key = c.env.ENCRYPTION_KEY || c.env.JWT_SECRET;
    const providers = await Promise.all(results.map(async (row: any) => {
        // 解密配置返回给前端（以便编辑回显），注意前端展示时要掩码处理
        const config = await processConfigForUsage(row.type, row.config, key);
        return {
            ...row,
            config
        };
    }));

    return c.json({ success: true, providers });
});

// ==========================================
// 2. 添加备份源
// ==========================================
backups.post('/providers', async (c) => {
    const { type, name, config } = await c.req.json();
    
    if (!type || !name || !config) throw new AppError('Missing required fields', 400);

    const key = c.env.ENCRYPTION_KEY || c.env.JWT_SECRET;
    const encryptedConfig = await processConfigForStorage(type, config, key);

    const res = await c.env.DB.prepare(
        "INSERT INTO backup_providers (type, name, config, created_at, updated_at) VALUES (?, ?, ?, ?, ?)"
    ).bind(type, name, encryptedConfig, Date.now(), Date.now()).run();

    return c.json({ success: true, id: res.meta.last_row_id });
});

// ==========================================
// 3. 更新备份源
// ==========================================
backups.put('/providers/:id', async (c) => {
    const id = c.req.param('id');
    const { name, config, type } = await c.req.json();
    
    const key = c.env.ENCRYPTION_KEY || c.env.JWT_SECRET;
    const encryptedConfig = await processConfigForStorage(type, config, key);

    await c.env.DB.prepare(
        "UPDATE backup_providers SET name = ?, config = ?, updated_at = ? WHERE id = ?"
    ).bind(name, encryptedConfig, Date.now(), id).run();

    return c.json({ success: true });
});

// ==========================================
// 4. 删除备份源
// ==========================================
backups.delete('/providers/:id', async (c) => {
    const id = c.req.param('id');
    await c.env.DB.prepare("DELETE FROM backup_providers WHERE id = ?").bind(id).run();
    return c.json({ success: true });
});

// ==========================================
// 5. 测试连接
// ==========================================
backups.post('/providers/test', async (c) => {
    const { type, config } = await c.req.json();
    try {
        const provider = await getProvider(type, config);
        await provider.testConnection();
        return c.json({ success: true, message: 'Connection successful' });
    } catch (e: any) {
        throw new AppError(`Connection failed: ${e.message}`, 400);
    }
});

// ==========================================
// 6. 执行备份 (导出)
// ==========================================
backups.post('/providers/:id/backup', async (c) => {
    const id = c.req.param('id');
    const { password } = await c.req.json(); // 用户输入的加密密码

    if (!password || password.length < SECURITY_CONFIG.MIN_EXPORT_PASSWORD_LENGTH) {
        throw new AppError(`Export password must be at least ${SECURITY_CONFIG.MIN_EXPORT_PASSWORD_LENGTH} chars`, 400);
    }

    // 1. 获取 Provider 配置
    const providerRow: any = await c.env.DB.prepare("SELECT * FROM backup_providers WHERE id = ?").bind(id).first();
    if (!providerRow) throw new AppError('Provider not found', 404);

    const key = c.env.ENCRYPTION_KEY || c.env.JWT_SECRET;
    const config = await processConfigForUsage(providerRow.type, providerRow.config, key);
    const provider = await getProvider(providerRow.type, config);

    // 2. 准备数据 (从数据库读取并解密)
    const { results: accountResults } = await c.env.DB.prepare("SELECT * FROM accounts").all();
    
    // 优化：并行解密，并过滤掉解密失败的数据，防止因单条数据损坏导致整个备份失败
    const accounts = (await Promise.all(accountResults.map(async (row: any) => {
        const secret = await decryptField(row.secret, key);
        if (!secret) return null; // 如果某条数据解密失败（如密钥轮换遗留的旧数据），则跳过，不影响整体备份

        return {
            service: row.service,
            account: row.account,
            category: row.category,
            secret: secret,
            digits: row.digits,
            period: row.period
        };
    }))).filter(Boolean);

    const exportPayload = {
        version: "2.0",
        app: "2fa-secure-manager",
        encrypted: true,
        timestamp: new Date().toISOString(),
        accounts
    };

    // 3. 使用用户密码加密 Payload
    const userEncrypted = await encryptData(exportPayload, password);
    const fileContent = JSON.stringify({ ...exportPayload, data: userEncrypted, accounts: undefined });

    // 4. 上传
    const filename = `2fa-backup-${new Date().toISOString().replace(/[:.]/g, '-')}.json`;
    try {
        await provider.uploadBackup(filename, fileContent);
        
        // 更新状态
        await c.env.DB.prepare("UPDATE backup_providers SET last_backup_at = ?, last_backup_status = 'success' WHERE id = ?")
            .bind(Date.now(), id).run();
            
        return c.json({ success: true, message: 'Backup successful' });
    } catch (e: any) {
        await c.env.DB.prepare("UPDATE backup_providers SET last_backup_status = 'failed' WHERE id = ?")
            .bind(id).run();
        throw new AppError(`Backup failed: ${e.message}`, 500);
    }
});

// ==========================================
// 7. 获取文件列表 & 恢复备份
// ==========================================
backups.get('/providers/:id/files', async (c) => {
    const id = c.req.param('id');
    const providerRow: any = await c.env.DB.prepare("SELECT * FROM backup_providers WHERE id = ?").bind(id).first();
    if (!providerRow) throw new AppError('Provider not found', 404);

    const key = c.env.ENCRYPTION_KEY || c.env.JWT_SECRET;
    const config = await processConfigForUsage(providerRow.type, providerRow.config, key);
    const provider = await getProvider(providerRow.type, config);

    const files = await provider.listBackups();
    return c.json({ success: true, files });
});

backups.post('/providers/:id/restore', async (c) => {
    const id = c.req.param('id');
    const { filename, password } = await c.req.json();

    const providerRow: any = await c.env.DB.prepare("SELECT * FROM backup_providers WHERE id = ?").bind(id).first();
    if (!providerRow) throw new AppError('Provider not found', 404);

    const key = c.env.ENCRYPTION_KEY || c.env.JWT_SECRET;
    const config = await processConfigForUsage(providerRow.type, providerRow.config, key);
    const provider = await getProvider(providerRow.type, config);

    // 1. 下载文件
    let content: string;
    try {
        content = await provider.downloadBackup(filename);
    } catch (e: any) {
        throw new AppError(`Restore download failed: ${e.message}`, 500);
    }

    // 2. 解析并解密
    let accounts = [];
    try {
        const backupFile = JSON.parse(content);
        if (!backupFile.data) throw new Error('Legacy format or invalid file');
        
        const decrypted = await decryptData(backupFile.data, password); // 使用用户输入的密码解密
        accounts = decrypted.accounts || [];
    } catch (e: any) {
        throw new AppError('解密失败：密码错误或文件格式不兼容', 400);
    }

    // 3. 覆盖写入数据库 (先清空，再分批插入)
    await c.env.DB.prepare("DELETE FROM accounts").run();

    // 4. 使用封装好的批量插入函数
    const insertedCount = await batchInsertAccounts(c.env.DB, accounts, key, 'restore');

    return c.json({ success: true, message: 'Restore successful', count: insertedCount });
});

export default backups;
