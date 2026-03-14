<template>
  <div class="vault-list-wrapper min-h-400">
    <div class="vault-content">
      <!-- 固定的操作栏与分类筛选 -->
      <el-affix :offset="layoutStore.isMobile ? 61 : 61" @change="(val) => isToolbarFixed = val">
        <div class="affix-container" :class="{ 'is-affixed': isToolbarFixed }">
          <div class="vault-list-toolbar mb-10 flex gap-15 flex-items-center flex-between flex-wrap">
            <div class="flex flex-items-center gap-10 flex-1">
              <el-input 
                v-model="searchQuery" 
                :placeholder="$t('common.search_placeholder')" 
                clearable 
                class="max-w-400"
              >
                <template #prefix>
                  <el-icon v-if="isFetching && searchQuery" class="is-loading"><Loading /></el-icon>
                  <el-icon v-else><Search /></el-icon>
                </template>
              </el-input>
            </div>
            
            <div class="batch-actions flex flex-items-center gap-10">
              <template v-if="selectedIds.length > 0">
                <span class="batch-text">{{ $t('common.selected_items', { count: selectedIds.length }) }}</span>
                <el-button type="danger" plain @click="handleBulkDelete" :loading="isBulkDeleting">
                  <el-icon><Delete /></el-icon> {{ $t('common.delete') }}
                </el-button>
                <el-button @click="selectedIds = []" plain>{{ $t('common.cancel') }}</el-button>
              </template>
              <el-button v-else @click="selectAllLoaded" plain>{{ $t('common.select_all_loaded') }}</el-button>
            </div>
          </div>

          <!-- 分类筛选 Chips -->
          <div class="category-filter-container" v-if="!isInitializing">
            <div class="category-chips">
              <div
                class="category-tag"
                :class="{ 'is-active': selectedCategory === '' }"
                @click="selectedCategory = ''"
              >
                {{ $t('common.all') }}
                <span class="tag-count">({{ absoluteTotalItems }})</span>
              </div>
              <div
                v-for="stat in categoryStats"
                :key="stat.id"
                class="category-tag"
                :class="{ 'is-active': selectedCategory === stat.id }"
                @click="selectedCategory = stat.id"
              >
                {{ stat.category || $t('common.uncategorized') }}
                <span class="tag-count">({{ stat.count }})</span>
              </div>
            </div>
          </div>
        </div>
      </el-affix>

      <!-- 1. 加载中 -->
      <div v-if="(isInitializing || isLoading || isFetching) && vault.length === 0" class="flex-column flex-center min-h-400 text-secondary">
        <el-icon class="is-loading mb-20 text-primary" :size="48"><Loading /></el-icon>
        <p class="text-16 ls-1">{{ $t('common.loading_data') }}</p>
      </div>

      <!-- 2. 完全空状态 -->
      <div v-else-if="!isLoading && !isFetching && vault.length === 0 && !searchQuery" class="empty-state">
        <el-empty :description="$t('common.empty_vault')">
          <el-button type="primary" @click="$emit('switch-tab', 'add-vault-scan')">{{ $t('common.go_add_vault') }}</el-button>
        </el-empty>
      </div>

      <!-- 3. 主列表 -->
      <div v-else
        class="list-container min-h-200" 
        v-infinite-scroll="handleLoadMore"
        :infinite-scroll-disabled="isLoadMoreDisabled"
        :infinite-scroll-distance="100"
      >
        <transition-group 
          name="vault-list" 
          tag="div" 
          class="el-row"
          style="margin-left: -10px; margin-right: -10px; display: flex; flex-wrap: wrap;"
          ref="listContainerRef"
        >
          <el-col 
            v-for="vaultItem in vault" 
            :key="vaultItem.id"
            v-bind="colProps"
            class="mb-20 vault-item-col"
            :data-id="vaultItem.id"
          >
            <el-card 
              class="vault-card" 
              :class="{ 
                'is-selected': selectedIds.includes(vaultItem.id), 
                'is-dragging': draggedId === vaultItem.id,
                'is-pressing': isPressing === vaultItem.id
              }"
              shadow="hover"
              @mousedown="handleMouseDown($event, vaultItem.id)"
              @touchstart.passive="handleTouchStart($event, vaultItem.id)"
            >
              <div class="card-header">
                <div class="service-info">
                  <el-checkbox :model-value="selectedIds.includes(vaultItem.id)" @change="toggleSelection(vaultItem.id)" @click.stop />
                  <h3 class="service-name" :title="vaultItem.service">{{ vaultItem.service }}</h3>
                  <el-tag size="small" v-if="vaultItem.category" effect="light">{{ vaultItem.category }}</el-tag>
                </div>
                
                <el-dropdown trigger="click" @command="(cmd) => handleCommand(cmd, vaultItem)">
                  <el-icon class="more-icon" @click.stop><MoreFilled /></el-icon>
                  <template #dropdown>
                    <el-dropdown-menu>
                      <el-dropdown-item command="qr">
                        <el-icon><Picture /></el-icon> {{ $t('common.export_account') }}
                      </el-dropdown-item>
                      <el-dropdown-item command="edit">
                        <el-icon><Edit /></el-icon> {{ $t('common.edit') }}
                      </el-dropdown-item>
                      <el-dropdown-item command="delete" class="text-danger">
                        <el-icon><Delete /></el-icon> {{ $t('common.delete') }}
                      </el-dropdown-item>
                    </el-dropdown-menu>
                  </template>
                </el-dropdown>
              </div>

              <p class="vault-name">{{ vaultItem.account?.includes(':') ? vaultItem.account.split(':').pop() : vaultItem.account }}</p>

              <div class="code-display-area" @click.stop="copyCode(vaultItem)">
                <div class="code-left">
                  <div class="current-code" :data-digits="vaultItem.digits">{{ vaultItem.currentCode || '------' }}</div>
                  <div class="next-code" v-if="vaultItem.nextCode" :data-digits="vaultItem.digits">{{ vaultItem.nextCode }}</div>
                </div>
                <div class="code-right" v-if="vaultItem.currentCode !== '------'">
                  <el-progress 
                    type="circle" 
                    :percentage="vaultItem.percentage || 0" 
                    :width="30" 
                    :stroke-width="3" 
                    :color="vaultItem.color || '#67C23A'"
                  >
                    <template #default>
                      <span class="timer-text">{{ vaultItem.remaining }}</span>
                    </template>
                  </el-progress>
                </div>
                <div v-else class="code-right">
                  <el-icon class="is-loading"><Loading /></el-icon>
                </div>
              </div>
            </el-card>
          </el-col>
        </transition-group>

        <!-- 极致镜像 Teleport 浮层 (同样对齐样式) -->
        <teleport to="body">
          <div 
            v-if="draggedId && draggedItem" 
            class="drag-floating-card"
            :style="floatingStyle"
          >
            <el-card class="vault-card" shadow="always">
              <div class="card-header">
                <div class="service-info">
                  <el-checkbox :model-value="false" disabled />
                  <h3 class="service-name">{{ draggedItem.service }}</h3>
                  <el-tag size="small" v-if="draggedItem.category" effect="light">{{ draggedItem.category }}</el-tag>
                </div>
                <el-icon class="more-icon"><MoreFilled /></el-icon>
              </div>
              <p class="vault-name">{{ draggedItem.account?.includes(':') ? draggedItem.account.split(':').pop() : draggedItem.account }}</p>
              <div class="code-display-area">
                <div class="code-left">
                  <div class="current-code" :data-digits="draggedItem.digits">{{ draggedItem.currentCode }}</div>
                </div>
                <div class="code-right">
                  <el-progress type="circle" :percentage="draggedItem.percentage" :width="30" :stroke-width="3" :color="draggedItem.color">
                    <template #default>
                      <span class="timer-text">{{ draggedItem.remaining }}</span>
                    </template>
                  </el-progress>
                </div>
              </div>
            </el-card>
          </div>
        </teleport>

        <div v-if="isFetchingNextPage" class="text-center p-20 text-secondary">
          <el-icon class="is-loading"><Loading /></el-icon> {{ $t('common.loading_more') }}
        </div>
        <div v-if="!hasNextPage && vault.length > 0" class="text-center p-20 text-secondary text-12">
          {{ $t('common.no_more_accounts') }}
        </div>
        <el-empty v-if="!isLoading && vault.length === 0 && searchQuery" :description="$t('common.no_matching_accounts')" />
      </div>
    </div>

    <!-- 业务 Dialogs (保持原有逻辑) -->
    <el-dialog v-model="showEditDialog" :title="$t('common.edit_account')" :width="layoutStore.isMobile ? '90%' : '400px'" destroy-on-close>
      <el-form :model="editVaultData" label-position="top">
        <el-form-item :label="$t('common.service_name')">
          <el-input v-model="editVaultData.service" />
        </el-form-item>
        <el-form-item :label="$t('common.account_identifier')">
          <el-input v-model="editVaultData.account" />
        </el-form-item>
        <el-form-item :label="$t('common.category_optional')">
          <el-select
            v-model="editVaultData.category"
            filterable
            allow-create
            default-first-option
            :placeholder="$t('common.category_optional')"
            style="width: 100%"
            clearable
          >
            <el-option
              v-for="item in categoryOptions"
              :key="item"
              :label="item"
              :value="item"
            />
          </el-select>
        </el-form-item>
      </el-form>
      <template #footer>
        <span class="dialog-footer">
          <el-button @click="showEditDialog = false">{{ $t('common.cancel') }}</el-button>
          <el-button type="primary" :loading="isEditing" @click="submitEditVault">{{ $t('common.save') }}</el-button>
        </span>
      </template>
    </el-dialog>

    <el-dialog v-model="showQrDialog" :title="$t('common.export_account')" :width="layoutStore.isMobile ? '90%' : '350px'" center align-center destroy-on-close @closed="showSecret = false">
      <div class="qr-container" v-if="currentQrItem">
        <div class="qr-info">
          <h3 class="qr-service">{{ currentQrItem.service }}</h3>
          <p class="qr-account">{{ currentQrItem.account }}</p>
        </div>
        <div class="qr-image-wrapper">
          <img :src="qrCodeUrl" class="qr-code-img" />
        </div>
        <p class="qr-tip">{{ $t('vault.export_qr_tip') }}</p>
        <div class="secret-section">
          <div class="secret-box">
            <div class="secret-text">{{ showSecret ? formatSecret(currentQrItem.secret) : '•••• •••• •••• ••••' }}</div>
            <div class="secret-actions">
              <el-icon class="action-icon" @click="showSecret = !showSecret"><View v-if="!showSecret" /><Hide v-else /></el-icon>
              <el-icon class="action-icon" @click="copySecret"><CopyDocument /></el-icon>
            </div>
          </div>
        </div>
        <div class="uri-link-wrapper">
          <el-button link type="info" size="small" @click="copyOtpUrl">{{ $t('vault.copy_otp_url') }}</el-button>
        </div>
      </div>
    </el-dialog>
  </div>
</template>

<script setup>
/**
 * 核心金库列表组件 (Vault List Root Component)
 * 
 * 架构说明 (Architecture Notes):
 * 1. 离线优先与秒开 (Offline-First Initialization): 
 *    `isInitializing` 状态拦截了组件初筛。生命周期 `onMounted` 时优先呼叫 `handleUnlocked` 读取
 *    `localStorage` 加密缓存 (`vaultStore.getData()`)。读取闭环后关闭 `isInitializing` 使得 
 *    UI 瞬间呈现历史数据，随后交由 Vue Query 在后台默默触发真实网络同步 (`fetchVault`) 更新状态，
 *    达到丝滑“秒开”极致体验。
 * 2. 消除瀑布流计算 (Heavy Compute Deferment): 
 *    将获取到缓存后极其冗长的 Hash 计算任务 `updateVaultStatus()` 通过 `setTimeout(..., 0)`
 *    推至浏览器的后续事件队列中，彻底让出 JavaScript 渲染主线程，保障金库大列表在手机端冷启动不白屏、不阻塞。
 * 3. 循环依赖解构 (Dependency Inversion): 
 *    鉴于获取数据的 `useVaultList` 和执行计算的 `useTotpTimer` 各自闭环又存在先后依赖，此处以
 *    `afterLoadRef` 作媒介进行延迟绑定：
 *    `useVaultList` (接收 `afterLoadRef`) -> `useTotpTimer` 实例生成 -> 绑定回调 ->
 *    下一次 Vue Query 拉回新数据时，直接调用绑定的 `updateVaultStatus` 进行后台预运算。
 */
import { ref, onMounted, computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { MoreFilled, Edit, Delete, Picture, View, Hide, CopyDocument, Loading, Search } from '@element-plus/icons-vue'
import { ElMessage } from 'element-plus'

// Stores & Composables
import { useLayoutStore } from '@/shared/stores/layoutStore'
import { useVaultStore } from '@/features/vault/store/vaultStore'
import { useVaultList } from '@/features/vault/composables/useVaultList'
import { useTotpTimer } from '@/features/vault/composables/useTotpTimer'
import { useVaultActions } from '@/features/vault/composables/useVaultActions'
import { vaultService } from '@/features/vault/service/vaultService'

const emit = defineEmits(['switch-tab'])
const { t } = useI18n()
const layoutStore = useLayoutStore()
const vaultStore = useVaultStore()

// --- 基础数据逻辑 ---
const afterLoadRef = ref(null)
const {
  vault, searchQuery, selectedCategory, isLoading, isFetching, isFetchingNextPage,
  hasNextPage, totalItems, absoluteTotalItems, categoryStats, localCategoryStats, fetchVault, handleLoadMore, refetch, isLoadMoreDisabled
} = useVaultList(afterLoadRef)

const { updateVaultStatus } = useTotpTimer(vault, afterLoadRef)
const {
  selectedIds, isBulkDeleting, toggleSelection, selectAllLoaded, handleBulkDelete,
  showEditDialog, editVaultData, isEditing, handleCommand, submitEditVault,
  showQrDialog, currentQrItem, qrCodeUrl, showSecret, formatSecret, copyCode, copySecret, copyOtpUrl,
  categoryOptions, performReorder
} = useVaultActions(fetchVault, vault, categoryStats)

// --- 精准响应式布局 ---
const isToolbarFixed = ref(false)

const colProps = {
  xs: 24,
  sm: 12,
  md: 8,
  lg: 6
}

// --- 物理感拖拽引擎 ---
const draggedId = ref(null)
const draggedItem = computed(() => vault.value.find(i => i.id === draggedId.value))

const floatingPos = ref({ x: 0, y: 0 })
const floatingSize = ref({ w: 0 })
const isPressing = ref(null) // 用于长按视觉反馈
let dragOffset = { x: 0, y: 0 }
let isDragging = false
let scrollRafId = null
let currentScrollSpeed = 0
let scrollAcceleration = 1
let lastMousePos = { x: 0, y: 0 }

const floatingStyle = computed(() => ({
    left: `${floatingPos.value.x}px`,
    top: `${floatingPos.value.y}px`,
    width: `${floatingSize.value.w}px`
}))

// 记录初始索引，用于失败回滚
let originalVault = []

// 抽离精准查找目标位置的逻辑，以便滚动时也能调用
const checkReorder = (x, y) => {
    const target = document.elementFromPoint(x, y)
    const targetCol = target?.closest('.vault-item-col')
    
    if (targetCol) {
        const targetId = targetCol.getAttribute('data-id')
        if (targetId && targetId !== draggedId.value) {
            const list = [...vault.value]
            const fromIdx = list.findIndex(i => i.id === draggedId.value)
            const toIdx = list.findIndex(i => i.id === targetId)
            
            if (fromIdx !== -1 && toIdx !== -1) {
                // 只有当位置真正改变时才更新
                const [item] = list.splice(fromIdx, 1)
                list.splice(toIdx, 0, item)
                vault.value = list
            }
        }
    }
}

const onDragStart = (x, y, id, targetEl) => {
    draggedId.value = id
    isDragging = true
    lastMousePos = { x, y }
    originalVault = [...vault.value]
    
    const rect = targetEl.getBoundingClientRect()
    dragOffset = {
        x: x - rect.left,
        y: y - rect.top
    }
    floatingSize.value.w = rect.width
    floatingPos.value = { x: rect.left, y: rect.top }
    
    // 只有在真正开始拖拽时才触发振动，减少 Intervention 警告
    if (layoutStore.isMobile && ('vibrate' in navigator)) {
        try { navigator.vibrate([20]) } catch(e) {}
    }
    
    // 仅移动端锁死 overflow，防止下拉刷新等冲突
    if (layoutStore.isMobile) {
        document.body.style.overflow = 'hidden'
    }

    // 强力清除并禁止文本选择，防止移动端出现蓝色选中块或搜索放大镜
    window.getSelection()?.removeAllRanges()
    document.body.style.userSelect = 'none'
    document.body.style.webkitUserSelect = 'none'
}

const onDragMove = (x, y) => {
    if (!isDragging) return
    lastMousePos = { x, y }
    
    floatingPos.value = {
        x: x - dragOffset.x,
        y: y - dragOffset.y
    }
    
    // 动态边缘滚动（基础速度计算）
    const threshold = 80 // 缩小阈值，让操作更精准
    if (y < threshold) {
        // 向上滚动：距离顶部越近，速度越快
        const baseSpeed = Math.max(-25, Math.floor((y - threshold) / 2.5))
        startAutoScroll(baseSpeed)
    } else if (y > window.innerHeight - threshold) {
        // 向下滚动：距离底部越近，速度越快
        const baseSpeed = Math.min(25, Math.floor((y - (window.innerHeight - threshold)) / 2.5))
        startAutoScroll(baseSpeed)
    } else {
        stopAutoScroll()
    }
    
    checkReorder(x, y)
}

const onDragEnd = () => {
    if (!isDragging) return
    stopAutoScroll()
    performReorder([...vault.value], originalVault)
    isDragging = false
    draggedId.value = null
    document.body.style.overflow = ''
    document.body.style.userSelect = ''
    document.body.style.webkitUserSelect = ''
}

const handleMouseDown = (e, id) => {
    // 排除特定交互区域
    if (e.target.closest('.el-checkbox, .el-dropdown, .el-button, .more-icon')) return
    
    // 基础防误触：区分“点击”与“拖拽”
    const startX = e.clientX
    const startY = e.clientY
    const targetEl = e.currentTarget
    let moved = false
    
    const onMove = (moveEv) => {
        if (!moved) {
            const dist = Math.sqrt(Math.pow(moveEv.clientX - startX, 2) + Math.pow(moveEv.clientY - startY, 2))
            if (dist > 5) {
                moved = true
                onDragStart(startX, startY, id, targetEl)
            }
        }
        if (moved) onDragMove(moveEv.clientX, moveEv.clientY)
    }
    
    const onEnd = () => {
        if (moved) onDragEnd()
        window.removeEventListener('mousemove', onMove)
        window.removeEventListener('mouseup', onEnd)
    }
    
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onEnd)
}

const handleTouchStart = (e, id) => {
    // 彻底排除交互区域，确保点击验证码/按钮 100% 优先
    if (e.target.closest('.el-checkbox, .el-dropdown, .el-button, .more-icon, .code-display-area')) return
    
    const touch = e.touches[0]
    const targetEl = e.currentTarget
    
    // 立即显示按压态反馈
    isPressing.value = id
    
    const timer = setTimeout(() => {
        isPressing.value = null
        onDragStart(touch.clientX, touch.clientY, id, targetEl)
        
        const onTMove = (moveEv) => {
            // 关键：阻止移动端原生滚动与下拉刷新干扰
            if (moveEv.cancelable) moveEv.preventDefault()
            const mT = moveEv.touches[0]
            onDragMove(mT.clientX, mT.clientY)
        }
        const onTEnd = () => {
            onDragEnd()
            window.removeEventListener('touchmove', onTMove)
            window.removeEventListener('touchend', onTEnd)
        }
        window.addEventListener('touchmove', onTMove, { passive: false })
        window.addEventListener('touchend', onTEnd)
    }, 200) // 稍微增加到 200ms 使按压态更明显
    
    const cancel = () => {
        clearTimeout(timer)
        isPressing.value = null
    }
    targetEl.addEventListener('touchend', cancel, { once: true })
    targetEl.addEventListener('touchmove', cancel, { once: true })
    targetEl.addEventListener('touchcancel', cancel, { once: true })
}

const startAutoScroll = (speed) => {
    currentScrollSpeed = speed
    if (scrollRafId) return
    
    scrollAcceleration = 1
    const step = () => {
        if (!isDragging) {
            return stopAutoScroll()
        }
        
        const actualMove = currentScrollSpeed * scrollAcceleration
        
        // 核心修复：根据布局确定滚动容器
        // PC端 (lg): 滚动发生在 .main-content
        // 移动端 (sm): 滚动发生在 document.documentElement
        let scrollContainer = document.documentElement
        if (!layoutStore.isMobile) {
            const mainContent = document.querySelector('.main-content')
            if (mainContent) scrollContainer = mainContent
        }
        
        const oldTop = scrollContainer.scrollTop
        scrollContainer.scrollTop += actualMove
        const newTop = scrollContainer.scrollTop
        
        // 如果容器没动，尝试切换到另一个容器（兜底逻辑）
        if (Math.abs(newTop - oldTop) < 0.1 && actualMove !== 0) {
            const fallbackContainer = scrollContainer === document.documentElement 
                ? document.querySelector('.main-content') 
                : document.documentElement
            
            if (fallbackContainer) {
                fallbackContainer.scrollTop += actualMove
            }
        }
        
        if (scrollAcceleration < 4) {
            scrollAcceleration += 0.03
        }
        
        checkReorder(lastMousePos.x, lastMousePos.y)
        scrollRafId = requestAnimationFrame(step)
    }
    scrollRafId = requestAnimationFrame(step)
}

const stopAutoScroll = () => {
    if (scrollRafId) {
        cancelAnimationFrame(scrollRafId)
        scrollRafId = null
        scrollAcceleration = 1
        currentScrollSpeed = 0
    }
}


const handleUnlocked = async () => {
    try {
        if (vaultStore.isDirty) {
            fetchVault()
            return
        }
        const vaultData = await vaultStore.getData()
        if (vaultData) {
            if (vaultData.vault) {
                vault.value = vaultData.vault
                setTimeout(() => updateVaultStatus(), 0)
            }
            // 同步恢复分类缓存，确保“秒开”且分类不消失
            if (vaultData.categoryStats) {
                localCategoryStats.value = vaultData.categoryStats
            }
        }
    } finally {
        isInitializing.value = false
    }
}

const isInitializing = ref(true)
defineExpose({ fetchVault })
onMounted(handleUnlocked)
</script>