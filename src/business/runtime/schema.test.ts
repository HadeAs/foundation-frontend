import { describe, expect, it } from 'vitest'
import contract from '../../../doc/nari-logistics.openapi.json'
import {
  changeRuntimeFilter,
  defaultRuntimeFilters,
  runtimeObjects,
  runtimeSortFields,
  traceFields,
  type RuntimeType,
} from './schema'

type ContractSchema = { properties: Record<string, { description?: string }> }
const schemas = contract.components.schemas as unknown as Record<string, ContractSchema>
describe('运行对象 V9 契约', () => {
  for (const type of Object.keys(runtimeObjects) as RuntimeType[])
    it(`${type} 完整只读字段、筛选及排序白名单`, () => {
      const config = runtimeObjects[type]
      const response = schemas[`${config.schema}Response`]!
      const query = schemas[`${config.schema}Query`]!
      expect(
        [...config.fields, ...traceFields, ...config.technical].map((field) => field.key).sort(),
      ).toEqual(Object.keys(response.properties).sort())
      for (const key of [...config.filters, ...config.more])
        expect(query.properties).toHaveProperty(key)
      for (const key of config.columns) expect(response.properties).toHaveProperty(key)
      for (const key of runtimeSortFields)
        expect(query.properties.sortBy?.description).toContain(key)
      expect(contract.paths).toHaveProperty(`/api/v1/business/${config.resource}`)
      expect(contract.paths).toHaveProperty(`/api/v1/business/${config.resource}/{id}`)
    })
  it('关系默认有效、状态不限、载具更换或清除时清空槽位', () => {
    expect(defaultRuntimeFilters('vehicleLoad')).toEqual({ bindingStatus: 'ACTIVE' })
    expect(defaultRuntimeFilters('boxBinding')).toEqual({ bindingStatus: 'ACTIVE' })
    expect(defaultRuntimeFilters('containerState')).toEqual({})
    const draft = { vehicleId: 1 as number | undefined, vehicleSlotId: 3 as number | undefined }
    changeRuntimeFilter('vehicleLoad', draft, 'vehicleId', 1)
    expect(draft.vehicleSlotId).toBe(3)
    changeRuntimeFilter('vehicleLoad', draft, 'vehicleId', 2)
    expect(draft.vehicleSlotId).toBeUndefined()
    draft.vehicleSlotId = 4
    changeRuntimeFilter('vehicleLoad', draft, 'vehicleId', undefined)
    expect(draft.vehicleSlotId).toBeUndefined()
  })
})
