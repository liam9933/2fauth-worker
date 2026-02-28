<template>
  <div class="tools-wrapper">
    <div class="tab-card-wrapper">
      <div class="tools-header">
        <el-button v-if="currentTool" link @click="currentTool = null" class="back-btn">
          <el-icon><ArrowLeft /></el-icon> 返回
        </el-button>
        <h2>{{ currentTool ? getToolTitle(currentTool) : '🛠️ 实用工具箱' }}</h2>
      </div>

      <!-- 工具列表 (卡片视图) -->
      <div v-if="!currentTool" class="tools-grid">
        <el-card 
          v-for="tool in tools" 
          :key="tool.id" 
          shadow="hover" 
          class="tool-card" 
          @click="currentTool = tool.id"
        >
          <div class="tool-card-content">
            <div class="icon-wrapper" :style="{ backgroundColor: tool.bgColor }">
              <el-icon :size="32" :color="tool.iconColor"><component :is="tool.icon" /></el-icon>
            </div>
            <div class="text-info">
              <h3>{{ tool.title }}</h3>
              <p>{{ tool.desc }}</p>
            </div>
          </div>
        </el-card>
      </div>

      <!-- 具体工具内容 -->
      <div v-else class="tool-container">
        
        <!-- 动态组件加载 -->
        <component :is="activeComponent" />

      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, defineAsyncComponent } from 'vue'
import { Key, ArrowLeft, Timer, Lock, Camera } from '@element-plus/icons-vue'
const ToolPassword = defineAsyncComponent(() => import('@/features/tools/components/passwordGenerator.vue'))
const ToolTimeSync = defineAsyncComponent(() => import('@/features/tools/components/timeSync.vue'))
const ToolQrParser = defineAsyncComponent(() => import('@/features/tools/components/qrParser.vue'))
const ToolTotpSecret = defineAsyncComponent(() => import('@/features/tools/components/totpSecret.vue'))

const currentTool = ref(null)

const tools = [
  { 
    id: 'totp-secret', 
    title: 'TOTP 密钥工具', 
    desc: '随机生成密钥，支持 Base32 格式转换与校验', 
    icon: Lock, 
    iconColor: '#67C23A',
    bgColor: 'var(--el-color-success-light-9)'
  },
  { 
    id: 'password', 
    title: '密码生成器', 
    desc: '生成高强度随机密码，支持自定义长度和字符类型', 
    icon: Key, 
    iconColor: '#409EFF',
    bgColor: 'var(--el-color-primary-light-9)'
  },
  {
    id: 'time-sync',
    title: '时间校准器',
    desc: '精准检测本地时间与服务器时间的偏差',
    icon: Timer,
    iconColor: '#E6A23C',
    bgColor: 'var(--el-color-warning-light-9)'
  },
  {
    id: 'qr-parser',
    title: '二维码解析器',
    desc: '识别图片中的二维码内容，提取 OTP 链接',
    icon: Camera,
    iconColor: '#F56C6C',
    bgColor: 'var(--el-color-danger-light-9)'
  }
]

const getToolTitle = (id) => {
  const t = tools.find(t => t.id === id)
  return t ? t.title : '工具'
}

const activeComponent = computed(() => {
  switch (currentTool.value) {
    case 'password': return ToolPassword;
    case 'time-sync': return ToolTimeSync;
    case 'qr-parser': return ToolQrParser;
    case 'totp-secret': return ToolTotpSecret;
    default: return null
  }
})
</script>
