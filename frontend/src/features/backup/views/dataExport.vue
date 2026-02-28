<template>
  <div class="data-export-wrapper">
    <div class="tab-card-wrapper">
      <div style="text-align: center; margin-bottom: 30px;">
        <h2>数据导出</h2>
        <p style="color: var(--el-text-color-secondary);">选择您需要的导出格式。请注意，明文导出存在安全风险。</p>
      </div>

      <div style="max-width: 600px; margin: 0 auto;">
        <div class="export-options">
          <el-button size="large" plain @click="openExportDialog('encrypted')">🔒 本系统加密备份 (.json)</el-button>
          <el-button size="large" plain @click="openExportDialog('json')">📄 标准 JSON / 2FAuth (.json)</el-button>
          <el-button size="large" plain @click="openExportDialog('2fas')">📱 2FAS 备份 (.2fas)</el-button>
          <el-button size="large" plain @click="openExportDialog('text')">📝 纯文本 URI (.txt)</el-button>
        </div>
      </div>
    </div>

    <!-- 加密导出密码弹窗 -->
    <el-dialog v-model="showPasswordDialog" title="设置导出密码" width="400px" destroy-on-close>
      <el-form :model="exportForm" label-position="top" v-loading="isExporting" :element-loading-text="loadingText">
        <el-form-item label="加密密码 (至少 12 位)">
          <el-input v-model="exportForm.password" type="password" show-password placeholder="请输入高强度密码" />
        </el-form-item>
        <el-form-item label="确认密码">
          <el-input v-model="exportForm.confirm" type="password" show-password placeholder="请再次输入" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="showPasswordDialog = false">取消</el-button>
        <el-button type="primary" :loading="isExporting" @click="executeExport">开始加密并下载</el-button>
      </template>
    </el-dialog>

    <!-- 明文导出风险提示弹窗 -->
    <el-dialog v-model="showWarningDialog" title="⚠️ 安全警告" width="400px" destroy-on-close>
      <el-alert title="风险提示" type="error" :closable="false" description="您正在导出未加密的明文数据。任何获取该文件的人都可以直接访问您的账号验证码！" show-icon />
      <p style="margin-top: 15px;">确定要继续吗？</p>
      <template #footer>
        <el-button @click="showWarningDialog = false">取消</el-button>
        <el-button type="danger" @click="executeExport" :loading="isExporting">确定导出</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref } from 'vue'
import { ElMessage } from 'element-plus'
import { migrationService } from '@/features/backup/service/migrationService'
import { downloadBlob } from '@/shared/utils/common'

const showPasswordDialog = ref(false)
const showWarningDialog = ref(false)
const isExporting = ref(false)
const exportForm = ref({ password: '', confirm: '' })
const loadingText = ref('')
const currentType = ref('encrypted')

const openExportDialog = (type) => {
  currentType.value = type
  if (type === 'encrypted') {
    exportForm.value = { password: '', confirm: '' }
    showPasswordDialog.value = true
  } else {
    showWarningDialog.value = true
  }
}

const executeExport = async () => {
  const type = currentType.value
  let password = ''
  
  if (type === 'encrypted') {
    if (exportForm.value.password !== exportForm.value.confirm) {
      return ElMessage.error('两次输入的密码不一致！')
    }
    if (exportForm.value.password.length < 12) {
      return ElMessage.error('密码太弱！至少需要 12 个字符。')
    }
    password = exportForm.value.password
  }

  isExporting.value = true
  try {
    // 1. 获取所有账号
    loadingText.value = '正在获取所有账号数据...'
    const vault = await migrationService.fetchAllVault()
    if (!vault || vault.length === 0) {
      throw new Error('没有可导出的账号')
    }

    // 2. 在前端处理数据
    loadingText.value = type === 'encrypted' ? '正在进行高强度 AES-GCM 加密...' : '正在生成导出文件...'
    const fileContent = await migrationService.exportData(vault, type, password)

    // 3. 创建 Blob 并下载
    let filename, mimeType
    const date = new Date().toISOString().split('T')[0]

    if (type === 'text') {
      mimeType = 'text/plain'
      filename = `2fa-export-${date}.txt`
    } else {
      mimeType = 'application/json'
      filename = `2fa-export-${type}-${date}.${type === '2fas' ? '2fas' : 'json'}`
    }

    downloadBlob(fileContent, filename, mimeType)

    ElMessage.success('导出成功！')
    showPasswordDialog.value = false
    showWarningDialog.value = false
  } catch (error) {
    console.error('Export failed:', error)
    ElMessage.error(error.message || '导出失败，请稍后重试')
  } finally { isExporting.value = false }
}
</script>
