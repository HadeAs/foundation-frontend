<script setup lang="ts">
import { CloseOutlined } from '@ant-design/icons-vue'
import { Dropdown as ADropdown, Menu as AMenu } from 'ant-design-vue'
import { computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'

import { useTabsStore } from '@/stores/tabs'

const tabs = useTabsStore()
const route = useRoute()
const router = useRouter()

const currentPath = computed(() => route.path)

function nextPathAfterClose(path: string) {
  const index = tabs.items.findIndex((tab) => tab.path === path)
  return tabs.items[index - 1]?.path || tabs.items[index + 1]?.path || '/'
}

async function close(path: string) {
  const next = nextPathAfterClose(path)
  tabs.remove(path)
  if (currentPath.value === path) await router.push(next)
}

async function handleAction(key: string, path: string) {
  if (key === 'refresh') {
    if (currentPath.value !== path) await router.push(path)
    router.go(0)
    return
  }
  if (key === 'close') return close(path)

  if (key === 'others') tabs.closeOthers(path)
  if (key === 'right') tabs.closeRight(path)
  if (!tabs.items.some((tab) => tab.path === currentPath.value)) await router.push(path)
}
</script>

<template>
  <nav class="page-tabs" aria-label="已打开页面">
    <a-dropdown
      v-for="tab in tabs.items"
      :key="tab.path"
      :trigger="['contextmenu']"
    >
      <button
        class="page-tab"
        :class="{ active: currentPath === tab.path }"
        type="button"
        @click="router.push(tab.path)"
      >
        <span>{{ tab.title }}</span>
        <CloseOutlined
          v-if="!tab.fixed"
          class="tab-close"
          @click.stop="close(tab.path)"
        />
      </button>
      <template #overlay>
        <a-menu
          :items="[
            { key: 'refresh', label: '刷新当前' },
            { key: 'close', label: '关闭当前', disabled: tab.fixed },
            { key: 'others', label: '关闭其他' },
            { key: 'right', label: '关闭右侧' },
          ]"
          @click="handleAction(String($event.key), tab.path)"
        />
      </template>
    </a-dropdown>
  </nav>
</template>

<style scoped>
.page-tabs { display: flex; width: 100%; min-height: 38px; flex: none; align-items: stretch; gap: 1px; padding: 0 12px; overflow: hidden; border-bottom: 1px solid var(--shell-border); background: var(--shell-panel); }
.page-tab { position: relative; display: inline-flex; min-width: 90px; max-width: 180px; align-items: center; justify-content: center; gap: 8px; padding: 0 14px; overflow: hidden; color: var(--shell-muted); font-size: 14px; white-space: nowrap; border: 0; border-right: 1px solid var(--shell-border); background: transparent; cursor: pointer; }
.page-tab::after { position: absolute; right: 13px; bottom: 0; left: 13px; height: 2px; background: transparent; content: ''; }
.page-tab:hover { color: var(--shell-ink); background: var(--shell-hover); }
.page-tab.active { color: var(--brand); font-weight: 600; }
.page-tab.active::after { background: var(--brand); }
.tab-close { flex: none; font-size: 14px; }
</style>
