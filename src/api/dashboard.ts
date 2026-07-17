import type { components } from '@/types/api'

import { apiClient, type ApiResult, unwrapResult } from './http'

export type DashboardOverview = components['schemas']['DashboardOverview']
export type DashboardMetric = components['schemas']['DashboardMetric']

export async function getDashboardOverview() {
  return unwrapResult(
    await apiClient.get<ApiResult<DashboardOverview>>('/api/v1/dashboard/overview'),
  )
}
