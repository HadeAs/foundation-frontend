import type { components } from '@/types/business-api'
import { runtimeObjects, runtimeSortFields, type RuntimeType } from '@/business/runtime/schema'
import { checkResult, getBusinessDictionaries, type BasicQuery } from './basic-data'
import { apiClient, type ApiResult, unwrapResult } from './http'

type Schema = components['schemas']
export type RuntimeRecord =
  | Schema['NariVehicleLoadResponse']
  | Schema['NariLocationStateResponse']
  | Schema['NariContainerStateResponse']
  | Schema['NariBoxBindingResponse']
export interface RuntimePage {
  records?: RuntimeRecord[]
  total?: number
}
const url = (type: RuntimeType) => `/api/v1/business/${runtimeObjects[type].resource}`

// Runtime objects deliberately expose GET only; generic CRUD endpoints are not PC maintenance actions.
export async function pageRuntimeData(type: RuntimeType, query: BasicQuery) {
  const config = runtimeObjects[type]
  const allowed = new Set([
    'page',
    'size',
    'sortBy',
    'sortOrder',
    ...config.filters,
    ...config.more,
  ])
  const params = Object.fromEntries(
    Object.entries(query).filter(
      ([key, value]) => allowed.has(key) && value !== undefined && value !== null && value !== '',
    ),
  )
  if (!query.sortBy || !runtimeSortFields.includes(query.sortBy)) {
    delete params.sortBy
    delete params.sortOrder
  }
  const response = await apiClient.get<ApiResult<RuntimePage>>(url(type), { params })
  checkResult(response.data)
  return unwrapResult(response)
}
export async function getRuntimeData(type: RuntimeType, id: number) {
  const response = await apiClient.get<ApiResult<RuntimeRecord>>(`${url(type)}/${id}`)
  checkResult(response.data)
  return unwrapResult(response)
}
export function getRuntimeDictionaries(type: RuntimeType) {
  return getBusinessDictionaries(
    runtimeObjects[type].fields.flatMap((field) => (field.dict ? [field.dict] : [])),
  )
}
