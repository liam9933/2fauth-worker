import { defineAsyncComponent, h, ref, onMounted, onUnmounted } from 'vue'
import { ElEmpty, ElButton } from 'element-plus'
import { i18n } from '@/locales'

/**
 * 增强的异步组件工厂函数
 * 解决 PWA/Cloudflare 环境下分块加载失败导致的白屏问题
 */
export function createAsyncComponent(loader) {
    return defineAsyncComponent({
        loader,
        // 加载中占位
        loadingComponent: {
            setup() {
                const dots = ref('...')
                let timer = null

                onMounted(() => {
                    timer = setInterval(() => {
                        if (dots.value.length >= 10) {
                            dots.value = '...'
                        } else {
                            dots.value += '.'
                        }
                    }, 400)
                })

                onUnmounted(() => {
                    if (timer) clearInterval(timer)
                })

                return () => h('div', {
                    style: 'display: flex; justify-content: center; align-items: center; min-height: 400px; width: 100%;'
                }, [
                    h('div', {
                        class: 'is-loading',
                        style: `
                            font-size: 24px; 
                            font-family: monospace; 
                            color: var(--el-color-primary);
                            font-weight: 500;
                            letter-spacing: 1px;
                        `
                    }, `Loading${dots.value}`)
                ])
            }
        },
        // 失败占位
        errorComponent: {
            props: ['error'],
            render() {
                const { t } = i18n.global
                return h('div', {
                    style: 'padding: 40px; text-align: center;'
                }, [
                    h(ElEmpty, { description: t('common.loading_failed') }, {
                        default: () => h(ElButton, {
                            type: 'primary',
                            onClick: () => window.location.reload()
                        }, t('common.refresh_now'))
                    })
                ])
            }
        },
        // 超时设置
        timeout: 15000,
        // 延迟显示加载组件
        delay: 200,
        // 错误重试逻辑
        onError(error, retry, fail, attempts) {
            if (attempts <= 3) {
                console.warn(`[AsyncComponent] Loading failed, retrying (${attempts}/3)...`, error)
                retry()
            } else {
                fail()
            }
        }
    })
}
