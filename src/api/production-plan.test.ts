import { afterEach, describe, expect, it, vi } from 'vitest'
import { apiClient, CONFLICT_MESSAGE } from './http'
import { pageProductionPlans, type ProductionPlanQuery } from './production-plan'

afterEach(() => vi.restoreAllMocks())
describe('生产计划 V9 查询', () => {
  it('发送真实分页条件、文本编码和开工日期，仅查询不写入', async () => {
    const data = { records: [{ id: 1, planNo: '0001', orderNo: '000123' }], total: 1 }
    const get = vi.spyOn(apiClient, 'get').mockResolvedValue({ data: { code: 0, data } })
    const post = vi.spyOn(apiClient, 'post'), put = vi.spyOn(apiClient, 'put'), remove = vi.spyOn(apiClient, 'delete')
    const query: ProductionPlanQuery = { page: 2, size: 20, planNo: '0001', orderNo: '000123', resourceCode: '001', mainProcessCode: '002', productionLineId: 3, deliveryStorageZoneId: 4, planStatus: 'PLANNED', plannedStartTimeStart: '2026-10-14T00:00:00.000+08:00', plannedStartTimeEnd: '2026-10-14T23:59:59.999+08:00', sortBy: 'sequenceNo', sortOrder: 'DESC' }
    expect(await pageProductionPlans(query)).toEqual(data)
    expect(get).toHaveBeenCalledWith('/api/v1/business/nari-production-plan', { params: query })
    expect(post).not.toHaveBeenCalled(); expect(put).not.toHaveBeenCalled(); expect(remove).not.toHaveBeenCalled()
  })
  it('剔除空值、旧工位/完成时间/模糊时间参数及不支持的排序', async () => {
    const get = vi.spyOn(apiClient, 'get').mockResolvedValue({ data: { data: {} } })
    await pageProductionPlans({ page: 1, size: 20, orderNo: '', resourceCode: undefined, startTime: 'old', endTime: 'old', stationId: 9, plannedEndTime: 'old', sortBy: 'orderNo', sortOrder: 'ASC' } as ProductionPlanQuery)
    expect(get).toHaveBeenLastCalledWith('/api/v1/business/nari-production-plan', { params: { page: 1, size: 20 } })
  })
  it('业务错误不作为成功空结果', async () => {
    const get = vi.spyOn(apiClient, 'get').mockResolvedValue({ data: { code: 40900 } })
    await expect(pageProductionPlans({})).rejects.toThrow(CONFLICT_MESSAGE)
    get.mockResolvedValue({ data: { code: 40300, message: '无查询权限' } })
    await expect(pageProductionPlans({})).rejects.toThrow('无查询权限')
  })
})
