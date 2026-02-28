import { defineStore } from 'pinia'
import { ref } from 'vue'

export const useLayoutStore = defineStore('layout', () => {
  const isMobile = ref(false)
  const showMobileMenu = ref(false)

  return {
    isMobile,
    showMobileMenu
  }
})