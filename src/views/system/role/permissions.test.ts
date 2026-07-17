import { describe, expect, it } from 'vitest'

import type { SysMenu } from '@/api/menu'

import { includeAncestorMenuIds } from './permissions'

describe('role menu permissions', () => {
  it('includes every parent directory without granting sibling menus', () => {
    const menus: SysMenu[] = [
      { menuId: 1, parentId: 0, menuType: 'DIR', menuName: '系统管理' },
      { menuId: 2, parentId: 1, menuType: 'DIR', menuName: '权限管理' },
      { menuId: 3, parentId: 2, menuType: 'MENU', menuName: '用户管理' },
      { menuId: 4, parentId: 2, menuType: 'MENU', menuName: '角色管理' },
      { menuId: 5, parentId: 0, menuType: 'MENU', menuName: '工作台' },
    ]

    expect(includeAncestorMenuIds(menus, [3, 5]).sort()).toEqual([1, 2, 3, 5])
  })
})
