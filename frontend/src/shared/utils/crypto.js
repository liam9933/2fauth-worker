// frontend/src/utils/crypto-vault.js

// 配置常量
const PBKDF2_ITERATIONS = 100000;
const SALT_LENGTH = 16;
const IV_LENGTH = 12; // AES-GCM 推荐 12 字节
const ALGORITHM = 'AES-GCM';
const HASH = 'SHA-256';

/**
 * 将文本密码转换为加密密钥 (PBKDF2)
 * @param {string} password - 用户输入的 PIN 码或密码
 * @param {Uint8Array} salt - 盐值
 * @returns {Promise<CryptoKey>}
 */
async function importKeyFromPassword(password, salt) {
  const enc = new TextEncoder();
  const keyMaterial = await window.crypto.subtle.importKey(
    'raw',
    enc.encode(password),
    { name: 'PBKDF2' },
    false,
    ['deriveKey']
  );

  return window.crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt: salt,
      iterations: PBKDF2_ITERATIONS,
      hash: HASH
    },
    keyMaterial,
    { name: ALGORITHM, length: 256 },
    false,
    ['encrypt', 'decrypt']
  );
}

/**
 * 加密数据
 * @param {Object} data - 要加密的 JSON 对象
 * @param {string} password - 密码
 * @returns {Promise<string>} - 返回 base64 编码的加密字符串 (包含 salt + iv + ciphertext)
 */
export async function encryptDataWithPassword(data, password) {
  const salt = window.crypto.getRandomValues(new Uint8Array(SALT_LENGTH));
  const iv = window.crypto.getRandomValues(new Uint8Array(IV_LENGTH));

  const key = await importKeyFromPassword(password, salt);
  const enc = new TextEncoder();
  const encodedData = enc.encode(JSON.stringify(data));

  const ciphertext = await window.crypto.subtle.encrypt(
    { name: ALGORITHM, iv: iv },
    key,
    encodedData
  );

  // 打包格式: salt + iv + ciphertext
  const combined = new Uint8Array(salt.length + iv.length + ciphertext.byteLength);
  combined.set(salt, 0);
  combined.set(iv, salt.length);
  combined.set(new Uint8Array(ciphertext), salt.length + iv.length);

  return arrayBufferToBase64(combined);
}

/**
 * 解密数据
 * @param {string} encryptedBase64 - base64 编码的加密字符串
 * @param {string} password - 密码
 * @returns {Promise<Object>} - 解密后的 JSON 对象
 */
export async function decryptDataWithPassword(encryptedBase64, password) {
  try {
    const combined = base64ToArrayBuffer(encryptedBase64);

    // 提取 salt, iv, ciphertext
    const salt = combined.slice(0, SALT_LENGTH);
    const iv = combined.slice(SALT_LENGTH, SALT_LENGTH + IV_LENGTH);
    const ciphertext = combined.slice(SALT_LENGTH + IV_LENGTH);

    const key = await importKeyFromPassword(password, salt);

    const decrypted = await window.crypto.subtle.decrypt(
      { name: ALGORITHM, iv: iv },
      key,
      ciphertext
    );

    const dec = new TextDecoder();
    return JSON.parse(dec.decode(decrypted));
  } catch (e) {
    console.error('Decryption failed:', e);
    throw new Error('密码错误或数据损坏');
  }
}

// --- 辅助函数 ---

function arrayBufferToBase64(buffer) {
  let binary = '';
  const bytes = new Uint8Array(buffer);
  const len = bytes.byteLength;
  for (let i = 0; i < len; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return window.btoa(binary);
}

function base64ToArrayBuffer(base64) {
  const binary_string = window.atob(base64);
  const len = binary_string.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binary_string.charCodeAt(i);
  }
  return bytes;
}