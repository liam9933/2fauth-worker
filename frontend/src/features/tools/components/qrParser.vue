<template>
  <div class="tool-pane">
    <div class="qr-parser-container">
      <!-- Use QrScanner Component -->
      <QrScanner @scan-success="handleScanSuccess" />

      <!-- Result Display -->
      <div v-if="scanResult" class="result-section" style="margin-top: 20px;">
        <el-divider content-position="left">解析结果</el-divider>
        <el-input v-model="scanResult" type="textarea" :rows="3" readonly resize="none" />
        <el-button type="success" plain style="width: 100%; margin-top: 10px;" @click="copyResult">
          <el-icon><CopyDocument /></el-icon> 复制内容
        </el-button>
      </div>

    </div>
  </div>
</template>

<script setup>
import { ref, defineAsyncComponent } from 'vue'
import { ElMessage } from 'element-plus'
import { CopyDocument } from '@element-plus/icons-vue'

// Import QrScanner component
const QrScanner = defineAsyncComponent(() => import('@/shared/components/qrScanner.vue'))

const scanResult = ref('')

const handleScanSuccess = (result) => {
  scanResult.value = result
  ElMessage.success('二维码解析成功')
}

const copyResult = async () => {
  if (!scanResult.value) return
  try { await navigator.clipboard.writeText(scanResult.value); ElMessage.success('内容已复制') } catch (e) {}
}
</script>