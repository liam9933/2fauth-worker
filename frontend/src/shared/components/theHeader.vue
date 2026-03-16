<template>
  <header class="header">
    <div class="logo">
      <a href="#" @click.prevent="goHome" class="header-home-link">
        <el-icon :size="24" color="#409EFC" style="margin-right: 10px;"><Lock /></el-icon>
        <h2>2FAuth Worker</h2>
      </a>
    </div>
    <div class="user-actions">
      <!-- 访客页面（仅在显式处于非授权页面如登录页时显示） -->
      <div class="guest-actions" v-if="route.meta.requiresAuth === false">
        <el-button circle :icon="themeStore.isDark ? Sunny : Moon" @click="themeStore.toggleTheme" class="header-action-btn" />
        <el-button circle :icon="iconLocales" :title="$i18n.locale === 'zh-CN' ? 'English' : '切换语言'" @click="toggleLanguage" class="header-action-btn" />
      </div>

      <!-- 系统内部页面，仅 PC 端显示用户头像 -->
      <div class="user-profile" v-if="!layoutStore.isMobile && route.meta.requiresAuth">
        <el-avatar 
          :size="32" 
          :src="authUserStore.userInfo?.avatar || ''"
          @error="(e) => true"
        >
          {{ authUserStore.userInfo?.username ? authUserStore.userInfo.username.charAt(0).toUpperCase() : '?' }}
        </el-avatar>
        <span class="username">{{ authUserStore.userInfo?.username || '2FAuth' }}</span>
      </div>

      <!-- 移动端菜单按钮 (现在放在右侧) -->
      <el-button 
        v-if="layoutStore.isMobile && route.meta.requiresAuth" 
        @click="layoutStore.showMobileMenu = true" 
        link
        class="header-menu-btn-refined"
      >
        <el-icon :size="20">
          <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M4 6H20M4 12H20M4 18H20" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
          </svg>
        </el-icon>
      </el-button>
    </div>
  </header>
</template>

<script setup>
import { useRoute, useRouter } from 'vue-router'
import { Lock } from '@element-plus/icons-vue'
import { useLayoutStore } from '@/shared/stores/layoutStore'
import { useAuthUserStore } from '@/features/auth/store/authUserStore'
import { useThemeStore } from '@/shared/stores/themeStore'
import { Sunny, Moon } from '@element-plus/icons-vue'
import iconLocales from '@/shared/components/icons/iconLocales.vue'
import { useI18n } from 'vue-i18n'
import { setLanguage } from '@/locales'

const { locale } = useI18n()
const route = useRoute()
const router = useRouter()
const layoutStore = useLayoutStore()
const authUserStore = useAuthUserStore()
const themeStore = useThemeStore()

const toggleLanguage = () => {
  const targetLang = locale.value === 'zh-CN' ? 'en-US' : 'zh-CN'
  setLanguage(targetLang)
}

const goHome = () => {
  if (route.path === '/') {
    layoutStore.homeTabReset++
  } else {
    router.push('/')
  }
}
</script>\n