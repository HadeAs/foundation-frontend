import type { components } from '@/types/api'

import { apiClient, type ApiResult, unwrapResult } from './http'

export type JobRequest = components['schemas']['JobRequest']
export type SysJob = components['schemas']['SysJob']
export type SysJobLog = components['schemas']['SysJobLog']
export type JobHandlerOption = components['schemas']['JobHandlerOption']
export type JobPage = components['schemas']['PageResultSysJob']
export type JobLogPage = components['schemas']['PageResultSysJobLog']

export async function pageJobs(
  page: number,
  size: number,
  keyword?: string,
  jobScope?: string,
  sourceType?: string,
) {
  return unwrapResult(
    await apiClient.get<ApiResult<JobPage>>('/api/v1/system/jobs', {
      params: { page, size, keyword: keyword?.trim() || undefined, jobScope, sourceType },
    }),
  )
}

export async function listJobHandlers() {
  return unwrapResult(
    await apiClient.get<ApiResult<JobHandlerOption[]>>('/api/v1/system/jobs/handlers'),
  )
}

export async function createJob(request: JobRequest) {
  return unwrapResult(
    await apiClient.post<ApiResult<SysJob>>('/api/v1/system/jobs', request),
  )
}

export async function updateJob(jobId: number, request: JobRequest) {
  return unwrapResult(
    await apiClient.put<ApiResult<SysJob>>(`/api/v1/system/jobs/${jobId}`, request),
  )
}

export function deleteJob(jobId: number) {
  return apiClient.delete(`/api/v1/system/jobs/${jobId}`)
}

export function batchDeleteJobs(ids: number[]) {
  return apiClient.post('/api/v1/system/jobs/batch/delete', { ids })
}

export function runJobNow(jobId: number) {
  return apiClient.post(`/api/v1/system/jobs/${jobId}/run`)
}

export function pauseJob(jobId: number) {
  return apiClient.post(`/api/v1/system/jobs/${jobId}/pause`)
}

export function resumeJob(jobId: number) {
  return apiClient.post(`/api/v1/system/jobs/${jobId}/resume`)
}

export async function pageJobLogs(
  jobId: number,
  page: number,
  size: number,
  startTime?: string,
  endTime?: string,
) {
  return unwrapResult(
    await apiClient.get<ApiResult<JobLogPage>>(`/api/v1/system/jobs/${jobId}/logs`, {
      params: { page, size, startTime, endTime },
    }),
  )
}
