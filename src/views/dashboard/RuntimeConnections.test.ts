import { flushPromises, mount } from '@vue/test-utils'
import { defineComponent, ref } from 'vue'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import {
  getRuntimeConnections,
  type RuntimeConnection,
  type RuntimeConnectionsOverview,
} from '@/api/dashboard'
import RuntimeConnections from './RuntimeConnections.vue'
import { connectionState, connectionStates } from './runtime-connections'

vi.mock('@/api/dashboard', () => ({ getRuntimeConnections: vi.fn() }))
const request = vi.mocked(getRuntimeConnections)
const timestamp = '2026-11-16T08:00:00Z'
function item(overrides: Partial<RuntimeConnection> = {}): RuntimeConnection {
  return {
    id: 'db',
    name: '数据库',
    group: 'FOUNDATION',
    kind: 'DATABASE',
    status: 'UP',
    message: '连接正常',
    checkedAt: timestamp,
    lastSuccessAt: timestamp,
    staleAfterSeconds: 30,
    durationMillis: 0,
    consecutiveFailures: 0,
    lastCommunicationAt: null,
    lastCommunicationStatus: null,
    ...overrides,
  }
}
function snapshot(items = [item()]): RuntimeConnectionsOverview {
  return { generatedAt: timestamp, refreshAfterSeconds: 15, items }
}
const stubs = {
  ATag: { template: '<span class="status"><slot /></span>' },
  AButton: { template: '<button><slot /></button>' },
  AAlert: { props: ['message'], template: '<div role="alert">{{ message }}</div>' },
  ASpin: true,
}

describe('运行连接状态', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date(timestamp))
    vi.spyOn(document, 'hidden', 'get').mockReturnValue(false)
    request.mockReset()
    request.mockResolvedValue(snapshot())
  })
  afterEach(() => {
    vi.restoreAllMocks()
    vi.useRealTimers()
  })

  for (const status of Object.keys(connectionStates) as RuntimeConnection['status'][]) {
    it(`展示 ${status} 的文字与颜色`, () => {
      expect(connectionState(item({ status }), Date.parse(timestamp), false)).toMatchObject(
        connectionStates[status],
      )
    })
  }

  it('过期、缺失检查时间和查询失败不能继续显示正常', () => {
    expect(connectionState(item(), Date.parse(timestamp) + 30000, false).label).toBe('未知')
    expect(connectionState(item({ checkedAt: null }), Date.parse(timestamp), false).label).toBe(
      '未知',
    )
    expect(connectionState(item(), Date.parse(timestamp), true).label).toBe('未知')
    expect(
      connectionState(item({ status: 'DISABLED', checkedAt: null }), Date.parse(timestamp), false)
        .label,
    ).toBe('停用')
  })

  it('按服务端间隔刷新，失败保留旧数据并标记未知，恢复后清除错误', async () => {
    const wrapper = mount(RuntimeConnections, { global: { stubs } })
    await flushPromises()
    expect(wrapper.text()).toContain('数据库')
    expect(wrapper.find('.status').text()).toBe('正常')
    request.mockRejectedValueOnce({ isAxiosError: true, response: { status: 403 } })
    await vi.advanceTimersByTimeAsync(15000)
    await flushPromises()
    expect(wrapper.text()).toContain('访问被拒绝')
    expect(wrapper.text()).toContain('数据库')
    expect(wrapper.find('.status').text()).toBe('未知')
    request.mockResolvedValueOnce({ ...snapshot(), refreshAfterSeconds: 5 })
    await wrapper.get('button').trigger('click')
    await flushPromises()
    expect(wrapper.find('[role="alert"]').exists()).toBe(false)
    await vi.advanceTimersByTimeAsync(5000)
    expect(request).toHaveBeenCalledTimes(4)
    wrapper.unmount()
    await vi.advanceTimersByTimeAsync(60000)
    expect(request).toHaveBeenCalledTimes(4)
  })

  it('首次失败显示未知而不是空数据，空响应单独展示空态', async () => {
    request.mockRejectedValueOnce(new Error('offline'))
    const wrapper = mount(RuntimeConnections, { global: { stubs } })
    await flushPromises()
    expect(wrapper.text()).toContain('连接状态未知，请重试')
    request.mockResolvedValueOnce(snapshot([]))
    await wrapper.get('button').trigger('click')
    await flushPromises()
    expect(wrapper.text()).toContain('暂无连接状态')
    wrapper.unmount()
  })

  it('基础服务在前，每组按 id 排序，详情保留零值和空时间', async () => {
    request.mockResolvedValueOnce(
      snapshot([
        item({ id: 'z', group: 'INTEGRATION', name: 'MES' }),
        item({ id: 'b', name: '缓存' }),
        item({ id: 'a', name: '数据库' }),
      ]),
    )
    const wrapper = mount(RuntimeConnections, { global: { stubs } })
    await flushPromises()
    expect(wrapper.findAll('.connection-title strong').map((el) => el.text())).toEqual([
      '数据库',
      '缓存',
      'MES',
    ])
    expect(wrapper.find('details').text()).toContain('0 ms')
    expect(wrapper.find('details').text()).toContain('—')
    wrapper.unmount()
  })

  it('浏览器隐藏时取消请求，恢复后忽略过期请求响应', async () => {
    let resolveOld!: (data: RuntimeConnectionsOverview) => void
    request.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          resolveOld = resolve
        }),
    )
    const wrapper = mount(RuntimeConnections, { global: { stubs } })
    const signal = request.mock.calls[0]![0]!
    vi.spyOn(document, 'hidden', 'get').mockReturnValue(true)
    document.dispatchEvent(new Event('visibilitychange'))
    expect(signal.aborted).toBe(true)
    await vi.advanceTimersByTimeAsync(60000)
    expect(request).toHaveBeenCalledTimes(1)
    vi.spyOn(document, 'hidden', 'get').mockReturnValue(false)
    document.dispatchEvent(new Event('visibilitychange'))
    await flushPromises()
    resolveOld(snapshot([item({ name: '旧数据' })]))
    await flushPromises()
    expect(wrapper.text()).not.toContain('旧数据')
    expect(wrapper.text()).toContain('数据库')
    wrapper.unmount()
  })

  it('工作台被 KeepAlive 缓存时停止轮询，重新进入立即刷新', async () => {
    const visible = ref(true)
    const Host = defineComponent({
      components: { RuntimeConnections },
      setup: () => ({ visible }),
      template: '<KeepAlive><RuntimeConnections v-if="visible" /></KeepAlive>',
    })
    const wrapper = mount(Host, { global: { stubs } })
    await flushPromises()
    expect(request).toHaveBeenCalledTimes(1)
    visible.value = false
    await flushPromises()
    await vi.advanceTimersByTimeAsync(60000)
    expect(request).toHaveBeenCalledTimes(1)
    visible.value = true
    await flushPromises()
    expect(request).toHaveBeenCalledTimes(2)
    wrapper.unmount()
  })

  it('查询进行中不重复发起请求，401 后不继续自动轮询', async () => {
    let reject!: (cause: unknown) => void
    request.mockImplementationOnce(
      () =>
        new Promise((_, fail) => {
          reject = fail
        }),
    )
    const wrapper = mount(RuntimeConnections, { global: { stubs } })
    await wrapper.get('button').trigger('click')
    expect(request).toHaveBeenCalledTimes(1)
    reject({ isAxiosError: true, response: { status: 401 } })
    await flushPromises()
    await vi.advanceTimersByTimeAsync(60000)
    expect(request).toHaveBeenCalledTimes(1)
    wrapper.unmount()
  })
})
