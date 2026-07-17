import type { components } from '@/types/api'

import { apiClient, type ApiResult, unwrapResult } from './http'

export type LifecycleOverview = components['schemas']['LifecycleOverviewResponse']
export type LifecyclePolicy = components['schemas']['Policy']
export type LifecycleJob = components['schemas']['CleanupJob']
export type LifecycleCleanupLog = components['schemas']['SysLifecycleCleanupLog']
export type LifecycleCleanupLogPage = components['schemas']['PageResultSysLifecycleCleanupLog']

export async function getLifecycleOverview() {
  return unwrapResult(
    await apiClient.get<ApiResult<LifecycleOverview>>('/api/v1/system/lifecycle/overview'),
  )
}

export async function pageLifecycleCleanupLogs(
  page: number,
  size: number,
  keyword?: string,
  policyCode?: string,
  targetName?: string,
  status?: string,
  startTime?: string,
  endTime?: string,
) {
  return unwrapResult(
    await apiClient.get<ApiResult<LifecycleCleanupLogPage>>('/api/v1/system/lifecycle/cleanup-logs', {
      params: {
        page,
        size,
        keyword: keyword?.trim() || undefined,
        policyCode: policyCode?.trim() || undefined,
        targetName: targetName?.trim() || undefined,
        status: status?.trim() || undefined,
        startTime,
        endTime,
      },
    }),
  )
}
