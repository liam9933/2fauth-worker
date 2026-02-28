import { createApp } from 'vue'
import { createPinia } from 'pinia'
import { ElMessage } from 'element-plus'
import 'element-plus/dist/index.css'
import { registerSW } from 'virtual:pwa-register'
import 'element-plus/theme-chalk/dark/css-vars.css'
import '@/app/styles/main.css'
import '@/app/styles/dark.css'
import App from '@/app/app.vue'
import router from '@/app/router'
import { useThemeStore } from '@/shared/stores/themeStore'
import { VueQueryPlugin } from '@tanstack/vue-query'
import { useVaultStore } from '@/features/vault/store/vaultStore'

const app = createApp(App)
const pinia = createPinia()

app.use(pinia)

// 初始化主题状态
const themeStore = useThemeStore()
themeStore.initTheme()

// PWA Service Worker 注册
registerSW({
  onOfflineReady() {
    ElMessage.success({
      message: '应用已缓存，支持离线访问',
      duration: 3000
    })
  },
})

app.use(router)
app.use(VueQueryPlugin, {
  queryClientConfig: {
    defaultOptions: {
      queries: {
        retry: 1,
        refetchOnWindowFocus: false, // 避免切换窗口时频繁请求列表
        staleTime: 1000 * 60 * 5 // 5分钟内数据视为新鲜，不自动重发请求
      }
    }
  }
})

const vaultStore = useVaultStore()
vaultStore.init().then(() => {
  app.mount('#app')
})