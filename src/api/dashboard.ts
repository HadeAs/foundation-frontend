import type { components } from '@/types/api'

import { apiClient, ApiError, type ApiResult, unwrapResult } from './http'

export type DashboardOverview = components['schemas']['DashboardOverview']
export type DashboardMetric = components['schemas']['DashboardMetric']
export type RuntimeConnection = components['schemas']['RuntimeConnectionStatus']
export type RuntimeConnectionsOverview = components['schemas']['RuntimeConnectionsOverview']

export async function getRuntimeConnections(signal?: AbortSignal) {
  const response = await apiClient.get<components['schemas']['RuntimeConnectionsResult']>(
    '/api/v1/dashboard/connections',
    { signal, headers: { 'Cache-Control': 'no-cache' } },
  )
  if (response.data.code !== 0) {
    throw new ApiError(
      response.data.message || '连接状态查询失败',
      response.data.traceId ?? undefined,
    )
  }
  if (!response.data.data || !Array.isArray(response.data.data.items)) {
    throw new ApiError('接口未返回有效连接状态')
  }
  return response.data.data
}

export async function getDashboardOverview() {
  return unwrapResult(
    await apiClient.get<ApiResult<DashboardOverview>>('/api/v1/dashboard/overview'),
  )
}
