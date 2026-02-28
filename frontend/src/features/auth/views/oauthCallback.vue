<template>
  <div class="callback-container">
    <el-card class="loading-card" shadow="hover">
      <el-result
        v-if="!errorMsg"
        icon="info"
        title="正在安全登录中"
        :sub-title="`请稍候，系统正在与 ${providerName} 交换安全凭证...`"
      >
        <template #extra>
          <el-icon class="is-loading" :size="40" color="#409eff"><Loading /></el-icon>
        </template>
      </el-result>

      <el-result
        v-else
        icon="error"
        title="授权失败"
        :sub-title="errorMsg"
      >
        <template #extra>
          <el-button type="primary" @click="goBackToLogin">返回登录页</el-button>
        </template>
      </el-result>
    </el-card>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { Loading } from '@element-plus/icons-vue'
import { useUserStore } from '@/features/auth/store/userStore'
import { setIdbItem } from '@/shared/utils/idb'

const route = useRoute()
const router = useRouter()
const errorMsg = ref('')
const providerName = ref('身份提供商')

onMounted(async () => {
  const code = route.query.code
  const state = route.query.state
  const error = route.query.error
  const hash = route.query.hash // Telegram 特有参数
  
  // 1. 智能识别 Provider
  // 优先使用路由参数 (如 /callback/telegram)，其次检测 Telegram 特征，最后使用缓存
  let providerId = route.params.provider
  if (!providerId) {
    if (hash) providerId = 'telegram'
    else providerId = localStorage.getItem('oauth_provider') || 'github'
  }
  
  // 优化：优先从缓存读取提供商名称，避免不必要的网络请求
  try {
    const cached = localStorage.getItem('oauth_providers_cache')
    if (cached) {
      const providers = JSON.parse(cached)
      const p = providers.find(x => x.id === providerId)
      if (p) providerName.value = p.name
    } else {
      const res = await fetch('/api/oauth/providers')
      const data = await res.json()
      const p = data.providers?.find(x => x.id === providerId)
      if (p) providerName.value = p.name
    }
  } catch (e) {}

  if (error) {
    errorMsg.value = route.query.error_description || `您拒绝了 ${providerName.value} 的授权请求`
    return
  }

  // 2. 参数校验 (区分 Telegram 和标准 OAuth)
  let payload = {}
  
  if (providerId === 'telegram') {
    if (!hash) {
      errorMsg.value = 'Telegram 登录缺少签名参数'
      return
    }
    // Telegram 默认不原样返回 state 参数，因此我们从前端缓存中将其补齐发送给后端校验
    const savedState = localStorage.getItem('oauth_state')
    payload = { ...route.query, state: savedState }
  } else {
    if (!code || !state) {
      errorMsg.value = 'URL 缺少必要的授权凭证参数'
      return
    }

    // 🛡️ 前端 State 校验：防止 CSRF 攻击
    const savedState = localStorage.getItem('oauth_state')
    if (!savedState || savedState !== state) {
      errorMsg.value = '安全警告：State 校验失败，请求可能被篡改'
      return
    }
    
    const codeVerifier = localStorage.getItem('oauth_code_verifier')
    payload = { code, state, codeVerifier }
  }

  localStorage.removeItem('oauth_state') // 校验通过后立即清除，防止重放
  localStorage.removeItem('oauth_provider')
  localStorage.removeItem('oauth_code_verifier')

  try {
    // 记录开始时间，确保加载动画至少展示一段时间
    const startTime = Date.now()
    // 只有 Telegram 才强制等待 1.5s，其他方式保持原速
    const MIN_DISPLAY_TIME = providerId === 'telegram' ? 1500 : 0

    // 关键步骤：把 code 发给后端换取我们自己的 JWT
    const response = await fetch(`/api/oauth/callback/${providerId}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    })

    const data = await response.json()

    // 计算耗时，如果过快则强制等待，优化用户体验
    const elapsed = Date.now() - startTime
    if (elapsed < MIN_DISPLAY_TIME) {
      await new Promise(resolve => setTimeout(resolve, MIN_DISPLAY_TIME - elapsed))
    }

    if (data.success) {
      // 登录成功！Token 已写入 httpOnly Cookie
      // 持久化客户端参数
      if (data.deviceKey) {
        await setIdbItem('device_salt', data.deviceKey)
      }

      // 立即调用接口确认会话有效性，并更新用户信息
      const userStore = useUserStore()
      await userStore.fetchUserInfo()
      
      // 一把推开大门，进入主界面
      router.push('/')
    } else {
      errorMsg.value = data.error || '登录验证被后端拒绝'
    }
  } catch (err) {
    console.error('OAuth Callback Error:', err)
    errorMsg.value = '网络请求异常，请稍后再试'
  }
})

const goBackToLogin = () => {
  router.push('/login')
}
</script>