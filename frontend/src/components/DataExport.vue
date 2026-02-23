<template>
  <div class="data-export-wrapper">
    <div class="tab-card-wrapper">
      <div style="text-align: center; margin-bottom: 30px;">
        <h2>数据导出</h2>
        <p style="color: #909399;">将当前金库中的所有账号打包，并使用您设置的密码进行 AES-GCM 强加密。</p>
      </div>

      <div style="max-width: 500px; margin: 0 auto;">
        <el-alert title="🛡️ 极密保护" type="warning" description="为保护您的资产，所有导出数据必须强制加密！" show-icon :closable="false" style="margin-bottom: 20px;" />
        
        <div style="text-align: center; margin-top: 40px;">
          <el-button type="warning" size="large" style="width: 100%;" @click="showExportDialog = true">
            <el-icon><Lock /></el-icon> 设置密码并导出
          </el-button>
        </div>
      </div>
    </div>

    <el-dialog v-model="showExportDialog" title="设置导出密码" width="400px" destroy-on-close>
      <el-form :model="exportForm" label-position="top" v-loading="isExporting" :element-loading-text="loadingText">
        <el-form-item label="加密密码 (至少 12 位)">
          <el-input v-model="exportForm.password" type="password" show-password placeholder="请输入高强度密码" />
        </el-form-item>
        <el-form-item label="确认密码">
          <el-input v-model="exportForm.confirm" type="password" show-password placeholder="请再次输入" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="showExportDialog = false">取消</el-button>
        <el-button type="warning" :loading="isExporting" @click="handleExport">开始加密并下载</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref } from 'vue'
import { ElMessage } from 'element-plus'
import { Lock } from '@element-plus/icons-vue'
import { request } from '../utils/request'

const showExportDialog = ref(false)
const isExporting = ref(false)
const exportForm = ref({ password: '', confirm: '' })
const loadingText = ref('')

const handleExport = async () => {
  if (exportForm.value.password !== exportForm.value.confirm) {
    return ElMessage.error('两次输入的密码不一致！')
  }
  if (exportForm.value.password.length < 12) {
    return ElMessage.error('密码太弱！至少需要 12 个字符。')
  }

  loadingText.value = '正在进行高强度 AES-GCM 加密...'
  isExporting.value = true
  try {
    const data = await request('/api/accounts/export-secure', {
      method: 'POST',
      body: JSON.stringify({ password: exportForm.value.password })
    })
    
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `2fa-backup-encrypted-${new Date().toISOString().split('T')[0]}.json`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)

    ElMessage.success('🎉 加密备份导出成功！请妥善保管好您的密码！')
    showExportDialog.value = false
    exportForm.value = { password: '', confirm: '' }
  } catch (error) {} finally { isExporting.value = false }
}
</script>

<style scoped>
.tab-card-wrapper {
  background: white;
  padding: 40px;
  border-radius: 12px;
  box-shadow: 0 2px 12px 0 rgba(0, 0, 0, 0.05);
  min-height: 400px;
}
</style>