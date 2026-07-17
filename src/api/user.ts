import type { components } from '@/types/api'

import { apiClient, type ApiResult, unwrapResult } from './http'

export type SysUser = components['schemas']['UserResponse']
export type UserRequest = components['schemas']['UserRequest']
export type UserPage = components['schemas']['PageResultUserResponse']

export async function pageUsers(page: number, size: number, keyword?: string) {
  return unwrapResult(
    await apiClient.get<ApiResult<UserPage>>('/api/v1/system/users', {
      params: { page, size, keyword: keyword?.trim() || undefined },
    }),
  )
}

export async function createUser(request: UserRequest) {
  return unwrapResult(
    await apiClient.post<ApiResult<SysUser>>('/api/v1/system/users', request),
  )
}

export async function updateUser(userId: number, request: UserRequest) {
  return unwrapResult(
    await apiClient.put<ApiResult<SysUser>>(`/api/v1/system/users/${userId}`, request),
  )
}

export function deleteUser(userId: number) {
  return apiClient.delete(`/api/v1/system/users/${userId}`)
}

export function resetUserPassword(userId: number, newPassword: string) {
  return apiClient.post(`/api/v1/system/users/${userId}/password/reset`, { newPassword })
}
