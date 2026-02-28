import { ElMessage } from 'element-plus'

export async function copyToClipboard(text, successMsg = '复制成功') {
  if (!text) return
  try {
    await navigator.clipboard.writeText(text)
    ElMessage.success(successMsg)
  } catch (e) {
    ElMessage.error('复制失败')
    console.error('Clipboard error:', e)
  }
}

export function triggerDownload(href, filename) {
  const a = document.createElement('a')
  a.href = href
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
}

export function downloadBlob(content, filename, mimeType) {
  const blob = new Blob([content], { type: mimeType })
  const url = URL.createObjectURL(blob)
  triggerDownload(url, filename)
  URL.revokeObjectURL(url)
}