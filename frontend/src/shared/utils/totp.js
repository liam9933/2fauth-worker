// Base32 字母表
const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567'

// --- 编码 / 解码工具 ---

export function base32ToBytes(str) {
  let bits = 0
  let value = 0
  let index = 0
  const cleaned = str.toUpperCase().replace(/=+$/, '').replace(/[^A-Z2-7]/g, '')
  const buffer = new Uint8Array(Math.ceil(cleaned.length * 5 / 8))
  
  for (let i = 0; i < cleaned.length; i++) {
    const val = ALPHABET.indexOf(cleaned[i])
    if (val === -1) continue
    value = (value << 5) | val
    bits += 5
    if (bits >= 8) {
      buffer[index++] = (value >>> (bits - 8)) & 0xFF
      bits -= 8
    }
  }
  return buffer.slice(0, index)
}

export function bytesToBase32(buffer) {
  let bits = 0
  let value = 0
  let output = ''
  const bytes = new Uint8Array(buffer)
  
  for (let i = 0; i < bytes.length; i++) {
    value = (value << 8) | bytes[i]
    bits += 8
    while (bits >= 5) {
      output += ALPHABET[(value >>> (bits - 5)) & 31]
      bits -= 5
    }
  }
  if (bits > 0) {
    output += ALPHABET[(value << (5 - bits)) & 31]
  }
  return output
}

export function hexToBytes(hex) {
  const cleaned = hex.replace(/[^0-9a-fA-F]/g, '')
  if (cleaned.length % 2 !== 0) return new Uint8Array(0)
  const bytes = new Uint8Array(cleaned.length / 2)
  for (let i = 0; i < cleaned.length; i += 2) {
    bytes[i / 2] = parseInt(cleaned.substr(i, 2), 16)
  }
  return bytes
}

export function bytesToHex(buffer) {
  return Array.from(new Uint8Array(buffer))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('')
}

export function asciiToBytes(str) {
  const buffer = new Uint8Array(str.length)
  for (let i = 0; i < str.length; i++) {
    buffer[i] = str.charCodeAt(i)
  }
  return buffer
}

export function bytesToAscii(buffer) {
  return String.fromCharCode.apply(null, new Uint8Array(buffer))
}

// --- TOTP 计算核心 ---

export async function generateTOTP(secret, period = 30, digits = 6, algorithm = 'SHA-1', offset = 0) {
  if (!secret) return '------'
  try {
    const keyBytes = base32ToBytes(secret)
    if (keyBytes.length === 0) return '------'

    const now = Date.now() / 1000
    const epoch = Math.floor(now / period) + offset
    const timeBuffer = new ArrayBuffer(8)
    const view = new DataView(timeBuffer)
    view.setBigUint64(0, BigInt(epoch), false)

    // Web Crypto API 算法映射
    const cryptoAlgo = { name: 'HMAC', hash: algorithm }
    
    const key = await window.crypto.subtle.importKey(
      'raw', keyBytes, cryptoAlgo, false, ['sign']
    )
    const signature = await window.crypto.subtle.sign('HMAC', key, timeBuffer)
    
    const sigView = new DataView(signature)
    // 动态获取 offset (最后一个字节的低4位)
    const offsetByte = sigView.getUint8(signature.byteLength - 1) & 0xf
    const binary = ((sigView.getUint8(offsetByte) & 0x7f) << 24) |
                   ((sigView.getUint8(offsetByte + 1) & 0xff) << 16) |
                   ((sigView.getUint8(offsetByte + 2) & 0xff) << 8) |
                   (sigView.getUint8(offsetByte + 3) & 0xff)
    
    const otp = binary % Math.pow(10, digits)
    return otp.toString().padStart(digits, '0')
  } catch (e) {
    console.error('TOTP Error', e)
    return 'ERROR'
  }
}

// --- URI 解析 ---

export function parseOtpUri(uri) {
  try {
    const url = new URL(uri)
    if (url.protocol !== 'otpauth:') return null
    
    const params = url.searchParams
    const secret = params.get('secret')
    if (!secret) return null

    const label = decodeURIComponent(url.pathname.replace(/^\//, '').replace(/^totp\//, ''))
    let service = params.get('issuer') || ''
    let account = label

    if (label.includes(':')) {
      const parts = label.split(':')
      if (!service) service = parts[0].trim()
      account = parts[1].trim()
    }

    return {
      service: service || 'Unknown',
      account: account || 'Unknown',
      secret: secret.replace(/\s/g, '').toUpperCase(),
      digits: parseInt(params.get('digits') || '6', 10),
      period: parseInt(params.get('period') || '30', 10),
      algorithm: (params.get('algorithm') || 'SHA1').toUpperCase().replace('SHA1', 'SHA-1').replace('SHA256', 'SHA-256').replace('SHA512', 'SHA-512'),
      category: ''
    }
  } catch (e) {
    return null
  }
}