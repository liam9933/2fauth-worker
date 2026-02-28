import { defineStore } from 'pinia'
import { ref } from 'vue'
import { encryptDataWithPassword, decryptDataWithPassword } from '@/shared/utils/crypto'

export const useVaultStore = defineStore('vault', () => {
  const isUnlocked = ref(false)
  const hasVault = ref(false)
  const isDirty = ref(false) // 标记缓存是否已因变更操作而过期
  const _password = ref(null) // 仅保存在内存中，刷新页面即丢失

  // 初始化检查：判断本地是否有加密数据，并尝试恢复会话
  const init = async () => {
    const encrypted = localStorage.getItem('secure_vault')
    hasVault.value = !!encrypted
    if (!hasVault.value) return

    // 模式 A: 尝试从 sessionStorage 恢复会话级解锁状态
    const sessionPassword = sessionStorage.getItem('vault_session_key')
    if (sessionPassword) {
      try {
        // 验证密码是否仍然有效
        await decryptDataWithPassword(encrypted, sessionPassword)
        // 验证通过，自动解锁
        _password.value = sessionPassword
        isUnlocked.value = true
      } catch (e) {
        // 密码无效，清除会话并锁定
        lock()
      }
    }
  }

  // 解锁保险箱
  const unlock = async (password) => {
    const encrypted = localStorage.getItem('secure_vault')
    if (!encrypted) throw new Error('尚未创建保险箱')

    try {
      await decryptDataWithPassword(encrypted, password)

      _password.value = password
      isUnlocked.value = true
      sessionStorage.setItem('vault_session_key', password)
      return true
    } catch (e) {
      throw new Error('密码错误')
    }
  }

  // 创建/重置保险箱
  const setup = async (password, initialData = { vault: [] }) => {
    const encrypted = await encryptDataWithPassword(initialData, password)
    localStorage.setItem('secure_vault', encrypted)
    _password.value = password
    hasVault.value = true
    isUnlocked.value = true
    sessionStorage.setItem('vault_session_key', password)
  }

  // 锁定保险箱
  const lock = () => {
    _password.value = null
    isUnlocked.value = false
    sessionStorage.removeItem('vault_session_key')
  }

  // 获取数据 (使用内存密码解密)
  const getData = async () => {
    if (!isUnlocked.value || !_password.value) return null
    const encrypted = localStorage.getItem('secure_vault')
    if (!encrypted) return { vault: [] }
    return await decryptDataWithPassword(encrypted, _password.value)
  }

  // 保存数据 (使用内存密码加密)
  const saveData = async (data) => {
    if (!isUnlocked.value || !_password.value) throw new Error('保险箱已锁定')
    const encrypted = await encryptDataWithPassword(data, _password.value)
    localStorage.setItem('secure_vault', encrypted)
  }

  // --- 备份云配置的专属加密缓存 ---
  const getEncryptedBackupProviders = async () => {
    if (!isUnlocked.value || !_password.value) return null
    const encrypted = localStorage.getItem('backup_providers_cache')
    if (!encrypted) return null
    try {
      const decrypted = await decryptDataWithPassword(encrypted, _password.value)
      return decrypted.providers || null
    } catch (e) {
      return null
    }
  }

  const saveEncryptedBackupProviders = async (providers) => {
    if (!isUnlocked.value || !_password.value) return
    const encrypted = await encryptDataWithPassword({ providers }, _password.value)
    localStorage.setItem('backup_providers_cache', encrypted)
  }

  return {
    isUnlocked,
    hasVault,
    isDirty,
    init,
    unlock,
    setup,
    lock,
    getData,
    markDirty: () => { isDirty.value = true },
    clearDirty: () => { isDirty.value = false },
    saveData,
    getEncryptedBackupProviders,
    saveEncryptedBackupProviders
  }
})