import type { components } from '@/types/api'

import { apiClient, type ApiResult, unwrapResult } from './http'

export type DictTypeRequest = components['schemas']['DictTypeRequest']
export type DictItemRequest = components['schemas']['DictItemRequest']
export type SysDictType = components['schemas']['SysDictType']
export type SysDictItem = components['schemas']['SysDictItem']
export type DictDisableImpact = components['schemas']['DictDisableImpactResponse']
export type DictImportResult = components['schemas']['DictImportResult']
export type SysDictChangeLog = components['schemas']['SysDictChangeLog']
export type DictItemResponse = components['schemas']['DictItemResponse']
export type DictTypePage = components['schemas']['PageResultSysDictType']
export type DictLogPage = components['schemas']['PageResultSysDictChangeLog']

export async function pageDictTypes(
  page: number,
  size: number,
  keyword?: string,
  status?: number,
  scope?: string,
) {
  return unwrapResult(
    await apiClient.get<ApiResult<DictTypePage>>('/api/v1/system/dicts/types', {
      params: { page, size, keyword: keyword?.trim() || undefined, status, scope },
    }),
  )
}

export async function createDictType(request: DictTypeRequest) {
  return unwrapResult(
    await apiClient.post<ApiResult<SysDictType>>('/api/v1/system/dicts/types', request),
  )
}

export async function updateDictType(dictTypeId: number, request: DictTypeRequest) {
  return unwrapResult(
    await apiClient.put<ApiResult<SysDictType>>(`/api/v1/system/dicts/types/${dictTypeId}`, request),
  )
}

export function deleteDictType(dictTypeId: number) {
  return apiClient.delete(`/api/v1/system/dicts/types/${dictTypeId}`)
}

export function batchDeleteDictTypes(ids: number[]) {
  return apiClient.post('/api/v1/system/dicts/types/batch/delete', { ids })
}

export async function getDictDisableImpact(dictTypeId: number) {
  return unwrapResult(
    await apiClient.get<ApiResult<DictDisableImpact>>(
      `/api/v1/system/dicts/types/${dictTypeId}/disable-impact`,
    ),
  )
}

export async function listManagedDictItems(dictCode: string) {
  return unwrapResult(
    await apiClient.get<ApiResult<SysDictItem[]>>('/api/v1/system/dicts/items/manage', {
      params: { dictCode },
    }),
  )
}

export async function listDictItems(dictCode: string) {
  return unwrapResult(
    await apiClient.get<ApiResult<DictItemResponse[]>>(`/api/v1/system/dicts/${dictCode}/items`),
  )
}

export async function createDictItem(request: DictItemRequest) {
  return unwrapResult(
    await apiClient.post<ApiResult<SysDictItem>>('/api/v1/system/dicts/items', request),
  )
}

export async function updateDictItem(dictItemId: number, request: DictItemRequest) {
  return unwrapResult(
    await apiClient.put<ApiResult<SysDictItem>>(
      `/api/v1/system/dicts/items/${dictItemId}`,
      request,
    ),
  )
}

export function deleteDictItem(dictItemId: number) {
  return apiClient.delete(`/api/v1/system/dicts/items/${dictItemId}`)
}

export function saveDictItemOrder(
  dictCode: string,
  items: Array<{ dictItemId: number; sortNo: number }>,
) {
  return apiClient.post('/api/v1/system/dicts/items/sort', { dictCode, items })
}

export function batchDeleteDictItems(ids: number[]) {
  return apiClient.post('/api/v1/system/dicts/items/batch/delete', { ids })
}

export function refreshDictCache() {
  return apiClient.post('/api/v1/system/dicts/refresh')
}

export function downloadDictTemplate() {
  return apiClient.get<Blob>('/api/v1/system/dicts/template', { responseType: 'blob' })
}

export function exportDict(dictCode?: string) {
  return apiClient.get<Blob>('/api/v1/system/dicts/export', {
    params: { dictCode },
    responseType: 'blob',
  })
}

export async function importDict(file: File, overwrite = true) {
  const data = new FormData()
  data.append('file', file)
  return unwrapResult(
    await apiClient.post<ApiResult<DictImportResult>>('/api/v1/system/dicts/import', data, {
      params: { overwrite },
    }),
  )
}

export async function pageDictChangeLogs(
  page: number,
  size: number,
  dictCode?: string,
) {
  return unwrapResult(
    await apiClient.get<ApiResult<DictLogPage>>('/api/v1/system/dicts/logs', {
      params: { page, size, dictCode },
    }),
  )
}
