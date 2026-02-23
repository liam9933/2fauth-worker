<template>
  <div class="backup-container">
    <!-- 顶部操作 -->
    <div class="header-actions">
      <h3>备份源管理</h3>
      <el-button type="primary" @click="openAddDialog">
        <el-icon><Plus /></el-icon> 添加备份源
      </el-button>
    </div>

    <!-- 列表区域 -->
    <el-row :gutter="20" v-loading="isLoading">
      <el-col :xs="24" :sm="12" :md="8" v-for="provider in providers" :key="provider.id" style="margin-bottom: 20px;">
        <el-card shadow="hover" class="provider-card">
          <template #header>
            <div class="card-header">
              <div class="provider-title">
                <el-tag size="small" effect="dark" :type="getProviderTypeTag(provider.type)">{{ provider.type.toUpperCase() }}</el-tag>
                <span class="provider-name">{{ provider.name }}</span>
              </div>
              <div class="provider-actions">
                <el-button link type="primary" @click="editProvider(provider)"><el-icon><Edit /></el-icon></el-button>
                <el-button link type="danger" @click="deleteProvider(provider)"><el-icon><Delete /></el-icon></el-button>
              </div>
            </div>
          </template>
          
          <div class="card-content">
            <p class="status-text">
              上次备份: 
              <span v-if="provider.last_backup_at">{{ new Date(provider.last_backup_at).toLocaleString() }}</span>
              <span v-else>从未</span>
              <el-tag v-if="provider.last_backup_status" size="small" :type="provider.last_backup_status === 'success' ? 'success' : 'danger'" style="margin-left: 5px;">
                {{ provider.last_backup_status }}
              </el-tag>
            </p>
            
            <div class="action-buttons">
              <el-button type="success" plain size="small" @click="openBackupDialog(provider)">立即备份</el-button>
              <el-button type="warning" plain size="small" @click="openRestoreDialog(provider)">恢复数据</el-button>
            </div>
          </div>
        </el-card>
      </el-col>
      
      <el-col :span="24" v-if="providers.length === 0">
        <el-empty description="暂无备份源，请点击右上角添加" />
      </el-col>
    </el-row>

    <!-- 编辑弹窗 -->
    <el-dialog v-model="showConfigDialog" :title="isEditing ? '编辑备份源' : '添加备份源'" width="500px" destroy-on-close>
      <el-form :model="form" label-position="top" ref="formRef">
        <el-form-item label="类型">
          <el-select v-model="form.type" :disabled="isEditing">
            <el-option label="WebDAV" value="webdav" />
            <el-option label="S3 对象存储" value="s3" />
          </el-select>
        </el-form-item>
        <el-form-item label="名称 (别名)">
          <el-input v-model="form.name" placeholder="例如: 我的坚果云" />
        </el-form-item>
        
        <!-- WebDAV 配置 -->
        <template v-if="form.type === 'webdav'">
          <el-form-item label="WebDAV 地址">
            <el-input v-model="form.config.url" placeholder="https://dav.jianguoyun.com/dav/" />
          </el-form-item>
          <el-form-item label="用户名">
            <el-input v-model="form.config.username" />
          </el-form-item>
          <el-form-item label="密码">
            <el-input v-model="form.config.password" type="password" show-password />
          </el-form-item>
          <el-form-item label="保存目录">
            <el-input v-model="form.config.saveDir" placeholder="/2fauth-backups" />
          </el-form-item>
        </template>

        <!-- S3 配置 -->
        <template v-if="form.type === 's3'">
          <el-form-item label="Endpoint (API 地址)">
            <el-input v-model="form.config.endpoint" placeholder="https://<account>.r2.cloudflarestorage.com" />
          </el-form-item>
          <el-form-item label="Bucket (存储桶名称)">
            <el-input v-model="form.config.bucket" placeholder="my-backup-bucket" />
          </el-form-item>
          <el-form-item label="Region (区域)">
            <el-input v-model="form.config.region" placeholder="auto 或 us-east-1" />
          </el-form-item>
          <el-form-item label="Access Key ID">
            <el-input v-model="form.config.accessKeyId" />
          </el-form-item>
          <el-form-item label="Secret Access Key">
            <el-input v-model="form.config.secretAccessKey" type="password" show-password />
          </el-form-item>
          <el-form-item label="存储路径前缀 (可选)">
            <el-input v-model="form.config.saveDir" placeholder="backups/" />
          </el-form-item>
        </template>
      </el-form>
      <template #footer>
        <el-button @click="testConnection" :loading="isTesting">测试连接</el-button>
        <el-button type="primary" @click="saveProvider" :loading="isSaving">保存</el-button>
      </template>
    </el-dialog>

    <!-- 备份弹窗 -->
    <el-dialog v-model="showBackupDialog" title="加密备份" width="400px">
      <el-alert title="数据安全" type="info" description="请输入加密密码。此密码用于加密备份文件内容，请务必牢记！" show-icon :closable="false" style="margin-bottom: 15px;" />
      <el-input v-model="backupPassword" type="password" show-password placeholder="输入加密密码" />
      <template #footer>
        <el-button @click="showBackupDialog = false">取消</el-button>
        <el-button type="primary" @click="handleBackup" :loading="isBackingUp">开始备份</el-button>
      </template>
    </el-dialog>

    <!-- 恢复列表弹窗 -->
    <el-dialog v-model="showRestoreListDialog" title="选择备份文件恢复" width="600px">
      <el-table :data="backupFiles" v-loading="isLoadingFiles" height="300px" style="width: 100%">
        <el-table-column prop="filename" label="文件名" show-overflow-tooltip />
        <el-table-column label="大小" width="100">
          <template #default="scope">
            {{ formatSize(scope.row.size) }}
          </template>
        </el-table-column>
        <el-table-column prop="lastModified" label="时间" width="180" />
        <el-table-column label="操作" width="100">
          <template #default="scope">
            <el-button link type="primary" @click="selectRestoreFile(scope.row)">恢复</el-button>
          </template>
        </el-table-column>
      </el-table>
    </el-dialog>

    <!-- 恢复确认弹窗 -->
    <el-dialog v-model="showRestoreConfirmDialog" title="解密恢复" width="400px">
      <el-alert title="警告" type="warning" description="恢复操作将覆盖当前所有数据！" show-icon :closable="false" style="margin-bottom: 15px;" />
      <el-input v-model="restorePassword" type="password" show-password placeholder="输入备份时的加密密码" />
      <template #footer>
        <el-button @click="showRestoreConfirmDialog = false">取消</el-button>
        <el-button type="danger" @click="handleRestore" :loading="isRestoring">确认覆盖恢复</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { Plus, Edit, Delete } from '@element-plus/icons-vue'
import { request } from '../utils/request'

const emit = defineEmits(['restore-success'])

const providers = ref([])
const isLoading = ref(false)

// 配置弹窗状态
const showConfigDialog = ref(false)
const isEditing = ref(false)
const isTesting = ref(false)
const isSaving = ref(false)
const form = ref({ type: 'webdav', name: '', config: { url: '', username: '', password: '', saveDir: '/', endpoint: '', bucket: '', region: 'auto', accessKeyId: '', secretAccessKey: '' } })
const currentProviderId = ref(null)

// 备份/恢复状态
const showBackupDialog = ref(false)
const backupPassword = ref('')
const isBackingUp = ref(false)
const currentActionProvider = ref(null)

const showRestoreListDialog = ref(false)
const isLoadingFiles = ref(false)
const backupFiles = ref([])
const showRestoreConfirmDialog = ref(false)
const restorePassword = ref('')
const selectedFile = ref(null)
const isRestoring = ref(false)

const fetchProviders = async () => {
  isLoading.value = true
  try {
    const res = await request('/api/backups/providers')
    if (res.success) providers.value = res.providers
  } finally { isLoading.value = false }
}

const getProviderTypeTag = (type) => type === 'webdav' ? 'primary' : (type === 's3' ? 'warning' : 'info')

const formatSize = (bytes) => {
  if (!bytes) return '0 B'
  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
}

const openAddDialog = () => {
  isEditing.value = false
  form.value = { type: 'webdav', name: '', config: { url: '', username: '', password: '', saveDir: '/', endpoint: '', bucket: '', region: 'auto', accessKeyId: '', secretAccessKey: '' } }
  showConfigDialog.value = true
}

const editProvider = (provider) => {
  isEditing.value = true
  currentProviderId.value = provider.id
  form.value = JSON.parse(JSON.stringify({
    type: provider.type,
    name: provider.name,
    config: provider.config
  }))
  showConfigDialog.value = true
}

const validateForm = () => {
  if (!form.value.name) return '请输入名称'
  const c = form.value.config
  if (form.value.type === 'webdav') {
    if (!c.url) return '请输入 WebDAV 地址'
    if (!c.username) return '请输入用户名'
    if (!c.password) return '请输入密码'
  } else if (form.value.type === 's3') {
    if (!c.endpoint) return '请输入 Endpoint'
    if (!c.bucket) return '请输入 Bucket'
    if (!c.accessKeyId) return '请输入 Access Key ID'
    if (!c.secretAccessKey) return '请输入 Secret Access Key'
  }
  return null
}

const testConnection = async () => {
  const error = validateForm()
  if (error) return ElMessage.warning(error)

  isTesting.value = true
  try {
    const res = await request('/api/backups/providers/test', {
      method: 'POST', body: JSON.stringify({ type: form.value.type, config: form.value.config })
    })
    if (res.success) ElMessage.success('连接成功')
  } catch (e) {} finally { isTesting.value = false }
}

const saveProvider = async () => {
  const error = validateForm()
  if (error) return ElMessage.warning(error)

  isSaving.value = true
  try {
    const url = isEditing.value ? `/api/backups/providers/${currentProviderId.value}` : '/api/backups/providers'
    const method = isEditing.value ? 'PUT' : 'POST'
    const res = await request(url, { method, body: JSON.stringify(form.value) })
    if (res.success) {
      ElMessage.success('保存成功')
      showConfigDialog.value = false
      fetchProviders()
    }
  } catch (e) {} finally { isSaving.value = false }
}

const deleteProvider = async (provider) => {
  try {
    await ElMessageBox.confirm('确定删除该备份源吗？', '警告', { type: 'warning' })
    await request(`/api/backups/providers/${provider.id}`, { method: 'DELETE' })
    fetchProviders()
  } catch (e) {}
}

const openBackupDialog = (provider) => {
  currentActionProvider.value = provider
  backupPassword.value = ''
  showBackupDialog.value = true
}

const handleBackup = async () => {
  if (backupPassword.value.length < 12) return ElMessage.warning('密码至少12位')
  isBackingUp.value = true
  try {
    const res = await request(`/api/backups/providers/${currentActionProvider.value.id}/backup`, {
      method: 'POST', body: JSON.stringify({ password: backupPassword.value })
    })
    if (res.success) {
      ElMessage.success('备份成功')
      showBackupDialog.value = false
      fetchProviders() // Refresh status
    }
  } catch (e) {} finally { isBackingUp.value = false }
}

const openRestoreDialog = async (provider) => {
  currentActionProvider.value = provider
  showRestoreListDialog.value = true
  isLoadingFiles.value = true
  try {
    const res = await request(`/api/backups/providers/${provider.id}/files`)
    if (res.success) backupFiles.value = res.files
  } finally { isLoadingFiles.value = false }
}

const selectRestoreFile = (file) => {
  selectedFile.value = file
  restorePassword.value = ''
  showRestoreConfirmDialog.value = true
}

const handleRestore = async () => {
  isRestoring.value = true
  try {
    const res = await request(`/api/backups/providers/${currentActionProvider.value.id}/restore`, {
      method: 'POST', body: JSON.stringify({ 
        filename: selectedFile.value.filename, 
        password: restorePassword.value 
      })
    })
    if (res.success) {
      ElMessage.success('恢复成功')
      showRestoreConfirmDialog.value = false
      showRestoreListDialog.value = false
      emit('restore-success')
    }
  } catch (e) {} finally { isRestoring.value = false }
}

onMounted(fetchProviders)
</script>

<style scoped>
.header-actions { display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px; }
.provider-card { height: 100%; }
.card-header { display: flex; justify-content: space-between; align-items: center; }
.provider-title { display: flex; align-items: center; gap: 10px; font-weight: bold; }
.status-text { font-size: 13px; color: #666; margin-bottom: 15px; }
.action-buttons { display: flex; gap: 10px; }
</style>