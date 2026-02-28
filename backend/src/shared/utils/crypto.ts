// 统一加密标准模块 (Backend Version)
// 算法: AES-GCM-256 + PBKDF2 (SHA-256)
// 目标: 确保前后端生成的加密数据完全互通

export const CRYPTO_CONFIG = {
    ALGO_NAME: 'AES-GCM',
    KDF_NAME: 'PBKDF2',
    HASH: 'SHA-256',
    ITERATIONS: 100000, // 平衡安全性与性能
    KEY_LEN: 256,
    SALT_LEN: 16,
    IV_LEN: 12
};





// 核心：从密码派生密钥
async function deriveKey(password: string, salt: Uint8Array): Promise<CryptoKey> {
    const enc = new TextEncoder();
    const keyMaterial = await crypto.subtle.importKey(
        "raw",
        enc.encode(password),
        { name: CRYPTO_CONFIG.KDF_NAME },
        false,
        ["deriveKey"]
    );

    return crypto.subtle.deriveKey(
        {
            name: CRYPTO_CONFIG.KDF_NAME,
            salt: salt as any,
            iterations: CRYPTO_CONFIG.ITERATIONS,
            hash: CRYPTO_CONFIG.HASH
        },
        keyMaterial,
        { name: CRYPTO_CONFIG.ALGO_NAME, length: CRYPTO_CONFIG.KEY_LEN },
        false,
        ["encrypt", "decrypt"]
    );
}



// ==========================================
// JWT 签发与验证 (原生轻量实现)
// ==========================================
export async function generateSecureJWT(payload: Record<string, any>, secret: string, expiry: number = 86400 * 7): Promise<string> {
    const header = { alg: 'HS256', typ: 'JWT', iat: Math.floor(Date.now() / 1000) };
    const enhancedPayload = {
        ...payload,
        iat: Math.floor(Date.now() / 1000),
        exp: Math.floor(Date.now() / 1000) + expiry,
        jti: crypto.randomUUID()
    };

    const headerB64 = btoa(JSON.stringify(header)).replace(/[+/=]/g, (m) => ({ '+': '-', '/': '_', '=': '' }[m as keyof { '+': string, '/': string, '=': string }] || m));
    const payloadB64 = btoa(JSON.stringify(enhancedPayload)).replace(/[+/=]/g, (m) => ({ '+': '-', '/': '_', '=': '' }[m as keyof { '+': string, '/': string, '=': string }] || m));

    const data = `${headerB64}.${payloadB64}`;
    const encoder = new TextEncoder();
    const cryptoKey = await crypto.subtle.importKey('raw', encoder.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
    const signature = await crypto.subtle.sign('HMAC', cryptoKey, encoder.encode(data));
    const signatureB64 = btoa(String.fromCharCode(...new Uint8Array(signature))).replace(/[+/=]/g, (m) => ({ '+': '-', '/': '_', '=': '' }[m as keyof { '+': string, '/': string, '=': string }] || m));

    return `${data}.${signatureB64}`;
}

export async function verifySecureJWT(token: string, secret: string): Promise<any | null> {
    try {
        const [headerB64, payloadB64, signatureB64] = token.split('.');
        if (!headerB64 || !payloadB64 || !signatureB64) return null;

        const data = `${headerB64}.${payloadB64}`;
        const encoder = new TextEncoder();

        const cryptoKey = await crypto.subtle.importKey('raw', encoder.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['verify']);
        const signatureBytes = Uint8Array.from(atob(signatureB64.replace(/[-_]/g, (m) => ({ '-': '+', '_': '/' }[m as keyof { '-': string, '_': string }] || m))), c => c.charCodeAt(0));
        // @ts-ignore Cloudflare WebCrypto types mismatch with standard BufferSource
        const isValid = await crypto.subtle.verify('HMAC', cryptoKey, signatureBytes as any as ArrayBuffer, encoder.encode(data) as any as ArrayBuffer);

        if (isValid) {
            const payload = JSON.parse(atob(payloadB64.replace(/[-_]/g, (m) => ({ '-': '+', '_': '/' }[m as keyof { '-': string, '_': string }] || m))));
            if (payload.exp && payload.exp < Math.floor(Date.now() / 1000)) return null;
            return payload;
        }
        return null;
    } catch {
        return null;
    }
}

// ==========================================
// PKCE 辅助机制 (OAuth)
// ==========================================
export function base64UrlEncode(str: Uint8Array): string {
    let binary = '';
    const len = str.byteLength;
    for (let i = 0; i < len; i++) {
        binary += String.fromCharCode(str[i]);
    }
    return btoa(binary)
        .replace(/\+/g, '-')
        .replace(/\//g, '_')
        .replace(/=+$/, '');
}

export async function generatePKCE() {
    const verifierBytes = new Uint8Array(32);
    crypto.getRandomValues(verifierBytes);
    const verifier = base64UrlEncode(verifierBytes);
    const challenge = base64UrlEncode(new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(verifier))));
    return { verifier, challenge };
}

// ==========================================
// 极速与兼容模式加解密体系
// ==========================================

// ⚡️ 极速模式：直接使用密钥的哈希值作为 AES 密钥 (无 PBKDF2)
async function getFastKey(secret: string): Promise<CryptoKey> {
    const encoder = new TextEncoder();
    const keyBuffer = await crypto.subtle.digest('SHA-256', encoder.encode(secret));
    return crypto.subtle.importKey('raw', keyBuffer, { name: 'AES-GCM' }, false, ['encrypt', 'decrypt']);
}

// 🛡️ 兼容模式：生成与前端相匹配的 Vault Backup 文件 (PBKDF2 + AES-GCM 封装)
export async function encryptBackupFile(data: any, password: string): Promise<string> {
    const salt = crypto.getRandomValues(new Uint8Array(CRYPTO_CONFIG.SALT_LEN));
    const iv = crypto.getRandomValues(new Uint8Array(CRYPTO_CONFIG.IV_LEN));

    const key = await deriveKey(password, salt);
    const enc = new TextEncoder();
    const encodedData = enc.encode(JSON.stringify(data));

    const ciphertext = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, encodedData);

    const combined = new Uint8Array(salt.length + iv.length + ciphertext.byteLength);
    combined.set(salt, 0);
    combined.set(iv, salt.length);
    combined.set(new Uint8Array(ciphertext), salt.length + iv.length);

    let binary = '';
    for (let i = 0; i < combined.byteLength; i++) {
        binary += String.fromCharCode(combined[i]);
    }
    return btoa(binary);
}

// 🚀 新版内置加密封装，主要用于 KV 或 D1 里的敏感小字段
export async function encryptData(data: any, masterKey: string): Promise<{ encrypted: number[], iv: number[], salt?: number[] }> {
    const encoder = new TextEncoder();
    const iv = crypto.getRandomValues(new Uint8Array(12));

    const key = await getFastKey(masterKey);

    const encrypted = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, encoder.encode(JSON.stringify(data)));
    return {
        encrypted: Array.from(new Uint8Array(encrypted)),
        iv: Array.from(iv)
    };
}

// 🚀 新版内置解密封装，自带兼容回退机制
export async function decryptData(encryptedData: { encrypted: number[], iv: number[], salt?: number[] }, masterKey: string): Promise<any> {
    const decoder = new TextDecoder();
    const iv = new Uint8Array(encryptedData.iv);
    const encrypted = new Uint8Array(encryptedData.encrypted);

    let key: CryptoKey;

    if (encryptedData.salt && encryptedData.salt.length > 0) {
        const salt = new Uint8Array(encryptedData.salt);
        key = await deriveKey(masterKey, salt);
    } else {
        key = await getFastKey(masterKey);
    }

    // @ts-ignore Cloudflare WebCrypto types mismatch with standard BufferSource
    const decrypted = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: iv as any }, key, encrypted as any);
    return JSON.parse(decoder.decode(decrypted));
}