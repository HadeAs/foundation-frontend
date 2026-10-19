import { flushPromises, mount } from '@vue/test-utils'
import { Button, Select, Table, Tag } from 'ant-design-vue'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import * as runtimeApi from '@/api/runtime-business'
import * as basicApi from '@/api/basic-data'
import { ApiError } from '@/api/http'
import ResizableTable from '@/components/common/ResizableTable.vue'
import ReferenceInput from '../basic-data/ReferenceInput.vue'
import ReferencePicker from '../basic-data/ReferencePicker.vue'
import RuntimePage from './RuntimePage.vue'
import RuntimeDetail from './RuntimeDetail.vue'
import RuntimeValue from './RuntimeValue.vue'
vi.mock('@/api/runtime-business', () => ({
  pageRuntimeData: vi.fn(),
  getRuntimeData: vi.fn(),
  getRuntimeDictionaries: vi.fn(),
}))
vi.mock('@/api/basic-data', async (original) => ({
  ...(await original<typeof basicApi>()),
  getBasicData: vi.fn(),
  pageBasicData: vi.fn(),
}))
const options = {
  global: {
    stubs: {
      AModal: { template: '<section><slot/><footer><slot name="footer"/></footer></section>' },
    },
  },
}
const wrappers: Array<{ unmount: () => void }> = []
function keep<T extends { unmount: () => void }>(value: T) {
  wrappers.push(value)
  return value
}
function pending<T>() {
  let resolve!: (value: T) => void
  const promise = new Promise<T>((done) => {
    resolve = done
  })
  return { promise, resolve }
}
function button(wrapper: ReturnType<typeof mount>, text: string) {
  return wrapper.findAllComponents(Button).find((b) => b.text().replace(/\s/g, '') === text)!
}
beforeEach(() => {
  vi.clearAllMocks()
  vi.stubGlobal(
    'ResizeObserver',
    class {
      observe() {}
      disconnect() {}
    },
  )
  vi.mocked(runtimeApi.pageRuntimeData).mockResolvedValue({
    records: [{ id: 1, bindingStatus: 'ACTIVE', boxId: 2, vehicleId: 3 }],
    total: 45,
  })
  vi.mocked(runtimeApi.getRuntimeDictionaries).mockResolvedValue({
    nari_vehicle_binding_status: [{ value: 'ACTIVE', label: '有效', tagType: 'success' }],
  })
  vi.mocked(basicApi.getBasicData).mockImplementation(async (_type, id) => ({
    id,
    containerName: '容器名称',
    containerCode: '00001',
  }))
})
afterEach(() => {
  wrappers.splice(0).forEach((w) => w.unmount())
  document.body.innerHTML = ''
  vi.unstubAllGlobals()
})
describe('运行页面本地 DOM', () => {
  it('只读无多选/写按钮，默认有效；服务器分页排序、查询草稿隔离与重置', async () => {
    const wrapper = keep(mount(RuntimePage, { props: { type: 'vehicleLoad' }, ...options }))
    await flushPromises()
    expect(runtimeApi.pageRuntimeData).toHaveBeenLastCalledWith(
      'vehicleLoad',
      expect.objectContaining({ bindingStatus: 'ACTIVE', page: 1, size: 20 }),
    )
    for (const text of ['新增', '编辑', '删除', '解绑'])
      expect(wrapper.findAll('button').some((b) => b.text() === text)).toBe(false)
    const table = wrapper.findComponent(ResizableTable)
    expect(table.findComponent(Table).props('rowSelection')).toBeUndefined()
    const columns = table.props('columns')
    expect(columns.filter((c) => c.sorter).map((c) => c.key)).toEqual([
      'createdTime',
      'updatedTime',
    ])
    wrapper.findAllComponents(Select)[0]!.vm.$emit('update:value', undefined)
    await button(wrapper, '查询').trigger('click')
    await flushPromises()
    expect(runtimeApi.pageRuntimeData).toHaveBeenLastCalledWith(
      'vehicleLoad',
      expect.objectContaining({ bindingStatus: undefined }),
    )
    table.vm.$emit('change', { current: 2, pageSize: 20 }, {}, {}, { action: 'paginate' })
    await flushPromises()
    expect(runtimeApi.pageRuntimeData).toHaveBeenLastCalledWith(
      'vehicleLoad',
      expect.objectContaining({ page: 2 }),
    )
    table.vm.$emit(
      'change',
      { current: 2, pageSize: 20 },
      {},
      { columnKey: 'createdTime', order: 'descend' },
      { action: 'sort' },
    )
    await flushPromises()
    expect(runtimeApi.pageRuntimeData).toHaveBeenLastCalledWith(
      'vehicleLoad',
      expect.objectContaining({ page: 1, sortOrder: 'DESC' }),
    )
    wrapper.findAllComponents(Select)[0]!.vm.$emit('update:value', 'ACTIVE')
    await button(wrapper, '刷新').trigger('click')
    await flushPromises()
    expect(runtimeApi.pageRuntimeData).toHaveBeenLastCalledWith(
      'vehicleLoad',
      expect.objectContaining({ bindingStatus: undefined, sortOrder: 'DESC' }),
    )
    await button(wrapper, '重置').trigger('click')
    await flushPromises()
    expect(runtimeApi.pageRuntimeData).toHaveBeenLastCalledWith(
      'vehicleLoad',
      expect.objectContaining({ bindingStatus: 'ACTIVE', sortBy: undefined }),
    )
  })
  it('载具改变清空装载位，更多条件收起不丢草稿', async () => {
    const wrapper = keep(mount(RuntimePage, { props: { type: 'vehicleLoad' }, ...options }))
    await flushPromises()
    await button(wrapper, '更多条件').trigger('click')
    const refs = wrapper.findAllComponents(ReferenceInput)
    const vehicle = refs.find((c) => c.props('label') === '载具')!,
      slot = refs.find((c) => c.props('target') === 'slot')!
    vehicle.vm.$emit('update:value', 3)
    await flushPromises()
    slot.vm.$emit('update:value', 8)
    await flushPromises()
    expect(slot.props()).toMatchObject({ vehicleId: 3, value: 8 })
    vehicle.vm.$emit('update:value', 5)
    await flushPromises()
    expect(slot.props('value')).toBeUndefined()
    slot.vm.$emit('update:value', 9)
    await button(wrapper, '收起条件').trigger('click')
    await button(wrapper, '查询').trigger('click')
    await flushPromises()
    expect(runtimeApi.pageRuntimeData).toHaveBeenLastCalledWith(
      'vehicleLoad',
      expect.objectContaining({ vehicleId: 5, vehicleSlotId: 9 }),
    )
  })
  it('字典失败保留原始状态并提供重试，不填充原型枚举', async () => {
    vi.mocked(runtimeApi.getRuntimeDictionaries).mockRejectedValue(new ApiError('字典不可用'))
    const wrapper = keep(mount(RuntimePage, { props: { type: 'vehicleLoad' }, ...options }))
    await flushPromises()
    expect(wrapper.text()).toContain('字典加载失败')
    expect(wrapper.text()).toContain('ACTIVE')
    expect(wrapper.findAllComponents(Select)[0]!.props('options')).toEqual([])
    vi.mocked(runtimeApi.getRuntimeDictionaries).mockResolvedValue({
      nari_vehicle_binding_status: [{ value: 'ACTIVE', label: '有效', tagType: 'success' }],
    })
    await button(wrapper, '重试').trigger('click')
    await flushPromises()
    expect(wrapper.text()).not.toContain('字典加载失败')
    expect(wrapper.text()).toContain('有效')
  })
  it('迟到响应不覆盖，空状态不伪造 UNKNOWN，失败不显示虚假零条', async () => {
    const old = pending<runtimeApi.RuntimePage>()
    vi.mocked(runtimeApi.pageRuntimeData)
      .mockReturnValueOnce(old.promise)
      .mockResolvedValue({ records: [], total: 0 })
    const wrapper = keep(mount(RuntimePage, { props: { type: 'locationState' }, ...options }))
    expect(wrapper.text()).toContain('加载中')
    await button(wrapper, '查询').trigger('click')
    await flushPromises()
    old.resolve({ records: [{ id: 1, presenceState: 'UNKNOWN' }], total: 1 })
    await flushPromises()
    expect(wrapper.text()).toContain('暂无运行状态')
    expect(wrapper.text()).not.toContain('UNKNOWN')
    vi.mocked(runtimeApi.pageRuntimeData).mockRejectedValue(new ApiError('服务暂不可用'))
    await button(wrapper, '查询').trigger('click')
    await flushPromises()
    expect(wrapper.text()).toContain('加载失败')
    expect(wrapper.text()).toContain('服务暂不可用')
    expect(wrapper.text()).not.toContain('共 0 条')
  })
  it('null/false/0/未知枚举独立呈现，缺失关联保留 ID，详情有完整追溯且安全渲染', async () => {
    const value = keep(
      mount(RuntimeValue, {
        props: {
          field: { key: 'autoLogisticsEnabled', label: '自动物流', kind: 'boolean' },
          value: null,
          relations: {},
          dictionaries: {},
        },
      }),
    )
    expect(value.text()).toBe('未确认')
    await value.setProps({ value: false })
    expect(value.text()).toBe('关闭')
    await value.setProps({ field: { key: 'totalQuantity', label: '数量' }, value: 0 })
    expect(value.text()).toBe('0')
    await value.setProps({ value: null })
    expect(value.text()).toBe('—')
    await value.setProps({
      field: { key: 'contentState', label: '内容', dict: 'nari_content_state' },
      value: 'NEW_STATE',
    })
    expect(value.text()).toBe('NEW_STATE')
    expect(value.findComponent(Tag).props('color')).toBeUndefined()
    vi.mocked(runtimeApi.getRuntimeData).mockResolvedValue({
      id: 1,
      containerId: 999,
      version: 4,
      totalQuantity: 0,
      traceId: '<img src=x onerror=alert(1)>',
    })
    vi.mocked(basicApi.getBasicData).mockRejectedValue(new ApiError('找不到关联对象'))
    const detail = keep(
      mount(RuntimeDetail, {
        props: { type: 'containerState', id: 1, dictionaries: {} },
        ...options,
      }),
    )
    await flushPromises()
    expect(detail.text()).toContain('ID 999')
    expect(detail.text()).toContain('追溯信息')
    expect(detail.text()).toContain('<img src=x onerror=alert(1)>')
    expect(detail.find('img').exists()).toBe(false)
    expect(runtimeApi.getRuntimeData).toHaveBeenCalledWith('containerState', 1)
  })
  it('候选保留服务器总数，不符规格行不可选；装载位携带载具 ID', async () => {
    vi.mocked(basicApi.pageBasicData).mockResolvedValue({
      records: [
        { id: 1, containerModelId: 10, containerName: '料箱' },
        { id: 2, containerModelId: 20, containerName: '料车' },
      ],
      total: 25,
    })
    vi.mocked(basicApi.getBasicData).mockImplementation(async (type, id) =>
      type === 'model' ? { id, containerCategory: id === 10 ? 'BOX' : 'VEHICLE_SLOT' } : { id },
    )
    const picker = keep(
      mount(ReferencePicker, { props: { type: 'container', containerKind: 'box' }, ...options }),
    )
    await flushPromises()
    expect(picker.findComponent(Table).props('pagination')).toMatchObject({ total: 25 })
    const rows = picker.findAll('tbody tr[tabindex="0"]')
    await rows[1]!.trigger('click')
    expect(picker.emitted('select')).toBeUndefined()
    await rows[0]!.trigger('keydown', { key: 'Enter' })
    expect(picker.emitted('select')).toEqual([[1]])
    const slots = keep(
      mount(ReferencePicker, { props: { type: 'slot', vehicleId: 7 }, ...options }),
    )
    await flushPromises()
    slots.findComponent(Table).vm.$emit('change', { current: 2, pageSize: 20 })
    await flushPromises()
    expect(basicApi.pageBasicData).toHaveBeenLastCalledWith(
      'slot',
      expect.objectContaining({ vehicleId: 7, page: 2 }),
    )
  })
})
