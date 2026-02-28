<template>
  <div class="vault-unlock-container">
    <el-card class="unlock-card" shadow="hover">
      <div class="icon-wrapper">
        <el-icon :size="48" color="#409EFF"><Lock /></el-icon>
      </div>
      
      <h2 class="title">{{ vaultStore.hasVault ? '解锁本地缓存' : '设置缓存密码' }}</h2>
      <p class="subtitle" style="margin-bottom: 10px;">
        {{ vaultStore.hasVault 
          ? '请输入您的缓存密码以加载本地离线数据' 
          : '设置一个密码用于将 2FA 数据安全地缓存在本机' 
        }}
      </p>

      <div class="form-container">
        <el-input
          v-model="password"
          type="password"
          show-password
          placeholder="请输入密码"
          @keyup.enter="handleSubmit"
          :prefix-icon="Key"
          size="large"
        />
        
        <div v-if="!vaultStore.hasVault" style="margin-top: 15px;">
          <el-input
            v-model="confirmPassword"
            type="password"
            show-password
            placeholder="再次确认密码"
            @keyup.enter="handleSubmit"
            :prefix-icon="Key"
            size="large"
          />
        </div>

        <div v-if="!vaultStore.hasVault" style="margin-top: 15px; text-align: left;">
          <el-alert
            title="缓存密码用途说明"
            type="info"
            :closable="false"
            show-icon
          >
            <p style="margin: 5px 0 0 0; line-height: 1.5; font-size: 13px;">
              此密码仅用于将 2FA 数据强加密保存到您的浏览器本地缓存中，防止<span style="color: var(--el-color-primary); font-weight: bold;">离线使用</span>时的明文泄露。<br/>
              即使您意外遗忘了它，也可以随时<span style="color: var(--el-color-success); font-weight: bold;">清除并重置</span>，重新登录即可从云端恢复您的全部 2FA 数据。
            </p>
          </el-alert>
        </div>

        <div v-if="errorMsg" class="error-msg">
          {{ errorMsg }}
        </div>

        <el-button 
          type="primary" 
          size="large" 
          class="submit-btn" 
          :loading="loading" 
          @click="handleSubmit"
        >
          {{ vaultStore.hasVault ? '验证并进入' : '开启缓存保护' }}
        </el-button>
        
        <div v-if="vaultStore.hasVault" class="reset-link">
          <el-button link type="info" size="small" @click="handleResetPrompt">忘记密码？清除本地离线缓存</el-button>
        </div>
      </div>
    </el-card>
  </div>
</template>

<script setup>
import { ref, onMounted, h } from 'vue'
import { Lock, Key } from '@element-plus/icons-vue'
import { useVaultStore } from '@/features/vault/store/vaultStore'
import { ElMessage, ElMessageBox } from 'element-plus'

const vaultStore = useVaultStore()

const emit = defineEmits(['unlocked'])

const password = ref('')
const confirmPassword = ref('')
const loading = ref(false)
const errorMsg = ref('')

onMounted(() => {
  vaultStore.init()
})

const handleSubmit = async () => {
  if (!password.value) {
    errorMsg.value = '密码不能为空'
    return
  }

  loading.value = true
  errorMsg.value = ''

  try {
    if (vaultStore.hasVault) {
      // 解锁模式
      await vaultStore.unlock(password.value)
      ElMessage.success('解锁成功')
      emit('unlocked')
    } else {
      // 创建模式
      if (password.value.length < 6) {
        throw new Error('密码长度至少需要 6 位')
      }
      if (password.value !== confirmPassword.value) {
        throw new Error('两次输入的密码不一致')
      }
      await vaultStore.setup(password.value)
      ElMessage.success('保险箱创建成功')
      emit('unlocked')
    }
  } catch (e) {
    errorMsg.value = e.message
    // 震动反馈 (如果支持)
    if (navigator.vibrate) navigator.vibrate(200)
  } finally {
    loading.value = false
  }
}

const handleResetPrompt = async () => {
  try {
    await ElMessageBox.confirm(
      h('div', null, [
        h('p', { style: 'margin-bottom: 10px; font-weight: 500;' }, '密码找不到了？没关系！'),
        h('p', { style: 'font-size: 13px; color: var(--el-text-color-secondary); line-height: 1.6;' }, 
          '点击下方按钮，系统将为您强制清理当前浏览器的本地加密缓存。清理完成后，您只需像初次访问一样，重新设置一个新的缓存密码即可。您的云端原始数据不会受到任何影响。'
        )
      ]),
      '清除缓存锁',
      {
        confirmButtonText: '确定清除',
        cancelButtonText: '点错了，返回',
        type: 'warning',
        center: true
      }
    )
    
    // User confirmed
    localStorage.removeItem('secure_vault')
    vaultStore.init()
    password.value = ''
    confirmPassword.value = ''
    errorMsg.value = ''
    ElMessage.success('本地缓存已完全清除，请重新设置密码')
  } catch (err) {
    if (err !== 'cancel') console.error(err)
  }
}
</script>