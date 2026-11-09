import type { components } from '@/types/api'

import { apiClient, ApiError, type ApiResult, requireVersion, unwrapResult } from './http'
import { isManagedJdbcKey, MANAGED_JDBC_MESSAGE } from './jdbc-config'

export type SysConfig = components['schemas']['SysConfig']
export type ConfigRequest = components['schemas']['ConfigRequest']
export type ConfigPage = components['schemas']['PageResultSysConfig']

export async function pageConfigs(
  page: number,
  size: number,
  keyword?: string,
  group?: string,
  scope?: string,
) {
  return unwrapResult(
    await apiClient.get<ApiResult<ConfigPage>>('/api/v1/system/configs', {
      params: {
        page,
        size,
        keyword: keyword?.trim() || undefined,
        group: group?.trim() || undefined,
        scope: scope || undefined,
      },
    }),
  )
}

export async function createConfig(request: ConfigRequest) {
  if (isManagedJdbcKey(request.configKey)) throw new ApiError(MANAGED_JDBC_MESSAGE)
  return unwrapResult(await apiClient.post<ApiResult<SysConfig>>('/api/v1/system/configs', request))
}

export async function updateConfig(
  configId: number,
  request: ConfigRequest,
  version: number | undefined,
) {
  if (isManagedJdbcKey(request.configKey)) throw new ApiError(MANAGED_JDBC_MESSAGE)
  return unwrapResult(
    await apiClient.put<ApiResult<SysConfig>>(`/api/v1/system/configs/${configId}`, {
      ...request,
      version: requireVersion(version),
    }),
  )
}

export function deleteConfig(configId: number, version: number | undefined) {
  return apiClient.delete(`/api/v1/system/configs/${configId}`, {
    params: { version: requireVersion(version) },
  })
}

export function refreshConfigCache() {
  return apiClient.post('/api/v1/system/configs/refresh')
}
