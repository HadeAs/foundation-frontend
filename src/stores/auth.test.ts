import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import * as authApi from '@/api/auth'
import * as menuApi from '@/api/menu'
import { readStoredSession } from '@/auth/session'

import { useAuthStore } from './auth'

vi.mock('@/api/auth')
vi.mock('@/api/menu')

describe('auth store', () => {
  beforeEach(() => {
    localStorage.clear()
    setActivePinia(createPinia())
    vi.clearAllMocks()
  })

  it('uses menus returned by the login endpoint', async () => {
    vi.mocked(authApi.login).mockResolvedValue({
      token: 'signed-token',
      userId: 1,
      username: 'admin',
      menus: [{ menuId: 99, menuName: '登录响应菜单' }],
    })

    const auth = useAuthStore()
    await auth.login({ username: 'admin', password: 'admin123' })

    expect(menuApi.listMenus).not.toHaveBeenCalled()
    expect(auth.user?.menus?.[0]?.menuId).toBe(99)
    expect(readStoredSession()?.user?.menus?.[0]?.menuId).toBe(99)
  })

  it('uses menus returned by the session endpoint when restoring', async () => {
    vi.mocked(authApi.getCurrentSession).mockResolvedValue({
      userId: 1,
      username: 'admin',
      menus: [{ menuId: 7, menuName: '系统参数', menuType: 'MENU', path: 'config' }],
    })

    const auth = useAuthStore()
    auth.token = 'signed-token'
    await auth.restore()

    expect(menuApi.listMenus).not.toHaveBeenCalled()
    expect(auth.user?.menus?.[0]?.menuId).toBe(7)
    expect(readStoredSession()?.user?.menus?.[0]?.menuId).toBe(7)
  })
})
