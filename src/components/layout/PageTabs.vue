<script setup lang="ts">
import { CloseOutlined, PushpinOutlined } from "@ant-design/icons-vue";
import { Dropdown as ADropdown, Menu as AMenu } from "ant-design-vue";
import { computed, nextTick, ref, watch } from "vue";
import { useRoute, useRouter } from "vue-router";

import { useTabsStore } from "@/stores/tabs";
import { resolveMenuIcon } from "@/components/layout/menu-icons";

const tabs = useTabsStore();
const route = useRoute();
const router = useRouter();

const currentPath = computed(() => route.path);
const tabsElement = ref<HTMLElement>();

async function revealCurrentTab() {
  await nextTick();
  const active = Array.from(
    tabsElement.value?.querySelectorAll<HTMLElement>("[data-tab-path]") || [],
  ).find((element) => element.dataset.tabPath === currentPath.value);
  active?.scrollIntoView?.({ behavior: "smooth", block: "nearest", inline: "nearest" });
}

watch(currentPath, revealCurrentTab, { immediate: true });

function tabIcon(path: string) {
  return resolveMenuIcon(router.resolve(path).meta.icon);
}

function nextPathAfterClose(path: string) {
  const index = tabs.items.findIndex((tab) => tab.path === path);
  return tabs.items[index - 1]?.path || tabs.items[index + 1]?.path || "/";
}

async function close(path: string) {
  const next = nextPathAfterClose(path);
  tabs.remove(path);
  if (currentPath.value === path) await router.push(next);
}

async function handleAction(key: string, path: string) {
  if (key === "refresh") {
    if (currentPath.value !== path) await router.push(path);
    router.go(0);
    return;
  }
  if (key === "close") return close(path);

  if (key === "others") tabs.closeOthers(path);
  if (key === "right") tabs.closeRight(path);
  if (!tabs.items.some((tab) => tab.path === currentPath.value))
    await router.push(path);
}
</script>

<template>
  <nav ref="tabsElement" class="page-tabs" aria-label="已打开页面">
    <a-dropdown
      v-for="tab in tabs.items"
      :key="tab.path"
      :trigger="['contextmenu']"
    >
      <div
        class="page-tab"
        :class="{ active: currentPath === tab.path }"
        role="tab"
        tabindex="0"
        :data-tab-path="tab.path"
        :aria-selected="currentPath === tab.path"
        :title="tab.title"
        @click="router.push(tab.path)"
        @keydown.enter="router.push(tab.path)"
        @keydown.space.prevent="router.push(tab.path)"
      >
        <component :is="tabIcon(tab.path)" class="tab-icon" />
        <span class="tab-title">{{ tab.title }}</span>
        <PushpinOutlined v-if="tab.fixed" class="tab-pin" />
        <button
          v-if="!tab.fixed"
          class="tab-close"
          type="button"
          :aria-label="`关闭${tab.title}`"
          @click.stop="close(tab.path)"
          @keydown.enter.stop="close(tab.path)"
          @keydown.space.prevent.stop="close(tab.path)"
        ><CloseOutlined /></button>
      </div>
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
.page-tabs {
  display: flex;
  width: 100%;
  min-height: 42px;
  flex: none;
  align-items: center;
  gap: 4px;
  padding: 4px 12px;
  overflow-x: auto;
  overflow-y: hidden;
  border-bottom: 1px solid var(--shell-border);
  background: var(--shell-panel);
  scrollbar-width: thin;
}
.page-tabs::-webkit-scrollbar {
  height: 6px;
}
.page-tab {
  display: inline-flex;
  min-width: 120px;
  max-width: 220px;
  height: 34px;
  flex: 0 0 auto;
  align-items: center;
  gap: 5px;
  padding: 0 12px;
  overflow: hidden;
  color: var(--shell-ink);
  font-size: 14px;
  white-space: nowrap;
  border: 1px solid var(--shell-border);
  border-radius: 0;
  background: var(--shell-panel);
  cursor: pointer;
}
.page-tab:hover {
  color: var(--brand);
  border-color: color-mix(in srgb, var(--brand) 45%, var(--shell-border));
  background: var(--shell-hover);
}
.page-tab.active {
  color: var(--brand);
  border-color: color-mix(in srgb, var(--brand) 24%, var(--shell-border));
  background: color-mix(in srgb, var(--brand) 10%, var(--shell-panel));
}
.tab-icon {
  flex: none;
  color: var(--shell-muted);
  font-size: 17px;
}
.page-tab.active .tab-icon {
  color: var(--brand);
}
.tab-title {
  min-width: 0;
  overflow: hidden;
  flex: 1;
  text-overflow: ellipsis;
}
.tab-close,
.tab-pin {
  flex: none;
  font-size: 11px;
}
.tab-close {
  display: inline-grid;
  padding: 2px;
  color: inherit;
  border: 0;
  background: transparent;
  cursor: pointer;
  place-items: center;
}
.tab-close:hover {
  color: var(--brand);
}
.tab-close:focus-visible {
  color: var(--brand-deep);
  outline: 1px solid var(--brand);
  outline-offset: 2px;
}
.tab-pin {
  color: var(--shell-muted);
}
</style>
