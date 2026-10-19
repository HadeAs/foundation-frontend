import { describe, expect, it } from 'vitest'
import contract from '../../../doc/nari-logistics.openapi.json'
import {
  buildRequest,
  changeField,
  objects,
  sortableFields,
  validateDraft,
  visibleFields,
  type DataRecord,
  type ObjectType,
} from './schema'

type ContractSchema = {
  properties: Record<string, { description?: string; nullable?: boolean }>
  required?: string[]
}
const schemas = contract.components.schemas as unknown as Record<string, ContractSchema>
describe('基础资料 V9 字段与查询契约', () => {
  for (const type of Object.keys(objects) as ObjectType[])
    it(`${type} 的字段、必填、筛选及排序与 V9 一致`, () => {
      const config = objects[type]
      const request = schemas[`Nari${config.schema}Request`]!
      const query = schemas[`Nari${config.schema}Query`]!
      const response = schemas[`Nari${config.schema}Response`]!
      expect(config.fields.map((item) => item.key).sort()).toEqual(
        Object.keys(request.properties)
          .filter((key) => key !== 'version')
          .sort(),
      )
      expect(
        config.fields
          .filter((item) => item.required)
          .map((item) => item.key)
          .sort(),
      ).toEqual([...(request.required || [])].filter((key) => key !== 'version').sort())
      for (const key of [
        ...config.filters,
        config.searchKey || 'keyword',
        'enabled',
        ...(config.owner ? [config.owner] : []),
      ])
        expect(query.properties).toHaveProperty(key)
      for (const key of config.columns) expect(response.properties).toHaveProperty(key)
      for (const key of sortableFields(type))
        expect(query.properties.sortBy?.description).toContain(key)
      expect(contract.paths).toHaveProperty(`/api/v1/business/${config.resource}`)
    })

  for (const type of Object.keys(objects) as ObjectType[])
    it(`${type} 使用独立更新 DTO，版本必填且仅可选字段允许 null 清空`, () => {
      const config = objects[type]
      const name = `Nari${config.schema}UpdateRequest`
      const update = schemas[name]!
      const paths = contract.paths as Record<
        string,
        { put?: { requestBody: { content: { 'application/json': { schema: { $ref: string } } } } } }
      >
      expect(
        paths[`/api/v1/business/${config.resource}/{id}`]?.put?.requestBody.content[
          'application/json'
        ].schema.$ref,
      ).toBe(`#/components/schemas/${name}`)
      expect(update.required).toEqual(['version'])
      expect(Object.keys(update.properties).sort()).toEqual(
        [...config.fields.map((field) => field.key), 'version'].sort(),
      )
      for (const field of config.fields) {
        expect(update.properties[field.key]?.nullable === true).toBe(!field.required)
        expect(update.properties[field.key]?.description).toContain('不传保留原值')
      }
      const body = buildRequest(type, {}, undefined, true)
      for (const [key, value] of Object.entries(body)) {
        expect(value).toBeNull()
        expect(update.properties[key]?.nullable).toBe(true)
      }
      expect(body).not.toHaveProperty('version')
    })

  it('容量只随大类显示，更新隐藏/清空字段传 null，新增省略', () => {
    for (const usage of ['TRANSFER_CART', 'MAGAZINE']) {
      expect(
        visibleFields('model', { containerCategory: 'VEHICLE_SLOT', usageType: usage }).some(
          (f) => f.key === 'boxCapacity',
        ),
      ).toBe(true)
    }
    const draft: DataRecord = {
      containerCategory: 'VEHICLE_SLOT',
      boxCapacity: 4,
      loadingMode: 'SLOT',
      version: 2,
    }
    changeField('model', draft, 'containerCategory', 'BOX')
    expect(draft.boxCapacity).toBeUndefined()
    expect(visibleFields('model', draft).some((f) => f.key === 'boxCapacity')).toBe(false)
    expect(buildRequest('model', draft)).not.toHaveProperty('boxCapacity')
    expect(buildRequest('model', draft, undefined, true)).toMatchObject({
      boxCapacity: null,
      remark: null,
    })
    expect(buildRequest('model', draft)).not.toHaveProperty('loadingMode')
    expect(buildRequest('model', draft)).not.toHaveProperty('version')
  })
  it('区域变更清空静态存储区，同区域和其他关联不受影响', () => {
    const draft: DataRecord = { areaId: 1, storageZoneId: 2, locationName: '原值' }
    changeField('location', draft, 'areaId', 1)
    expect(draft.storageZoneId).toBe(2)
    changeField('location', draft, 'areaId', 3)
    expect(buildRequest('location', draft, undefined, true)).toMatchObject({
      areaId: 3,
      storageZoneId: null,
      locationName: '原值',
    })
    const association: DataRecord = { storageZoneId: 2 }
    changeField('locationStorage', association, 'areaId', 3)
    expect(association.storageZoneId).toBe(2)
  })
  it('所属对象由上下文锁定，布尔 false 和前导零保留', () => {
    expect(buildRequest('slot', { vehicleId: 9, slotCode: '0001', enabled: false }, 3)).toEqual({
      vehicleId: 3,
      slotCode: '0001',
      enabled: false,
    })
  })
  it('必填、整数、正整数、长度与旧分类校验', () => {
    expect(
      validateDraft('factory', { factoryCode: '001', factoryName: '工厂', enabled: false }),
    ).toEqual({})
    expect(validateDraft('floor', { floorNumber: 1.5 })).toHaveProperty('floorNumber')
    expect(
      validateDraft('model', { containerCategory: 'VEHICLE_SLOT', boxCapacity: 0 }),
    ).toHaveProperty('boxCapacity')
    expect(
      validateDraft('model', { containerCategory: 'BOX', boxCapacity: -1 }),
    ).not.toHaveProperty('boxCapacity')
    expect(validateDraft('factory', { factoryCode: 'a'.repeat(129) })).toHaveProperty('factoryCode')
    expect(validateDraft('model', { containerCategory: 'VEHICLE' })).toHaveProperty(
      'containerCategory',
    )
    expect(validateDraft('slot', { vehicleId: 1, slotCode: '001', enabled: true })).toEqual({})
  })
})
