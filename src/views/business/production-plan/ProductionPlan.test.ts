import { flushPromises, mount } from '@vue/test-utils'
import { Button, RangePicker, Select, Table } from 'ant-design-vue'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import * as api from '@/api/production-plan'
import * as basicApi from '@/api/basic-data'
import { ApiError } from '@/api/http'
import { planDateQuery, todayPlanRange } from '@/business/production-plan'
import ReferenceInput from '@/components/business/basic-data/ReferenceInput.vue'
import ResizableTable from '@/components/common/ResizableTable.vue'
import ProductionPlan from './index.vue'

vi.mock('@/api/production-plan', async (original) => ({
  ...(await original<typeof api>()),
  pageProductionPlans: vi.fn(),
}))
vi.mock('@/api/basic-data', async (original) => ({
  ...(await original<typeof basicApi>()),
  getBasicData: vi.fn(),
}))
const wrappers: Array<ReturnType<typeof mount>> = []
function create() {
  const wrapper = mount(ProductionPlan)
  wrappers.push(wrapper)
  return wrapper
}
function button(wrapper: ReturnType<typeof mount>, label: string) {
  return wrapper.findAllComponents(Button).find((item) => item.text().replace(/\s/g, '') === label)!
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
  vi.mocked(api.pageProductionPlans).mockResolvedValue({
    records: [
      {
        id: 1,
        planNo: '00001',
        orderNo: '000123',
        planStatus: 'PLANNED',
        resourceCode: '001',
        mainProcessCode: '010',
        productionLineId: 3,
        deliveryStorageZoneId: 4,
        plannedQuantity: 10,
      },
      { id: 2, planNo: '00002', orderNo: '000123', planStatus: 'EXECUTING' },
    ],
    total: 42,
  })
  vi.mocked(basicApi.getBasicData).mockImplementation(async (type, id) =>
    type === 'line'
      ? { id, lineName: '装配一线', lineCode: 'L1' }
      : { id, storageName: '配送一区', storageCode: 'Z1' },
  )
})
afterEach(() => {
  wrappers.splice(0).forEach((wrapper) => wrapper.unmount())
  document.body.innerHTML = ''
  vi.unstubAllGlobals()
})

describe('生产计划正式页面本地 DOM', () => {
  it('默认当天；查询/分页/排序/刷新使用已应用条件，重置清空全部条件', async () => {
    const wrapper = create()
    await flushPromises()
    expect(api.pageProductionPlans).toHaveBeenLastCalledWith(
      expect.objectContaining({ ...planDateQuery(todayPlanRange()), page: 1, size: 20 }),
    )
    await wrapper.find('input[aria-label="生产订单号"]').setValue(' 000123 ')
    await button(wrapper, '更多条件').trigger('click')
    await wrapper.find('input[aria-label="计划单号"]').setValue('00001')
    await wrapper.find('input[aria-label="主工序编码"]').setValue('010')
    wrapper.findAllComponents(ReferenceInput)[0]!.vm.$emit('update:value', 3)
    wrapper.findAllComponents(ReferenceInput)[1]!.vm.$emit('update:value', 4)
    wrapper.findComponent(Select).vm.$emit('update:value', 'PLANNED')
    wrapper.findComponent(RangePicker).vm.$emit('update:value', null)
    await button(wrapper, '查询').trigger('click')
    await flushPromises()
    const request = vi.mocked(api.pageProductionPlans).mock.lastCall![0]
    expect(request).toMatchObject({
      page: 1,
      orderNo: '000123',
      planNo: '00001',
      mainProcessCode: '010',
      productionLineId: 3,
      deliveryStorageZoneId: 4,
      planStatus: 'PLANNED',
    })
    expect(request).not.toHaveProperty('plannedStartTimeStart')
    await wrapper.find('input[aria-label="生产订单号"]').setValue('unsaved')
    const table = wrapper.findComponent(ResizableTable)
    table.vm.$emit('change', { current: 2, pageSize: 20 }, {}, {}, { action: 'paginate' })
    await flushPromises()
    expect(api.pageProductionPlans).toHaveBeenLastCalledWith(
      expect.objectContaining({ page: 2, orderNo: '000123' }),
    )
    table.vm.$emit(
      'change',
      { current: 2, pageSize: 20 },
      {},
      { columnKey: 'sequenceNo', order: 'descend' },
      { action: 'sort' },
    )
    await flushPromises()
    expect(api.pageProductionPlans).toHaveBeenLastCalledWith(
      expect.objectContaining({ page: 1, sortBy: 'sequenceNo', sortOrder: 'DESC' }),
    )
    await button(wrapper, '刷新').trigger('click')
    await flushPromises()
    expect(api.pageProductionPlans).toHaveBeenLastCalledWith(
      expect.objectContaining({ orderNo: '000123', sortOrder: 'DESC' }),
    )
    await button(wrapper, '重置').trigger('click')
    await flushPromises()
    expect(api.pageProductionPlans).toHaveBeenLastCalledWith({
      ...planDateQuery(todayPlanRange()),
      page: 1,
      size: 20,
      sortBy: undefined,
      sortOrder: undefined,
    })
  })
  it('同订单不同计划独立展示，名称回显，缺失能力禁用并说明，无完成时间及虚假任务数', async () => {
    const wrapper = create()
    await flushPromises()
    expect(wrapper.text()).toContain('00001')
    expect(wrapper.text()).toContain('00002')
    expect(wrapper.text()).toContain('装配一线')
    expect(wrapper.text()).toContain('配送一区')
    expect(wrapper.text()).toContain('状态待确认')
    expect(wrapper.text()).toContain('配送中')
    expect(wrapper.find('[aria-label*="PLANNED"]').exists()).toBe(true)
    const table = wrapper.findComponent(ResizableTable)
    expect(table.findComponent(Table).props('rowKey')).toBe('id')
    expect(table.findComponent(Table).props('rowSelection')).toBeUndefined()
    expect(
      table
        .props('columns')
        .filter((item) => item.sorter)
        .map((item) => item.key),
    ).toEqual(['sequenceNo', 'planNo', 'plannedStartTime'])
    expect(wrapper.text()).not.toContain('完成时间')
    expect(wrapper.find('[aria-label="关联任务数未提供"]').text()).toBe('—')
    const count = vi.mocked(api.pageProductionPlans).mock.calls.length
    for (const label of [
      '下载导入模板',
      'Excel导入',
      '调整顺序',
      '变更记录',
      '修改',
      '插单',
      '删除',
    ]) {
      const action = button(wrapper, label)
      expect(action.props('disabled')).toBe(true)
      expect(action.element.parentElement?.getAttribute('aria-label')).toContain('：')
      await action.trigger('click')
    }
    expect(api.pageProductionPlans).toHaveBeenCalledTimes(count)
  })
  it('迟到结果不覆盖新查询，加载/空/失败区分，失败不显示旧记录或虚假总数，允许重试', async () => {
    let resolve!: (value: api.ProductionPlanPage) => void
    vi.mocked(api.pageProductionPlans)
      .mockReturnValueOnce(
        new Promise((done) => {
          resolve = done
        }),
      )
      .mockResolvedValue({ records: [], total: 0 })
    const wrapper = create()
    expect(wrapper.text()).toContain('加载中')
    await button(wrapper, '查询').trigger('click')
    await flushPromises()
    resolve({ records: [{ id: 9, planNo: 'LATE' }], total: 1 })
    await flushPromises()
    expect(wrapper.text()).toContain('暂无生产计划')
    expect(wrapper.text()).not.toContain('LATE')
    vi.mocked(api.pageProductionPlans).mockRejectedValue(new ApiError('无查询权限'))
    await button(wrapper, '刷新').trigger('click')
    await flushPromises()
    expect(wrapper.text()).toContain('加载失败')
    expect(wrapper.text()).toContain('无查询权限')
    expect(wrapper.text()).not.toContain('共 0 条')
    vi.mocked(api.pageProductionPlans).mockResolvedValue({ records: [], total: 0 })
    await button(wrapper, '重新加载').trigger('click')
    await flushPromises()
    expect(wrapper.text()).toContain('暂无生产计划')
  })
  it('名称加载失败保留 ID，翻到失效页自动回退有效页', async () => {
    vi.mocked(basicApi.getBasicData).mockRejectedValue(new ApiError('不可用'))
    const wrapper = create()
    await flushPromises()
    expect(wrapper.text()).toContain('ID 3（名称加载失败）')
    expect(wrapper.text()).toContain('ID 4（名称加载失败）')
    vi.mocked(api.pageProductionPlans).mockResolvedValue({ records: [], total: 0 })
    wrapper
      .findComponent(ResizableTable)
      .vm.$emit('change', { current: 3, pageSize: 20 }, {}, {}, { action: 'paginate' })
    await flushPromises()
    expect(api.pageProductionPlans).toHaveBeenLastCalledWith(expect.objectContaining({ page: 1 }))
  })
})
