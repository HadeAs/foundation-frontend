import { beforeEach, describe, expect, it, vi } from 'vitest'

import { apiClient } from './http'
import { clearDictItemCache, listDictItems, refreshDictCache } from './dict'

describe('字典项缓存', () => {
  beforeEach(() => {
    clearDictItemCache()
    vi.restoreAllMocks()
  })

  it('复用同一字典请求，并在刷新缓存后重新获取', async () => {
    const get = vi.spyOn(apiClient, 'get').mockResolvedValue({
      data: { data: [{ label: '启用', value: 'ENABLED' }] },
    })
    vi.spyOn(apiClient, 'post').mockResolvedValue({ data: {} })

    await Promise.all([listDictItems('status'), listDictItems('status')])
    expect(get).toHaveBeenCalledTimes(1)

    await refreshDictCache()
    await listDictItems('status')
    expect(get).toHaveBeenCalledTimes(2)
  })
})
