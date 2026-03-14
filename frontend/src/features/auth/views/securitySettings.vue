<template>
  <div class="security-wrapper">
    <div class="tab-card-wrapper">
      <div class="text-center mb-30">
        <h2>{{ $t('security.passkey_title') }}</h2>
        <p class="text-secondary">{{ $t('security.passkey_desc') }}</p>
      </div>
      <div class="security-container">
        <div class="security-header-actions">
          <h3>{{ $t('security.management') }}</h3>
          <el-button type="primary" @click="showAddDialog = true">
            <el-icon><Plus /></el-icon> {{ $t('security.add_passkey') }}
          </el-button>
        </div>

        <!-- 全局加载状态 -->
        <div v-if="loading && credentials.length === 0" class="flex-column flex-center min-h-200 text-secondary">
          <el-icon class="is-loading mb-20 text-primary" :size="48"><Loading /></el-icon>
          <p class="text-16 ls-1">{{ $t('common.loading_data') }}</p>
        </div>

        <!-- 空状态 -->
        <div v-else-if="credentials.length === 0" class="empty-state mt-40">
          <el-empty :description="$t('security.no_passkeys')" />
        </div>

        <!-- 列表区域 (有数据情况) -->
        <div v-else class="credential-list mt-20">
            <el-table :data="credentials" style="width: 100%">
              <el-table-column :label="$t('security.credential_name')" min-width="150">
                <template #default="{ row }">
                  <div class="flex-align-center" style="min-height: 32px;">
                    <template v-if="editingId === row.id">
                      <el-input 
                        v-model="editName"
                        size="small"
                        @keyup.enter="saveEdit(row)"
                        @keyup.esc="cancelEdit"
                        @blur="cancelEdit"
                        ref="editInputRef"
                        style="width: 150px; margin-right: 8px;"
                      />
                      <el-button 
                        type="success" 
                        link 
                        :icon="Check" 
                        @mousedown.prevent
                        @click="saveEdit(row)"
                      />
                    </template>
                    <template v-else>
                      <span>{{ row.name || $t('security.default_name') }}</span>
                      <el-button 
                        type="primary" 
                        link 
                        :icon="Edit" 
                        @click="startEdit(row)"
                        class="ml-2"
                      />
                    </template>
                  </div>
                </template>
              </el-table-column>
              <el-table-column :label="$t('security.created_at')" min-width="150">
                <template #default="{ row }">
                  {{ formatDate(row.created_at) }}
                </template>
              </el-table-column>
              <el-table-column :label="$t('security.last_used')" min-width="150">
                <template #default="{ row }">
                  {{ row.last_used_at ? formatDate(row.last_used_at) : '-' }}
                </template>
              </el-table-column>
              <el-table-column align="right" width="100">
                <template #default="{ row }">
                  <el-button 
                    type="danger" 
                    link 
                    :icon="Delete" 
                    @click="handleDelete(row)"
                  />
                </template>
              </el-table-column>
            </el-table>
        </div>

        <!-- 添加 Passkey 弹窗 -->
        <el-dialog
          v-model="showAddDialog"
          :title="$t('security.add_dialog_title')"
          :width="layoutStore.isMobile ? '90%' : '400px'"
          append-to-body
        >
          <el-form :model="addForm" @submit.prevent="handleAdd">
            <el-form-item :label="$t('security.credential_name')">
              <el-input 
                v-model="addForm.name" 
                :placeholder="$t('security.default_name')" 
                clearable
              />
              <p class="text-secondary text-12 mt-8">{{ $t('security.add_dialog_tip') }}</p>
            </el-form-item>
          </el-form>
          <template #footer>
            <span class="dialog-footer">
              <el-button @click="showAddDialog = false">{{ $t('common.cancel') }}</el-button>
              <el-button type="primary" :loading="adding" @click="handleAdd">
                {{ $t('common.confirm') }}
              </el-button>
            </span>
          </template>
        </el-dialog>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, nextTick } from 'vue'
import { Plus, Delete, Cpu, CircleCheck, Loading, Edit, Check } from '@element-plus/icons-vue'
import { useLayoutStore } from '@/shared/stores/layoutStore'
import { ElMessage, ElMessageBox } from 'element-plus'
import { useI18n } from 'vue-i18n'
import { webAuthnService } from '@/features/auth/service/webAuthnService'

const layoutStore = useLayoutStore()

const { t } = useI18n()
const loading = ref(true)
const adding = ref(false)
const showAddDialog = ref(false)
const credentials = ref([])
const addForm = ref({
  name: ''
})

const editingId = ref(null)
const editName = ref('')
const editInputRef = ref(null)

const startEdit = (row) => {
  editingId.value = row.id
  editName.value = row.name || t('security.default_name')
  nextTick(() => {
    if (editInputRef.value) {
      if (Array.isArray(editInputRef.value)) {
        editInputRef.value[0]?.focus()
      } else {
        editInputRef.value.focus()
      }
    }
  })
}

const cancelEdit = () => {
  editingId.value = null
  editName.value = ''
}

const saveEdit = async (row) => {
  const newName = editName.value.trim()
  if (!newName) {
    ElMessage.error(t('common.name_required', '名称不能为空'))
    return
  }
  
  if (newName === row.name) {
    cancelEdit()
    return
  }

  try {
    const res = await webAuthnService.updateCredentialName(row.id, newName)
    if (res.success) {
      ElMessage.success(t('common.success'))
      cancelEdit()
      await fetchCredentials()
    }
  } catch (error) {
    console.error('Failed to update credential name:', error)
  }
}

const fetchCredentials = async () => {
  loading.value = true
  try {
    const res = await webAuthnService.listCredentials()
    if (res.success) {
      credentials.value = res.credentials
    }
  } catch (error) {
    console.error('Failed to fetch credentials:', error)
  } finally {
    loading.value = false
  }
}

const handleAdd = async () => {
  if (!webAuthnService.isSupported()) {
    ElMessage.error(t('auth.passkey_not_supported'))
    return
  }

  adding.value = true
  try {
    const name = addForm.value.name.trim() || t('security.default_name')
    const res = await webAuthnService.register(name)
    if (res.success) {
      ElMessage.success(t('security.register_success'))
      showAddDialog.value = false
      addForm.value.name = ''
      await fetchCredentials()
    }
  } catch (error) {
    console.error('Passkey registration failed:', error)
    // Error notification is handled by requester or service level usually
  } finally {
    adding.value = false
  }
}

const handleDelete = async (row) => {
  try {
    await ElMessageBox.confirm(
      t('security.delete_confirm'),
      t('common.warning'),
      {
        confirmButtonText: t('common.confirm'),
        cancelButtonText: t('common.cancel'),
        type: 'warning',
      }
    )
    
    const res = await webAuthnService.deleteCredential(row.id)
    if (res.success) {
      ElMessage.success(t('common.success'))
      await fetchCredentials()
    }
  } catch (error) {
    if (error !== 'cancel') {
      console.error('Failed to delete credential:', error)
    }
  }
}

const formatDate = (timestamp) => {
  if (!timestamp) return '-'
  const date = new Date(timestamp)
  const Y = date.getFullYear()
  const M = String(date.getMonth() + 1).padStart(2, '0')
  const D = String(date.getDate()).padStart(2, '0')
  const h = String(date.getHours()).padStart(2, '0')
  const m = String(date.getMinutes()).padStart(2, '0')
  const s = String(date.getSeconds()).padStart(2, '0')
  return `${Y}-${M}-${D} ${h}:${m}:${s}`
}

onMounted(() => {
  fetchCredentials()
})
</script>
