<script setup lang="ts">
import {
  LockOutlined,
  LogoutOutlined,
  MenuFoldOutlined,
  MenuUnfoldOutlined,
  SettingOutlined,
  UserOutlined,
} from '@ant-design/icons-vue'
import {
  Avatar as AAvatar,
  Breadcrumb as ABreadcrumb,
  BreadcrumbItem as ABreadcrumbItem,
  Button as AButton,
  Dropdown as ADropdown,
  Layout as ALayout,
  LayoutContent as ALayoutContent,
  LayoutHeader as ALayoutHeader,
  LayoutSider as ALayoutSider,
  Menu as AMenu,
  Tooltip as ATooltip,
  type MenuProps,
} from 'ant-design-vue'
import { computed, h, onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'

import ChangePasswordModal from '@/components/layout/ChangePasswordModal.vue'
import PageTabs from '@/components/layout/PageTabs.vue'
import ThemePanel from '@/components/layout/ThemePanel.vue'
import { resolveMenuIcon } from '@/components/layout/menu-icons'
import { buildMenuTree, createMenuRoutes, type MenuNode } from '@/router/dynamic'
import { useAuthStore } from '@/stores/auth'
import { useTabsStore } from '@/stores/tabs'

const route = useRoute()
const router = useRouter()
const auth = useAuthStore()
const tabs = useTabsStore()
const collapsed = ref(false)
const themeOpen = ref(false)
const passwordOpen = ref(false)
const menuTree = computed(() => buildMenuTree(auth.user?.menus || []))
const selectedKeys = computed(() => [route.path])
const openKeys = ref<string[]>([])

function toMenuItems(nodes: MenuNode[]): MenuProps['items'] {
  return nodes.map((node) => {
    const path = node.menuType === 'MENU' ? node.fullPath : undefined
    return {
      key: path || `dir-${node.menuId}`,
      icon: h(resolveMenuIcon(node.icon)),
      label: node.menuName || '未命名菜单',
      children: node.children.length ? toMenuItems(node.children) : undefined,
    }
  })
}

const menuItems = computed(() => toMenuItems(menuTree.value))

function findOpenKeys(nodes: MenuNode[], path: string, parents: string[] = []): string[] {
  for (const node of nodes) {
    if (node.fullPath === path) return parents
    const nextParents = node.menuType === 'DIR' && node.menuId !== undefined
      ? [...parents, `dir-${node.menuId}`]
      : parents
    const child = findOpenKeys(node.children, path, nextParents)
    if (child.length) return child
  }
  return []
}

watch(
  [() => route.path, menuTree],
  ([path]) => {
    openKeys.value = [...new Set([...openKeys.value, ...findOpenKeys(menuTree.value, path)])]
  },
  { immediate: true },
)

function findBreadcrumb(nodes: MenuNode[], path: string, parents: string[] = []): string[] {
  for (const node of nodes) {
    const current = [...parents, node.menuName || '未命名菜单']
    if (node.fullPath === path) return current
    const child = findBreadcrumb(node.children, path, current)
    if (child.length) return child
  }
  return []
}

const breadcrumbs = computed(() => findBreadcrumb(menuTree.value, route.path))
watch(
  () => route.fullPath,
  () => {
    if (!route.meta.title || !String(route.name || '').startsWith('menu-')) return
    tabs.add({
      path: route.path,
      title: route.meta.title,
      routeName: String(route.name),
      fixed: route.meta.fixedTab,
    })
  },
  { immediate: true },
)

onMounted(() => {
  tabs.reconcile(
    createMenuRoutes(auth.user?.menus || []).map((menu) => String(menu.path)),
  )
})

async function handleMenuClick({ key }: { key: string | number }) {
  const path = String(key)
  if (path.startsWith('/')) await router.push(path)
}

async function handleUserAction({ key }: { key: string | number }) {
  if (key === 'password') passwordOpen.value = true
  if (key === 'logout') {
    await auth.logout()
    await router.replace('/login')
  }
}
</script>

<template>
  <a-layout class="app-shell">
    <a-layout-sider
      v-model:collapsed="collapsed"
      class="app-sider"
      :width="238"
      :collapsed-width="72"
      :trigger="null"
      collapsible
    >
      <div class="shell-brand" :class="{ collapsed }">
        <span class="brand-symbol"><i></i></span>
        <span class="brand-title" :aria-hidden="collapsed">
          <strong>工业系统</strong>
        </span>
      </div>
      <a-menu
        v-model:open-keys="openKeys"
        class="side-menu"
        mode="inline"
        theme="light"
        :items="menuItems"
        :selected-keys="selectedKeys"
        @click="handleMenuClick"
      />
    </a-layout-sider>

    <a-layout class="shell-main">
      <a-layout-header class="shell-header">
        <div class="header-left">
          <a-tooltip :title="collapsed ? '展开菜单' : '收起菜单'">
            <a-button
              type="text"
              class="collapse-button"
              :aria-label="collapsed ? '展开左侧菜单' : '收起左侧菜单'"
              @click="collapsed = !collapsed"
            >
              <MenuUnfoldOutlined v-if="collapsed" />
              <MenuFoldOutlined v-else />
            </a-button>
          </a-tooltip>
          <a-breadcrumb class="header-breadcrumb">
            <a-breadcrumb-item v-for="item in breadcrumbs" :key="item">{{ item }}</a-breadcrumb-item>
          </a-breadcrumb>
        </div>

        <div class="header-right">
          <a-tooltip title="界面设置">
            <a-button type="text" aria-label="界面设置" @click="themeOpen = true"><SettingOutlined /></a-button>
          </a-tooltip>
          <span class="header-divider"></span>
          <a-dropdown :trigger="['click']">
            <button class="user-entry" type="button" aria-label="打开用户菜单">
              <a-avatar class="user-avatar" :size="34"><UserOutlined /></a-avatar>
              <span class="user-copy"><strong>{{ auth.displayName }}</strong><small>{{ auth.user?.username }}</small></span>
            </button>
            <template #overlay>
              <a-menu
                :items="[
                  { key: 'password', icon: h(LockOutlined), label: '修改密码' },
                  { type: 'divider' },
                  { key: 'logout', icon: h(LogoutOutlined), label: '退出登录', danger: true },
                ]"
                @click="handleUserAction"
              />
            </template>
          </a-dropdown>
        </div>
      </a-layout-header>

      <PageTabs />

      <a-layout-content class="shell-content">
        <router-view v-slot="{ Component, route: viewRoute }">
          <keep-alive>
            <component :is="Component" :key="String(viewRoute.name)" />
          </keep-alive>
        </router-view>
      </a-layout-content>
    </a-layout>

    <ThemePanel v-model:open="themeOpen" />
    <ChangePasswordModal v-model:open="passwordOpen" />
  </a-layout>
</template>

<style scoped>
.app-shell { width: 100%; max-width: 100%; height: 100vh; overflow: hidden; }
.app-sider { position: relative; z-index: 2; height: 100vh; overflow: hidden; border-right: 1px solid var(--sider-border); background: var(--sider-bg) !important; box-shadow: 5px 0 22px rgba(21, 55, 56, 0.06); }
.app-sider :deep(.ant-layout-sider-children) { display: flex; min-height: 0; flex-direction: column; }
.shell-brand { display: flex; height: 48px; align-items: center; gap: 12px; padding: 0 20px; overflow: hidden; border-bottom: 1px solid var(--sider-border); }
.shell-brand.collapsed { justify-content: center; gap: 0; padding: 0; }
.brand-symbol { position: relative; display: grid; width: 28px; height: 28px; flex: none; border: 1px solid #35c8c7; place-items: center; transform: rotate(45deg); }
.brand-symbol::before, .brand-symbol::after, .brand-symbol i { position: absolute; background: #35c8c7; content: ''; }
.brand-symbol::before { width: 13px; height: 2px; }
.brand-symbol::after { width: 2px; height: 13px; }
.brand-symbol i { width: 5px; height: 5px; background: #d8ffff; }
.brand-title { display: flex; min-width: 0; max-width: 150px; overflow: hidden; flex-direction: column; color: var(--sider-ink); opacity: 1; white-space: nowrap; transition: max-width .2s ease, opacity .14s ease .06s; }
.shell-brand.collapsed .brand-title { max-width: 0; opacity: 0; transition-delay: 0s; }
.brand-title strong { font-size: 16px; font-weight: 600; letter-spacing: 0.08em; white-space: nowrap; }
.side-menu { min-height: 0; flex: 1; overflow-x: hidden; overflow-y: auto; border-inline-end: 0 !important; background: transparent !important; scrollbar-width: thin; }
:deep(.side-menu .ant-menu-sub.ant-menu-inline) { background: transparent !important; }
:deep(.side-menu .ant-menu-item), :deep(.side-menu .ant-menu-submenu-title) { width: auto; height: 36px; margin-block: 3px; margin-inline: 9px; line-height: 36px; border-radius: 3px; color: var(--sider-muted); font-size: 15px; }
:deep(.side-menu > .ant-menu-item), :deep(.side-menu > .ant-menu-submenu > .ant-menu-submenu-title) { padding-inline-start: 14px !important; }
:deep(.side-menu .ant-menu-item:hover), :deep(.side-menu .ant-menu-submenu-title:hover) { color: var(--sider-ink) !important; background: var(--sider-selected) !important; }
:deep(.side-menu .ant-menu-item-selected) { color: var(--brand); background: var(--sider-selected) !important; }
:deep(.side-menu .ant-menu-item-selected::after) { position: absolute; top: 10px; right: -9px; bottom: 10px; width: 2px; background: #3bd1cf; content: ''; }
.app-sider.ant-layout-sider-collapsed :deep(.side-menu .ant-menu-item), .app-sider.ant-layout-sider-collapsed :deep(.side-menu .ant-menu-submenu-title) { display: flex; align-items: center; justify-content: center; padding-inline: 0 !important; }
.app-sider.ant-layout-sider-collapsed :deep(.side-menu .ant-menu-item-icon), .app-sider.ant-layout-sider-collapsed :deep(.side-menu .anticon) { margin-inline-end: 0 !important; }
.app-sider.ant-layout-sider-collapsed :deep(.side-menu .ant-menu-title-content), .app-sider.ant-layout-sider-collapsed :deep(.side-menu .ant-menu-submenu-arrow) { display: none !important; }
.shell-main { width: 0; min-width: 0; max-width: 100%; height: 100vh; flex: 1 1 0; overflow: hidden; background: var(--shell-bg); }
.shell-header { display: flex; width: 100%; height: 48px; flex: none; align-items: center; justify-content: space-between; padding: 0 7px 0 8px; line-height: normal; border-bottom: 1px solid var(--shell-border); background: var(--shell-panel); }
.header-left, .header-right { display: flex; align-items: center; }
.header-left { gap: 14px; }
.header-breadcrumb { font-size: 14px; }
.collapse-button { color: var(--shell-muted); }
.header-right { gap: 4px; color: var(--shell-muted); }
.header-divider { width: 1px; height: 22px; margin: 0 7px; background: var(--shell-border); }
.user-entry { display: flex; align-items: center; gap: 10px; padding: 3px 0 3px 5px; color: var(--shell-ink); border: 0; background: transparent; cursor: pointer; }
.user-avatar { flex: none; color: #fff; background: var(--brand); }
.user-avatar :deep(.anticon) { font-size: 21px; }
.user-copy { display: flex; min-width: 86px; flex-direction: column; align-items: flex-start; }
.user-entry strong { font-size: 14px; font-weight: 600; }
.user-entry small { margin-top: 2px; color: var(--shell-muted); font-size: 11px; }
.shell-content { width: 100%; min-height: 0; flex: 1; overflow: hidden; background: var(--shell-bg); }
.shell-content::-webkit-scrollbar { width: 7px; }
.shell-content::-webkit-scrollbar-track { background: transparent; }
.shell-content::-webkit-scrollbar-thumb { border-radius: 7px; background: var(--scrollbar-thumb); }
.shell-content::-webkit-scrollbar-thumb:hover { background: var(--scrollbar-thumb-hover); }
</style>
