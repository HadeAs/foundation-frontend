import type { components } from '@/types/api'

import { apiClient, type ApiResult, unwrapResult } from './http'

export type SysFile = components['schemas']['SysFile']
export type FilePage = components['schemas']['PageResultSysFile']

export async function pageFiles(page: number, size: number, keyword?: string, group?: string) {
  return unwrapResult(
    await apiClient.get<ApiResult<FilePage>>('/api/v1/files', {
      params: { page, size, keyword: keyword?.trim() || undefined, group },
    }),
  )
}

export async function uploadFile(file: File, group?: string, remark?: string) {
  const data = new FormData()
  data.append('file', file)
  return unwrapResult(
    await apiClient.post<ApiResult<SysFile>>('/api/v1/files', data, {
      params: { group, remark: remark?.trim() || undefined },
    }),
  )
}

export function downloadFile(fileId: number) {
  return apiClient.get<Blob>(`/api/v1/files/${fileId}/download`, { responseType: 'blob' })
}

export function deleteFile(fileId: number) {
  return apiClient.delete(`/api/v1/files/${fileId}`)
}

export function batchDeleteFiles(ids: number[]) {
  return apiClient.post('/api/v1/files/batch/delete', { ids })
}
