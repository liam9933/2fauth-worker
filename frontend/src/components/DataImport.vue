<template>
  <div class="data-import-wrapper">
    <div class="tab-card-wrapper">
      <div style="text-align: center; margin-bottom: 30px;">
        <h2>数据导入</h2>
        <p style="color: #909399;">支持从各类 2FA 软件或本系统的备份文件中恢复数据。</p>
      </div>

      <div style="max-width: 600px; margin: 0 auto;" v-loading="isImporting && !showDecryptDialog" :element-loading-text="loadingText">
        <div class="import-options">
          <el-button size="large" plain @click="triggerImport('encrypted', '.json')">🔒 本系统加密备份 (.json)</el-button>
          <el-button size="large" plain @click="triggerImport('json', '.json')">📄 标准 JSON / 2FAuth (.json)</el-button>
          <el-button size="large" plain @click="triggerImport('2fas', '.2fas,.json')">📱 2FAS 备份 (.2fas)</el-button>
          <el-button size="large" plain @click="triggerImport('text', '.txt')">📝 纯文本 URI (.txt)</el-button>
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
import { request } from '../utils/request'

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
  loadingText.value = currentImportType.value === 'encrypted' ? '正在解密并导入数据...' : '正在导入数据...'
  isImporting.value = true
  try {
    const data = await request('/api/accounts/import', {
      method: 'POST',
      body: JSON.stringify({
        type: currentImportType.value,
        content: currentFileContent.value,
        password: importPassword.value
      })
    })
    if (data.success) {
      let msg = `✅ 成功导入 ${data.count} 个账户！`
      if (data.duplicates > 0) msg += ` (自动跳过了 ${data.duplicates} 个重复账户)`
      ElMessage.success({ message: msg, duration: 5000 })
      showDecryptDialog.value = false
      emit('success')
    }
  } catch (error) {} finally { isImporting.value = false }
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
.import-options { display: grid; grid-template-columns: 1fr 1fr; gap: 15px; margin-top: 20px; }
.import-options .el-button { margin: 0; justify-content: flex-start; padding-left: 20px; height: auto; padding-top: 15px; padding-bottom: 15px; }
@media (max-width: 768px) { .import-options { grid-template-columns: 1fr; } }
</style>