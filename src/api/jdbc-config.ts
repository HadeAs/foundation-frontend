import axios from 'axios'

import { apiClient, ApiError, type ApiResult, CONFLICT_MESSAGE } from './http'

export type JdbcProfile = 'MES' | 'WMS'
export interface JdbcConfig {
  profile?: string
  configured: boolean
  enabled?: boolean
  jdbcUrl?: string
  username?: string
  driverClassName?: string
  passwordSet?: boolean
  version?: number | null
}
export interface JdbcConfigSave {
  enabled: boolean
  jdbcUrl: string
  username: string
  driverClassName: string
  password?: string | null
  version?: number | null
}

export const MANAGED_JDBC_MESSAGE = '受管连接参数请通过“连接配置”维护'

export function isManagedJdbcKey(key?: string) {
  return ['nari.jdbc.mes', 'nari.jdbc.wms'].includes(key?.trim().toLowerCase() || '')
}

export function isJdbcConflict(error: unknown) {
  return (
    (axios.isAxiosError(error) &&
      (error.response?.status === 409 || Number(error.response?.data?.code) === 40900)) ||
    (error instanceof ApiError && error.message === CONFLICT_MESSAGE)
  )
}

function readConfig(result: ApiResult<JdbcConfig>, profile: JdbcProfile): JdbcConfig {
  if (result.code === 40900) throw new ApiError(CONFLICT_MESSAGE, result.traceId)
  if (result.code !== undefined && result.code !== 0) {
    throw new ApiError(result.message || '连接配置操作失败', result.traceId)
  }
  const data = result.data
  if (
    !data ||
    typeof data.configured !== 'boolean' ||
    (data.profile !== undefined && data.profile !== profile) ||
    (data.configured &&
      (typeof data.enabled !== 'boolean' ||
        typeof data.jdbcUrl !== 'string' ||
        typeof data.username !== 'string' ||
        typeof data.driverClassName !== 'string' ||
        typeof data.passwordSet !== 'boolean' ||
        !Number.isInteger(data.version) ||
        Number(data.version) < 0))
  ) {
    throw new ApiError('连接配置响应不完整，请重新加载', result.traceId)
  }
  // Only retain documented fields; never propagate password/ciphertext returned unexpectedly.
  return {
    profile,
    configured: data.configured,
    enabled: data.enabled,
    jdbcUrl: data.jdbcUrl,
    username: data.username,
    driverClassName: data.driverClassName,
    passwordSet: data.passwordSet,
    version: data.version,
  }
}

export async function getJdbcConfig(profile: JdbcProfile) {
  const response = await apiClient.get<ApiResult<JdbcConfig>>(
    `/api/v1/business/nari-logistics/jdbc-configs/${profile}`,
  )
  return readConfig(response.data, profile)
}

export async function saveJdbcConfig(profile: JdbcProfile, request: JdbcConfigSave) {
  const response = await apiClient.put<ApiResult<JdbcConfig>>(
    `/api/v1/business/nari-logistics/jdbc-configs/${profile}`,
    request,
  )
  return readConfig(response.data, profile)
}
