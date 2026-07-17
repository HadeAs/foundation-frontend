import type { components } from '@/types/api'

export const AUTH_STORAGE_KEY = 'foundation.auth.session'

export type SessionUser = components['schemas']['SessionResponse']

export type StoredSession = {
  token: string
  expiresAt?: string
  refreshExpiresAt?: string
  user?: SessionUser
}

export function readStoredSession(): StoredSession | null {
  const value = localStorage.getItem(AUTH_STORAGE_KEY)
  if (!value) return null

  try {
    const session = JSON.parse(value) as StoredSession
    return typeof session.token === 'string' && session.token ? session : null
  } catch {
    localStorage.removeItem(AUTH_STORAGE_KEY)
    return null
  }
}

export function writeStoredSession(session: StoredSession) {
  localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(session))
}

export function clearStoredSession() {
  localStorage.removeItem(AUTH_STORAGE_KEY)
}
