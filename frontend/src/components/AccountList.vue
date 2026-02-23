<template>
  <div class="account-list-wrapper" v-loading="loading" element-loading-text="数据加载中..." style="min-height: 400px;">
    <div v-if="!loading && accounts.length === 0 && !searchQuery" class="empty-state">
      <el-empty description="空空如也，快去添加你的第一个 2FA 账号吧！">
        <el-button type="primary" @click="$emit('switch-tab', 'add-account')">去添加账号</el-button>
      </el-empty>
    </div>

    <div v-else>
      <div class="toolbar" style="margin-bottom: 20px; display: flex; gap: 15px; align-items: center; justify-content: space-between; flex-wrap: wrap;">
        <el-input 
          v-model="searchQuery" 
          placeholder="🔍 搜索服务名称、账号或分类..." 
          clearable 
          style="max-width: 400px; flex: 1;" 
        />
        
        <div class="batch-actions" v-if="selectedIds.length > 0" style="display: flex; align-items: center; gap: 10px;">
          <span style="color: #606266; font-size: 14px;">已选择 {{ selectedIds.length }} 项</span>
          <el-button type="danger" plain @click="handleBulkDelete" :loading="isBulkDeleting">
            <el-icon><Delete /></el-icon> 批量删除
          </el-button>
          <el-button @click="selectedIds = []" plain>取消选择</el-button>
        </div>
        <div v-else>
          <el-button @click="selectAllVisible" plain>全选本页</el-button>
        </div>
      </div>

      <el-row :gutter="20" v-if="accounts.length > 0">
        <el-col :xs="24" :sm="12" :md="8" :lg="6" v-for="account in accounts" :key="account.id" style="margin-bottom: 20px;">
          <el-card class="account-card" :class="{ 'is-selected': selectedIds.includes(account.id) }" shadow="hover">
            <div class="card-header">
              <div class="service-info" style="display: flex; align-items: center; gap: 10px;">
                <el-checkbox :model-value="selectedIds.includes(account.id)" @change="toggleSelection(account.id)" @click.stop />
                <h3 class="service-name">{{ account.service }}</h3>
                <el-tag size="small" v-if="account.category" effect="light">{{ account.category }}</el-tag>
              </div>
              
              <el-dropdown trigger="click" @command="(cmd) => handleCommand(cmd, account)">
                <el-icon class="more-icon"><MoreFilled /></el-icon>
                <template #dropdown>
                  <el-dropdown-menu>
                    <el-dropdown-item command="edit">
                      <el-icon><Edit /></el-icon> 编辑账号
                    </el-dropdown-item>
                    <el-dropdown-item command="delete" style="color: #F56C6C;">
                      <el-icon><Delete /></el-icon> 删除账号
                    </el-dropdown-item>
                  </el-dropdown-menu>
                </template>
              </el-dropdown>
            </div>
            
            <p class="account-name" style="margin-left: 24px;">{{ account.account }}</p>
            
            <div class="card-actions">
              <el-button type="primary" class="code-btn" @click="showTotpCode(account)">
                <el-icon><Key /></el-icon> 获取验证码
              </el-button>
            </div>
          </el-card>
        </el-col>
      </el-row>

      <div class="pagination-wrapper" v-if="total > 0" style="margin-top: 10px; display: flex; justify-content: center;">
        <el-pagination
          v-model:current-page="currentPage"
          v-model:page-size="pageSize"
          :page-sizes="[12, 24, 48, 96]"
          background
          :layout="layoutState.isMobile ? 'prev, pager, next' : 'total, sizes, prev, pager, next, jumper'"
          :small="layoutState.isMobile"
          :total="total"
          @size-change="handleSizeChange"
          @current-change="handleCurrentChange"
        />
      </div>

      <el-empty v-if="!loading && accounts.length === 0 && searchQuery" description="没有找到匹配的账号" />
    </div>

    <!-- 编辑弹窗 -->
    <el-dialog v-model="showEditDialog" title="✏️ 编辑账号" :width="layoutState.isMobile ? '90%' : '400px'" destroy-on-close>
      <el-form :model="editAccountData" label-position="top">
        <el-form-item label="服务名称 (如 Google, GitHub)">
          <el-input v-model="editAccountData.service" />
        </el-form-item>
        <el-form-item label="账号标识 (如 邮箱地址)">
          <el-input v-model="editAccountData.account" />
        </el-form-item>
        <el-form-item label="分类 (可选)">
          <el-input v-model="editAccountData.category" />
        </el-form-item>
      </el-form>
      <template #footer>
        <span class="dialog-footer">
          <el-button @click="showEditDialog = false">取消</el-button>
          <el-button type="primary" :loading="isEditing" @click="submitEditAccount">保存修改</el-button>
        </span>
      </template>
    </el-dialog>

    <!-- TOTP 弹窗 -->
    <el-dialog v-model="showTotpDialog" :title="currentTotpAccount?.account" width="300px" center align-center @closed="stopTotpTimer" destroy-on-close>
      <div class="totp-container">
        <div class="totp-service">{{ currentTotpAccount?.service }}</div>
        <div class="totp-code" @click="copyCode">{{ currentTotpCode }}</div>
        <div class="totp-timer">
          <el-progress type="circle" :percentage="totpPercentage" :width="80" :stroke-width="6" :color="totpColor">
            <template #default>
              <span class="timer-text">{{ totpRemaining }}s</span>
            </template>
          </el-progress>
        </div>
        <div class="totp-tip">点击验证码复制</div>
      </div>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, onMounted, computed, watch } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { Key, MoreFilled, Edit, Delete } from '@element-plus/icons-vue'
import { request } from '../utils/request'
import { layoutState } from '../states/layout'

const emit = defineEmits(['switch-tab'])

const accounts = ref([])
const loading = ref(true)
const total = ref(0)
const searchQuery = ref('')
const currentPage = ref(1)
const pageSize = ref(12)

// 批量操作状态
const selectedIds = ref([])
const isBulkDeleting = ref(false)

// 编辑弹窗
const showEditDialog = ref(false)
const isEditing = ref(false)
const editAccountData = ref({ id: '', service: '', account: '', category: '' })

// TOTP 弹窗
const showTotpDialog = ref(false)
const currentTotpAccount = ref(null)
const currentTotpCode = ref('------')
const totpRemaining = ref(30)
let totpInterval = null
let lastTotpEpoch = -1
let searchTimer = null

// 获取列表
const fetchAccounts = async () => {
  loading.value = true
  try {
    const query = new URLSearchParams({
      page: currentPage.value,
      limit: pageSize.value,
      search: searchQuery.value
    }).toString()
    
    const data = await request(`/api/accounts?${query}`)
    if (data.success) {
      accounts.value = data.accounts || []
      if (data.pagination) total.value = data.pagination.total
    }
  } catch (error) {
    console.error('Failed to fetch accounts', error)
  } finally {
    loading.value = false
  }
}

defineExpose({ fetchAccounts })

// 分页与搜索逻辑
const handleSizeChange = (val) => {
  pageSize.value = val
  currentPage.value = 1
  fetchAccounts()
}

const handleCurrentChange = (val) => {
  currentPage.value = val
  fetchAccounts()
}

watch(searchQuery, () => {
  currentPage.value = 1
  if (searchTimer) clearTimeout(searchTimer)
  searchTimer = setTimeout(() => fetchAccounts(), 300)
})

// 批量选择逻辑
const toggleSelection = (id) => {
  const index = selectedIds.value.indexOf(id)
  if (index > -1) selectedIds.value.splice(index, 1)
  else selectedIds.value.push(id)
}

const selectAllVisible = () => {
  accounts.value.forEach(acc => {
    if (!selectedIds.value.includes(acc.id)) selectedIds.value.push(acc.id)
  })
}

const handleBulkDelete = async () => {
  try {
    await ElMessageBox.confirm(`确定要删除选中的 ${selectedIds.value.length} 个账号吗？`, '警告', { type: 'error' })
    isBulkDeleting.value = true
    const data = await request('/api/accounts/batch-delete', {
      method: 'POST',
      body: JSON.stringify({ ids: selectedIds.value })
    })
    if (data.success) {
      ElMessage.success(`成功删除了 ${data.count} 个账号`)
      selectedIds.value = []
      fetchAccounts()
    }
  } catch (e) {} finally { isBulkDeleting.value = false }
}

// 单个账号操作
const handleCommand = async (command, account) => {
  if (command === 'delete') {
    try {
      await ElMessageBox.confirm(`确定删除 [${account.service}] 吗？`, '警告', { type: 'error' })
      const data = await request(`/api/accounts/${account.id}`, { method: 'DELETE' })
      if (data.success) {
        ElMessage.success('账号已删除')
        fetchAccounts()
      }
    } catch (e) {}
  } else if (command === 'edit') {
    editAccountData.value = { ...account, category: account.category || '' }
    showEditDialog.value = true
  }
}

const submitEditAccount = async () => {
  if (!editAccountData.value.service || !editAccountData.value.account) return ElMessage.warning('必填项不能为空')
  isEditing.value = true
  try {
    const data = await request(`/api/accounts/${editAccountData.value.id}`, {
      method: 'PUT',
      body: JSON.stringify({
        service: editAccountData.value.service,
        account: editAccountData.value.account,
        category: editAccountData.value.category
      })
    })
    if (data.success) {
      ElMessage.success('账号修改成功')
      showEditDialog.value = false
      fetchAccounts()
    }
  } catch (e) {} finally { isEditing.value = false }
}

// TOTP 计算逻辑
const totpPercentage = computed(() => {
  const period = currentTotpAccount.value?.period || 30
  return (totpRemaining.value / period) * 100
})

const totpColor = computed(() => {
  if (totpRemaining.value > 10) return '#67C23A'
  if (totpRemaining.value > 5) return '#E6A23C'
  return '#F56C6C'
})

const showTotpCode = (account) => {
  currentTotpAccount.value = account
  currentTotpCode.value = '------'
  lastTotpEpoch = -1
  showTotpDialog.value = true
  updateTotpLogic()
  if (totpInterval) clearInterval(totpInterval)
  totpInterval = setInterval(updateTotpLogic, 1000)
}

const updateTotpLogic = () => {
  if (!currentTotpAccount.value) return
  const period = currentTotpAccount.value.period || 30
  const now = Date.now() / 1000
  const epoch = Math.floor(now / period)
  totpRemaining.value = Math.ceil(period - (now % period))
  if (epoch > lastTotpEpoch) {
    fetchTotpCode()
    lastTotpEpoch = epoch
  }
}

const fetchTotpCode = async () => {
  try {
    const data = await request('/api/accounts/generate-totp', {
      method: 'POST', body: JSON.stringify({ secret: currentTotpAccount.value.secret })
    })
    if (data.success) currentTotpCode.value = data.code
  } catch (e) {}
}

const stopTotpTimer = () => {
  if (totpInterval) clearInterval(totpInterval)
  totpInterval = null
}

const copyCode = async () => {
  if (currentTotpCode.value === '------') return
  try {
    await navigator.clipboard.writeText(currentTotpCode.value)
    ElMessage.success('验证码已复制')
  } catch (e) {}
}

onMounted(fetchAccounts)
</script>

<style scoped>
.account-card { border-radius: 12px; transition: all 0.3s ease; border: none; }
.account-card:hover { transform: translateY(-5px); box-shadow: 0 8px 24px rgba(0, 0, 0, 0.1) !important; }
.card-header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 10px; }
.service-name { margin: 0 0 5px 0; font-size: 18px; color: #303133; }
.account-name { color: #909399; font-size: 14px; margin: 0 0 20px 0; word-break: break-all; }
.more-icon { cursor: pointer; color: #909399; padding: 5px; }
.more-icon:hover { color: #409EFF; }
.card-actions { display: flex; justify-content: flex-end; }
.code-btn { width: 100%; border-radius: 8px; }
.account-card.is-selected { border: 1px solid #409EFF; background-color: #f4f9ff; }
.totp-container { display: flex; flex-direction: column; align-items: center; padding: 10px 0; }
.totp-service { font-size: 14px; color: #909399; margin-bottom: 5px; }
.totp-code { font-size: 36px; font-weight: bold; color: #409EFF; letter-spacing: 6px; margin: 15px 0; cursor: pointer; transition: transform 0.1s; }
.totp-code:active { transform: scale(0.95); }
.totp-timer { margin: 10px 0; }
.timer-text { font-size: 16px; font-weight: bold; color: #606266; }
.totp-tip { font-size: 12px; color: #909399; margin-top: 10px; }
</style>