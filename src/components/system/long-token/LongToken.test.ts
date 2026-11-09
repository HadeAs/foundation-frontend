import { flushPromises, mount } from '@vue/test-utils'
import { Button, Checkbox, Input, Modal, Textarea } from 'ant-design-vue'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ApiError, CONFLICT_MESSAGE } from '@/api/http'
import * as api from '@/api/long-token'
import LongTokenEditor from './LongTokenEditor.vue'
import LongTokenSecret from './LongTokenSecret.vue'

vi.mock('@/api/long-token', async (original) => ({
  ...(await original<typeof api>()),
  getLongTokenApis: vi.fn(),
  createLongToken: vi.fn(),
  authorizeLongToken: vi.fn(),
}))
const scope = { scopeCode: 'provider', name: '设备接入', description: '' }
const row: api.LongTokenMetadata = {
  tokenId: '00000001',
  scopeCode: 'provider',
  name: 'scanner',
  enabled: true,
  version: 4,
  authorizationVersion: 0,
  apiCodes: ['a'],
}
const catalog = [
  { apiCode: 'a', scopeCode: 'group-a', name: '扫码上报', method: 'POST', path: '/report/a' },
  { apiCode: 'b', scopeCode: 'group-b', name: '状态上报', method: 'POST', path: '/report/b' },
]
const options = {
  global: {
    stubs: {
      AModal: { template: '<section><slot/><footer><slot name="footer"/></footer></section>' },
    },
  },
}
const wrappers: ReturnType<typeof mount>[] = []
function editor(record?: api.LongTokenMetadata) {
  const wrapper = mount(LongTokenEditor, { ...options, props: { scope, record } })
  wrappers.push(wrapper)
  return wrapper
}
function button(wrapper: ReturnType<typeof mount>, label: string) {
  return wrapper.findAllComponents(Button).find((item) => item.text().replace(/\s/g, '') === label)!
}
beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(api.getLongTokenApis).mockResolvedValue(catalog)
  vi.mocked(api.createLongToken).mockResolvedValue({ metadata: row, token: 'one-time-test-value' })
  vi.mocked(api.authorizeLongToken).mockResolvedValue(row)
})
afterEach(() => {
  wrappers.splice(0).forEach((wrapper) => wrapper.unmount())
  Modal.destroyAll()
  vi.restoreAllMocks()
})
describe('长期 Token 编辑交互（本地 DOM）', () => {
  it('默认全不选，跨分组展示，筛选不丢失勾选，创建显式传接口代码', async () => {
    const wrapper = editor()
    await flushPromises()
    expect(wrapper.text()).toContain('group-a')
    expect(wrapper.text()).toContain('group-b')
    expect(wrapper.findAllComponents(Checkbox).every((item) => !item.props('checked'))).toBe(true)
    wrapper.findAllComponents(Input)[0]!.vm.$emit('update:value', ' scanner ')
    wrapper.findAllComponents(Checkbox)[1]!.vm.$emit('change', { target: { checked: true } })
    wrapper.findAllComponents(Input)[1]!.vm.$emit('update:value', '扫码')
    await flushPromises()
    expect(wrapper.findAllComponents(Checkbox)).toHaveLength(1)
    expect(wrapper.text()).toContain('已选 1 / 100')
    await button(wrapper, '创建').trigger('click')
    await flushPromises()
    expect(api.createLongToken).toHaveBeenCalledWith({
      scopeCode: 'provider',
      name: ' scanner ',
      apiCodes: ['b'],
    })
    expect(wrapper.emitted('created')).toHaveLength(1)
  })
  it('空选仍提交显式空数组；名称不能为空', async () => {
    const wrapper = editor()
    await flushPromises()
    await button(wrapper, '创建').trigger('click')
    expect(api.createLongToken).not.toHaveBeenCalled()
    wrapper.findAllComponents(Input)[0]!.vm.$emit('update:value', 'scanner')
    await button(wrapper, '创建').trigger('click')
    await flushPromises()
    expect(api.createLongToken).toHaveBeenCalledWith({
      scopeCode: 'provider',
      name: 'scanner',
      apiCodes: [],
    })
  })
  it('授权回显且使用凭据与授权版本；失效接口必须显式取消，不静默删除', async () => {
    const record = { ...row, apiCodes: ['a', 'removed'] }
    const wrapper = editor(record)
    await flushPromises()
    expect(wrapper.findAllComponents(Checkbox)[0]!.props('checked')).toBe(true)
    expect(wrapper.text()).toContain('removed')
    await button(wrapper, '保存授权').trigger('click')
    expect(api.authorizeLongToken).not.toHaveBeenCalled()
    wrapper
      .findAllComponents(Checkbox)
      .at(-1)!
      .vm.$emit('change', { target: { checked: false } })
    await button(wrapper, '保存授权').trigger('click')
    await flushPromises()
    expect(api.authorizeLongToken).toHaveBeenCalledWith(record, ['a'])
  })
  it('接口目录失败禁止提交并可重试', async () => {
    vi.mocked(api.getLongTokenApis).mockRejectedValueOnce(new ApiError('无接口查询权限'))
    const wrapper = editor()
    await flushPromises()
    expect(button(wrapper, '创建').props('disabled')).toBe(true)
    await button(wrapper, '重新加载').trigger('click')
    await flushPromises()
    expect(button(wrapper, '创建').props('disabled')).toBe(false)
  })
  it('提交转圈锁定与防重复；冲突保留选择但不允许重发', async () => {
    let reject!: (error: unknown) => void
    vi.mocked(api.authorizeLongToken).mockReturnValue(
      new Promise((_, fail) => {
        reject = fail
      }),
    )
    const wrapper = editor(row)
    await flushPromises()
    await button(wrapper, '保存授权').trigger('click')
    await flushPromises()
    expect(button(wrapper, '保存授权').props('loading')).toBe(true)
    expect(button(wrapper, '取消').props('disabled')).toBe(true)
    await button(wrapper, '保存授权').trigger('click')
    expect(api.authorizeLongToken).toHaveBeenCalledOnce()
    reject(new ApiError(CONFLICT_MESSAGE))
    await flushPromises()
    expect(button(wrapper, '保存授权').props('disabled')).toBe(true)
    expect(wrapper.findAllComponents(Checkbox)[0]!.props('checked')).toBe(true)
    expect(wrapper.emitted('close')).toBeUndefined()
  })
  it('创建结果未知时保留名称但禁止重复创建', async () => {
    vi.mocked(api.createLongToken).mockRejectedValue(
      new api.LongTokenOutcomeUnknownError('unknown'),
    )
    const wrapper = editor()
    await flushPromises()
    wrapper.findAllComponents(Input)[0]!.vm.$emit('update:value', 'scanner')
    await button(wrapper, '创建').trigger('click')
    await flushPromises()
    expect(wrapper.text()).toContain('请求结果未知')
    expect(wrapper.findAllComponents(Input)[0]!.props('value')).toBe('scanner')
    expect(button(wrapper, '创建').props('disabled')).toBe(true)
    expect(wrapper.emitted('created')).toBeUndefined()
  })
  it('不能超过 100 个接口；取消有改动时需要确认', async () => {
    vi.mocked(api.getLongTokenApis).mockResolvedValue(
      Array.from({ length: 101 }, (_, i) => ({ ...catalog[0]!, apiCode: String(i) })),
    )
    const wrapper = editor({ ...row, apiCodes: Array.from({ length: 100 }, (_, i) => String(i)) })
    await flushPromises()
    expect(wrapper.findAllComponents(Checkbox).at(-1)!.props('disabled')).toBe(true)
    wrapper.findAllComponents(Checkbox)[0]!.vm.$emit('change', { target: { checked: false } })
    const confirm = vi
      .spyOn(Modal, 'confirm')
      .mockReturnValue({ destroy: vi.fn(), update: vi.fn() })
    await button(wrapper, '取消').trigger('click')
    expect(confirm).toHaveBeenCalled()
  })
})
describe('一次性明文展示', () => {
  it('仅点击时复制，失败可手动复制，关闭确认后清空且不写存储', async () => {
    const storage = vi.spyOn(Storage.prototype, 'setItem')
    const copy = vi
      .spyOn(navigator.clipboard, 'writeText')
      .mockRejectedValue(new Error('insecure context'))
    const wrapper = mount(LongTokenSecret, { ...options, props: { token: 'one-time-secret' } })
    wrappers.push(wrapper)
    expect(copy).not.toHaveBeenCalled()
    await button(wrapper, '复制Token').trigger('click')
    await flushPromises()
    expect(copy).toHaveBeenCalledWith('one-time-secret')
    expect(wrapper.findComponent(Textarea).props('value')).toBe('one-time-secret')
    const confirm = vi
      .spyOn(Modal, 'confirm')
      .mockReturnValue({ destroy: vi.fn(), update: vi.fn() })
    await button(wrapper, '已保存，关闭').trigger('click')
    expect(wrapper.emitted('close')).toBeUndefined()
    await confirm.mock.calls[0]![0].onOk!()
    await flushPromises()
    expect(wrapper.findComponent(Textarea).props('value')).toBe('')
    expect(wrapper.emitted('close')).toHaveLength(1)
    expect(storage).not.toHaveBeenCalled()
  })
})
