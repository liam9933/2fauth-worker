import { D1Database } from '@cloudflare/workers-types';
import { encryptData, decryptData } from './crypto';
import { sanitizeInput } from './helper';

// 加密并序列化字段
export async function encryptField(data: any, key: string) {
    const encrypted = await encryptData(data, key);
    return JSON.stringify(encrypted);
}

// 反序列化并解密字段
export async function decryptField(encryptedStr: string, key: string) {
    try {
        const encryptedObj = JSON.parse(encryptedStr);
        return await decryptData(encryptedObj, key);
    } catch (e) {
        console.error('Decryption failed', e);
        return null;
    }
}

/**
 * 批量插入账号 (数据清洗 + 并行加密 + 分批写入)
 * @param db D1 数据库实例
 * @param accounts 待插入的原始账号列表
 * @param key 加密密钥
 * @param createdBy 创建者标识 (username 或 'restore')
 * @returns 成功插入的数量
 */
export async function batchInsertAccounts(
    db: D1Database,
    accounts: any[],
    key: string,
    createdBy: string
): Promise<number> {
    // 1. 准备数据 (规范化、加密、生成ID)
    const preparedItems = await Promise.all(accounts.map(async (acc) => {
        // 规范化密钥 (去除空格，转大写)
        const normalizedSecret = (acc.secret || '').replace(/\s/g, '').toUpperCase();
        const secretEncrypted = await encryptField(normalizedSecret, key);
        
        return {
            id: crypto.randomUUID(),
            service: sanitizeInput(acc.service, 50),
            account: sanitizeInput(acc.account, 100),
            category: acc.category ? sanitizeInput(acc.category, 30) : '',
            secretEncrypted,
            digits: acc.digits || 6,
            period: acc.period || 30,
            created_at: Date.now(),
            created_by: createdBy
        };
    }));

    // 2. 构造插入语句
    const stmt = db.prepare(
        `INSERT INTO accounts (id, service, account, category, secret, digits, period, created_at, created_by) 
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
    );
    
    // 3. 分批写入 (每批 100 条)
    const BATCH_SIZE = 100;
    for (let i = 0; i < preparedItems.length; i += BATCH_SIZE) {
        const chunk = preparedItems.slice(i, i + BATCH_SIZE);
        const batch = chunk.map(item => stmt.bind(
            item.id, item.service, item.account, item.category, item.secretEncrypted,
            item.digits, item.period, item.created_at, item.created_by
        ));
        
        if (batch.length > 0) await db.batch(batch);
    }
    
    return preparedItems.length;
}

/**
 * 批量删除账号 (分批 + 并行)
 * @param db D1 数据库实例
 * @param ids 待删除的账号 ID 列表
 * @returns 成功删除的数量
 */
export async function batchDeleteAccounts(
    db: D1Database,
    ids: string[]
): Promise<number> {
    if (!ids || ids.length === 0) return 0;

    // 优化：使用 IN 子句 + db.batch() 并行执行，减少 SQL 解析与网络 RTT
    const CHUNK_SIZE = 50;
    let deletedCount = 0;
    const statements = [];

    for (let i = 0; i < ids.length; i += CHUNK_SIZE) {
        const chunk = ids.slice(i, i + CHUNK_SIZE);
        const placeholders = chunk.map(() => '?').join(',');
        const query = `DELETE FROM accounts WHERE id IN (${placeholders})`;
        statements.push(db.prepare(query).bind(...chunk));
    }
    
    // D1 batch 限制每次最多 128 条语句
    const BATCH_LIMIT = 100;
    for (let i = 0; i < statements.length; i += BATCH_LIMIT) {
        const batchChunk = statements.slice(i, i + BATCH_LIMIT);
        const results = await db.batch(batchChunk);
        results.forEach(res => deletedCount += (res.meta.changes || 0));
    }
    
    return deletedCount;
}