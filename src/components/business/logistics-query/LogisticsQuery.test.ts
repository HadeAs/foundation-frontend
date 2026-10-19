import { flushPromises, mount } from '@vue/test-utils'
import { Button, Input, InputNumber, RangePicker, Select, Table, Tag } from 'ant-design-vue'
import dayjs from 'dayjs'
import { KeepAlive, defineComponent, h, nextTick, ref } from 'vue'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import * as api from '@/api/logistics-query'
import * as basicApi from '@/api/basic-data'
import { ApiError } from '@/api/http'
import { fields, queryObjects, type QueryType } from '@/business/logistics-query/schema'
import ResizableTable from '@/components/common/ResizableTable.vue'
import QueryList from './QueryList.vue'
import QueryDetail from './QueryDetail.vue'
import QueryViewer from './QueryViewer.vue'
import QueryReference from './QueryReference.vue'
import QueryFilters from './QueryFilters.vue'
import QueryValue from './QueryValue.vue'
import LogisticsQueryPage from './LogisticsQueryPage.vue'
vi.mock('@/api/logistics-query', () => ({
  pageLogisticsData: vi.fn(),
  getLogisticsData: vi.fn(),
  getLogisticsDictionaries: vi.fn(),
}))
vi.mock('@/api/basic-data', async (original) => ({
  ...(await original<typeof basicApi>()),
  getBasicData: vi.fn(),
}))
const options = {
  global: {
    stubs: {
      AModal: {
        props: ['title', 'width'],
        template:
          '<section class="modal"><header>{{ title }}</header><slot/><footer><slot name="footer"/></footer></section>',
      },
    },
  },
}
const wrappers: Array<{ unmount: () => void }> = []
function keep<T extends { unmount: () => void }>(wrapper: T) {
  wrappers.push(wrapper)
  return wrapper
}
function button(wrapper: ReturnType<typeof mount>, text: string) {
  return wrapper.findAllComponents(Button).find((b) => b.text().replace(/\s/g, '') === text)!
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
  vi.mocked(api.pageLogisticsData).mockResolvedValue({
    records: [{ id: 1, taskNo: '0001', orderNo: '0002', applicationNo: 'WH001' }],
    total: 45,
  })
  vi.mocked(api.getLogisticsData).mockImplementation(async (_type, id) => ({
    id,
    taskNo: `TASK-${id}`,
    applicationNo: `WH-${id}`,
    receivingNo: `RC-${id}`,
    orderNo: '0001',
  }))
  vi.mocked(api.getLogisticsDictionaries).mockResolvedValue({
    nari_logistics_task_status: [{ value: 'RUNNING', label: '执行中', tagType: 'primary' }],
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

describe('物流查询页面本地 DOM', () => {
  for (const type of Object.keys(queryObjects) as QueryType[])
    it(`${type} 默认创建时间倒序、日期状态不限，无主键列/多选/写入口`, async () => {
      const wrapper = keep(mount(QueryList, { props: { type }, ...options }))
      await flushPromises()
      expect(api.pageLogisticsData).toHaveBeenLastCalledWith(type, {
        page: 1,
        size: 20,
        sortBy: 'createdTime',
        sortOrder: 'DESC',
      })
      const table = wrapper.findComponent(ResizableTable)
      expect(table.findComponent(Table).props('rowSelection')).toBeUndefined()
      const columns = table.props('columns')
      expect(columns.map((c) => c.key)).not.toContain('id')
      expect(
        columns
          .filter((c) => c.sorter)
          .map((c) => c.key)
          .sort(),
      ).toEqual([...queryObjects[type].sort].sort())
      expect(wrapper.text()).not.toContain('记录 ID')
      for (const text of ['新增', '编辑', '删除', '导入', '导出', '取消任务', '清理WMS'])
        expect(wrapper.findAll('button').some((b) => b.text().replace(/\s/g, '') === text)).toBe(
          false,
        )
    })
  it('草稿/查询/刷新隔离，三态排序、分页、默认重置与更多条件保留', async () => {
    const wrapper = keep(mount(QueryList, { props: { type: 'task' }, ...options }))
    await flushPromises()
    const input = wrapper.findComponent(Input)
    input.vm.$emit('update:value', ' 0001 ')
    await button(wrapper, '刷新').trigger('click')
    await flushPromises()
    expect(api.pageLogisticsData).toHaveBeenLastCalledWith(
      'task',
      expect.not.objectContaining({ taskNo: '0001' }),
    )
    await button(wrapper, '查询').trigger('click')
    await flushPromises()
    expect(api.pageLogisticsData).toHaveBeenLastCalledWith(
      'task',
      expect.objectContaining({ taskNo: '0001', page: 1 }),
    )
    const table = wrapper.findComponent(ResizableTable)
    table.vm.$emit('change', { current: 3, pageSize: 20 }, {}, {}, { action: 'paginate' })
    await flushPromises()
    await button(wrapper, '刷新').trigger('click')
    await flushPromises()
    expect(api.pageLogisticsData).toHaveBeenLastCalledWith(
      'task',
      expect.objectContaining({ taskNo: '0001', page: 3 }),
    )
    for (const order of ['ascend', 'descend', undefined]) {
      table.vm.$emit(
        'change',
        { current: 3, pageSize: 20 },
        {},
        { columnKey: 'queueNo', order },
        { action: 'sort' },
      )
      await flushPromises()
      expect(api.pageLogisticsData).toHaveBeenLastCalledWith(
        'task',
        expect.objectContaining({
          page: 1,
          sortBy: order ? 'queueNo' : undefined,
          sortOrder: order === 'ascend' ? 'ASC' : order === 'descend' ? 'DESC' : undefined,
        }),
      )
    }
    await button(wrapper, '更多条件').trigger('click')
    wrapper
      .findAllComponents(InputNumber)
      .find((c) => c.props('placeholder') === '队列序号')!
      .vm.$emit('update:value', 0)
    await button(wrapper, '收起条件').trigger('click')
    await button(wrapper, '查询').trigger('click')
    await flushPromises()
    expect(api.pageLogisticsData).toHaveBeenLastCalledWith(
      'task',
      expect.objectContaining({ queueNo: 0 }),
    )
    await button(wrapper, '重置').trigger('click')
    await flushPromises()
    expect(api.pageLogisticsData).toHaveBeenLastCalledWith('task', {
      page: 1,
      size: 20,
      sortBy: 'createdTime',
      sortOrder: 'DESC',
    })
  })
  it('日期使用上海时区，倒置范围及小数阻止查询且不改变当前结果', async () => {
    const wrapper = keep(mount(QueryList, { props: { type: 'warehouse' }, ...options }))
    await flushPromises()
    const picker = wrapper.findComponent(RangePicker)
    picker.vm.$emit('update:value', [dayjs('2026-10-15T12:00:00'), dayjs('2026-10-15T13:00:00')])
    await button(wrapper, '查询').trigger('click')
    await flushPromises()
    expect(api.pageLogisticsData).toHaveBeenLastCalledWith(
      'warehouse',
      expect.objectContaining({
        succeededTimeStart: '2026-10-15T12:00:00+08:00',
        succeededTimeEnd: '2026-10-15T13:00:00+08:00',
      }),
    )
    const count = vi.mocked(api.pageLogisticsData).mock.calls.length
    picker.vm.$emit('update:value', [dayjs('2026-10-15T13:00:00'), dayjs('2026-10-15T12:00:00')])
    await button(wrapper, '查询').trigger('click')
    await flushPromises()
    expect(api.pageLogisticsData).toHaveBeenCalledTimes(count)
    expect(wrapper.text()).toContain('开始时间不能晚于结束时间')
    expect(wrapper.text()).toContain('WH001')
  })
  it('过期响应不覆盖新查询；空、失败、加载状态分离，失败不显示零条', async () => {
    const old = pending<api.LogisticsPage>()
    vi.mocked(api.pageLogisticsData)
      .mockReturnValueOnce(old.promise)
      .mockResolvedValue({ records: [], total: 0 })
    const wrapper = keep(mount(QueryList, { props: { type: 'task' }, ...options }))
    expect(wrapper.text()).toContain('加载中')
    await button(wrapper, '查询').trigger('click')
    await flushPromises()
    old.resolve({ records: [{ id: 1, taskNo: 'OLD' }], total: 1 })
    await flushPromises()
    expect(wrapper.text()).toContain('暂无数据')
    expect(wrapper.text()).not.toContain('OLD')
    vi.mocked(api.pageLogisticsData).mockRejectedValue(new ApiError('请求暂不可用'))
    await button(wrapper, '刷新').trigger('click')
    await flushPromises()
    expect(wrapper.text()).toContain('加载失败')
    expect(wrapper.text()).not.toContain('共 0 条')
    vi.mocked(api.pageLogisticsData).mockResolvedValue({ records: [], total: 0 })
    await button(wrapper, '重新加载').trigger('click')
    await flushPromises()
    expect(wrapper.text()).toContain('暂无数据')
  })
  it('后端字典失败可重试；未知枚举、零、空值安全展示', async () => {
    vi.mocked(api.getLogisticsDictionaries).mockRejectedValue(new Error('字典服务不可用'))
    const wrapper = keep(mount(QueryList, { props: { type: 'task' }, ...options }))
    await flushPromises()
    expect(wrapper.text()).toContain('字典加载失败')
    expect(wrapper.findComponent(Select).props('options')).toEqual([])
    vi.mocked(api.getLogisticsDictionaries).mockResolvedValue({
      nari_logistics_task_status: [{ value: 'RUNNING', label: '执行中', tagType: 'primary' }],
    })
    await button(wrapper, '重试').trigger('click')
    await flushPromises()
    expect(wrapper.findComponent(Select).props('options')).toEqual([
      { value: 'RUNNING', label: '执行中' },
    ])
    const value = keep(
      mount(QueryValue, {
        props: { fieldKey: 'taskStatus', value: 'NEW', relations: {}, dictionaries: {} },
      }),
    )
    expect(value.text()).toBe('NEW')
    expect(value.findComponent(Tag).props('color')).toBeUndefined()
    await value.setProps({ fieldKey: 'quantity', value: 0 })
    expect(value.text()).toBe('0')
    await value.setProps({ value: null })
    expect(value.text()).toBe('—')
  })
  it('详情完整覆盖、快照折叠文本安全、关联失败保留 ID', async () => {
    vi.mocked(api.getLogisticsData).mockResolvedValue({
      id: 1,
      taskId: 99,
      beforeState: '<img src=x onerror=alert(1)>',
      afterState: '{"quantity":0}',
      traceId: 'TRACE-1',
    })
    const wrapper = keep(mount(QueryDetail, { props: { type: 'operation', id: 1 }, ...options }))
    await flushPromises()
    expect(
      wrapper
        .findAll('dt')
        .map((dt) => dt.text())
        .sort(),
    ).toEqual(
      [
        ...queryObjects.operation.details,
        ...queryObjects.operation.technical,
        'version',
        'bizDate',
        'sourceSystem',
        'traceId',
        'idempotentKey',
      ]
        .map((key) => fields[key]!.label)
        .sort(),
    )
    expect(wrapper.text()).not.toContain('记录 ID')
    expect(wrapper.find('img').exists()).toBe(false)
    expect(wrapper.text()).toContain('<img src=x onerror=alert(1)>')
    expect(wrapper.findAll('details').every((d) => !d.attributes('open'))).toBe(true)
    vi.mocked(api.getLogisticsData).mockRejectedValue(new Error('找不到关联'))
    const value = keep(
      mount(QueryValue, {
        props: {
          fieldKey: 'taskId',
          value: 99,
          relations: { 'task:99': null },
          dictionaries: {},
          links: true,
        },
      }),
    )
    expect(value.text()).toContain('ID 99')
    await value.find('button').trigger('click')
    expect(value.emitted('navigate')).toEqual([['task', 99]])
  })
  it('缴库记录行内打开箱明细，不创建独立页面', async () => {
    const wrapper = keep(mount(LogisticsQueryPage, { props: { type: 'warehouse' }, ...options }))
    await flushPromises()
    await button(wrapper, '箱明细').trigger('click')
    await flushPromises()
    expect(wrapper.findComponent(QueryViewer).props('initial')).toEqual({
      type: 'warehouseBox',
      id: 1,
      boxes: true,
      label: 'WH001',
    })
    expect(api.pageLogisticsData).toHaveBeenLastCalledWith(
      'warehouseBox',
      expect.objectContaining({ warehouseRecordId: 1 }),
    )
    await button(wrapper.findComponent(QueryViewer), '关闭').trigger('click')
    expect(wrapper.findComponent(QueryViewer).exists()).toBe(false)
    expect(wrapper.findComponent(QueryList).props('type')).toBe('warehouse')
  })
  it('缴库子列表锁定父级，查看/关联/返回复用同窗并保留分页筛选排序', async () => {
    const viewer = keep(
      mount(QueryViewer, {
        props: { initial: { type: 'warehouseBox', id: 7, boxes: true, label: 'WH007' } },
        ...options,
      }),
    )
    await flushPromises()
    const list = viewer.findComponent(QueryList),
      table = list.findComponent(ResizableTable)
    expect(table.props('columns').map((column) => column.key)).not.toContain('warehouseRecordId')
    expect(api.pageLogisticsData).toHaveBeenLastCalledWith(
      'warehouseBox',
      expect.objectContaining({ warehouseRecordId: 7 }),
    )
    await button(list, '更多条件').trigger('click')
    expect(
      list.findAllComponents(QueryReference).some((c) => c.props('label') === '所属缴库记录'),
    ).toBe(false)
    list.findComponent(Input).vm.$emit('update:value', '0001')
    await button(list, '查询').trigger('click')
    await flushPromises()
    table.vm.$emit('change', { current: 2, pageSize: 20 }, {}, {}, { action: 'paginate' })
    await flushPromises()
    list.vm.$emit('navigate', 'warehouseBox', 1)
    await flushPromises()
    expect(viewer.findAll('.modal')).toHaveLength(1)
    viewer.findComponent(QueryDetail).vm.$emit('navigate', 'task', 1)
    await flushPromises()
    expect(viewer.findAll('.modal')).toHaveLength(1)
    await button(viewer, '返回').trigger('click')
    await button(viewer, '返回').trigger('click')
    await flushPromises()
    expect(viewer.findComponent(QueryList).findComponent(Table).props('pagination')).toMatchObject({
      current: 2,
    })
    expect(viewer.findComponent(QueryList).findComponent(Input).props('value')).toBe('0001')
    await button(list, '重置').trigger('click')
    await flushPromises()
    expect(api.pageLogisticsData).toHaveBeenLastCalledWith('warehouseBox', {
      warehouseRecordId: 7,
      page: 1,
      size: 20,
      sortBy: 'createdTime',
      sortOrder: 'DESC',
    })
  })
  it('关联选择服务端业务字段搜索、跨页已选回显、点击/键盘即选、外部清除', async () => {
    vi.mocked(api.pageLogisticsData).mockResolvedValue({
      records: [
        { id: 1, taskNo: 'TASK-1' },
        { id: 2, taskNo: 'TASK-2' },
      ],
      total: 40,
    })
    const wrapper = keep(
      mount(QueryReference, {
        props: { target: 'task', value: 99, label: '关联运输任务' },
        ...options,
      }),
    )
    await flushPromises()
    await wrapper.find('.reference-trigger').trigger('click')
    await flushPromises()
    expect(wrapper.text()).toContain('已选：TASK-99')
    expect(wrapper.text()).not.toContain('记录 ID')
    wrapper.findComponent(Input).vm.$emit('update:value', ' TASK-1 ')
    await button(wrapper, '查询').trigger('click')
    await flushPromises()
    expect(api.pageLogisticsData).toHaveBeenLastCalledWith(
      'task',
      expect.objectContaining({ taskNo: 'TASK-1' }),
    )
    const table = wrapper.findComponent(Table)
    table.vm.$emit('change', { current: 2, pageSize: 20 })
    await flushPromises()
    expect(api.pageLogisticsData).toHaveBeenLastCalledWith(
      'task',
      expect.objectContaining({ page: 2 }),
    )
    await wrapper.findAll('tbody tr[tabindex="0"]')[1]!.trigger('keydown', { key: 'Enter' })
    expect(wrapper.emitted('update:value')).toEqual([[2]])
    await wrapper.setProps({ value: 2 })
    await wrapper.find('.reference-trigger').trigger('click')
    await flushPromises()
    expect(wrapper.find('tr.query-selected-row').text()).toContain('TASK-2')
    await button(wrapper, '取消').trigger('click')
    const count = vi.mocked(api.pageLogisticsData).mock.calls.length
    await wrapper.find('.reference-clear').trigger('click')
    await flushPromises()
    expect(wrapper.emitted('update:value')?.at(-1)).toEqual([undefined])
    expect(api.pageLogisticsData).toHaveBeenCalledTimes(count)
  })
  it('切换菜单重新初始化且关闭查看链，旧组件响应不泄漏', async () => {
    const active = ref(true)
    const Host = defineComponent({
      setup: () => () =>
        h(KeepAlive, null, {
          default: () => (active.value ? h(LogisticsQueryPage, { type: 'task' }) : h('div')),
        }),
    })
    const wrapper = keep(mount(Host, options))
    await flushPromises()
    wrapper.findComponent(QueryList).findComponent(Input).vm.$emit('update:value', 'changed')
    wrapper.findComponent(QueryList).vm.$emit('navigate', 'task', 1)
    await flushPromises()
    active.value = false
    await nextTick()
    active.value = true
    await flushPromises()
    expect(wrapper.findComponent(QueryViewer).exists()).toBe(false)
    expect(api.pageLogisticsData).toHaveBeenLastCalledWith('task', {
      page: 1,
      size: 20,
      sortBy: 'createdTime',
      sortOrder: 'DESC',
    })
  })
  it('起终点载具改变时分别清空装载位', async () => {
    const wrapper = keep(
      mount(QueryFilters, {
        props: {
          keys: ['originVehicleId', 'originVehicleSlotId'],
          draft: { originVehicleId: 1, originVehicleSlotId: 2, destinationVehicleSlotId: 3 },
          dictionaries: {},
          dictError: '',
        },
        ...options,
      }),
    )
    wrapper.findComponent({ name: 'ReferenceInput' }).vm.$emit('update:value', 4)
    expect(wrapper.emitted('change')?.[0]?.[0]).toMatchObject({
      originVehicleId: 4,
      originVehicleSlotId: undefined,
      destinationVehicleSlotId: 3,
    })
  })
})
