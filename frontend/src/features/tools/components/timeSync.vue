<template>
  <div class="tool-pane">
    <div class="time-sync-container">
      <!-- 状态横幅 -->
      <el-alert
        v-if="syncStatus"
        :title="syncStatus.title"
        :type="syncStatus.type"
        :description="syncStatus.desc"
        show-icon
        :closable="false"
        style="margin-bottom: 20px;"
      />

      <!-- 时钟仪表盘 -->
      <div class="clocks-wrapper">
        <div class="clock-card local">
          <div class="clock-label">📱 本地设备时间</div>
          <div class="clock-time">{{ formatTime(localTime) }}</div>
        </div>
        <div class="clock-card server">
          <div class="clock-label">☁️ 服务器时间 (估算)</div>
          <div class="clock-time">{{ formatTime(serverTime) }}</div>
        </div>
      </div>

      <!-- 详细数据 -->
      <div class="sync-details">
        <p>时间偏差: <strong>{{ offset !== null ? `${offset > 0 ? '+' : ''}${offset} ms` : '--' }}</strong></p>
        <p>网络延迟: <span>{{ rtt !== null ? `${rtt} ms` : '--' }}</span></p>
      </div>

      <el-button type="primary" size="large" :loading="isSyncing" @click="syncTime" style="width: 100%; margin-top: 20px;">
        <el-icon><Refresh /></el-icon> 立即检测
      </el-button>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { ElMessage } from 'element-plus'
import { Refresh } from '@element-plus/icons-vue'
import { request } from '@/shared/utils/request'

const localTime = ref(Date.now())
const offset = ref(null)
const rtt = ref(null)
const isSyncing = ref(false)
let clockTimer = null

const serverTime = computed(() => localTime.value + (offset.value || 0))
const formatTime = (ts) => new Date(ts).toLocaleTimeString()

const syncStatus = computed(() => {
  if (offset.value === null) return null
  const abs = Math.abs(offset.value)
  if (abs < 2000) return { title: '时间同步正常', type: 'success', desc: '本地时间与服务器误差极小，不影响 2FA 验证。' }
  if (abs < 30000) return { title: '存在微小偏差', type: 'warning', desc: '建议校准本地时间，但通常仍可使用。' }
  return { title: '时间偏差过大', type: 'error', desc: '严重偏差！2FA 验证码将失效，请务必校准设备时间。' }
})

const syncTime = async () => {
  isSyncing.value = true
  const start = Date.now()
  try {
    const res = await request('/api/tools/server-time')
    const end = Date.now()
    if (res.success) {
      const serverTs = res.time
      rtt.value = end - start
      const estimatedServerTime = serverTs + (rtt.value / 2)
      offset.value = Math.round(estimatedServerTime - end)
      ElMessage.success(`校准完成，偏差 ${offset.value}ms`)
    }
  } catch (e) {
    ElMessage.error(e.message || '无法连接服务器')
  } finally {
    isSyncing.value = false
  }
}

onMounted(() => {
  clockTimer = setInterval(() => { localTime.value = Date.now() }, 1000)
  syncTime()
})

onUnmounted(() => {
  if (clockTimer) clearInterval(clockTimer)
})
</script>