import type { components } from '@/types/business-api'
import { checkResult } from './basic-data'
import { apiClient, type ApiResult, unwrapResult } from './http'

type Schema = components['schemas']
export type ProductionPlan = Schema['NariProductionPlanResponse']
export type ProductionPlanQuery = Schema['NariProductionPlanQuery']
export type ProductionPlanPage = Schema['PageResultNariProductionPlanResponse']
export const productionPlanSortFields = ['id', 'createdTime', 'updatedTime', 'plannedStartTime', 'planNo', 'sequenceNo']
const queryFields = new Set(['page', 'size', 'keyword', 'sortBy', 'sortOrder', 'planNo', 'orderNo', 'resourceCode', 'productionLineId', 'mainProcessCode', 'deliveryStorageZoneId', 'planStatus', 'plannedStartTimeStart', 'plannedStartTimeEnd'])

// Dedicated plan operations are not part of V9; generic CRUD must not simulate insertion/reordering.
export async function pageProductionPlans(query: ProductionPlanQuery) {
  const params = Object.fromEntries(Object.entries(query).filter(([key, value]) => queryFields.has(key) && value !== undefined && value !== null && value !== ''))
  if (!query.sortBy || !productionPlanSortFields.includes(query.sortBy)) {
    delete params.sortBy; delete params.sortOrder
  } else if (query.sortOrder !== 'ASC' && query.sortOrder !== 'DESC') delete params.sortOrder
  const response = await apiClient.get<ApiResult<ProductionPlanPage>>('/api/v1/business/nari-production-plan', { params })
  checkResult(response.data)
  return unwrapResult(response)
}
