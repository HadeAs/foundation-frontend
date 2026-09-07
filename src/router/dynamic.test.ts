import { describe, expect, it } from 'vitest'

import {
  buildMenuTree,
  createMenuRoutes,
  isMenuForCurrentTerminal,
  joinRoutePath,
  normalizeComponentPath,
  normalizeExternalUrl,
  normalizeRoutePath,
  type SysMenu,
} from './dynamic'

const menus: SysMenu[] = [
  { menuId: 1, menuName: '系统管理', menuType: 'DIR', path: 'system', status: 1, visible: true, sortNo: 10 },
  {
    menuId: 2,
    parentId: 1,
    menuName: '用户管理',
    menuType: 'MENU',
    path: 'user',
    component: '/system/user',
    status: 1,
    visible: true,
  },
]

describe('dynamic routes', () => {
  it('builds the menu hierarchy', () => {
    const tree = buildMenuTree(menus)
    expect(tree[0]?.children[0]?.menuName).toBe('用户管理')
  })

  it('keeps hidden and disabled records for menu management', () => {
    const records: SysMenu[] = [
      ...menus,
      { menuId: 3, menuName: '停用菜单', menuType: 'MENU', status: 0, visible: false },
    ]
    expect(buildMenuTree(records, false, false)).toHaveLength(2)
  })

  it('normalizes safe paths and rejects external paths', () => {
    expect(normalizeRoutePath('dashboard')).toBe('/dashboard')
    expect(normalizeRoutePath('/')).toBe('/dashboard')
    expect(normalizeRoutePath('https://example.com')).toBeNull()
    expect(normalizeComponentPath('/system/user')).toBe(
      '/src/views/system/user/index.vue',
    )
    expect(normalizeComponentPath('../secret')).toBeNull()
    expect(normalizeExternalUrl('https://example.com/docs')).toBe('https://example.com/docs')
    expect(normalizeExternalUrl('javascript:alert(1)')).toBeNull()
  })

  it('keeps only PC-compatible menus in the current application', () => {
    expect(isMenuForCurrentTerminal({ terminalType: 'PC' })).toBe(true)
    expect(isMenuForCurrentTerminal({})).toBe(true)
    expect(isMenuForCurrentTerminal({ terminalType: 'MOBILE' })).toBe(false)
  })

  it('joins parent and current menu paths', () => {
    expect(joinRoutePath('/system', 'security')).toBe('/system/security')
    expect(joinRoutePath('/system/security', 'user')).toBe('/system/security/user')
    expect(joinRoutePath('/system/security', '/system/user')).toBe('/system/user')
  })

  it('creates a route without a handwritten component map', () => {
    const route = createMenuRoutes(menus)[0]
    expect(route?.path).toBe('/system/user')
    expect(route?.name).toBe('menu-2')
  })

  it('normalizes the backend root dashboard route', () => {
    const [route] = createMenuRoutes([{
      menuId: 1,
      menuName: '运行总览',
      menuType: 'MENU',
      path: '/',
      component: '/dashboard',
      status: 1,
      visible: true,
    }])
    expect(route?.path).toBe('/dashboard')
    expect(route?.meta?.fixedTab).toBe(true)
  })

  it('registers external menus as internal routes and filters non-PC menus', () => {
    const [externalRoute] = createMenuRoutes([
      { menuId: 8, menuName: '文档', menuType: 'MENU', path: 'docs', externalUrl: 'https://example.com', status: 1 },
    ])
    expect(externalRoute?.path).toBe('/docs')
    expect(externalRoute?.meta?.externalUrl).toBe('https://example.com')
    expect(createMenuRoutes([
      { menuId: 9, menuName: '移动端', menuType: 'MENU', path: 'mobile', terminalType: 'MOBILE', status: 1 },
    ])).toEqual([])
  })
})
