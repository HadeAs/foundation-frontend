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
describe('基础资料字段与最新查询契约', () => {
  for (const type of Object.keys(objects) as ObjectType[])
    it(`${type} 的字段、必填、筛选及排序与当前 OpenAPI 一致`, () => {
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

  it('产线归属楼层，查询和维护不再使用区域字段', () => {
    expect(objects.line.fields.find((item) => item.key === 'floorId')).toMatchObject({
      label: '所属楼层',
      target: 'floor',
      required: true,
    })
    expect(objects.line.filters).toEqual(['floorId', 'lineType'])
    expect(objects.line.columns).toContain('floorId')
    expect(objects.line.columns).not.toContain('areaId')
    expect(validateDraft('line', {}).floorId).toBe('请填写所属楼层')
    expect(buildRequest('line', { floorId: 2, areaId: 99 })).toEqual({ floorId: 2 })
    expect(buildRequest('line', { floorId: 3, areaId: 99 }, undefined, true)).toMatchObject({
      floorId: 3,
    })
    expect(buildRequest('line', { floorId: null }, undefined, true)).not.toHaveProperty('floorId')
    for (const type of ['storage', 'location'] as const)
      expect(objects[type].fields.find((item) => item.key === 'areaId')?.target).toBe('area')
  })
  it('交管区域只维护基础字段，编码保留前导零，不提交运行状态', () => {
    expect(sortableFields('trafficArea')).toEqual(['id', 'createdTime', 'updatedTime'])
    const draft = {
      areaCode: ' 0001 ',
      areaName: ' 交管一区 ',
      enabled: false,
      remark: '',
      status: 'OCCUPIED',
      lockSource: 'PDA',
      occupancyKey: 'TASK-01',
      lastOperatorName: 'admin',
      lastOperationTime: '2026-10-19T01:30:00Z',
      version: 3,
    }
    expect(buildRequest('trafficArea', draft)).toEqual({
      areaCode: '0001',
      areaName: '交管一区',
      enabled: false,
    })
    expect(buildRequest('trafficArea', draft, undefined, true)).toEqual({
      areaCode: '0001',
      areaName: '交管一区',
      enabled: false,
      remark: null,
    })
    expect(validateDraft('trafficArea', draft)).toEqual({})
    expect(validateDraft('trafficArea', { ...draft, areaCode: ' ' })).toHaveProperty('areaCode')
    expect(validateDraft('trafficArea', { ...draft, areaName: 'a'.repeat(129) })).toHaveProperty(
      'areaName',
    )
    expect(validateDraft('trafficArea', { ...draft, remark: 'a'.repeat(501) })).toHaveProperty(
      'remark',
    )
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
  it('楼层数仅更改显示文案，字段、必填、整数校验和排序保持不变', () => {
    expect(objects.floor.fields.find((item) => item.key === 'floorNumber')).toEqual({
      key: 'floorNumber',
      label: '楼层数',
      kind: 'integer',
      required: true,
    })
    expect(objects.floor.columns).toContain('floorNumber')
    expect(sortableFields('floor')).toContain('floorNumber')
    expect(validateDraft('floor', {}).floorNumber).toBe('请填写楼层数')
    for (const floorNumber of [-1, 0, 3]) {
      expect(validateDraft('floor', { floorNumber })).not.toHaveProperty('floorNumber')
      expect(buildRequest('floor', { floorNumber })).toEqual({ floorNumber })
    }
    expect(validateDraft('floor', { floorNumber: 1.5 }).floorNumber).toBe('请输入整数')
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
