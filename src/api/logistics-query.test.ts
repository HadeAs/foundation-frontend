import { afterEach, describe, expect, it, vi } from 'vitest'
import { queryObjects, type QueryType } from '@/business/logistics-query/schema'
import { apiClient } from './http'
import { getLogisticsData, getLogisticsDictionaries, pageLogisticsData } from './logistics-query'
afterEach(() => vi.restoreAllMocks())
describe('物流业务只读接口', () => {
  for (const type of Object.keys(queryObjects) as QueryType[])
    it(`${type} 分页及详情仅使用 GET`, async () => {
      const get = vi
        .spyOn(apiClient, 'get')
        .mockResolvedValue({ data: { code: 0, data: { id: 12, records: [], total: 0 } } })
      const post = vi.spyOn(apiClient, 'post'),
        put = vi.spyOn(apiClient, 'put'),
        remove = vi.spyOn(apiClient, 'delete')
      await pageLogisticsData(type, { page: 2, size: 50, sortBy: 'createdTime', sortOrder: 'DESC' })
      expect(get).toHaveBeenLastCalledWith(`/api/v1/business/${queryObjects[type].resource}`, {
        params: { page: 2, size: 50, sortBy: 'createdTime', sortOrder: 'DESC' },
      })
      await getLogisticsData(type, 12)
      expect(get).toHaveBeenLastCalledWith(`/api/v1/business/${queryObjects[type].resource}/12`)
      expect(post).not.toHaveBeenCalled()
      expect(put).not.toHaveBeenCalled()
      expect(remove).not.toHaveBeenCalled()
    })
  it('只传白名单条件；未开放排序、keyword 及通用时间不泄漏；空与零区分', async () => {
    const get = vi.spyOn(apiClient, 'get').mockResolvedValue({ data: { data: {} } })
    await pageLogisticsData('warehouseBox', {
      page: 1,
      size: 20,
      warehouseRecordId: 7,
      quantity: 0,
      orderNo: '0001',
      keyword: 'ignored',
      startTime: 'ignored',
      sortBy: 'id',
      sortOrder: 'ASC',
      materialCode: '',
    })
    expect(get).toHaveBeenLastCalledWith('/api/v1/business/nari-warehouse-record-box', {
      params: { page: 1, size: 20, warehouseRecordId: 7, quantity: 0, orderNo: '0001' },
    })
    await pageLogisticsData('task', {
      page: 1,
      size: 20,
      sortBy: 'queueNo',
      sortOrder: 'ASC',
      completedTimeStart: '2026-10-15T12:00:00+08:00',
    })
    expect(get).toHaveBeenLastCalledWith('/api/v1/business/nari-logistics-task', {
      params: {
        page: 1,
        size: 20,
        sortBy: 'queueNo',
        sortOrder: 'ASC',
        completedTimeStart: '2026-10-15T12:00:00+08:00',
      },
    })
  })
  it('业务失败与不存在不被视为成功；状态字典实时读取', async () => {
    const get = vi
      .spyOn(apiClient, 'get')
      .mockResolvedValue({ data: { code: 40300, message: '无查询权限' } })
    await expect(pageLogisticsData('task', { page: 1, size: 20 })).rejects.toThrow('无查询权限')
    get.mockResolvedValue({ data: { code: 0, data: null } })
    await expect(getLogisticsData('warehouse', 1)).rejects.toThrow('不存在或暂不可用')
    get.mockResolvedValue({ data: { code: 0, data: {} } })
    await getLogisticsDictionaries('operation')
    expect(get).toHaveBeenLastCalledWith('/api/v1/system/dicts/items', {
      params: { codes: 'nari_evidence_source,nari_task_cancel_status' },
    })
  })
})
