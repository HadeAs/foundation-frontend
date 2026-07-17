import type { components } from '@/types/api'

import { apiClient, type ApiResult, unwrapResult } from './http'

export type SysDept = components['schemas']['SysDept']
export type DeptRequest = components['schemas']['DeptRequest']

export async function listDeptTree(keyword?: string) {
  return unwrapResult(
    await apiClient.get<ApiResult<SysDept[]>>('/api/v1/system/depts/tree', {
      params: { keyword: keyword?.trim() || undefined },
    }),
  )
}

export async function getDept(deptId: number) {
  return unwrapResult(
    await apiClient.get<ApiResult<SysDept>>(`/api/v1/system/depts/${deptId}`),
  )
}

export async function createDept(request: DeptRequest) {
  return unwrapResult(
    await apiClient.post<ApiResult<SysDept>>('/api/v1/system/depts', request),
  )
}

export async function updateDept(deptId: number, request: DeptRequest) {
  return unwrapResult(
    await apiClient.put<ApiResult<SysDept>>(`/api/v1/system/depts/${deptId}`, request),
  )
}

export function deleteDept(deptId: number) {
  return apiClient.delete(`/api/v1/system/depts/${deptId}`)
}
