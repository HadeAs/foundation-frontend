import axios, {
  AxiosError,
  type InternalAxiosRequestConfig,
  type AxiosResponse,
} from 'axios'

import {
  clearStoredSession,
  readStoredSession,
  writeStoredSession,
} from '@/auth/session'
import type { components } from '@/types/api'

export type ApiResult<T> = {
  code?: number
  message?: string
  data?: T
  timestamp?: string
  traceId?: string
}

type RetryRequest = InternalAxiosRequestConfig & { _retry?: boolean }
type TokenResponse = components['schemas']['TokenResponse']

export class ApiError extends Error {
  constructor(
    message: string,
    public readonly traceId?: string,
  ) {
    super(message)
    this.name = 'ApiError'
  }
}

export const apiClient = axios.create({
  baseURL: '/',
  timeout: 15_000,
})

let sessionExpiredHandler: (() => void | Promise<void>) | undefined
let sessionExpiryHandled = false

export function setSessionExpiredHandler(handler: () => void | Promise<void>) {
  sessionExpiredHandler = handler
}

async function notifySessionExpired() {
  if (sessionExpiryHandled) return
  sessionExpiryHandled = true
  clearStoredSession()
  await sessionExpiredHandler?.()
}

apiClient.interceptors.request.use((config) => {
  const token = readStoredSession()?.token
  if (token) {
    sessionExpiryHandled = false
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

let refreshing: Promise<string> | null = null

async function refreshToken() {
  const current = readStoredSession()
  if (!current?.token) throw new ApiError('登录状态已失效，请重新登录')

  const response = await axios.post<ApiResult<TokenResponse>>(
    '/api/v1/auth/refresh',
    undefined,
    { headers: { Authorization: `Bearer ${current.token}` }, timeout: 15_000 },
  )
  const next = response.data.data
  if (!next?.token) throw new ApiError(response.data.message || '刷新登录状态失败')

  writeStoredSession({
    ...current,
    token: next.token,
    expiresAt: next.expiresAt,
    refreshExpiresAt: next.refreshExpiresAt,
  })
  return next.token
}

apiClient.interceptors.response.use(
  (response) => response,
  async (error: AxiosError<ApiResult<unknown>>) => {
    const request = error.config as RetryRequest | undefined
    const url = request?.url || ''
    const canRefresh =
      error.response?.status === 401 &&
      request &&
      !request._retry &&
      !url.includes('/api/v1/auth/login') &&
      !url.includes('/api/v1/auth/refresh')

    if (!canRefresh) return Promise.reject(error)

    request._retry = true
    refreshing ??= refreshToken().finally(() => {
      refreshing = null
    })

    try {
      request.headers.Authorization = `Bearer ${await refreshing}`
      return await apiClient(request)
    } catch (refreshError) {
      await notifySessionExpired()
      return Promise.reject(refreshError)
    }
  },
)

export function unwrapResult<T>(response: AxiosResponse<ApiResult<T>>): T {
  if (response.data.data === undefined) {
    throw new ApiError(response.data.message || '接口未返回有效数据', response.data.traceId)
  }
  return response.data.data
}

export function getErrorMessage(error: unknown) {
  if (error instanceof ApiError) {
    return error.traceId ? `${error.message}（Trace ID: ${error.traceId}）` : error.message
  }
  if (axios.isAxiosError<ApiResult<unknown>>(error)) {
    const message = error.response?.data?.message
    const traceId = error.response?.data?.traceId
    if (message) return traceId ? `${message}（Trace ID: ${traceId}）` : message
    if (!error.response) return '无法连接服务，请检查网络或后端服务状态'
  }
  return '操作失败，请稍后重试'
}
