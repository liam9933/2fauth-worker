<template>
  <div class="data-import-wrapper">
    <div class="tab-card-wrapper">
      <div style="text-align: center; margin-bottom: 30px;">
        <h2>数据导入</h2>
        <p style="color: var(--el-text-color-secondary);">支持从各类 2FA 软件或本系统的备份文件中恢复数据。</p>
      </div>

      <div style="max-width: 600px; margin: 0 auto;" v-loading="isImporting && !showDecryptDialog" :element-loading-text="loadingText">
        <div class="import-options">
          <el-button size="large" plain @click="triggerImport('encrypted', '.json')">🔒 本系统加密备份 (.json)</el-button>
          <el-button size="large" plain @click="triggerImport('json', '.json')">📄 标准 JSON / 2FAuth (.json)</el-button>
          <el-button size="large" plain @click="triggerImport('2fas', '.2fas,.json')">📱 2FAS 备份 (.2fas)</el-button>
          <el-button size="large" plain @click="triggerImport('text', '.txt')">📝 OTPAuth 纯文本格式 (.txt)</el-button>
        </div>
        <input type="file" ref="fileInputRef" :accept="acceptType" style="display: none" @change="handleFileUpload" />
      </div>
    </div>

    <el-dialog v-model="showDecryptDialog" title="🔓 解密备份文件" width="400px" destroy-on-close>
      <el-alert title="检测到加密文件" type="success" :closable="false" style="margin-bottom: 15px;" />
      <el-form label-position="top" v-loading="isImporting" :element-loading-text="loadingText">
        <el-form-item label="请输入该备份的解密密码：">
          <el-input v-model="importPassword" type="password" show-password placeholder="输入当时设置的导出密码" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="showDecryptDialog = false">取消</el-button>
        <el-button type="primary" :loading="isImporting" @click="submitImportData">确认解密并导入</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref } from 'vue'
import { ElMessage } from 'element-plus'
import { migrationService } from '@/features/backup/service/migrationService'

const emit = defineEmits(['success'])

const fileInputRef = ref(null)
const acceptType = ref('.json')
const currentImportType = ref('')
const currentFileContent = ref('')
const showDecryptDialog = ref(false)
const importPassword = ref('')
const isImporting = ref(false)
const loadingText = ref('')

const triggerImport = (type, accept) => {
  currentImportType.value = type
  acceptType.value = accept
  setTimeout(() => fileInputRef.value.click(), 0)
}

const handleFileUpload = (e) => {
  const file = e.target.files[0]
  if (!file) return
  if (file.size > 10 * 1024 * 1024) {
    ElMessage.error('文件太大，不能超过 10MB')
    e.target.value = ''
    return
  }
  const reader = new FileReader()
  reader.onload = (event) => {
    currentFileContent.value = event.target.result
    if (currentImportType.value === 'encrypted') {
      importPassword.value = ''
      showDecryptDialog.value = true
    } else {
      submitImportData()
    }
  }
  reader.onerror = () => ElMessage.error('文件读取失败')
  reader.readAsText(file)
  e.target.value = ''
}

const submitImportData = async () => {
  if (currentImportType.value === 'encrypted' && !importPassword.value) {
    return ElMessage.warning('请输入解密密码')
  }
  
  isImporting.value = true
  try {
    // 1. 前端解析/解密
    loadingText.value = currentImportType.value === 'encrypted' ? '正在使用 AES-GCM 解密数据...' : '正在解析数据...'
    const vault = await migrationService.parseImportData(
      currentFileContent.value,
      currentImportType.value,
      importPassword.value
    )

    // 2. 发送给后端保存
    loadingText.value = `正在保存 ${vault.length} 个账号...`
    const data = await migrationService.saveImportedVault(vault)

    if (data.success) {
      showDecryptDialog.value = false
      if (data.count > 0) {
        let msg = `✅ 成功导入 ${data.count} 个账户！`
        if (data.duplicates > 0) msg += ` (自动跳过了 ${data.duplicates} 个重复账户)`
        ElMessage.success({ message: msg, duration: 5000 })
        emit('success') // 有实际导入才切换到账号列表
      } else {
        // 0 条：留在导入页，给出明确提示
        const reason = data.total > 0 ? `文件中 ${data.total} 个账户均已存在，无需重复导入` : '未能从文件中解析到有效账户，请检查文件格式'
        ElMessage.warning({ message: `⚠️ 导入完成，${reason}`, duration: 6000 })
      }
    }
  } catch (error) {
    console.error(error)
    ElMessage.error(error.message || '导入失败')
  } finally { isImporting.value = false }
}
</script>