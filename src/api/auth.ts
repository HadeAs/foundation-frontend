import type { components } from '@/types/api'

import { apiClient, unwrapResult } from './http'

type LoginRequest = components['schemas']['LoginRequest']
type LoginResponse = components['schemas']['LoginResponse']
type SessionResponse = components['schemas']['SessionResponse']
type ChangePasswordRequest = components['schemas']['ChangePasswordRequest']

export async function login(request: LoginRequest) {
  return unwrapResult(
    await apiClient.post<{ data?: LoginResponse; message?: string; traceId?: string }>(
      '/api/v1/auth/login',
      request,
    ),
  )
}

export async function getCurrentSession() {
  return unwrapResult(
    await apiClient.get<{ data?: SessionResponse; message?: string; traceId?: string }>(
      '/api/v1/auth/me',
    ),
  )
}

export function logout() {
  return apiClient.post('/api/v1/auth/logout')
}

export function changePassword(request: ChangePasswordRequest) {
  return apiClient.post('/api/v1/auth/password', request)
}
