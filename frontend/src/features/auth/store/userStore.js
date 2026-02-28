import { defineStore } from 'pinia'
import { ref } from 'vue'
import { request } from '@/shared/utils/request'
import { useVaultStore } from '@/features/vault/store/vaultStore'

export const useUserStore = defineStore('user', () => {
  const getStoredUser = () => {
    try {
      return JSON.parse(localStorage.getItem('userInfo') || '{}')
    } catch (e) {
      return {}
    }
  }

  const userInfo = ref(getStoredUser())

  const setUserInfo = (info) => {
    userInfo.value = info
    localStorage.setItem('userInfo', JSON.stringify(info))
  }

  const clearUserInfo = () => {
    userInfo.value = {}
    localStorage.removeItem('userInfo')
    localStorage.removeItem('secure_vault')
    localStorage.removeItem('backup_providers_cache')

    // 锁定保险箱
    const vaultStore = useVaultStore()
    vaultStore.lock()
  }

  const logout = async () => {
    try {
      await request('/api/oauth/logout', { method: 'POST' })
    } catch (e) {
      console.error('Logout request failed', e)
    } finally {
      clearUserInfo()
    }
  }

  const fetchUserInfo = async () => {
    try {
      const data = await request(`/api/oauth/me?_t=${Date.now()}`, { silent: true })
      if (data.success) {
        setUserInfo(data.userInfo)
        return true
      }
    } catch (e) {
      clearUserInfo()
      return false
    }
    return false
  }

  return {
    userInfo,
    setUserInfo,
    clearUserInfo,
    logout,
    fetchUserInfo
  }
})