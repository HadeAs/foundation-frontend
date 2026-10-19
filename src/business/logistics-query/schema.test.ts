import { describe, expect, it } from 'vitest'
import contract from '../../../doc/nari-logistics.openapi.json'
import {
  commonTechnical,
  fields,
  filterField,
  filterKeys,
  prepareFilters,
  queryKeys,
  queryObjects,
  snapshotText,
  type QueryType,
} from './schema'

type ContractSchema = { properties: Record<string, { type?: string; description?: string }> }
const schemas = contract.components.schemas as unknown as Record<string, ContractSchema>
describe('物流查询五对象契约', () => {
  for (const type of Object.keys(queryObjects) as QueryType[])
    it(`${type} 响应字段完整且无主键显示，查询及排序严格对齐契约`, () => {
      const config = queryObjects[type],
        response = schemas[`${config.schema}Response`]!,
        query = schemas[`${config.schema}Query`]!
      const displayed = [
        ...config.details,
        ...config.technical,
        ...config.snapshots,
        ...commonTechnical,
      ]
      expect([...displayed, 'id'].sort()).toEqual(Object.keys(response.properties).sort())
      expect(config.columns).not.toContain('id')
      expect(config.sort).not.toContain('id')
      for (const key of displayed) expect(fields[key]).toBeDefined()
      for (const key of filterKeys(type)) expect(filterField(key)).toBeDefined()
      expect(queryKeys(type).sort()).toEqual(
        Object.keys(query.properties)
          .filter(
            (key) =>
              !['page', 'size', 'sortBy', 'sortOrder', 'keyword', 'startTime', 'endTime'].includes(
                key,
              ),
          )
          .sort(),
      )
      for (const key of config.sort) {
        expect(config.columns).toContain(key)
        expect(query.properties.sortBy?.description).toContain(key)
      }
      expect(contract.paths).toHaveProperty(`/api/v1/business/${config.resource}`)
      expect(contract.paths).toHaveProperty(`/api/v1/business/${config.resource}/{id}`)
    })
  it('文本保留前导零；数字必须为整数，0 不丢失，范围倒置拒绝，未知条件剔除', () => {
    expect(
      prepareFilters('task', {
        orderNo: ' 00001 ',
        queueNo: 0,
        keyword: 'ignored',
        taskStatus: '',
      }),
    ).toEqual({ orderNo: '00001', queueNo: 0 })
    expect(() => prepareFilters('task', { queueNo: 1.5 })).toThrow('有效整数')
    expect(() =>
      prepareFilters('warehouse', {
        succeededTimeStart: '2026-10-15T13:00:00+08:00',
        succeededTimeEnd: '2026-10-15T12:00:00+08:00',
      }),
    ).toThrow('开始时间不能晚于结束时间')
    expect(fields.objectId!.target).toBeUndefined()
    expect(fields.productionPlanId!.target).toBeUndefined()
  })
  it('快照 JSON 格式化，其他内容原样保留，不生成 HTML', () => {
    expect(snapshotText('{"a":0}')).toBe('{\n  "a": 0\n}')
    expect(snapshotText('<img src=x>')).toBe('<img src=x>')
    expect(snapshotText(null)).toBe('—')
  })
})
