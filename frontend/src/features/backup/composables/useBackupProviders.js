import { ref, onMounted } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { useVaultStore } from '@/features/vault/store/vaultStore'
import { backupService } from '@/features/backup/service/backupService'
import { i18n } from '@/locales'

export function useBackupProviders() {
    const { t } = i18n.global
    const vaultStore = useVaultStore()

    const providers = ref([])
    const availableTypes = ref(['s3', 'telegram', 'webdav']) // Default types
    const isLoading = ref(false)

    // Form and Dialog State
    const showConfigDialog = ref(false)
    const isEditing = ref(false)
    const isTesting = ref(false)
    const isSaving = ref(false)
    const isEditingWebdavPwd = ref(false)
    const isEditingS3Secret = ref(false)
    const isEditingTelegramToken = ref(false)
    const isEditingGoogleDrive = ref(false)
    const isAuthenticatingGoogle = ref(false)
    const authStatus = ref(null) // null, 'success', 'error'
    const authErrorMessage = ref('')

    const initialFormState = () => ({
        type: 's3',
        name: '',
        config: { url: '', username: '', password: '', saveDir: '/2fauth-worker-backup', endpoint: '', bucket: '', region: 'auto', accessKeyId: '', secretAccessKey: '', botToken: '', chatId: '', refreshToken: '', folderId: '' },
        autoBackup: false,
        autoBackupPassword: '',
        autoBackupRetain: 30
    })

    const form = ref(initialFormState())
    const currentProviderId = ref(null)
    const hasExistingAutoPwd = ref(false)
    const configUseExistingAutoPwd = ref(false)

    // Methods
    const fetchProviders = async () => {
        const cachedEncrypted = await vaultStore.getEncryptedBackupProviders()
        if (cachedEncrypted && Array.isArray(cachedEncrypted)) {
            providers.value = cachedEncrypted
        } else {
            isLoading.value = true
        }

        try {
            const res = await backupService.getProviders()
            if (res.success) {
                providers.value = res.providers
                if (res.availableTypes) {
                    availableTypes.value = res.availableTypes
                }
                await vaultStore.saveEncryptedBackupProviders(res.providers)
            }
        } finally { isLoading.value = false }
    }

    const openAddDialog = () => {
        isEditing.value = false
        isEditingWebdavPwd.value = false
        isEditingS3Secret.value = false
        isEditingTelegramToken.value = false
        isEditingGoogleDrive.value = false
        form.value = initialFormState()
        hasExistingAutoPwd.value = false
        configUseExistingAutoPwd.value = false
        showConfigDialog.value = true
    }

    const editProvider = (provider) => {
        isEditing.value = true
        isEditingWebdavPwd.value = false
        isEditingS3Secret.value = false
        isEditingTelegramToken.value = false
        isEditingGoogleDrive.value = false
        currentProviderId.value = provider.id
        form.value = JSON.parse(JSON.stringify({
            type: provider.type,
            name: provider.name,
            config: provider.config,
            autoBackup: !!provider.auto_backup,
            autoBackupPassword: '',
            autoBackupRetain: provider.auto_backup_retain ?? 30
        }))
        hasExistingAutoPwd.value = !!provider.auto_backup_password
        configUseExistingAutoPwd.value = true
        showConfigDialog.value = true
    }

    const validateForm = () => {
        if (!form.value.name) return t('backup.require_name')
        const c = form.value.config
        if (form.value.type === 'webdav') {
            if (!c.url) return t('backup.require_webdav_url')
            if (!c.username) return t('backup.require_username')
            if (!c.password) return t('backup.require_password')
        } else if (form.value.type === 's3') {
            if (!c.endpoint) return t('backup.require_endpoint')
            if (!c.bucket) return t('backup.require_bucket')
            if (!c.accessKeyId) return t('backup.require_access_key')
            if (!c.secretAccessKey) return t('backup.require_secret_key')
        } else if (form.value.type === 'telegram') {
            if (!c.botToken) return t('backup.require_telegram_token')
            if (!c.chatId) return t('backup.require_telegram_chat_id')
        } else if (form.value.type === 'gdrive') {
            if (!c.refreshToken) return t('backup.require_google_auth')
        }

        if (form.value.autoBackup) {
            if (isEditing.value && hasExistingAutoPwd.value && configUseExistingAutoPwd.value) {
                return null
            }
            if (!form.value.autoBackupPassword || form.value.autoBackupPassword.length < 12) {
                return t('backup.password_min_length')
            }
        }
        return null
    }

    const testConnection = async () => {
        const error = validateForm()
        if (error) return ElMessage.warning(error)

        isTesting.value = true
        try {
            const res = await backupService.testConnection(
                form.value.type,
                form.value.config,
                isEditing.value ? currentProviderId.value : null
            )
            if (res.success) ElMessage.success(t('backup.test_success'))
        } catch (e) {
            // Already handled by request.js global error handler
        } finally { isTesting.value = false }
    }

    const saveProvider = async () => {
        const error = validateForm()
        if (error) return ElMessage.warning(error)

        if (isEditing.value && hasExistingAutoPwd.value && configUseExistingAutoPwd.value) {
            form.value.autoBackupPassword = ''
        }

        isSaving.value = true
        try {
            const res = isEditing.value
                ? await backupService.updateProvider(currentProviderId.value, form.value)
                : await backupService.createProvider(form.value)
            if (res.success) {
                ElMessage.success(t('backup.save_success'))
                showConfigDialog.value = false
                await fetchProviders()
            }
        } catch (e) {
            // Already handled by request.js
        } finally { isSaving.value = false }
    }

    const deleteProvider = async (provider) => {
        try {
            await ElMessageBox.confirm(t('backup.delete_provider_confirm'), t('common.warning'), { type: 'warning' })
            await backupService.deleteProvider(provider.id)
            await fetchProviders()
        } catch (e) {
            // Error handled by request.js (unless it's 'cancel' from ElMessageBox)
        }
    }

    const startGoogleAuth = async () => {
        isAuthenticatingGoogle.value = true
        authStatus.value = null
        authErrorMessage.value = ''
        try {
            const res = await backupService.getGoogleAuthUrl()
            if (res.success && res.authUrl) {
                const name = 'google_auth'
                const specs = 'width=600,height=700,left=200,top=100'
                const authWindow = window.open(res.authUrl, name, specs)

                // 检查窗口是否被关闭
                const timer = setInterval(() => {
                    try {
                        // COOP 可能导致访问 authWindow.closed 报错，这里用 try-catch 保护
                        if (authWindow && authWindow.closed) {
                            clearInterval(timer)
                            // 若窗口关闭且仍未成功，重置加载状态
                            if (isAuthenticatingGoogle.value && !authStatus.value) {
                                isAuthenticatingGoogle.value = false
                            }
                        }
                    } catch (e) {
                        // 访问被拒绝说明窗口已经跳转到不同策略的域
                        // 我们不需要报错，因为我们有 BroadcastChannel 兜底
                    }
                }, 1000)
            } else {
                isAuthenticatingGoogle.value = false
            }
        } catch (e) {
            isAuthenticatingGoogle.value = false
        }
    }

    const handleAuthMessage = async (event) => {
        const data = event instanceof MessageEvent ? event.data : event
        if (!data || !data.type) return

        if (data.type === 'GDRIVE_AUTH_SUCCESS') {
            isAuthenticatingGoogle.value = false
            authStatus.value = 'success'
            form.value.config.refreshToken = data.refreshToken
            if (!form.value.config.saveDir) {
                form.value.config.saveDir = '/2fauth-worker-backup'
            }
        } else if (data.type === 'GDRIVE_AUTH_ERROR') {
            isAuthenticatingGoogle.value = false
            authStatus.value = 'error'
            authErrorMessage.value = data.message || t('backup.google_auth_failed')
        }
    }

    const setupAuthListener = (onMessage) => {
        const handleMsg = (e) => {
            onMessage(e)
            handleAuthMessage(e)
        }

        // 1. Listen via postMessage
        window.addEventListener('message', handleMsg)

        // 2. Listen via BroadcastChannel (More robust)
        const bc = new BroadcastChannel('gdrive_oauth_channel')
        bc.onmessage = handleMsg

        return () => {
            window.removeEventListener('message', handleMsg)
            bc.close()
        }
    }

    onMounted(fetchProviders)

    return {
        providers,
        isLoading,
        showConfigDialog,
        isEditing,
        isTesting,
        isSaving,
        isEditingWebdavPwd,
        isEditingS3Secret,
        isEditingTelegramToken,
        isEditingGoogleDrive,
        isAuthenticatingGoogle,
        authStatus,
        authErrorMessage,
        form,
        hasExistingAutoPwd,
        configUseExistingAutoPwd,
        fetchProviders,
        openAddDialog,
        editProvider,
        testConnection,
        saveProvider,
        deleteProvider,
        startGoogleAuth,
        handleAuthMessage,
        setupAuthListener,
        availableTypes
    }
}
