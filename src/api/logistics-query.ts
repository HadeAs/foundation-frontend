import type { components } from '@/types/business-api'
import { fields, queryKeys, queryObjects, type QueryType } from '@/business/logistics-query/schema'
import { checkResult, getBusinessDictionaries, type BasicQuery } from './basic-data'
import { apiClient, ApiError, type ApiResult, unwrapResult } from './http'

type Schema = components['schemas']
export type LogisticsRecord = Schema['NariLogisticsTaskResponse'] | Schema['NariOperationRecordResponse'] | Schema['NariWarehouseRecordResponse'] | Schema['NariWarehouseRecordBoxResponse'] | Schema['NariReceivingRecordResponse']
export interface LogisticsPage { records?: LogisticsRecord[]; total?: number }
const url = (type: QueryType) => `/api/v1/business/${queryObjects[type].resource}`

// Deliberately GET-only. CRUD and PDA commands are outside these query pages.
export async function pageLogisticsData(type: QueryType, query: BasicQuery) {
  const allowed = new Set(['page', 'size', 'sortBy', 'sortOrder', ...queryKeys(type)])
  const params = Object.fromEntries(Object.entries(query).filter(([key, value]) => allowed.has(key) && value !== undefined && value !== null && value !== ''))
  if (!query.sortBy || !queryObjects[type].sort.includes(query.sortBy)) { delete params.sortBy; delete params.sortOrder }
  const response = await apiClient.get<ApiResult<LogisticsPage>>(url(type), { params })
  checkResult(response.data)
  return unwrapResult(response)
}
export async function getLogisticsData(type: QueryType, id: number) {
  const response = await apiClient.get<ApiResult<LogisticsRecord>>(`${url(type)}/${id}`)
  checkResult(response.data)
  const result = unwrapResult(response)
  if (!result || result.id === undefined) throw new ApiError('关联记录不存在或暂不可用')
  return result
}
export function getLogisticsDictionaries(type: QueryType) {
  const config = queryObjects[type]
  return getBusinessDictionaries([...new Set([...config.details, ...config.technical].flatMap(key => fields[key]?.dict ? [fields[key]!.dict!] : []))])
}
