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

const dictItemCache = new Map<string, Promise<DictItemResponse[]>>()

export function clearDictItemCache(dictCode?: string) {
  if (dictCode) dictItemCache.delete(dictCode)
  else dictItemCache.clear()
}

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
  const result = unwrapResult(
    await apiClient.post<ApiResult<SysDictType>>('/api/v1/system/dicts/types', request),
  )
  clearDictItemCache()
  return result
}

export async function updateDictType(dictTypeId: number, request: DictTypeRequest) {
  const result = unwrapResult(
    await apiClient.put<ApiResult<SysDictType>>(`/api/v1/system/dicts/types/${dictTypeId}`, request),
  )
  clearDictItemCache()
  return result
}

export async function deleteDictType(dictTypeId: number) {
  const result = await apiClient.delete(`/api/v1/system/dicts/types/${dictTypeId}`)
  clearDictItemCache()
  return result
}

export async function batchDeleteDictTypes(ids: number[]) {
  const result = await apiClient.post('/api/v1/system/dicts/types/batch/delete', { ids })
  clearDictItemCache()
  return result
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
  const cached = dictItemCache.get(dictCode)
  if (cached) return cached

  const request = apiClient
    .get<ApiResult<DictItemResponse[]>>(`/api/v1/system/dicts/${dictCode}/items`)
    .then(unwrapResult)
    .catch((error) => {
      dictItemCache.delete(dictCode)
      throw error
    })
  dictItemCache.set(dictCode, request)
  return request
}

export async function createDictItem(request: DictItemRequest) {
  const result = unwrapResult(
    await apiClient.post<ApiResult<SysDictItem>>('/api/v1/system/dicts/items', request),
  )
  clearDictItemCache()
  return result
}

export async function updateDictItem(dictItemId: number, request: DictItemRequest) {
  const result = unwrapResult(
    await apiClient.put<ApiResult<SysDictItem>>(
      `/api/v1/system/dicts/items/${dictItemId}`,
      request,
    ),
  )
  clearDictItemCache()
  return result
}

export async function deleteDictItem(dictItemId: number) {
  const result = await apiClient.delete(`/api/v1/system/dicts/items/${dictItemId}`)
  clearDictItemCache()
  return result
}

export async function saveDictItemOrder(
  dictCode: string,
  items: Array<{ dictItemId: number; sortNo: number }>,
) {
  const result = await apiClient.post('/api/v1/system/dicts/items/sort', { dictCode, items })
  clearDictItemCache(dictCode)
  return result
}

export async function batchDeleteDictItems(ids: number[]) {
  const result = await apiClient.post('/api/v1/system/dicts/items/batch/delete', { ids })
  clearDictItemCache()
  return result
}

export async function refreshDictCache() {
  const result = await apiClient.post('/api/v1/system/dicts/refresh')
  clearDictItemCache()
  return result
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
  const result = unwrapResult(
    await apiClient.post<ApiResult<DictImportResult>>('/api/v1/system/dicts/import', data, {
      params: { overwrite },
    }),
  )
  clearDictItemCache()
  return result
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
