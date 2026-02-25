import { reactive } from 'vue'
import { request } from '../utils/request'

const getStoredUser = () => {
  try {
    return JSON.parse(localStorage.getItem('userInfo') || '{}')
  } catch (e) {
    return {}
  }
}

export const userState = reactive({
  userInfo: getStoredUser(),

  setUserInfo(info) {
    this.userInfo = info
    localStorage.setItem('userInfo', JSON.stringify(info))
  },

  clearUserInfo() {
    this.userInfo = {}
    localStorage.removeItem('userInfo')
  },

  async logout() {
    try {
      // 请求后端清除 HttpOnly Cookie
      await request('/api/oauth/logout', { method: 'POST' })
    } catch (e) {
      console.error('Logout request failed', e)
    } finally {
      // 无论后端是否成功，前端都必须清理状态并跳转
      this.clearUserInfo()
    }
  },

  async fetchUserInfo() {
    try {
      // 使用 silent: true 避免未登录时弹出 "Unauthorized" 错误提示
      const data = await request('/api/oauth/me', { silent: true })
      if (data.success) {
        this.setUserInfo(data.userInfo)
        return true
      }
    } catch (e) {
      this.clearUserInfo()
      return false
    }
  }
})