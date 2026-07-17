<script setup lang="ts">
import { ReloadOutlined } from '@ant-design/icons-vue'
import {
  Button as AButton,
  Divider as ADivider,
  Drawer as ADrawer,
  RadioButton as ARadioButton,
  RadioGroup as ARadioGroup,
  Segmented as ASegmented,
} from 'ant-design-vue'

import { useThemeStore, type ThemeDensity, type ThemeMode } from '@/stores/theme'

const open = defineModel<boolean>('open', { required: true })
const theme = useThemeStore()
</script>

<template>
  <a-drawer v-model:open="open" title="界面设置" width="360" placement="right">
    <section class="setting-block">
      <label>外观模式</label>
      <a-segmented
        :value="theme.mode"
        block
        :options="[
          { label: '浅色', value: 'light' },
          { label: '深色', value: 'dark' },
          { label: '跟随系统', value: 'auto' },
        ]"
        @change="theme.mode = $event as ThemeMode"
      />
    </section>

    <section class="setting-block">
      <label>品牌主色</label>
      <div class="color-control">
        <input v-model="theme.primaryColor" type="color" aria-label="选择品牌主色" />
        <code>{{ theme.primaryColor.toUpperCase() }}</code>
      </div>
    </section>

    <section class="setting-block">
      <label>组件圆角</label>
      <a-radio-group v-model:value="theme.radius" button-style="solid">
        <a-radio-button :value="0">直角</a-radio-button>
        <a-radio-button :value="6">6px</a-radio-button>
        <a-radio-button :value="10">10px</a-radio-button>
      </a-radio-group>
    </section>

    <section class="setting-block">
      <label>界面密度</label>
      <a-segmented
        :value="theme.density"
        block
        :options="[
          { label: '紧凑', value: 'compact' },
          { label: '标准', value: 'standard' },
        ]"
        @change="theme.density = $event as ThemeDensity"
      />
    </section>

    <a-divider />
    <a-button block @click="theme.reset()">
      <template #icon><ReloadOutlined /></template>
      恢复默认设置
    </a-button>
  </a-drawer>
</template>

<style scoped>
.setting-block { margin-bottom: 28px; }
.setting-block > label { display: block; margin-bottom: 10px; color: #617171; font-size: 14px; font-weight: 600; }
.color-control { display: flex; height: 42px; align-items: center; gap: 12px; padding: 6px 12px; border: 1px solid var(--shell-border); background: var(--shell-panel); }
.color-control input { width: 28px; height: 28px; padding: 0; border: 0; background: transparent; cursor: pointer; }
.color-control code { color: var(--shell-ink); font-size: 14px; letter-spacing: 0.08em; }
</style>
