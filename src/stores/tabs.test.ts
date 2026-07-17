import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it } from 'vitest'

import { useTabsStore } from './tabs'

describe('page tabs', () => {
  beforeEach(() => {
    sessionStorage.clear()
    setActivePinia(createPinia())
  })

  it('keeps fixed tabs when closing other pages', () => {
    const tabs = useTabsStore()
    tabs.add({ path: '/dashboard', title: '工作台', routeName: 'menu-1', fixed: true })
    tabs.add({ path: '/system/user', title: '用户管理', routeName: 'menu-2' })
    tabs.add({ path: '/system/role', title: '角色管理', routeName: 'menu-3' })

    tabs.closeOthers('/system/user')
    expect(tabs.items.map((tab) => tab.path)).toEqual(['/dashboard', '/system/user'])

    tabs.remove('/dashboard')
    expect(tabs.items[0]?.path).toBe('/dashboard')
  })

  it('removes tabs that are no longer authorized', () => {
    const tabs = useTabsStore()
    tabs.add({ path: '/dashboard', title: '工作台', routeName: 'menu-1', fixed: true })
    tabs.add({ path: '/system/user', title: '用户管理', routeName: 'menu-2' })
    tabs.reconcile(['/dashboard'])
    expect(tabs.items).toHaveLength(1)
  })
})
