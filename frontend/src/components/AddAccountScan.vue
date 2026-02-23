<template>
  <div class="add-account-wrapper">
    <div class="tab-card-wrapper">
      <h2 style="text-align: center; margin-bottom: 20px;">📷 扫码添加</h2>
      <div style="max-width: 600px; margin: 0 auto;">
        <div style="text-align: center; margin-bottom: 20px; margin-top: 10px;">
          <p style="color: #909399;">请允许浏览器使用摄像头，或直接上传微信/系统截图。</p>
        </div>
        <QrScanner @scan-success="handleScanSuccess" />
      </div>
    </div>
  </div>
</template>

<script setup>
import { h } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { request } from '../utils/request'
import QrScanner from './QrScanner.vue'

const emit = defineEmits(['success'])

const handleScanSuccess = async (uri) => {
  try {
    const data = await request('/api/accounts/parse-uri', { 
      method: 'POST',
      body: JSON.stringify({ uri })
    })

    if (data.success && data.account) {
      const acc = data.account
      await ElMessageBox.confirm(
        h('div', { style: 'text-align:left; background:#f5f7fa; padding:15px; border-radius:8px;' }, [
          h('p', [h('strong', '服务方：'), acc.issuer || '未知']),
          h('p', [h('strong', '账号：'), acc.account || '未知']),
          h('p', [h('strong', '算法：'), `${acc.algorithm} (${acc.digits}位 / ${acc.period}秒)`])
        ]),
        '✅ 二维码解析成功，确认添加？',
        {
          confirmButtonText: '确认添加',
          cancelButtonText: '取消',
          type: 'success'
        }
      )

      const addData = await request('/api/accounts/add-from-uri', {
        method: 'POST',
        body: JSON.stringify({ uri, category: '手机扫码' })
      })

      if (addData.success) {
        ElMessage.success('扫码账号添加成功！')
        emit('success')
      }
    }
  } catch (err) {
    if (err !== 'cancel') console.error(err)
  }
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
</style>