import axios from 'axios'
import { apiClient, ApiError, type ApiResult, CONFLICT_MESSAGE } from './http'

export interface LongTokenScope {
  scopeCode: string
  name: string
  description: string
}
export interface LongTokenApi {
  apiCode: string
  scopeCode: string
  name: string
  method: string
  path: string
}
export interface LongTokenMetadata {
  tokenId: string
  scopeCode: string
  name?: string
  scopeName?: string
  enabled?: boolean
  version?: number
  authorizationVersion?: number
  apiCodes?: string[]
  createdTime?: string
  revokedTime?: string | null
}
export interface LongTokenPage {
  records: LongTokenMetadata[]
  total: number
  current?: number
  size?: number
}
export interface LongTokenCreated {
  metadata: LongTokenMetadata
  token: string
}
export interface LongTokenQuery {
  scopeCode: string
  page: number
  size: number
  keyword?: string
  enabled?: boolean
}
export interface LongTokenCreate {
  scopeCode: string
  name: string
  apiCodes: string[]
}
export interface LongTokenAuthorization {
  apiCodes: string[]
  version: number
  authorizationVersion: number
}

const base = '/api/v1/system/long-tokens'
export class LongTokenOutcomeUnknownError extends ApiError {}

function check<T>(result: ApiResult<T>) {
  if (result.code === 40900) throw new ApiError(CONFLICT_MESSAGE, result.traceId)
  if (result.code !== undefined && result.code !== 0)
    throw new ApiError(result.message || '长期 Token 操作失败', result.traceId)
}
function data<T>(result: ApiResult<T>): T {
  check(result)
  if (result.data === undefined || result.data === null)
    throw new ApiError('接口未返回有效数据', result.traceId)
  return result.data
}
function metadata(row: LongTokenMetadata, scopeCode: string): LongTokenMetadata {
  if (!row || typeof row.tokenId !== 'string' || !row.tokenId || row.scopeCode !== scopeCode)
    throw new ApiError('Token 元数据不完整，请刷新后重试')
  // The list and authorization response must never retain plaintext Token fields.
  return {
    tokenId: row.tokenId,
    scopeCode: row.scopeCode,
    name: row.name,
    scopeName: row.scopeName,
    enabled: row.enabled,
    version: row.version,
    authorizationVersion: row.authorizationVersion,
    apiCodes: row.apiCodes,
    createdTime: row.createdTime,
    revokedTime: row.revokedTime,
  }
}
export function canRevokeToken(row: LongTokenMetadata) {
  return row.enabled === true && Number.isInteger(row.version) && Number(row.version) >= 1
}
export function canAuthorizeToken(row: LongTokenMetadata) {
  return (
    canRevokeToken(row) &&
    Number.isInteger(row.authorizationVersion) &&
    Number(row.authorizationVersion) >= 0 &&
    Array.isArray(row.apiCodes)
  )
}
export function isLongTokenConflict(error: unknown) {
  return (
    (axios.isAxiosError(error) &&
      (error.response?.status === 409 || Number(error.response?.data?.code) === 40900)) ||
    (error instanceof ApiError && error.message === CONFLICT_MESSAGE)
  )
}
export function isLongTokenOutcomeUnknown(error: unknown) {
  return (
    error instanceof LongTokenOutcomeUnknownError ||
    (axios.isAxiosError(error) && (!error.response || error.response.status >= 500))
  )
}
function apiCodes(codes: string[]) {
  if (codes.length > 100 || codes.some((code) => !code) || new Set(codes).size !== codes.length)
    throw new ApiError('最多选择 100 个接口，且不能重复')
  return [...codes]
}
export async function getLongTokenScopes() {
  const result = data((await apiClient.get<ApiResult<LongTokenScope[]>>(`${base}/scopes`)).data)
  if (!Array.isArray(result) || result.some((row) => !row.scopeCode || !row.name))
    throw new ApiError('接入范围响应无效')
  return result
}
export async function getLongTokenApis() {
  const result = data((await apiClient.get<ApiResult<LongTokenApi[]>>(`${base}/interfaces`)).data)
  if (
    !Array.isArray(result) ||
    result.some((row) => !row.apiCode || !row.scopeCode || !row.name || !row.method || !row.path)
  )
    throw new ApiError('接口授权目录响应无效')
  return result
}
export async function pageLongTokens(query: LongTokenQuery): Promise<LongTokenPage> {
  const result = data(
    (
      await apiClient.get<ApiResult<LongTokenPage>>(base, {
        params: {
          scopeCode: query.scopeCode,
          page: query.page,
          size: query.size,
          keyword: query.keyword?.trim() || undefined,
          enabled: query.enabled,
        },
      })
    ).data,
  )
  if (!Array.isArray(result.records) || !Number.isFinite(result.total))
    throw new ApiError('Token 列表响应无效')
  return {
    records: result.records.map((row) => metadata(row, query.scopeCode)),
    total: result.total,
    current: result.current,
    size: result.size,
  }
}
export async function createLongToken(request: LongTokenCreate): Promise<LongTokenCreated> {
  const result = (
    await apiClient.post<ApiResult<LongTokenCreated>>(base, {
      scopeCode: request.scopeCode,
      name: request.name.trim(),
      apiCodes: apiCodes(request.apiCodes),
    })
  ).data
  check(result)
  try {
    if (!result.data?.token || typeof result.data.token !== 'string')
      throw new Error('missing token')
    return { metadata: metadata(result.data.metadata, request.scopeCode), token: result.data.token }
  } catch {
    throw new LongTokenOutcomeUnknownError('创建响应不完整，请先刷新列表核对，勿重复创建')
  }
}
export async function revokeLongToken(row: LongTokenMetadata) {
  if (!canRevokeToken(row)) throw new ApiError('Token 已停用或版本缺失，请刷新后重试')
  const result = await apiClient.post<ApiResult<null>>(
    `${base}/${encodeURIComponent(row.scopeCode)}/${encodeURIComponent(row.tokenId)}/revoke`,
    { version: row.version },
  )
  check(result.data)
}
export async function authorizeLongToken(row: LongTokenMetadata, codes: string[]) {
  if (!canAuthorizeToken(row)) throw new ApiError('Token 状态或授权版本无效，请刷新后重试')
  const request: LongTokenAuthorization = {
    apiCodes: apiCodes(codes),
    version: row.version!,
    authorizationVersion: row.authorizationVersion!,
  }
  const result = data(
    (
      await apiClient.put<ApiResult<LongTokenMetadata>>(
        `${base}/${encodeURIComponent(row.scopeCode)}/${encodeURIComponent(row.tokenId)}/authorization`,
        request,
      )
    ).data,
  )
  return metadata(result, row.scopeCode)
}
