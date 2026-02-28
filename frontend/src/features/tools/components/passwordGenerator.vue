<template>
  <div class="tool-pane">
    <div class="result-box">
      <div class="password-display">{{ password }}</div>
      <el-button type="primary" link @click="copyPassword" title="复制">
        <el-icon size="20"><CopyDocument /></el-icon>
      </el-button>
    </div>
    
    <div class="controls">
      <div class="control-row">
        <span class="label">长度: {{ length }}</span>
        <el-slider v-model="length" :min="6" :max="64" @input="generate" style="flex: 1; margin: 0 15px;" />
      </div>
      
      <div class="control-row checkboxes">
        <el-checkbox v-model="useUpper" label="A-Z" @change="generate" />
        <el-checkbox v-model="useLower" label="a-z" @change="generate" />
        <el-checkbox v-model="useNumber" label="0-9" @change="generate" />
        <el-checkbox v-model="useSymbol" label="#$@" @change="generate" />
      </div>
    </div>

    <el-button type="primary" size="large" @click="generate" style="width: 100%; margin-top: 20px;">
      <el-icon><Refresh /></el-icon> 重新生成
    </el-button>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { ElMessage } from 'element-plus'
import { CopyDocument, Refresh } from '@element-plus/icons-vue'

const password = ref('')
const length = ref(16)
const useUpper = ref(true)
const useLower = ref(true)
const useNumber = ref(true)
const useSymbol = ref(true)

const generate = () => {
  let chars = ''
  if (useLower.value) chars += 'abcdefghijklmnopqrstuvwxyz'
  if (useUpper.value) chars += 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'
  if (useNumber.value) chars += '0123456789'
  if (useSymbol.value) chars += '!@#$%^&*()_+-=[]{}|;:,.<>?'
  
  if (!chars) {
    password.value = ''
    ElMessage.warning('请至少选择一种字符类型')
    return
  }
  
  let res = ''
  const array = new Uint32Array(length.value)
  window.crypto.getRandomValues(array)
  for (let i = 0; i < length.value; i++) {
    res += chars[array[i] % chars.length]
  }
  password.value = res
}

const copyPassword = async () => {
  if (!password.value) return
  try {
    await navigator.clipboard.writeText(password.value)
    ElMessage.success('密码已复制')
  } catch (e) {
    ElMessage.error('复制失败')
  }
}

onMounted(generate)
</script>