import { afterEach, expect, it, vi } from 'vitest'
import type { AxiosResponse } from 'axios'
import { apiClient } from './http'
import { getRuntimeConnections } from './dashboard'

afterEach(() => vi.restoreAllMocks())

it('读取同源连接缓存，透传取消信号，接受空 traceId', async () => {
  const data = { generatedAt: '2026-11-16T08:00:00Z', refreshAfterSeconds: 15, items: [] }
  const get = vi
    .spyOn(apiClient, 'get')
    .mockResolvedValue({ data: { code: 0, data, traceId: null } } as AxiosResponse)
  const controller = new AbortController()
  expect(await getRuntimeConnections(controller.signal)).toEqual(data)
  expect(get).toHaveBeenCalledWith('/api/v1/dashboard/connections', {
    signal: controller.signal,
    headers: { 'Cache-Control': 'no-cache' },
  })
})

it('HTTP 200 的业务失败不能作为有效快照', async () => {
  vi.spyOn(apiClient, 'get').mockResolvedValue({
    data: { code: 50000, message: '状态服务异常', data: { items: [] } },
  } as AxiosResponse)
  await expect(getRuntimeConnections()).rejects.toThrow('状态服务异常')
})

it('拒绝缺失的快照数据', async () => {
  vi.spyOn(apiClient, 'get').mockResolvedValue({ data: { code: 0, data: null } } as AxiosResponse)
  await expect(getRuntimeConnections()).rejects.toThrow('接口未返回有效连接状态')
})
