<template>
  <div class="data-backup-wrapper">
    <div class="tab-card-wrapper">
      <div style="text-align: center; margin-bottom: 30px;">
        <h2>云端备份中心</h2>
        <p style="color: var(--el-text-color-secondary);">配置多个备份源（WebDAV, S3等），确保数据万无一失。</p>
      </div>
      <BackupSettings @restore-success="$emit('success')" />
    </div>
  </div>
</template>

<script setup>
import BackupSettings from '@/features/backup/components/backupSettings.vue'

const emit = defineEmits(['success'])
</script>