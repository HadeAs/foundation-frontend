import type { components } from '@/types/api'

import { apiClient, type ApiResult, unwrapResult } from './http'

export type SysApiLog = components['schemas']['SysApiLog']
export type ApiLogPage = components['schemas']['PageResultSysApiLog']
export type SysLoginLog = components['schemas']['SysLoginLog']
export type LoginLogPage = components['schemas']['PageResultSysLoginLog']
export type SysOperationLog = components['schemas']['SysOperationLog']
export type OperationLogPage = components['schemas']['PageResultSysOperationLog']
export type SysAuditLog = components['schemas']['SysAuditLog']
export type AuditLogPage = components['schemas']['PageResultSysAuditLog']

export async function pageApiLogs(
  page: number,
  size: number,
  keyword?: string,
  statusCode?: number,
  startTime?: string,
  endTime?: string,
) {
  return unwrapResult(
    await apiClient.get<ApiResult<ApiLogPage>>('/api/v1/monitor/logs/api', {
      params: {
        page,
        size,
        keyword: keyword?.trim() || undefined,
        statusCode,
        startTime,
        endTime,
      },
    }),
  )
}

export async function pageLoginLogs(
  page: number,
  size: number,
  keyword?: string,
  success?: boolean,
  startTime?: string,
  endTime?: string,
) {
  return unwrapResult(
    await apiClient.get<ApiResult<LoginLogPage>>('/api/v1/monitor/logs/login', {
      params: {
        page,
        size,
        keyword: keyword?.trim() || undefined,
        success,
        startTime,
        endTime,
      },
    }),
  )
}

export async function pageOperationLogs(
  page: number,
  size: number,
  keyword?: string,
  operationType?: string,
  startTime?: string,
  endTime?: string,
) {
  return unwrapResult(
    await apiClient.get<ApiResult<OperationLogPage>>('/api/v1/monitor/logs/operation', {
      params: {
        page,
        size,
        keyword: keyword?.trim() || undefined,
        operationType,
        startTime,
        endTime,
      },
    }),
  )
}

export async function pageAuditLogs(
  page: number,
  size: number,
  keyword?: string,
  targetType?: string,
  actionType?: string,
  operator?: string,
  startTime?: string,
  endTime?: string,
) {
  return unwrapResult(
    await apiClient.get<ApiResult<AuditLogPage>>('/api/v1/monitor/audit-logs', {
      params: {
        page,
        size,
        keyword: keyword?.trim() || undefined,
        targetType: targetType?.trim() || undefined,
        actionType: actionType?.trim() || undefined,
        operator: operator?.trim() || undefined,
        startTime,
        endTime,
      },
    }),
  )
}
