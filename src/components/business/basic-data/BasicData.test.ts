import { flushPromises, mount } from '@vue/test-utils'
import { Button, Modal, Select, Switch, Table } from 'ant-design-vue'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import * as api from '@/api/basic-data'
import { ApiError, CONFLICT_MESSAGE } from '@/api/http'
import ResizableTable from '@/components/common/ResizableTable.vue'
import BasicDataEditor from './BasicDataEditor.vue'
import BasicDataGrid from './BasicDataGrid.vue'
import DataState from './DataState.vue'
import ReferenceInput from './ReferenceInput.vue'
import ReferencePicker from './ReferencePicker.vue'

vi.mock('@/api/basic-data', async (original) => ({
  ...(await original<typeof api>()),
  pageBasicData: vi.fn(),
  getBasicData: vi.fn(),
  getBasicDictionaries: vi.fn(),
  saveBasicData: vi.fn(),
  deleteBasicData: vi.fn(),
}))
const modalStub = {
  props: ['open'],
  template: '<section><slot /><footer><slot name="footer" /></footer></section>',
}
const options = { global: { stubs: { AModal: modalStub } } }
const factory = { id: 1, version: 3, factoryCode: '0001', factoryName: '测试工厂', enabled: true }
const wrappers: Array<{ unmount: () => void }> = []
function keep<T extends { unmount: () => void }>(wrapper: T) {
  wrappers.push(wrapper)
  return wrapper
}
function pending<T>() {
  let resolve!: (value: T) => void
  const promise = new Promise<T>((done) => {
    resolve = done
  })
  return { promise, resolve }
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
  vi.mocked(api.pageBasicData).mockResolvedValue({ records: [factory], total: 41 })
  vi.mocked(api.getBasicData).mockResolvedValue(factory)
  vi.mocked(api.getBasicDictionaries).mockResolvedValue({})
  vi.mocked(api.saveBasicData).mockResolvedValue(factory)
})
afterEach(() => {
  wrappers.splice(0).forEach((wrapper) => wrapper.unmount())
  document.body.innerHTML = ''
  vi.unstubAllGlobals()
})
describe('基础资料页面本地 DOM', () => {
  const trafficArea = {
    id: 11,
    version: 4,
    areaCode: '0001',
    areaName: '交管一区',
    enabled: true,
    remark: '通道交叉口',
    status: 'OCCUPIED',
    lockSource: 'PDA',
    occupancyKey: '0001-TASK-01',
    lastOperatorName: '测试操作员',
    lastOperationTime: '2026-10-19T01:30:00Z',
    createdTime: '2026-10-19T01:00:00Z',
    updatedTime: '2026-10-19T02:00:00Z',
  }
  it('交管区域列表支持查询和新增，保留最后操作时间但不显示创建/更新时间或排序', async () => {
    vi.mocked(api.pageBasicData).mockResolvedValue({ records: [trafficArea], total: 1 })
    const wrapper = keep(mount(BasicDataGrid, { props: { type: 'trafficArea' }, ...options }))
    await flushPromises()
    const table = wrapper.findComponent(ResizableTable)
    expect(table.props('columns').map((column) => column.key)).toEqual([
      'areaCode',
      'areaName',
      'enabled',
      'status',
      'lockSource',
      'occupancyKey',
      'lastOperatorName',
      'lastOperationTime',
      'remark',
      'action',
    ])
    expect(
      table
        .props('columns')
        .filter((column) => column.sorter)
        .map((column) => column.key),
    ).toEqual([])
    expect(wrapper.findComponent(ReferenceInput).exists()).toBe(false)
    expect(wrapper.text()).not.toContain('所属楼层')
    expect(
      wrapper.findAllComponents(Button).some((button) => /锁定|释放/.test(button.text())),
    ).toBe(false)
    expect(
      table
        .props('columns')
        .slice(2, 8)
        .map((column) => column.title),
    ).toEqual(['启用状态', '运行状态', '锁定来源', '占用标识', '最后操作人', '最后操作时间'])
    for (const value of ['占用', 'PDA', '0001-TASK-01', '测试操作员', '2026-10-19 09:30:00'])
      expect(wrapper.text()).toContain(value)
    expect(wrapper.text()).not.toMatch(/创建时间|更新时间|2026-10-19 09:00:00|2026-10-19 10:00:00/)
    await wrapper.find('input[aria-label="查询关键字"]').setValue(' 0001 ')
    wrapper.findComponent(Select).vm.$emit('update:value', 0)
    await wrapper
      .findAllComponents(Button)
      .find((button) => button.text().replace(/\s/g, '') === '查询')!
      .trigger('click')
    await flushPromises()
    expect(api.pageBasicData).toHaveBeenLastCalledWith(
      'trafficArea',
      expect.objectContaining({
        keyword: '0001',
        enabled: false,
        page: 1,
      }),
    )
    await wrapper
      .findAllComponents(Button)
      .find((button) => button.text().replace(/\s/g, '') === '新增')!
      .trigger('click')
    await flushPromises()
    const editor = wrapper.findComponent(BasicDataEditor)
    expect(editor.text()).not.toMatch(/运行状态|锁定来源|占用标识|最后操作人|最后操作时间/)
    const save = editor
      .findAllComponents(Button)
      .find((button) => button.text().replace(/\s/g, '') === '保存')!
    await save.trigger('click')
    expect(api.saveBasicData).not.toHaveBeenCalled()
    expect(editor.text()).toContain('请填写交管区域编码')
    await editor.find('input[aria-label="交管区域编码"]').setValue('0002')
    await editor.find('input[aria-label="交管区域名称"]').setValue('交管二区')
    await save.trigger('click')
    await flushPromises()
    expect(api.saveBasicData).toHaveBeenCalledWith(
      'trafficArea',
      {
        areaCode: '0002',
        areaName: '交管二区',
        enabled: true,
      },
      undefined,
    )
    expect(wrapper.findComponent(BasicDataEditor).exists()).toBe(false)
  })
  it('交管区域只读运行列区分空闲、占用、未知值与空值', async () => {
    vi.mocked(api.pageBasicData).mockResolvedValue({
      records: [
        { ...trafficArea, status: 'FREE' },
        { ...trafficArea, id: 12, status: 'NEW_STATUS', lockSource: 'NEW_SOURCE' },
        { id: 13, areaCode: 'EMPTY', areaName: '无运行信息', enabled: false },
      ],
      total: 3,
    })
    const wrapper = keep(mount(BasicDataGrid, { props: { type: 'trafficArea' }, ...options }))
    await flushPromises()
    const rows = wrapper.findAll('.ant-table-tbody > tr.ant-table-row')
    expect(rows).toHaveLength(3)
    expect(rows[0]!.find('.ant-tag-success').exists()).toBe(true)
    expect(rows[0]!.text()).toContain('空闲')
    expect(rows[1]!.text()).toContain('NEW_STATUS')
    expect(rows[1]!.text()).toContain('NEW_SOURCE')
    const cells = rows[2]!.findAll('td')
    expect(cells.slice(4, 9).map((cell) => cell.text())).toEqual(['—', '—', '—', '—', '—'])
    expect(rows[2]!.text()).toContain('停用')
  })
  it('交管区域详情只读，编辑只提交基础字段并保留冲突草稿', async () => {
    vi.mocked(api.getBasicData).mockResolvedValue(trafficArea)
    const detail = keep(
      mount(BasicDataEditor, {
        props: { type: 'trafficArea', id: 11, readonly: true },
        ...options,
      }),
    )
    await flushPromises()
    expect(detail.find('input[aria-label="交管区域编码"]').attributes('disabled')).toBeDefined()
    expect(
      detail
        .findAllComponents(Button)
        .some((button) => button.text().replace(/\s/g, '') === '保存'),
    ).toBe(false)
    expect(detail.text()).toContain('2026-10-19 10:00:00')
    const wrapper = keep(
      mount(BasicDataEditor, { props: { type: 'trafficArea', id: 11 }, ...options }),
    )
    await flushPromises()
    expect(wrapper.text()).not.toMatch(/运行状态|锁定来源|占用标识|最后操作人|最后操作时间/)
    await wrapper.find('input[aria-label="交管区域名称"]').setValue('交管新名称')
    await wrapper.find('textarea[aria-label="备注"]').setValue('')
    wrapper.findComponent(Switch).vm.$emit('update:checked', false)
    const request = pending<typeof trafficArea>()
    vi.mocked(api.saveBasicData).mockReturnValueOnce(request.promise)
    const save = wrapper
      .findAllComponents(Button)
      .find((button) => button.text().replace(/\s/g, '') === '保存')!
    await save.trigger('click')
    await save.trigger('click')
    expect(api.saveBasicData).toHaveBeenCalledTimes(1)
    expect(save.props('loading')).toBe(true)
    expect(api.saveBasicData).toHaveBeenCalledWith(
      'trafficArea',
      {
        areaCode: '0001',
        areaName: '交管新名称',
        enabled: false,
        remark: null,
      },
      trafficArea,
    )
    request.resolve(trafficArea)
    await flushPromises()
    expect(wrapper.emitted('saved')).toHaveLength(1)
    vi.mocked(api.saveBasicData).mockRejectedValueOnce(new ApiError(CONFLICT_MESSAGE))
    await save.trigger('click')
    await flushPromises()
    expect(wrapper.text()).toContain(CONFLICT_MESSAGE)
    expect(wrapper.find<HTMLInputElement>('input[aria-label="交管区域名称"]').element.value).toBe(
      '交管新名称',
    )
    expect(save.props('disabled')).toBe(true)
  })
  it.each([false, true])('交管区域删除（批量 %s）携带版本，失败不清空选中项', async (batch) => {
    vi.mocked(api.pageBasicData).mockResolvedValue({ records: [trafficArea], total: 1 })
    vi.mocked(api.deleteBasicData).mockRejectedValueOnce(new ApiError('交管区域存在引用'))
    const wrapper = keep(mount(BasicDataGrid, { props: { type: 'trafficArea' }, ...options }))
    await flushPromises()
    const table = wrapper.findComponent(Table)
    table.props('rowSelection')!.onChange!([11], [trafficArea])
    await flushPromises()
    await wrapper
      .findAllComponents(Button)
      .find((button) => button.text().replace(/\s/g, '') === (batch ? '批量删除' : '删除'))!
      .trigger('click')
    const confirm = wrapper
      .findAllComponents(Button)
      .find((button) => button.text().replace(/\s/g, '') === '确认删除')!
    await confirm.trigger('click')
    await flushPromises()
    expect(api.deleteBasicData).toHaveBeenCalledWith('trafficArea', [trafficArea], batch)
    expect(wrapper.text()).toContain('交管区域存在引用')
    expect(table.props('rowSelection')!.selectedRowKeys).toEqual([11])
    vi.mocked(api.deleteBasicData).mockResolvedValueOnce(undefined)
    await confirm.trigger('click')
    await flushPromises()
    expect(wrapper.findComponent(Modal).props('open')).toBe(false)
    expect(table.props('rowSelection')!.selectedRowKeys).toEqual([])
  })
  it('查询、翻页、服务器排序、刷新保留已应用条件，重置清空', async () => {
    const wrapper = keep(mount(BasicDataGrid, { props: { type: 'factory' }, ...options }))
    await flushPromises()
    const table = wrapper.findComponent(ResizableTable)
    expect(table.props('columnSettings')).toBe(true)
    expect(table.find('button[aria-label="列设置"]').exists()).toBe(true)
    const cols = table.props('columns')
    expect(cols.map((col) => col.key)).toEqual([
      'factoryCode',
      'factoryName',
      'enabled',
      'remark',
      'createdTime',
      'updatedTime',
      'action',
    ])
    await wrapper.find('input[aria-label="查询关键字"]').setValue('工厂 A')
    await wrapper
      .findAllComponents(Button)
      .find((b) => b.text().replace(/\s/g, '') === '查询')!
      .trigger('click')
    await flushPromises()
    expect(api.pageBasicData).toHaveBeenLastCalledWith(
      'factory',
      expect.objectContaining({ keyword: '工厂 A', page: 1 }),
    )
    table.vm.$emit('change', { current: 2, pageSize: 20 }, {}, {}, { action: 'paginate' })
    await flushPromises()
    table.vm.$emit(
      'change',
      { current: 2, pageSize: 20 },
      {},
      { columnKey: 'createdTime', order: 'descend' },
      { action: 'sort' },
    )
    await flushPromises()
    expect(api.pageBasicData).toHaveBeenLastCalledWith(
      'factory',
      expect.objectContaining({ page: 1, sortBy: 'createdTime', sortOrder: 'DESC' }),
    )
    await wrapper.find('input[aria-label="查询关键字"]').setValue('未查询草稿')
    await wrapper
      .findAllComponents(Button)
      .find((b) => b.text().replace(/\s/g, '') === '刷新')!
      .trigger('click')
    await flushPromises()
    expect(api.pageBasicData).toHaveBeenLastCalledWith(
      'factory',
      expect.objectContaining({ keyword: '工厂 A', sortOrder: 'DESC' }),
    )
    await wrapper
      .findAllComponents(Button)
      .find((b) => b.text().replace(/\s/g, '') === '重置')!
      .trigger('click')
    await flushPromises()
    expect(api.pageBasicData).toHaveBeenLastCalledWith(
      'factory',
      expect.objectContaining({ page: 1, sortBy: undefined }),
    )
  })
  it('嵌入表查询锁定所属对象，候选不能覆盖所属 ID', async () => {
    vi.mocked(api.pageBasicData).mockResolvedValue({ records: [], total: 0 })
    const wrapper = keep(
      mount(BasicDataGrid, {
        props: { type: 'locationStorage', ownerId: 42, embedded: true },
        ...options,
      }),
    )
    await flushPromises()
    const embeddedTable = wrapper.findComponent(ResizableTable)
    expect(embeddedTable.props('columnSettings')).toBe(false)
    expect(embeddedTable.find('button[aria-label="列设置"]').exists()).toBe(false)
    expect(embeddedTable.classes()).not.toContain('with-column-settings')
    expect(api.pageBasicData).toHaveBeenCalledWith(
      'locationStorage',
      expect.objectContaining({ locationId: 42 }),
    )
    await wrapper
      .findAllComponents(Button)
      .find((b) => b.text().replace(/\s/g, '') === '新增')!
      .trigger('click')
    await flushPromises()
    const inputs = wrapper.findComponent(BasicDataEditor).findAllComponents(ReferenceInput)
    expect(inputs.find((item) => item.props('target') === 'location')!.props()).toMatchObject({
      value: 42,
      disabled: true,
    })
    expect(
      inputs.find((item) => item.props('target') === 'storage')!.props('areaId'),
    ).toBeUndefined()
  })
  it('布尔开关不立即保存，更新传版本，重复点击仅一次', async () => {
    const save = pending<typeof factory>()
    vi.mocked(api.saveBasicData).mockReturnValue(save.promise)
    const wrapper = keep(mount(BasicDataEditor, { props: { type: 'factory', id: 1 }, ...options }))
    await flushPromises()
    wrapper.findComponent(Switch).vm.$emit('update:checked', false)
    await flushPromises()
    expect(api.saveBasicData).not.toHaveBeenCalled()
    const button = wrapper
      .findAllComponents(Button)
      .find((b) => b.text().replace(/\s/g, '') === '保存')!
    await button.trigger('click')
    await button.trigger('click')
    expect(api.saveBasicData).toHaveBeenCalledTimes(1)
    expect(api.saveBasicData).toHaveBeenCalledWith(
      'factory',
      expect.objectContaining({ factoryCode: '0001', enabled: false, remark: null }),
      factory,
    )
    expect(button.props('loading')).toBe(true)
    save.resolve(factory)
    await flushPromises()
    expect(wrapper.emitted('saved')).toHaveLength(1)
  })
  it('409 保留输入并禁止原版本重复提交', async () => {
    vi.mocked(api.saveBasicData).mockRejectedValue(new ApiError(CONFLICT_MESSAGE))
    const wrapper = keep(mount(BasicDataEditor, { props: { type: 'factory', id: 1 }, ...options }))
    await flushPromises()
    await wrapper.find('input[aria-label="工厂名称"]').setValue('新名称')
    await wrapper
      .findAllComponents(Button)
      .find((b) => b.text().replace(/\s/g, '') === '保存')!
      .trigger('click')
    await flushPromises()
    expect(wrapper.text()).toContain(CONFLICT_MESSAGE)
    expect((wrapper.find('input[aria-label="工厂名称"]').element as HTMLInputElement).value).toBe(
      '新名称',
    )
    expect(
      wrapper
        .findAllComponents(Button)
        .find((b) => b.text().replace(/\s/g, '') === '保存')!
        .props('disabled'),
    ).toBe(true)
    expect(wrapper.emitted('saved')).toBeUndefined()
  })
  it('编辑区域初始回显保持，用户更换后清空存储区并带区域查询', async () => {
    vi.mocked(api.getBasicData).mockImplementation(async (type) =>
      type === 'location'
        ? { id: 5, version: 2, areaId: 1, storageZoneId: 2 }
        : { id: 1, areaName: '区域' },
    )
    const wrapper = keep(mount(BasicDataEditor, { props: { type: 'location', id: 5 }, ...options }))
    await flushPromises()
    const area = wrapper
      .findAllComponents(ReferenceInput)
      .find((field) => field.props('target') === 'area')!
    const storage = wrapper
      .findAllComponents(ReferenceInput)
      .find((field) => field.props('target') === 'storage')!
    expect(storage.props('value')).toBe(2)
    area.vm.$emit('update:value', 3)
    await flushPromises()
    expect(storage.props('value')).toBeUndefined()
    expect(storage.props('areaId')).toBe(3)
    area.vm.$emit('update:value', undefined)
    await flushPromises()
    expect(storage.props('disabled')).toBe(true)
  })
  it('容量仅有装载位载具显示，切换后隐藏且无 loadingMode', async () => {
    vi.mocked(api.getBasicData).mockResolvedValue({
      id: 1,
      version: 2,
      containerCategory: 'VEHICLE_SLOT',
      boxCapacity: 4,
    })
    const wrapper = keep(mount(BasicDataEditor, { props: { type: 'model', id: 1 }, ...options }))
    await flushPromises()
    expect(wrapper.text()).toContain('料箱容量')
    wrapper.findAllComponents(Select)[0]!.vm.$emit('update:value', 'VEHICLE_DIRECT')
    await flushPromises()
    expect(wrapper.text()).not.toContain('料箱容量')
    expect(wrapper.text()).not.toContain('装载方式')
  })
  it('加载、空态与失败具有不同图标/文字，失败可重试', async () => {
    const wrapper = keep(mount(DataState, { props: { loading: true } }))
    expect(wrapper.find('[aria-label="loading"]').exists()).toBe(true)
    await wrapper.setProps({ loading: false })
    expect(wrapper.text()).toContain('暂无数据')
    expect(wrapper.find('[aria-label="inbox"]').exists()).toBe(true)
    await wrapper.setProps({ error: '网络错误' })
    expect(wrapper.find('[aria-label="exclamation-circle"]').exists()).toBe(true)
    await wrapper.find('button').trigger('click')
    expect(wrapper.emitted('retry')).toHaveLength(1)
  })
  it('候选始终携带区域，跨页已选可见，键盘行选择立即返回', async () => {
    vi.mocked(api.pageBasicData).mockResolvedValue({
      records: [{ id: 3, areaId: 8, storageName: '新库' }],
      total: 21,
    })
    vi.mocked(api.getBasicData).mockImplementation(async (type, id) =>
      type === 'storage' ? { id, areaId: 8, storageName: '已选库' } : { id, areaName: '区域' },
    )
    const wrapper = keep(
      mount(ReferencePicker, { props: { type: 'storage', selectedId: 9, areaId: 8 }, ...options }),
    )
    await flushPromises()
    expect(wrapper.find('.current-selection').text()).toContain('已选库')
    const table = wrapper.findComponent(Table)
    table.vm.$emit('change', { current: 2, pageSize: 20 })
    await flushPromises()
    expect(api.pageBasicData).toHaveBeenLastCalledWith(
      'storage',
      expect.objectContaining({ page: 2, areaId: 8 }),
    )
    await wrapper.find('tbody tr[tabindex="0"]').trigger('keydown', { key: 'Enter' })
    expect(wrapper.emitted('select')).toEqual([[3]])
  })
  it('候选忽略旧区域迟到响应，选择框图标在清除与搜索间切换', async () => {
    const old = pending<api.BasicPage>()
    vi.mocked(api.pageBasicData)
      .mockReturnValueOnce(old.promise)
      .mockResolvedValue({ records: [{ id: 2, areaId: 2, storageName: '新区域库' }], total: 1 })
    const picker = keep(
      mount(ReferencePicker, { props: { type: 'storage', areaId: 1 }, ...options }),
    )
    await picker.setProps({ areaId: 2 })
    await flushPromises()
    old.resolve({ records: [{ id: 1, areaId: 1, storageName: '旧区域库' }], total: 1 })
    await flushPromises()
    expect(picker.text()).toContain('新区域库')
    expect(picker.text()).not.toContain('旧区域库')
    const input = keep(
      mount(ReferenceInput, { props: { target: 'factory', label: '工厂', value: 1 }, ...options }),
    )
    await flushPromises()
    expect(input.find('.reference-action .anticon-close').exists()).toBe(true)
    expect(input.find('.reference-action .anticon-search').exists()).toBe(false)
    await input.find('button[aria-label="清除工厂"]').trigger('click')
    expect(input.emitted('update:value')).toEqual([[undefined]])
    expect(input.findComponent(ReferencePicker).exists()).toBe(false)
    await input.setProps({ value: undefined })
    expect(input.find('.reference-action .anticon-search').exists()).toBe(true)
    expect(input.find('.reference-action .anticon-close').exists()).toBe(false)
    await input.find('button[aria-label="选择工厂"]').trigger('click')
    expect(input.findComponent(ReferencePicker).exists()).toBe(true)
    await input.setProps({ disabled: true, value: 1 })
    expect(input.find('.reference-action .anticon-search').exists()).toBe(true)
    expect(input.find('button[aria-label="清除工厂"]').exists()).toBe(false)
  })

  it('批量删除保留选中版本，拒绝时保留选择与确认弹窗', async () => {
    vi.mocked(api.deleteBasicData).mockRejectedValue(new ApiError('存在引用，不能删除'))
    const wrapper = keep(mount(BasicDataGrid, { props: { type: 'factory' }, ...options }))
    await flushPromises()
    const table = wrapper.findComponent(ResizableTable)
    const antTable = table.findComponent(Table)
    antTable.props('rowSelection')!.onChange!([1], [factory])
    await flushPromises()
    await wrapper
      .findAllComponents(Button)
      .find((b) => b.text().replace(/\s/g, '') === '批量删除')!
      .trigger('click')
    await flushPromises()
    await wrapper
      .findAllComponents(Button)
      .find((b) => b.text().replace(/\s/g, '') === '确认删除')!
      .trigger('click')
    await flushPromises()
    expect(api.deleteBasicData).toHaveBeenCalledWith('factory', [factory], true)
    expect(wrapper.text()).toContain('存在引用，不能删除')
    expect(antTable.props('rowSelection')!.selectedRowKeys).toEqual([1])
  })

  it('列表迟到查询不覆盖最新结果，接口失败展示错误而非空数据', async () => {
    const old = pending<api.BasicPage>()
    vi.mocked(api.pageBasicData)
      .mockReturnValueOnce(old.promise)
      .mockResolvedValue({ records: [{ ...factory, factoryName: '最新结果' }], total: 1 })
    const wrapper = keep(mount(BasicDataGrid, { props: { type: 'factory' }, ...options }))
    await wrapper
      .findAllComponents(Button)
      .find((b) => b.text().replace(/\s/g, '') === '查询')!
      .trigger('click')
    await flushPromises()
    old.resolve({ records: [{ ...factory, factoryName: '旧结果' }], total: 1 })
    await flushPromises()
    expect(wrapper.text()).toContain('最新结果')
    expect(wrapper.text()).not.toContain('旧结果')
    vi.mocked(api.pageBasicData).mockRejectedValue(new ApiError('无权查看此对象'))
    await wrapper
      .findAllComponents(Button)
      .find((b) => b.text().replace(/\s/g, '') === '查询')!
      .trigger('click')
    await flushPromises()
    expect(wrapper.text()).toContain('加载失败')
    expect(wrapper.text()).toContain('无权查看此对象')
  })
})
