import { afterEach, describe, expect, it, vi } from 'vitest'
import { runtimeObjects, type RuntimeType } from '@/business/runtime/schema'
import { apiClient, CONFLICT_MESSAGE } from './http'
import { getRuntimeData, getRuntimeDictionaries, pageRuntimeData } from './runtime-business'

afterEach(() => vi.restoreAllMocks())
describe('运行对象只读请求', () => {
  for (const type of Object.keys(runtimeObjects) as RuntimeType[]) it(`${type} 分页与详情仅使用 GET`, async () => {
    const get = vi.spyOn(apiClient, 'get').mockResolvedValue({ data: { code: 0, data: { records: [], total: 0 } } })
    const post = vi.spyOn(apiClient, 'post'), put = vi.spyOn(apiClient, 'put'), remove = vi.spyOn(apiClient, 'delete')
    await pageRuntimeData(type, { page: 2, size: 50, sortBy: 'updatedTime', sortOrder: 'DESC' })
    expect(get).toHaveBeenLastCalledWith(`/api/v1/business/${runtimeObjects[type].resource}`, { params: { page: 2, size: 50, sortBy: 'updatedTime', sortOrder: 'DESC' } })
    await getRuntimeData(type, 12)
    expect(get).toHaveBeenLastCalledWith(`/api/v1/business/${runtimeObjects[type].resource}/12`)
    expect(post).not.toHaveBeenCalled(); expect(put).not.toHaveBeenCalled(); expect(remove).not.toHaveBeenCalled()
  })
  it('保留 false、前导零，省略空值及未开放条件/排序', async () => {
    const get = vi.spyOn(apiClient, 'get').mockResolvedValue({ data: { data: {} } })
    await pageRuntimeData('locationState', { page: 1, size: 20, autoLogisticsEnabled: false, reservationKey: '', startTime: '2026-10-14', sortBy: 'presenceState', sortOrder: 'ASC' })
    expect(get).toHaveBeenLastCalledWith('/api/v1/business/nari-location-state', { params: { page: 1, size: 20, autoLogisticsEnabled: false } })
    await pageRuntimeData('boxBinding', { page: 1, size: 20, orderNo: '000012', bindingStatus: undefined })
    expect(get).toHaveBeenLastCalledWith('/api/v1/business/nari-box-binding', { params: { page: 1, size: 20, orderNo: '000012' } })
  })
  it('业务拒绝不当作空结果，按模型字典编码加载，不复制演示枚举', async () => {
    const get = vi.spyOn(apiClient, 'get').mockResolvedValue({ data: { code: 40900 } })
    await expect(getRuntimeData('boxBinding', 1)).rejects.toThrow(CONFLICT_MESSAGE)
    get.mockResolvedValue({ data: { code: 40300, message: '无查询权限' } })
    await expect(pageRuntimeData('containerState', { page: 1, size: 20 })).rejects.toThrow('无查询权限')
    get.mockResolvedValue({ data: { data: {} } })
    await getRuntimeDictionaries('vehicleLoad')
    expect(get).toHaveBeenLastCalledWith('/api/v1/system/dicts/items', { params: { codes: 'nari_vehicle_loading_mode,nari_vehicle_binding_status' } })
  })
})
