import type { components } from '@/types/api'

import { apiClient, type ApiResult, unwrapResult } from './http'

export type SysMenu = components['schemas']['SysMenu']
export type MenuRequest = components['schemas']['MenuRequest']

export async function listMenus(keyword?: string) {
  return unwrapResult(
    await apiClient.get<ApiResult<SysMenu[]>>('/api/v1/system/menus', {
      params: { keyword: keyword?.trim() || undefined },
    }),
  )
}

export async function createMenu(request: MenuRequest) {
  return unwrapResult(
    await apiClient.post<ApiResult<SysMenu>>('/api/v1/system/menus', request),
  )
}

export async function updateMenu(menuId: number, request: MenuRequest) {
  return unwrapResult(
    await apiClient.put<ApiResult<SysMenu>>(`/api/v1/system/menus/${menuId}`, request),
  )
}

export function deleteMenu(menuId: number) {
  return apiClient.delete(`/api/v1/system/menus/${menuId}`)
}
