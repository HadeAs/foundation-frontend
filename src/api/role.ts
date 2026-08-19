import type { components } from '@/types/api'

import { apiClient, type ApiResult, requireVersion, unwrapResult } from './http'

export type SysRole = components['schemas']['SysRole']
export type RoleRequest = components['schemas']['RoleRequest']
export type RolePage = components['schemas']['PageResultSysRole']

export async function pageRoles(page: number, size: number, keyword?: string) {
  return unwrapResult(
    await apiClient.get<ApiResult<RolePage>>('/api/v1/system/roles', {
      params: { page, size, keyword: keyword?.trim() || undefined },
    }),
  )
}

export async function createRole(request: RoleRequest) {
  return unwrapResult(
    await apiClient.post<ApiResult<SysRole>>('/api/v1/system/roles', request),
  )
}

export async function updateRole(roleId: number, request: RoleRequest, version: number | undefined) {
  return unwrapResult(
    await apiClient.put<ApiResult<SysRole>>(`/api/v1/system/roles/${roleId}`, {
      ...request,
      version: requireVersion(version),
    }),
  )
}

export function deleteRole(roleId: number, version: number | undefined) {
  return apiClient.delete(`/api/v1/system/roles/${roleId}`, {
    params: { version: requireVersion(version) },
  })
}

export async function getRoleMenuIds(roleId: number) {
  return unwrapResult(
    await apiClient.get<ApiResult<number[]>>(`/api/v1/system/roles/${roleId}/menu-ids`),
  )
}

export function assignRoleMenus(roleId: number, ids: number[], version: number | undefined) {
  return apiClient.put(`/api/v1/system/roles/${roleId}/menus`, {
    ids,
    version: requireVersion(version),
  })
}
