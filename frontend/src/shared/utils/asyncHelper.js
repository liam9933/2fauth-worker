import { defineAsyncComponent, h, ref, onMounted, onUnmounted, defineComponent } from 'vue'
import { ElEmpty, ElButton } from 'element-plus'
import { i18n } from '@/locales'

/**
 * 增强的异步组件工厂函数
 * 解决 PWA/Cloudflare 环境下分块加载失败导致的白屏问题
 */
export function createAsyncComponent(loader) {
    return defineAsyncComponent({
        loader: async () => {
            console.log('[AsyncComponent] Starting to load component...')
            try {
                const comp = await loader()
                console.log('[AsyncComponent] Component loaded successfully')
                return comp
            } catch (err) {
                console.error('[AsyncComponent] Component load failed:', err)
                throw err
            }
        },
        
        // 加载中占位
        loadingComponent: defineComponent({
            name: 'AsyncLoading',
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

                // 使用闭包渲染函数，这是 Vue3 推荐的最稳健方式
                return () => h('div', {
                    style: {
                        display: 'flex',
                        justifyContent: 'center',
                        alignItems: 'center',
                        minHeight: '400px',
                        width: '100%',
                        backgroundColor: 'transparent'
                    }
                }, [
                    h('div', {
                        class: 'is-loading',
                        style: {
                            fontSize: '24px', 
                            fontFamily: 'monospace', 
                            color: 'var(--el-color-primary)',
                            fontWeight: '500',
                            letterSpacing: '1px'
                        }
                    }, `Loading${dots.value}`)
                ])
            }
        }),

        // 失败占位
        errorComponent: defineComponent({
            name: 'AsyncError',
            props: ['error'],
            setup(props) {
                console.error('[AsyncComponent] Rendering error component:', props.error)
                
                const t = (key) => {
                    try {
                        return i18n.global.t(key)
                    } catch (e) {
                        return key
                    }
                }

                return () => h('div', {
                    style: { padding: '40px', textAlign: 'center' }
                }, [
                    h(ElEmpty, { description: t('common.loading_failed') }, {
                        default: () => h(ElButton, {
                            type: 'primary',
                            onClick: () => window.location.reload()
                        }, t('common.refresh_now'))
                    })
                ])
            }
        }),

        // 延迟显示加载组件 (防止闪烁)
        delay: 200,
        // 超时设置 (15秒)
        timeout: 15000,
        // 错误重试逻辑
        onError(error, retry, fail, attempts) {
            if (attempts <= 3) {
                console.warn(`[AsyncComponent] Loading failed, retrying (${attempts}/3)...`, error)
                setTimeout(() => retry(), 1000)
            } else {
                fail()
            }
        }
    })
}
