import { beforeEach, describe, expect, it, vi } from 'vitest'
import { objects, type ObjectType } from '@/business/basic-data/schema'
import { apiClient, CONFLICT_MESSAGE } from './http'
import {
  deleteBasicData,
  getBasicData,
  getBasicDictionaries,
  isVersionConflict,
  pageBasicData,
  saveBasicData,
} from './basic-data'

describe('基础资料真实接口请求', () => {
  beforeEach(() => vi.restoreAllMocks())
  for (const type of Object.keys(objects) as ObjectType[])
    it(`${type} 六类 CRUD 接口`, async () => {
      const get = vi
        .spyOn(apiClient, 'get')
        .mockResolvedValue({ data: { code: 0, data: { records: [], total: 0 } } })
      const post = vi
        .spyOn(apiClient, 'post')
        .mockResolvedValue({ data: { code: 0, data: { id: 1 } } })
      const put = vi
        .spyOn(apiClient, 'put')
        .mockResolvedValue({ data: { code: 0, data: { id: 1 } } })
      const remove = vi.spyOn(apiClient, 'delete').mockResolvedValue({ data: { code: 0 } })
      const base = `/api/v1/business/${objects[type].resource}`
      await pageBasicData(type, {
        page: 2,
        size: 20,
        enabled: false,
        sortBy: 'createdTime',
        sortOrder: 'DESC',
        keyword: '',
      })
      expect(get).toHaveBeenLastCalledWith(base, {
        params: { page: 2, size: 20, enabled: false, sortBy: 'createdTime', sortOrder: 'DESC' },
      })
      await getBasicData(type, 1)
      expect(get).toHaveBeenLastCalledWith(`${base}/1`)
      await saveBasicData(type, { enabled: false })
      expect(post).toHaveBeenLastCalledWith(base, { enabled: false })
      await saveBasicData(type, { enabled: true, remark: null }, { id: 1, version: 2 })
      expect(put).toHaveBeenLastCalledWith(`${base}/1`, { enabled: true, remark: null, version: 2 })
      await deleteBasicData(type, [{ id: 1, version: 2 }], false)
      expect(remove).toHaveBeenLastCalledWith(`${base}/1`, { params: { version: 2 } })
      await deleteBasicData(
        type,
        [
          { id: 1, version: 2 },
          { id: 3, version: 4 },
        ],
        true,
      )
      expect(post).toHaveBeenLastCalledWith(`${base}/batch/delete`, {
        items: [
          { id: 1, version: 2 },
          { id: 3, version: 4 },
        ],
      })
    })
  it('排序非法字段不发送，按区域查询不丢条件', async () => {
    const get = vi.spyOn(apiClient, 'get').mockResolvedValue({ data: { data: { records: [] } } })
    await pageBasicData('storage', {
      page: 3,
      size: 20,
      areaId: 7,
      keyword: '线边',
      sortBy: 'enabled',
      sortOrder: 'ASC',
    })
    expect(get).toHaveBeenCalledWith('/api/v1/business/nari-storage-zone', {
      params: { page: 3, size: 20, areaId: 7, keyword: '线边' },
    })
  })
  it('缺版本或 ID 阻止写入，业务冲突和拒绝不能当成功', async () => {
    const put = vi.spyOn(apiClient, 'put').mockResolvedValue({ data: { code: 40900, data: {} } })
    await expect(saveBasicData('factory', {}, { id: 1 })).rejects.toThrow('数据版本缺失')
    await expect(saveBasicData('factory', {}, { version: 2 })).rejects.toThrow('缺少记录 ID')
    expect(put).not.toHaveBeenCalled()
    await expect(saveBasicData('factory', {}, { id: 1, version: 2 })).rejects.toThrow(
      CONFLICT_MESSAGE,
    )
    const remove = vi
      .spyOn(apiClient, 'delete')
      .mockResolvedValue({ data: { code: 40001, message: '存在引用' } })
    await expect(deleteBasicData('factory', [{ id: 1, version: 2 }], false)).rejects.toThrow(
      '存在引用',
    )
    expect(remove).toHaveBeenCalledTimes(1)
    expect(isVersionConflict({ isAxiosError: true, response: { status: 409 } })).toBe(true)
  })
  it('只加载所需业务字典，不复制枚举', async () => {
    const get = vi.spyOn(apiClient, 'get').mockResolvedValue({ data: { data: {} } })
    await getBasicDictionaries('model')
    expect(get).toHaveBeenCalledWith('/api/v1/system/dicts/items', {
      params: { codes: 'nari_container_category,nari_container_usage' },
    })
    await getBasicDictionaries('factory')
    expect(get).toHaveBeenCalledTimes(1)
  })
})
