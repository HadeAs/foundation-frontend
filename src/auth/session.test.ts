import { beforeEach, describe, expect, it } from 'vitest'

import {
  AUTH_STORAGE_KEY,
  clearStoredSession,
  readStoredSession,
  writeStoredSession,
} from './session'

describe('auth session storage', () => {
  beforeEach(() => localStorage.clear())

  it('persists and clears a valid token', () => {
    writeStoredSession({ token: 'signed-token', expiresAt: '2026-07-15T08:00:00+08:00' })
    expect(readStoredSession()?.token).toBe('signed-token')

    clearStoredSession()
    expect(readStoredSession()).toBeNull()
  })

  it('drops invalid storage values', () => {
    localStorage.setItem(AUTH_STORAGE_KEY, '{invalid')
    expect(readStoredSession()).toBeNull()
    expect(localStorage.getItem(AUTH_STORAGE_KEY)).toBeNull()
  })
})
