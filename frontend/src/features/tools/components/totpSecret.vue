<template>
  <div class="tool-pane">
    <div class="totp-layout">
      <!-- Bottom: Configuration -->
      <div class="config-side">
        <!-- 1. Secret Input (Tabs) -->
        <div class="config-section">
          <div class="section-header">
            <h3 class="section-title">密钥配置</h3>
            <el-button link type="primary" @click="showScanner = true">
              <el-icon><Camera /></el-icon> 识别二维码导入
            </el-button>
          </div>
          
          <el-tabs v-model="activeTab" type="border-card" class="secret-tabs">
            <el-tab-pane label="Base32" name="base32">
              <el-input 
                v-model="secretBase32" 
                @input="handleBase32Input" 
                placeholder="JBSWY3DP..." 
                clearable
                type="textarea"
                :rows="3"
              />
              <div class="tab-actions">
                <el-button size="small" @click="refreshBase32"><el-icon><Refresh /></el-icon> 随机生成</el-button>
                <el-button size="small" @click="copyToClipboard(secretBase32)"><el-icon><CopyDocument /></el-icon> 复制</el-button>
              </div>
            </el-tab-pane>
            
            <el-tab-pane label="Hex (十六进制)" name="hex">
              <el-input 
                v-model="secretHex" 
                @input="handleHexInput" 
                placeholder="48656c6c6f..." 
                clearable
                type="textarea"
                :rows="3"
              />
              <div class="tab-actions">
                <el-button size="small" @click="refreshHex"><el-icon><Refresh /></el-icon> 随机生成</el-button>
                <el-button size="small" @click="copyToClipboard(secretHex)"><el-icon><CopyDocument /></el-icon> 复制</el-button>
              </div>
            </el-tab-pane>
            
            <el-tab-pane label="ASCII" name="ascii">
              <el-input 
                v-model="secretAscii" 
                @input="handleAsciiInput" 
                placeholder="Hello..." 
                clearable
                type="textarea"
                :rows="3"
              />
              <div class="tab-actions">
                <el-button size="small" @click="refreshAscii"><el-icon><Refresh /></el-icon> 随机生成</el-button>
                <el-button size="small" @click="copyToClipboard(secretAscii)"><el-icon><CopyDocument /></el-icon> 复制</el-button>
              </div>
            </el-tab-pane>
          </el-tabs>
        </div>

        <!-- 2. Metadata -->
        <div class="config-section">
          <h3 class="section-title">基础信息</h3>
          <div class="meta-row">
            <el-input v-model="issuer" @input="updateUri">
              <template #prefix><span class="input-label">服务商</span></template>
            </el-input>
            <el-input v-model="account" @input="updateUri">
              <template #prefix><span class="input-label">账号标识</span></template>
            </el-input>
          </div>
        </div>

        <!-- 3. Result Preview -->
        <div class="config-section">
          <div class="section-header">
            <h3 class="section-title">结果预览</h3>
            <el-button link type="primary" @click="downloadQrCode" :disabled="!qrCodeUrl">
              <el-icon><Download /></el-icon> 保存二维码
            </el-button>
          </div>
          <div class="preview-top-section">
            <div class="qr-wrapper" v-loading="!qrCodeUrl">
              <img v-if="qrCodeUrl" :src="qrCodeUrl" alt="QR Code" class="qr-img" />
              <el-empty v-else description="配置参数以生成预览" :image-size="100" />
            </div>
            <div class="result-card">
              <div class="totp-code" :class="{ 'blur': !currentCode }">{{ currentCode || '------' }}</div>
              <div class="totp-timer" :class="{ 'urgent': remaining < 5 }">
                <el-icon><Timer /></el-icon> {{ remaining }}s 后刷新
              </div>
              <el-button type="primary" plain size="small" @click="copyToClipboard(currentCode, '验证码已复制')" :disabled="!currentCode" style="margin-top: 10px;">
                <el-icon><CopyDocument /></el-icon> 复制验证码
              </el-button>
            </div>
          </div>
          <div class="uri-box" v-if="qrCodeUrl">
            <div class="uri-text">{{ currentUri }}</div>
            <el-button link type="primary" @click="copyToClipboard(currentUri)"><el-icon><CopyDocument /></el-icon></el-button>
          </div>
        </div>

        <!-- 4. Advanced Settings -->
        <div class="config-section">
          <el-collapse>
            <el-collapse-item title="高级设置 (算法/位数/步长)" name="1">
              <div class="advanced-row">
                <el-select v-model="algorithm" @change="updateAll('settings')" placeholder="算法" style="flex: 1">
                  <el-option label="SHA-1 (默认)" value="SHA-1" />
                  <el-option label="SHA-256" value="SHA-256" />
                  <el-option label="SHA-512" value="SHA-512" />
                </el-select>
                <el-select v-model="digits" @change="updateAll('settings')" placeholder="位数" style="width: 100px">
                  <el-option label="6 位" :value="6" />
                  <el-option label="8 位" :value="8" />
                </el-select>
                <el-select v-model="period" @change="updateAll('settings')" placeholder="周期" style="width: 100px">
                  <el-option label="30 秒" :value="30" />
                  <el-option label="60 秒" :value="60" />
                </el-select>
              </div>
            </el-collapse-item>
          </el-collapse>
        </div>

        <!-- 5. Time Offset -->
        <div class="config-section">
          <div class="label-row">
            <span class="label-text">时间偏移 (Time Travel): {{ timeOffset > 0 ? '+' : '' }}{{ timeOffset }}s</span>
            <el-button link type="primary" @click="adjustTime(0, true)" size="small">重置</el-button>
          </div>
          <el-button-group style="width: 100%; display: flex;">
            <el-button @click="adjustTime(-period)" style="flex:1" size="small">上个周期</el-button>
            <el-button @click="adjustTime(period)" style="flex:1" size="small">下个周期</el-button>
          </el-button-group>
        </div>

        <!-- Save Button -->
        <div class="config-section" style="margin-top: 20px;">
          <el-button type="success" size="large" @click="saveToVault" style="width: 100%;" :loading="isSaving">
            <el-icon><CircleCheck /></el-icon> 保存到我的账户
          </el-button>
        </div>
      </div>
    </div>
    
    <!-- 二维码扫描弹窗 -->
    <el-dialog v-model="showScanner" title="扫描二维码" width="500px" destroy-on-close append-to-body>
      <QrScanner @scan-success="handleScanSuccess" />
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, onMounted, onUnmounted, defineAsyncComponent } from 'vue'
import { ElMessage } from 'element-plus'
import { CopyDocument, Refresh, Timer, Camera, CircleCheck, Download } from '@element-plus/icons-vue'
import QRCode from 'qrcode'
import { request } from '@/shared/utils/request'
import { base32ToBytes, bytesToBase32, hexToBytes, bytesToHex, asciiToBytes, bytesToAscii, generateTOTP, parseOtpUri } from '@/shared/utils/totp'
import { useQueryClient } from '@tanstack/vue-query'
import { copyToClipboard, triggerDownload } from '@/shared/utils/common'

const QrScanner = defineAsyncComponent(() => import('@/shared/components/qrScanner.vue'))

// --- State ---
const queryClient = useQueryClient()
const activeTab = ref('base32')
const secretBase32 = ref('')
const secretHex = ref('')
const secretAscii = ref('')

// Metadata & Settings
const issuer = ref('2FAuth-Tool')
const account = ref('TestUser')
const algorithm = ref('SHA-1')
const digits = ref(6)
const period = ref(30)
const timeOffset = ref(0)

const qrCodeUrl = ref('')
const currentUri = ref('')
const currentCode = ref('')
const remaining = ref(30)
const isSaving = ref(false)
const showScanner = ref(false)
let timer = null

// --- Handlers ---
const updateAll = async (sourceType) => {
  try {
    // 1. Sync Inputs
    if (sourceType === 'base32') {
      const bytes = base32ToBytes(secretBase32.value)
      secretHex.value = bytesToHex(bytes)
      secretAscii.value = bytesToAscii(bytes)
    } else if (sourceType === 'hex') {
      const bytes = hexToBytes(secretHex.value)
      if (bytes.length > 0) secretBase32.value = bytesToBase32(bytes)
      secretAscii.value = bytesToAscii(bytes)
    } else if (sourceType === 'ascii') {
      const bytes = asciiToBytes(secretAscii.value)
      secretBase32.value = bytesToBase32(bytes)
      secretHex.value = bytesToHex(bytes)
    }

    // 2. Generate QR
    if (secretBase32.value) {
      const label = encodeURIComponent(`${issuer.value}:${account.value}`)
      const algoParam = algorithm.value.replace('-', '') // SHA-1 -> SHA1
      const uri = `otpauth://totp/${label}?secret=${secretBase32.value}&issuer=${encodeURIComponent(issuer.value)}&algorithm=${algoParam}&period=${period.value}&digits=${digits.value}`
      currentUri.value = uri
      qrCodeUrl.value = await QRCode.toDataURL(uri, { width: 200, margin: 1 })
    } else {
      qrCodeUrl.value = ''
      currentUri.value = ''
      currentCode.value = ''
    }

    // 3. Update TOTP immediately
    calcTotp()
  } catch (e) {
    console.error(e)
    // Ignore decoding errors during typing
  }
}

const handleBase32Input = () => updateAll('base32')
const handleHexInput = () => updateAll('hex')
const handleAsciiInput = () => updateAll('ascii')
const updateUri = () => updateAll('settings')

const refreshBase32 = () => {
  // Generate 20 random bytes (160 bits) - Standard high security
  const array = new Uint8Array(20)
  window.crypto.getRandomValues(array)
  secretBase32.value = bytesToBase32(array)
  updateAll('base32')
  ElMessage.success('已生成新的随机密钥')
}

const refreshHex = () => {
  // Generate 20 random bytes
  const array = new Uint8Array(20)
  window.crypto.getRandomValues(array)
  secretHex.value = bytesToHex(array)
  updateAll('hex')
  ElMessage.success('已生成新的 Hex 密钥')
}

const refreshAscii = () => {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*()'
  let result = ''
  const array = new Uint32Array(20)
  window.crypto.getRandomValues(array)
  for (let i = 0; i < 20; i++) result += chars[array[i] % chars.length]
  secretAscii.value = result
  updateAll('ascii')
  ElMessage.success('已生成随机 ASCII 密钥')
}

// --- TOTP Calculation ---
const calcTotp = async () => {
  if (!secretBase32.value) return
  
  const p = period.value
  const now = (Date.now() / 1000) + timeOffset.value
  const epoch = Math.floor(now / p)
  remaining.value = Math.ceil(p - (now % p))

  try {
    // 计算周期偏移量 (Time Travel)
    const periodOffset = Math.floor(timeOffset.value / p)
    currentCode.value = await generateTOTP(secretBase32.value, p, digits.value, algorithm.value, periodOffset)
  } catch (e) {
    currentCode.value = 'ERROR'
  }
}

// --- Time Travel ---
const adjustTime = (delta, reset = false) => {
  if (reset) timeOffset.value = 0
  else timeOffset.value += delta
  calcTotp()
}

// --- Import QR ---
const handleScanSuccess = (uri) => {
  showScanner.value = false
  handleParsedUri(uri)
}

const handleParsedUri = (uri) => {
  const parsed = parseOtpUri(uri)
  if (parsed) {
    if (parsed.secret) {
      secretBase32.value = parsed.secret
      updateAll('base32')
    }
    if (parsed.service) issuer.value = parsed.service
    if (parsed.account) account.value = parsed.account
    if (parsed.digits) digits.value = parsed.digits
    if (parsed.period) period.value = parsed.period
    if (parsed.algorithm) algorithm.value = parsed.algorithm
    
    updateAll('settings')
    ElMessage.success('二维码解析成功')
  } else {
    ElMessage.warning('无效的 OTP URI')
  }
}

// --- Save to Vault ---
const saveToVault = async () => {
  if (!secretBase32.value) return ElMessage.warning('密钥不能为空')
  if (!issuer.value || !account.value) return ElMessage.warning('请填写服务商和账号')
  
  isSaving.value = true
  try {
    const res = await request('/api/vault', {
      method: 'POST',
      body: JSON.stringify({
        service: issuer.value,
        account: account.value,
        secret: secretBase32.value,
        digits: digits.value,
        period: period.value,
        category: '工具箱添加'
      })
    })
    if (res.success) {
      ElMessage.success('已保存到我的账户')
      // 刷新账号列表缓存
      queryClient.invalidateQueries(['vault'])
    }
  } catch (e) {
    // Error handled by request
  } finally {
    isSaving.value = false
  }
}

const downloadQrCode = () => {
  if (!qrCodeUrl.value) return
  triggerDownload(qrCodeUrl.value, `2fa-qr-${account.value || 'code'}.png`)
}

onMounted(() => {
  refreshBase32() // Init with a random key
  timer = setInterval(calcTotp, 1000)
})

onUnmounted(() => { if (timer) clearInterval(timer) })
</script>