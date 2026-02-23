<template>
  <div class="add-account-wrapper">
    <div class="tab-card-wrapper">
      <h2 style="text-align: center; margin-bottom: 20px;">⌨️ 手动输入</h2>
      <div style="max-width: 600px; margin: 0 auto;">
        <el-form :model="newAccount" label-position="top" :rules="rules" ref="addFormRef" style="padding: 10px 0;">
          <el-form-item label="服务名称 (如 Google, GitHub)" prop="service">
            <el-input v-model="newAccount.service" placeholder="请输入服务名称" />
          </el-form-item>
          <el-form-item label="账号标识 (如 邮箱地址)" prop="account">
            <el-input v-model="newAccount.account" placeholder="请输入账号或邮箱" />
          </el-form-item>
          <el-form-item label="安全密钥 (Base32格式)" prop="secret">
            <el-input v-model="newAccount.secret" placeholder="请输入 16 位以上的安全密钥" />
          </el-form-item>
          <el-row :gutter="20">
            <el-col :span="12">
              <el-form-item label="代码位数" prop="digits">
                <el-select v-model="newAccount.digits" style="width: 100%">
                  <el-option label="6 位" :value="6" />
                  <el-option label="8 位" :value="8" />
                </el-select>
              </el-form-item>
            </el-col>
            <el-col :span="12">
              <el-form-item label="更新周期" prop="period">
                <el-select v-model="newAccount.period" style="width: 100%">
                  <el-option label="30 秒" :value="30" />
                  <el-option label="60 秒" :value="60" />
                </el-select>
              </el-form-item>
            </el-col>
          </el-row>
          <el-form-item label="分类 (可选)" prop="category">
            <el-input v-model="newAccount.category" placeholder="如 工作, 个人" />
          </el-form-item>
          <el-form-item style="margin-top: 30px;">
            <el-button type="primary" :loading="submitting" @click="submitAddAccount" style="width: 100%;" size="large">确认添加</el-button>
          </el-form-item>
        </el-form>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref } from 'vue'
import { ElMessage } from 'element-plus'
import { request } from '../utils/request'

const emit = defineEmits(['success'])

const submitting = ref(false)
const addFormRef = ref(null)
const newAccount = ref({
  service: '', account: '', secret: '', category: '', digits: 6, period: 30
})

const rules = {
  service: [{ required: true, message: '请输入服务名称', trigger: 'blur' }],
  account: [{ required: true, message: '请输入账号标识', trigger: 'blur' }],
  secret: [
    { required: true, message: '请输入安全密钥', trigger: 'blur' },
    { min: 16, message: '密钥长度通常不少于 16 位', trigger: 'blur' }
  ]
}

const submitAddAccount = async () => {
  if (!addFormRef.value) return
  await addFormRef.value.validate(async (valid) => {
    if (valid) {
      submitting.value = true
      try {
        const data = await request('/api/accounts', {
          method: 'POST',
          body: JSON.stringify(newAccount.value)
        })
        if (data.success) {
          ElMessage.success('账号添加成功！')
          newAccount.value = { service: '', account: '', secret: '', category: '', digits: 6, period: 30 }
          emit('success')
        }
      } catch (error) {
      } finally {
        submitting.value = false
      }
    }
  })
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