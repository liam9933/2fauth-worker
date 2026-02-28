<script setup>
import { onMounted, onBeforeUnmount } from 'vue'
import { RouterView, useRoute } from 'vue-router'
import TheHeader from '@/shared/components/theHeader.vue'
import TheFooter from '@/shared/components/theFooter.vue'
import { useLayoutStore } from '@/shared/stores/layoutStore'

const route = useRoute()
const layoutStore = useLayoutStore()

const checkMobile = () => {
  layoutStore.isMobile = window.innerWidth < 768
}

onMounted(() => {
  checkMobile()
  window.addEventListener('resize', checkMobile)
})

onBeforeUnmount(() => {
  window.removeEventListener('resize', checkMobile)
})
</script>

<template>
  <div class="app-container">
    <!-- 登录页通常不显示头部，可以通过路由 meta 控制，这里简单示例默认显示 -->
    <TheHeader v-if="!route.meta.hideHeader" />
    
    <main>
      <RouterView />
    </main>
    <TheFooter />
  </div>
</template>
