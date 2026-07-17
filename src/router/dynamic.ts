import type { Router, RouteRecordRaw } from 'vue-router'

import MissingPage from '@/views/errors/page-not-configured.vue'
import type { components } from '@/types/api'

export type SysMenu = components['schemas']['SysMenu']
export type MenuNode = SysMenu & { children: MenuNode[]; fullPath: string | null }

const viewModules = import.meta.glob('/src/views/**/*.vue')
const installedNames = new Set<string>()
let accessiblePaths: string[] = []

export function normalizeRoutePath(path?: string) {
  if (!path) return null
  const value = path.trim()
  if (!value || value.startsWith('//') || /^https?:/i.test(value)) return null
  if (value === '/') return '/dashboard'
  return value.startsWith('/') ? value : `/${value}`
}

export function normalizeComponentPath(component?: string) {
  if (!component) return null
  const value = component.trim().replace(/\/$/, '')
  if (!value || value.includes('..') || /^https?:/i.test(value)) return null
  if (value.endsWith('.vue')) {
    return value.startsWith('/src/views/')
      ? value
      : `/src/views${value.startsWith('/') ? value : `/${value}`}`
  }
  const directory = value.startsWith('/src/views/')
    ? value
    : `/src/views${value.startsWith('/') ? value : `/${value}`}`
  return `${directory}/index.vue`
}

export function joinRoutePath(parentPath: string | null, currentPath?: string) {
  const current = normalizeRoutePath(currentPath)
  if (!current) return parentPath
  if (!parentPath || current === '/dashboard') return current

  const parentSegments = parentPath.split('/').filter(Boolean)
  const currentSegments = current.split('/').filter(Boolean)
  if (currentSegments[0] === parentSegments[0]) return current
  return `/${[...parentSegments, ...currentSegments].join('/')}`
}

export function buildMenuTree(
  menus: SysMenu[],
  visibleOnly = true,
  activeOnly = true,
): MenuNode[] {
  const active = menus
    .filter((menu) =>
      (!activeOnly || menu.status === 1) && (!visibleOnly || menu.visible !== false),
    )
    .sort((left, right) => (left.sortNo || 0) - (right.sortNo || 0))
  const nodes = new Map<number, MenuNode>()

  for (const menu of active) {
    if (menu.menuId !== undefined) nodes.set(menu.menuId, { ...menu, children: [], fullPath: null })
  }

  const roots: MenuNode[] = []
  for (const node of nodes.values()) {
    const parent = node.parentId === undefined ? undefined : nodes.get(node.parentId)
    if (parent) parent.children.push(node)
    else roots.push(node)
  }

  function assignPaths(items: MenuNode[], parentPath: string | null) {
    for (const item of items) {
      item.fullPath = joinRoutePath(parentPath, item.path)
      assignPaths(item.children, item.fullPath || parentPath)
    }
  }
  assignPaths(roots, null)
  return roots
}

export function createMenuRoutes(menus: SysMenu[]): RouteRecordRaw[] {
  const paths = new Set<string>()
  const nodes = buildMenuTree(menus, false, false)
  const pages = nodes.flatMap(function flatten(node: MenuNode): MenuNode[] {
    return [node, ...node.children.flatMap(flatten)]
  })

  return pages.flatMap((menu) => {
    if (menu.status !== 1 || menu.menuType !== 'MENU' || menu.menuId === undefined) return []
    const path = menu.fullPath
    if (!path || paths.has(path)) return []
    paths.add(path)

    const componentPath = normalizeComponentPath(menu.component)
    const routeComponentPath = `/src/views${path}/index.vue`
    const loader = (componentPath ? viewModules[componentPath] : undefined)
      || viewModules[routeComponentPath]
    return [{
      path,
      name: `menu-${menu.menuId}`,
      component: loader || MissingPage,
      meta: {
        title: menu.menuName || '未命名页面',
        icon: menu.icon,
        menuId: menu.menuId,
        fixedTab: path === '/dashboard',
        keepAlive: true,
      },
    } satisfies RouteRecordRaw]
  })
}

export function syncDynamicRoutes(router: Router, menus: SysMenu[]) {
  for (const name of installedNames) router.removeRoute(name)
  installedNames.clear()

  const routes = createMenuRoutes(menus)
  accessiblePaths = routes.map((route) => String(route.path))
  for (const route of routes) {
    router.addRoute('root-layout', route)
    installedNames.add(String(route.name))
  }
  return accessiblePaths
}

export function getFirstAccessiblePath() {
  return accessiblePaths.includes('/dashboard') ? '/dashboard' : accessiblePaths[0]
}
