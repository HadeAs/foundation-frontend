import { defineStore } from 'pinia'

import * as authApi from '@/api/auth'
import { ApiError } from '@/api/http'
import {
  clearStoredSession,
  readStoredSession,
  writeStoredSession,
  type SessionUser,
} from '@/auth/session'
import type { components } from '@/types/api'
import { useTabsStore } from './tabs'

type LoginRequest = components['schemas']['LoginRequest']

export const useAuthStore = defineStore('auth', {
  state: () => {
    const stored = readStoredSession()
    return {
      token: stored?.token || '',
      expiresAt: stored?.expiresAt,
      refreshExpiresAt: stored?.refreshExpiresAt,
      user: stored?.user || null,
    } as {
      token: string
      expiresAt?: string
      refreshExpiresAt?: string
      user: SessionUser | null
    }
  },
  getters: {
    isAuthenticated: (state) => Boolean(state.token),
    displayName: (state) => state.user?.realName || state.user?.username || '用户',
  },
  actions: {
    async login(request: LoginRequest) {
      const result = await authApi.login(request)
      if (!result.token) throw new ApiError('登录接口未返回 token')

      const user: SessionUser = {
        userId: result.userId,
        username: result.username,
        realName: result.realName,
        roles: result.roles,
        menus: result.menus || [],
        permissions: result.permissions,
      }
      this.token = result.token
      this.expiresAt = result.expiresAt
      this.refreshExpiresAt = result.refreshExpiresAt
      this.user = user
      writeStoredSession({
        token: result.token,
        expiresAt: result.expiresAt,
        refreshExpiresAt: result.refreshExpiresAt,
        user,
      })
    },
    async restore() {
      if (!this.token) return
      try {
        const user = await authApi.getCurrentSession()
        this.user = user
        writeStoredSession({
          token: this.token,
          expiresAt: this.expiresAt,
          refreshExpiresAt: this.refreshExpiresAt,
          user,
        })
      } catch {
        this.clear()
      }
    },
    async logout() {
      try {
        await authApi.logout()
      } finally {
        this.clear()
      }
    },
    clear() {
      this.token = ''
      this.expiresAt = undefined
      this.refreshExpiresAt = undefined
      this.user = null
      clearStoredSession()
      useTabsStore().clear()
    },
  },
})
