import type { components } from '@/types/api'

import {
  apiClient,
  type ApiResult,
  requireVersion,
  type VersionedId,
  unwrapResult,
} from './http'

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

export async function updateJob(jobId: number, request: JobRequest, version: number | undefined) {
  return unwrapResult(
    await apiClient.put<ApiResult<SysJob>>(`/api/v1/system/jobs/${jobId}`, {
      ...request,
      version: requireVersion(version),
    }),
  )
}

export function deleteJob(jobId: number, version: number | undefined) {
  return apiClient.delete(`/api/v1/system/jobs/${jobId}`, {
    params: { version: requireVersion(version) },
  })
}

export function batchDeleteJobs(items: VersionedId[]) {
  return apiClient.post('/api/v1/system/jobs/batch/delete', { items })
}

export function runJobNow(jobId: number) {
  return apiClient.post(`/api/v1/system/jobs/${jobId}/run`)
}

export function pauseJob(jobId: number, version: number | undefined) {
  return apiClient.post(`/api/v1/system/jobs/${jobId}/pause`, undefined, {
    params: { version: requireVersion(version) },
  })
}

export function resumeJob(jobId: number, version: number | undefined) {
  return apiClient.post(`/api/v1/system/jobs/${jobId}/resume`, undefined, {
    params: { version: requireVersion(version) },
  })
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
