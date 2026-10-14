import axios from 'axios'
import type { components } from '@/types/business-api'
import { objects, sortableFields, type DataRecord, type ObjectType } from '@/business/basic-data/schema'
import { apiClient, ApiError, type ApiResult, CONFLICT_MESSAGE, requireVersion, unwrapResult, versionedId } from './http'

type Schema = components['schemas']
type BusinessResponse = Schema['NariFactoryResponse'] | Schema['NariFloorResponse'] | Schema['NariAreaResponse'] | Schema['NariProductionLineResponse'] | Schema['NariStorageZoneResponse'] | Schema['NariLocationResponse'] | Schema['NariContainerModelResponse'] | Schema['NariContainerResponse'] | Schema['NariLocationLineResponse'] | Schema['NariLocationContainerModelResponse'] | Schema['NariLocationUsageResponse'] | Schema['NariLocationStorageZoneResponse'] | Schema['NariVehicleSlotResponse'] | Schema['NariFixtureBoxOrderResponse'] | Schema['NariResourceLineResponse'] | Schema['NariLineProcessStorageZoneResponse']
export interface BasicPage { records?: BusinessResponse[]; total?: number }
export type BasicQuery = DataRecord & { page: number; size: number; sortBy?: string; sortOrder?: 'ASC' | 'DESC' }
export type DictionaryItem = Schema['DictItemResponse']
export async function getBasicDictionaries(type: ObjectType): Promise<Record<string, DictionaryItem[]>> {
  const codes = objects[type].fields.flatMap((field) => field.dict ? [field.dict] : [])
  return getBusinessDictionaries(codes)
}
export async function getBusinessDictionaries(codes: string[]): Promise<Record<string, DictionaryItem[]>> {
  if (!codes.length) return {}
  const response = await apiClient.get<ApiResult<Record<string, DictionaryItem[]>>>('/api/v1/system/dicts/items', { params: { codes: codes.join(',') } })
  checkResult(response.data)
  return unwrapResult(response)
}
const url = (type: ObjectType) => `/api/v1/business/${objects[type].resource}`

// Some deployments return a business failure inside HTTP 200. Never treat it as a successful write.
export function checkResult<T>(result: ApiResult<T>) {
  if (result.code === 40900) throw new ApiError(CONFLICT_MESSAGE, result.traceId)
  if (result.code !== undefined && result.code !== 0) throw new ApiError(result.message || '操作失败，请稍后重试', result.traceId)
}
export function isVersionConflict(error: unknown) {
  return (axios.isAxiosError(error) && (error.response?.status === 409 || error.response?.data?.code === 40900)) || (error instanceof Error && error.message.startsWith(CONFLICT_MESSAGE))
}
export async function pageBasicData(type: ObjectType, query: BasicQuery) {
  const params = Object.fromEntries(Object.entries(query).filter(([, value]) => value !== undefined && value !== null && value !== ''))
  if (!query.sortBy || !sortableFields(type).includes(query.sortBy)) { delete params.sortBy; delete params.sortOrder }
  const response = await apiClient.get<ApiResult<BasicPage>>(url(type), { params })
  checkResult(response.data)
  return unwrapResult(response)
}
export async function getBasicData(type: ObjectType, id: number): Promise<DataRecord> {
  const response = await apiClient.get<ApiResult<BusinessResponse>>(`${url(type)}/${id}`)
  checkResult(response.data)
  return unwrapResult(response)
}
export async function saveBasicData(type: ObjectType, body: DataRecord, record?: DataRecord): Promise<DataRecord> {
  if (record && record.id === undefined) throw new ApiError('缺少记录 ID，请刷新后重试')
  const response = record
    ? await apiClient.put<ApiResult<BusinessResponse>>(`${url(type)}/${record.id}`, { ...body, version: requireVersion(record.version) })
    : await apiClient.post<ApiResult<BusinessResponse>>(url(type), body)
  checkResult(response.data)
  return unwrapResult(response)
}
export async function deleteBasicData(type: ObjectType, records: DataRecord[], batch: boolean) {
  const items = records.map((record) => {
    if (record.id === undefined) throw new ApiError('缺少记录 ID，请刷新后重试')
    return versionedId(record.id, record.version)
  })
  if (!items.length) throw new ApiError('请选择要删除的数据')
  const response = batch
    ? await apiClient.post<ApiResult<unknown>>(`${url(type)}/batch/delete`, { items })
    : await apiClient.delete<ApiResult<unknown>>(`${url(type)}/${items[0]!.id}`, { params: { version: items[0]!.version } })
  checkResult(response.data)
}
