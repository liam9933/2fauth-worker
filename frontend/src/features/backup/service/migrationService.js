import { request } from '@/shared/utils/request'
import { encryptDataWithPassword, decryptDataWithPassword } from '@/shared/utils/crypto' // 现在已指向标准实现
import { parseOtpUri } from '@/shared/utils/totp'

export const migrationService = {
  // 1. 获取所有数据 (用于导出)
  async fetchAllVault() {
    // 请求后端获取所有数据 (limit=9999)
    const res = await request('/api/vault?limit=9999')
    if (!res.success) throw new Error('无法获取账号数据')
    return res.vault || []
  },

  // 2. 处理导出逻辑 (前端加密/格式化)
  async exportData(vault, type, password) {
    const timestamp = new Date().toISOString()
    const baseData = { version: "2.0", app: "2fauth", timestamp }

    // 格式 A: 本系统加密备份 (使用 crypto-vault AES-GCM)
    if (type === 'encrypted') {
      if (!password) throw new Error('加密导出需要密码')
      const payload = { ...baseData, accounts: vault }
      const encryptedData = await encryptDataWithPassword(payload, password)
      return JSON.stringify({
        ...baseData,
        encrypted: true,
        data: encryptedData,
        note: "This file is encrypted with your export password (AES-GCM-256 + PBKDF2)."
      }, null, 2)
    }

    // 格式 B: 标准 JSON
    if (type === 'json') {
      return JSON.stringify({ ...baseData, encrypted: false, accounts: vault }, null, 2)
    }

    // 格式 C: 2FAS 兼容格式 (schemaVersion 4 标准)
    if (type === '2fas') {
      const services = vault.map(acc => ({
        name: acc.service,
        secret: acc.secret,
        otp: {
          tokenType: 'TOTP',
          issuer: acc.service,
          account: acc.account,
          digits: acc.digits,
          period: acc.period,
          algorithm: (acc.algorithm || 'SHA1').replace('SHA-', 'SHA'),
          counter: 0,
        },
        order: { position: 0 },
      }))
      return JSON.stringify({ schemaVersion: 4, appOrigin: 'export', services }, null, 2)
    }

    // 格式 D: OTPAuth 纯文本格式 
    if (type === 'text') {
      return vault.map(acc => {
        const label = encodeURIComponent(`${acc.service}:${acc.account}`)
        const issuer = encodeURIComponent(acc.service)
        return `otpauth://totp/${label}?secret=${acc.secret}&issuer=${issuer}&digits=${acc.digits}&period=${acc.period}`
      }).join('\n')
    }

    throw new Error('未知的导出类型')
  },

  // 3. 处理导入逻辑 (前端解密/解析)
  async parseImportData(content, type, password) {
    let rawVault = []

    // 场景 A: 加密备份
    if (type === 'encrypted') {
      if (!password) throw new Error('导入加密文件需要密码')
      try {
        let ciphertext = content
        const json = typeof content === 'string' ? tryParseJSON(content) : content
        if (json && typeof json === 'object' && json.data) {
          ciphertext = json.data
        }
        const input = typeof ciphertext === 'object' ? JSON.stringify(ciphertext) : ciphertext
        const decrypted = await decryptDataWithPassword(input, password)
        rawVault = decrypted.vault || decrypted.accounts || []
      } catch (e) {
        console.error(e)
        throw new Error('解密失败：密码错误或文件格式不兼容')
      }
    }
    // 场景 B: 标准 JSON / 2FAuth
    else if (type === 'json') {
      const json = typeof content === 'string' ? JSON.parse(content) : content
      // 本项目导出格式: data.accounts[] 或 data.vault[]
      if (Array.isArray(json.accounts)) {
        rawVault = json.accounts
      } else if (Array.isArray(json.vault)) {
        rawVault = json.vault
        // 旧导出格式: data.data[]
      } else if (Array.isArray(json.data)) {
        rawVault = json.data
        // 标准第三方格式: data.secrets[] (issuer + algorithm 字段)
      } else if (Array.isArray(json.secrets)) {
        rawVault = json.secrets.map(s => ({
          service: s.issuer || s.service || s.name || 'Unknown',
          account: s.account || s.label || '',
          secret: s.secret || '',
          algorithm: s.algorithm || 'SHA1',
          digits: s.digits || 6,
          period: s.period || 30,
        }))
        // 简单数组
      } else if (Array.isArray(json)) {
        rawVault = json
        // 误选 JSON 但实际是 2FAS 格式
      } else if (json.services) {
        rawVault = json.services.map(s => ({
          service: s.otp?.issuer || s.name || 'Unknown',
          account: s.otp?.account || s.account || s.username || '',
          secret: s.secret || '',
          algorithm: s.otp?.algorithm || s.algorithm || 'SHA1',
          digits: s.otp?.digits || s.digits || 6,
          period: s.otp?.period || s.period || 30,
        }))
      }
    }
    // 场景 C: 2FAS (schemaVersion 4, 字段在 otp 子对象中)
    else if (type === '2fas') {
      const json = typeof content === 'string' ? JSON.parse(content) : content
      if (Array.isArray(json.services)) {
        rawVault = json.services.map(s => ({
          service: s.otp?.issuer || s.name || 'Unknown',
          account: s.otp?.account || s.account || s.username || '',
          secret: s.secret || '',
          algorithm: (s.otp?.algorithm || s.algorithm || 'SHA1').toUpperCase(),
          digits: s.otp?.digits || s.digits || 6,
          period: s.otp?.period || s.period || 30,
        }))
      }
    }
    // 场景 D: OTPAuth 纯文本格式 
    else if (type === 'text') {
      const lines = content.split('\n')
      lines.forEach(line => {
        const acc = parseOtpUri(line.trim())
        if (acc) rawVault.push(acc)
      })
    }

    // 过滤无效数据
    return rawVault.filter(acc => acc && acc.secret && acc.service && acc.account)
  },


  // 4. 批量保存到后端s
  async saveImportedVault(vault) {
    // 调用后端批量导入接口 (需要后端支持接收纯 JSON 数组)
    // 我们将复用 /api/vault/import 接口，但修改其实现以支持 'raw' 类型
    return await request('/api/vault/import', {
      method: 'POST',
      body: JSON.stringify({ type: 'raw', content: JSON.stringify(vault) })
    })
  }
}

// 辅助函数：安全解析 JSON，失败返回 null
function tryParseJSON(str) {
  try {
    return JSON.parse(str)
  } catch (e) {
    return null
  }
}