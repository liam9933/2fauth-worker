import { defineStore } from 'pinia'
import { ref } from 'vue'

export const useLayoutStore = defineStore('layout', () => {
  const isMobile = ref(false)
  const showMobileMenu = ref(false)
  const homeTabReset = ref(0) // 触发返回统一的主账号视图

  return {
    isMobile,
    showMobileMenu,
    homeTabReset
  }
})