import { flushPromises, mount } from '@vue/test-utils'
import { Button, Switch, Table, TabPane, Tabs } from 'ant-design-vue'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import * as api from '@/api/basic-data'
import { ApiError, CONFLICT_MESSAGE } from '@/api/http'
import { buildRequest, type DataRecord, type ObjectType } from '@/business/basic-data/schema'
import ResizableTable from '@/components/common/ResizableTable.vue'
import BasicDataEditor from './BasicDataEditor.vue'
import BasicDataGrid from './BasicDataGrid.vue'
import BasicDataPage from './BasicDataPage.vue'
import ReferenceInput from './ReferenceInput.vue'

vi.mock('@/api/basic-data', async (original) => ({
  ...(await original<typeof api>()),
  getBasicData: vi.fn(),
  pageBasicData: vi.fn(),
  getBasicDictionaries: vi.fn(),
  saveBasicData: vi.fn(),
  deleteBasicData: vi.fn(),
}))
const options = {
  global: {
    stubs: {
      AModal: {
        props: { open: Boolean },
        template: '<section v-if="open"><slot/><footer><slot name="footer"/></footer></section>',
      },
    },
  },
}
const row: DataRecord = {
  id: 8,
  version: 2,
  productionLineId: 3,
  resourceCode: '0001',
  enabled: true,
  remark: '备注',
}
const wrappers: Array<{ unmount: () => void }> = []
function keep<T extends { unmount: () => void }>(wrapper: T) {
  wrappers.push(wrapper)
  return wrapper
}
function button(wrapper: ReturnType<typeof mount>, text: string) {
  return wrapper.findAllComponents(Button).find((item) => item.text().replace(/\s/g, '') === text)!
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
  vi.mocked(api.getBasicDictionaries).mockResolvedValue({})
  vi.mocked(api.pageBasicData).mockResolvedValue({ records: [row], total: 1 })
  vi.mocked(api.getBasicData).mockImplementation(async (type, id) =>
    type === 'resourceLine' ? row : { id, lineName: '产线一', storageName: '配送区' },
  )
  vi.mocked(api.saveBasicData).mockResolvedValue(row)
})
afterEach(() => {
  wrappers.splice(0).forEach((wrapper) => wrapper.unmount())
  document.body.innerHTML = ''
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
})

describe('产线关联配置', () => {
  it('行入口、双页签、父产线隔离及子弹窗关闭保护', async () => {
    const page = keep(mount(BasicDataPage, { props: { type: 'line' }, ...options }))
    await flushPromises()
    await button(page, '关联配置').trigger('click')
    await flushPromises()
    expect(api.getBasicData).toHaveBeenCalledWith('line', 8)
    expect(api.pageBasicData).toHaveBeenCalledWith(
      'resourceLine',
      expect.objectContaining({ productionLineId: 8 }),
    )
    expect(page.findAllComponents(TabPane).map((tab) => tab.props('tab'))).toEqual([
      '资源产线映射',
      '产线主工序配送区',
    ])
    page.findComponent(Tabs).vm.$emit('update:activeKey', 'lineProcessStorage')
    await flushPromises()
    const nested = page
      .findAllComponents(BasicDataGrid)
      .find((grid) => grid.props('type') === 'lineProcessStorage')!
    expect(nested.props('ownerId')).toBe(8)
    expect(api.pageBasicData).toHaveBeenCalledWith(
      'lineProcessStorage',
      expect.objectContaining({ productionLineId: 8 }),
    )
    await button(nested, '新增').trigger('click')
    await flushPromises()
    expect(button(page, '关闭').props('disabled')).toBe(true)
    expect(page.findAllComponents(TabPane).every((tab) => tab.props('disabled'))).toBe(true)
    await button(nested, '取消').trigger('click')
    await flushPromises()
    expect(button(page, '关闭').props('disabled')).toBe(false)
  })

  for (const [type, key] of [
    ['resourceLine', 'resourceCode'],
    ['lineProcessStorage', 'mainProcessCode'],
  ] as const)
    it(`${type} 按编码/产线查询及时间排序`, async () => {
      const grid = keep(
        mount(BasicDataGrid, { props: { type, ownerId: 3, embedded: true }, ...options }),
      )
      await flushPromises()
      await grid.find('input[aria-label="查询关键字"]').setValue(' 0001 ')
      await button(grid, '查询').trigger('click')
      await flushPromises()
      expect(api.pageBasicData).toHaveBeenLastCalledWith(
        type,
        expect.objectContaining({ productionLineId: 3, [key]: '0001', page: 1 }),
      )
      const table = grid.findComponent(ResizableTable)
      expect(
        table
          .props('columns')
          .filter((column) => column.sorter)
          .map((column) => column.key),
      ).toEqual(['createdTime', 'updatedTime'])
      table.vm.$emit(
        'change',
        { current: 1, pageSize: 20 },
        {},
        { columnKey: 'updatedTime', order: 'descend' },
        { action: 'sort' },
      )
      await flushPromises()
      expect(api.pageBasicData).toHaveBeenLastCalledWith(
        type,
        expect.objectContaining({ productionLineId: 3, sortBy: 'updatedTime', sortOrder: 'DESC' }),
      )
    })

  it('更新保留文本编码和 false、备注清空、所属产线锁定及防重复提交', async () => {
    let finish!: (value: DataRecord) => void
    vi.mocked(api.saveBasicData).mockReturnValue(
      new Promise((resolve) => {
        finish = resolve
      }),
    )
    const editor = keep(
      mount(BasicDataEditor, { props: { type: 'resourceLine', id: 8, ownerId: 3 }, ...options }),
    )
    await flushPromises()
    expect(editor.findComponent(ReferenceInput).props()).toMatchObject({
      value: 3,
      target: 'line',
      disabled: true,
    })
    editor.findComponent(Switch).vm.$emit('update:checked', false)
    await editor.find('textarea').setValue('')
    await button(editor, '保存').trigger('click')
    await button(editor, '保存').trigger('click')
    await flushPromises()
    expect(api.saveBasicData).toHaveBeenCalledTimes(1)
    expect(api.saveBasicData).toHaveBeenCalledWith(
      'resourceLine',
      { productionLineId: 3, resourceCode: '0001', enabled: false, remark: null },
      row,
    )
    expect(button(editor, '保存').props('loading')).toBe(true)
    finish(row)
    await flushPromises()
    expect(editor.emitted('saved')).toHaveLength(1)
  })

  it('配送区可选择存储区，不擅自加区域限制，新增固定所属产线', async () => {
    const editor = keep(
      mount(BasicDataEditor, { props: { type: 'lineProcessStorage', ownerId: 3 }, ...options }),
    )
    await flushPromises()
    const storage = editor
      .findAllComponents(ReferenceInput)
      .find((input) => input.props('target') === 'storage')!
    expect(storage.props('areaId')).toBeUndefined()
    storage.vm.$emit('update:value', 9)
    await editor.find('input[aria-label="主工序编码"]').setValue('0002')
    await button(editor, '保存').trigger('click')
    await flushPromises()
    expect(api.saveBasicData).toHaveBeenCalledWith(
      'lineProcessStorage',
      { productionLineId: 3, mainProcessCode: '0002', storageZoneId: 9, enabled: true },
      undefined,
    )
    expect(buildRequest('lineProcessStorage', { productionLineId: 99 }, 3).productionLineId).toBe(3)
  })

  it('跨产线记录拒绝编辑，冲突保留输入并锁定旧版本', async () => {
    const wrong = keep(
      mount(BasicDataEditor, { props: { type: 'resourceLine', id: 8, ownerId: 4 }, ...options }),
    )
    await flushPromises()
    expect(wrong.text()).toContain('记录归属已改变')
    expect(button(wrong, '保存').props('disabled')).toBe(true)
    vi.mocked(api.saveBasicData).mockRejectedValue(new ApiError(CONFLICT_MESSAGE))
    const editor = keep(
      mount(BasicDataEditor, { props: { type: 'resourceLine', id: 8, ownerId: 3 }, ...options }),
    )
    await flushPromises()
    await editor.find('input[aria-label="资源编码"]').setValue('0009')
    await button(editor, '保存').trigger('click')
    await flushPromises()
    expect(editor.text()).toContain(CONFLICT_MESSAGE)
    expect((editor.find('input[aria-label="资源编码"]').element as HTMLInputElement).value).toBe(
      '0009',
    )
    expect(button(editor, '保存').props('disabled')).toBe(true)
  })

  for (const type of ['resourceLine', 'lineProcessStorage'] as ObjectType[])
    it(`${type} 批量删除失败保留选择`, async () => {
      vi.mocked(api.deleteBasicData).mockRejectedValue(new ApiError(CONFLICT_MESSAGE))
      const grid = keep(
        mount(BasicDataGrid, { props: { type, ownerId: 3, embedded: true }, ...options }),
      )
      await flushPromises()
      const table = grid.findComponent(ResizableTable).findComponent(Table)
      table.props('rowSelection')!.onChange!([8], [row])
      await flushPromises()
      await button(grid, '批量删除').trigger('click')
      await flushPromises()
      await button(grid, '确认删除').trigger('click')
      await flushPromises()
      expect(api.deleteBasicData).toHaveBeenCalledWith(type, [row], true)
      expect(table.props('rowSelection')!.selectedRowKeys).toEqual([8])
      expect(button(grid, '确认删除').props('disabled')).toBe(true)
    })
})
