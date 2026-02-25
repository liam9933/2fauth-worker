<template>
  <el-container class="home-container">
    <el-container class="main-body">
      <!-- 侧边栏 (Desktop) -->
      <el-aside :width="isCollapse ? '64px' : '240px'" class="left-aside" v-if="!layoutState.isMobile">
        <el-menu
          :default-active="activeTab"
          class="side-menu"
          @select="handleMenuSelect"
          :collapse="isCollapse"
        >
          <el-menu-item index="accounts">
            <el-icon><Iphone /></el-icon>
            <template #title><span>我的账户</span></template>
          </el-menu-item>

          <el-sub-menu index="add-account">
            <template #title>
              <el-icon><Plus /></el-icon><span>添加账号</span>
            </template>
            <el-menu-item index="add-account-scan">
              <el-icon><Camera /></el-icon><span>扫码添加</span>
            </el-menu-item>
            <el-menu-item index="add-account-manual">
              <el-icon><Edit /></el-icon><span>手动输入</span>
            </el-menu-item>
          </el-sub-menu>

          <el-sub-menu index="migration">
            <template #title>
              <el-icon><Sort /></el-icon><span>数据迁移</span>
            </template>
            <el-menu-item index="migration-export"><el-icon><Upload /></el-icon><span>数据导出</span></el-menu-item>
            <el-menu-item index="migration-import"><el-icon><Download /></el-icon><span>数据导入</span></el-menu-item>
          </el-sub-menu>

          <el-menu-item index="backups">
            <el-icon><Cloudy /></el-icon><template #title><span>云端备份</span></template>
          </el-menu-item>

          <el-menu-item index="tools">
            <el-icon><Tools /></el-icon><template #title><span>实用工具</span></template>
          </el-menu-item>
        </el-menu>

        <!-- 底部切换按钮 -->
        <div class="sidebar-footer" :class="{ 'is-collapsed': isCollapse }">
          <el-button circle :icon="isCollapse ? Expand : Fold" @click="toggleCollapse" :title="isCollapse ? '展开' : '折叠'" />
          <el-button circle :icon="isDark ? Sunny : Moon" @click="toggleTheme" />
          <el-button circle @click="handleLogout" title="退出登录">
            <el-icon><SwitchButton /></el-icon>
          </el-button>
        </div>
      </el-aside>

      <!-- 抽屉菜单 (Mobile) -->
      <el-drawer
        v-model="layoutState.showMobileMenu"
        direction="ltr"
        size="240px"
        :with-header="false"
      >
        <div class="drawer-content">
          <el-menu
            :default-active="activeTab"
            class="side-menu"
            @select="handleMenuSelect"
            style="border-right: none;"
          >
            <el-menu-item index="accounts">
              <el-icon><Iphone /></el-icon>
              <span>我的账户</span>
            </el-menu-item>
            <el-sub-menu index="add-account">
              <template #title>
                <el-icon><Plus /></el-icon><span>添加账号</span>
              </template>
              <el-menu-item index="add-account-scan">
                <el-icon><Camera /></el-icon><span>扫码添加</span>
              </el-menu-item>
              <el-menu-item index="add-account-manual">
                <el-icon><Edit /></el-icon><span>手动输入</span>
              </el-menu-item>
            </el-sub-menu>
            <el-sub-menu index="migration">
              <template #title>
                <el-icon><Sort /></el-icon><span>数据迁移</span>
              </template>
              <el-menu-item index="migration-export"><el-icon><Upload /></el-icon><span>数据导出</span></el-menu-item>
              <el-menu-item index="migration-import"><el-icon><Download /></el-icon><span>数据导入</span></el-menu-item>
            </el-sub-menu>
            <el-menu-item index="backups">
              <el-icon><Cloudy /></el-icon><span>云端备份</span>
            </el-menu-item>
            <el-menu-item index="tools">
              <el-icon><Tools /></el-icon><span>实用工具</span>
            </el-menu-item>
          </el-menu>
          
          <div class="sidebar-footer">
            <el-button circle :icon="isDark ? Sunny : Moon" @click="toggleTheme" />
            <el-button circle @click="handleLogout" title="退出登录">
              <el-icon><SwitchButton /></el-icon>
            </el-button>
          </div>
        </div>
      </el-drawer>

      <el-main class="main-content">
        <!-- 视图：我的账户 -->
        <div v-if="activeTab === 'accounts'" class="view-container">
          <AccountList ref="accountListRef" @switch-tab="activeTab = $event" />
        </div>

        <!-- 视图：添加账号 -->
        <div v-if="activeTab === 'add-account-scan'" class="view-container">
          <AddAccountScan @success="handleSuccess" />
        </div>
        <div v-if="activeTab === 'add-account-manual'" class="view-container">
          <AddAccountManual @success="handleSuccess" />
        </div>

        <!-- 视图：数据导出 -->
        <div v-if="activeTab === 'migration-export'" class="view-container">
          <DataExport />
        </div>

        <!-- 视图：数据导入 -->
        <div v-if="activeTab === 'migration-import'" class="view-container">
          <DataImport @success="handleSuccess" />
        </div>

        <!-- 视图：云端备份 -->
        <div v-if="activeTab === 'backups'" class="view-container">
          <DataBackup @success="handleSuccess" />
        </div>

        <!-- 视图：实用工具 -->
        <div v-if="activeTab === 'tools'" class="view-container">
          <UtilityTools />
        </div>

      </el-main>
    </el-container>
  </el-container>
</template>

<script setup>
import { ref, nextTick, defineAsyncComponent } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import { Iphone, Plus, Camera, Edit, Sort, Upload, Download, Cloudy, Sunny, Moon, SwitchButton, Fold, Expand, Tools } from '@element-plus/icons-vue'
import { layoutState } from '../states/layout'
import { isDark, toggleTheme } from '../states/theme'
import { userState } from '../states/user'

const AccountList = defineAsyncComponent(() => import('../components/AccountList.vue'))
const AddAccountScan = defineAsyncComponent(() => import('../components/AddAccountScan.vue'))
const AddAccountManual = defineAsyncComponent(() => import('../components/AddAccountManual.vue'))
const DataExport = defineAsyncComponent(() => import('../components/DataExport.vue'))
const DataImport = defineAsyncComponent(() => import('../components/DataImport.vue'))
const DataBackup = defineAsyncComponent(() => import('../components/DataBackup.vue'))
const UtilityTools = defineAsyncComponent(() => import('../components/UtilityTools.vue'))

const activeTab = ref('accounts')
const accountListRef = ref(null)
const router = useRouter()
const isCollapse = ref(localStorage.getItem('sidebar_collapse') === 'true')

// 移动端菜单处理
const handleMenuSelect = (index) => {
  activeTab.value = index
  if (layoutState.isMobile) {
    layoutState.showMobileMenu = false
  }
}

// 操作成功回调 (刷新列表)
const handleSuccess = () => {
  activeTab.value = 'accounts'
  nextTick(() => {
    if (accountListRef.value) {
      accountListRef.value.fetchAccounts()
    }
  })
}

const handleLogout = async () => {
  await userState.logout()
  router.push('/login')
  ElMessage.success('已安全退出')
}

const toggleCollapse = () => {
  isCollapse.value = !isCollapse.value
  localStorage.setItem('sidebar_collapse', isCollapse.value)
}
</script>

<style scoped>
.home-container {
  height: 100%; /* 占满父容器 (App.vue 的 main) */
  background-color: var(--el-bg-color-page);
}

.main-body {
  height: 100%; /* 自动填充 */
  display: flex;
  overflow: hidden; /* 内部滚动 */
}

.left-aside {
  background: var(--el-bg-color);
  border-right: 1px solid var(--el-border-color-light);
  display: flex;
  flex-direction: column;
  overflow-x: hidden;
  overflow-y: auto;
  white-space: nowrap;
}

/* 视觉优化：隐藏侧边栏滚动条，保持界面清爽 */
.left-aside::-webkit-scrollbar {
  width: 0;
  height: 0;
}

.side-menu {
  border-right: none;
  padding-top: 10px;
  flex: 1;
}

.main-content {
  padding: 30px 20px;
  width: 100%;
  background-color: var(--el-bg-color-page);
  overflow-y: auto; /* 内容区独立滚动 */
}

.sidebar-footer {
  padding: 20px;
  text-align: center;
  display: flex;
  justify-content: center;
  gap: 10px;
}

.sidebar-footer .el-button {
  margin-left: 0;
}

.sidebar-footer.is-collapsed {
  flex-direction: column;
  align-items: center;
  padding: 10px 0;
}

.drawer-content {
  height: 100%;
  display: flex;
  flex-direction: column;
  overflow-y: auto; /* 确保移动端菜单过长时可以滚动 */
}
</style>