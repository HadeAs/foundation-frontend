import type { components } from '@/types/api'

import { apiClient, type ApiResult, unwrapResult } from './http'

export type AsyncTaskRequest = components['schemas']['AsyncTaskRequest']
export type SysAsyncTask = components['schemas']['SysAsyncTask']
export type SysAsyncTaskLog = components['schemas']['SysAsyncTaskLog']
export type AsyncTaskPage = components['schemas']['PageResultSysAsyncTask']
export type AsyncTaskLogPage = components['schemas']['PageResultSysAsyncTaskLog']

export async function pageAsyncTasks(
  page: number,
  size: number,
  keyword?: string,
  status?: string,
  taskType?: string,
  startTime?: string,
  endTime?: string,
) {
  return unwrapResult(
    await apiClient.get<ApiResult<AsyncTaskPage>>('/api/v1/system/async-tasks', {
      params: {
        page,
        size,
        keyword: keyword?.trim() || undefined,
        status,
        taskType: taskType?.trim() || undefined,
        startTime,
        endTime,
      },
    }),
  )
}

export async function createAsyncTask(request: AsyncTaskRequest) {
  return unwrapResult(
    await apiClient.post<ApiResult<SysAsyncTask>>('/api/v1/system/async-tasks', request),
  )
}

export async function getAsyncTask(taskId: number) {
  return unwrapResult(
    await apiClient.get<ApiResult<SysAsyncTask>>(`/api/v1/system/async-tasks/${taskId}`),
  )
}

export async function cancelAsyncTask(taskId: number) {
  return unwrapResult(
    await apiClient.post<ApiResult<SysAsyncTask>>(`/api/v1/system/async-tasks/${taskId}/cancel`),
  )
}

export async function pageAsyncTaskLogs(
  taskId: number,
  page: number,
  size: number,
  startTime?: string,
  endTime?: string,
) {
  return unwrapResult(
    await apiClient.get<ApiResult<AsyncTaskLogPage>>(`/api/v1/system/async-tasks/${taskId}/logs`, {
      params: { page, size, startTime, endTime },
    }),
  )
}
