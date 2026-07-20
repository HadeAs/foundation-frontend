<script setup lang="ts">
import { ConfigProvider as AConfigProvider, theme as antTheme } from 'ant-design-vue'
import zhCN from 'ant-design-vue/es/locale/zh_CN'
import { computed, onBeforeUnmount, ref, watchEffect } from 'vue'

import { useThemeStore } from '@/stores/theme'

const themeStore = useThemeStore()
const media = window.matchMedia('(prefers-color-scheme: dark)')
const systemDark = ref(media.matches)
const syncSystemTheme = (event: MediaQueryListEvent) => (systemDark.value = event.matches)
media.addEventListener('change', syncSystemTheme)
onBeforeUnmount(() => media.removeEventListener('change', syncSystemTheme))

const isDark = computed(
  () => themeStore.mode === 'dark' || (themeStore.mode === 'auto' && systemDark.value),
)

const theme = computed(() => ({
  algorithm: [
    ...(isDark.value ? [antTheme.darkAlgorithm] : []),
    ...(themeStore.density === 'compact' ? [antTheme.compactAlgorithm] : []),
  ],
  token: {
    colorPrimary: themeStore.primaryColor,
    colorLink: isDark.value ? '#63d7d6' : '#076f71',
    borderRadius: themeStore.radius,
    controlHeight: themeStore.density === 'compact' ? 34 : 38,
    fontSize: 15,
    fontFamily:
      '"Avenir Next", "DIN Alternate", "PingFang SC", "Microsoft YaHei", sans-serif',
  },
  components: {
    Table: {
      borderRadiusLG: 0,
    },
  },
}))

watchEffect(() => {
  document.documentElement.dataset.theme = isDark.value ? 'dark' : 'light'
  document.documentElement.style.setProperty('--brand', themeStore.primaryColor)
  themeStore.persist()
})
</script>

<template>
  <a-config-provider :locale="zhCN" :theme="theme">
    <router-view />
  </a-config-provider>
</template>
