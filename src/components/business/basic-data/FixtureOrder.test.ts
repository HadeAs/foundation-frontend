import { flushPromises, mount } from '@vue/test-utils'
import { Button, Modal, Switch, Table } from 'ant-design-vue'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import * as api from '@/api/basic-data'
import { ApiError, CONFLICT_MESSAGE } from '@/api/http'
import { canManageContainer } from '@/business/basic-data/container-capabilities'
import { buildRequest, sortableFields, validateDraft } from '@/business/basic-data/schema'
import ResizableTable from '@/components/common/ResizableTable.vue'
import BasicDataEditor from './BasicDataEditor.vue'
import BasicDataGrid from './BasicDataGrid.vue'
import BasicDataPage from './BasicDataPage.vue'
import ReferenceInput from './ReferenceInput.vue'

vi.mock('@/api/basic-data', async original => ({ ...await original<typeof api>(), getBasicData: vi.fn(), pageBasicData: vi.fn(), getBasicDictionaries: vi.fn(), saveBasicData: vi.fn(), deleteBasicData: vi.fn() }))
const modalStub = { props: { open: Boolean, closable: Boolean, keyboard: Boolean }, template: '<section v-if="open"><slot/><footer><slot name="footer"/></footer></section>' }
const options = { global: { stubs: { AModal: modalStub } } }
const record = { id: 10, version: 3, boxId: 1, orderNo: '0000123', enabled: true, remark: '备注' }
const wrappers: Array<{ unmount: () => void }> = []
function keep<T extends { unmount: () => void }>(value: T) { wrappers.push(value); return value }
function button(wrapper: ReturnType<typeof mount>, text: string) { return wrapper.findAllComponents(Button).find(b => b.text().replace(/\s/g, '') === text)! }
beforeEach(() => {
  vi.clearAllMocks()
  vi.stubGlobal('ResizeObserver', class { observe() {} disconnect() {} })
  vi.mocked(api.pageBasicData).mockResolvedValue({ records: [record], total: 1 })
  vi.mocked(api.getBasicDictionaries).mockResolvedValue({})
  vi.mocked(api.getBasicData).mockImplementation(async (type, id) => type === 'fixtureOrder' ? record : type === 'container' ? { id, containerModelId: 11, containerName: '治具箱' } : { id, containerCategory: 'BOX', usageType: 'FIXTURE_BOX' })
  vi.mocked(api.saveBasicData).mockResolvedValue(record)
})
afterEach(() => { wrappers.splice(0).forEach(w => w.unmount()); document.body.innerHTML = ''; vi.unstubAllGlobals(); vi.restoreAllMocks() })
describe('治具箱适用订单', () => {
  it('仅规格允许入口；装载位对其他规格及未知规格隐藏', async () => {
    expect(canManageContainer({ containerCategory: 'BOX', usageType: 'MAGAZINE', runtimeUsage: 'FIXTURE' }, 'fixtureOrder')).toBe(false)
    expect(canManageContainer(undefined, 'slot')).toBe(false)
    vi.mocked(api.pageBasicData).mockResolvedValue({ records: [{ id: 1, containerModelId: 11 }, { id: 2, containerModelId: 12 }, { id: 3, containerModelId: 13 }, { id: 4 }], total: 4 })
    vi.mocked(api.getBasicData).mockImplementation(async (_type, id) => ({ id, containerCategory: id === 11 ? 'VEHICLE_SLOT' : id === 12 ? 'VEHICLE_DIRECT' : 'BOX', usageType: 'FIXTURE_BOX' }))
    const grid = keep(mount(BasicDataGrid, { props: { type: 'container' }, ...options }))
    await flushPromises()
    expect(grid.findAllComponents(Button).filter(b => b.text() === '装载位')).toHaveLength(1)
    expect(grid.findAllComponents(Button).filter(b => b.text() === '适用订单')).toHaveLength(1)
  })
  it('当前箱查询、订单号文本及时间排序；不能按订单号排序', async () => {
    const grid = keep(mount(BasicDataGrid, { props: { type: 'fixtureOrder', ownerId: 1, embedded: true }, ...options }))
    await flushPromises()
    expect(api.pageBasicData).toHaveBeenCalledWith('fixtureOrder', expect.objectContaining({ boxId: 1 }))
    await grid.find('input[aria-label="查询关键字"]').setValue('0000123')
    await button(grid, '查询').trigger('click'); await flushPromises()
    expect(api.pageBasicData).toHaveBeenLastCalledWith('fixtureOrder', expect.objectContaining({ boxId: 1, orderNo: '0000123' }))
    const columns = grid.findComponent(ResizableTable).props('columns')
    expect(columns.filter(c => c.sorter).map(c => c.key)).toEqual(['createdTime', 'updatedTime'])
    expect(sortableFields('fixtureOrder')).not.toContain('orderNo')
  })
  it('父级只读，前导零与 false 保留，清空备注 null，资格复核与提交锁', async () => {
    let finish!: (value: typeof record) => void
    vi.mocked(api.saveBasicData).mockReturnValue(new Promise(resolve => { finish = resolve }))
    const editor = keep(mount(BasicDataEditor, { props: { type: 'fixtureOrder', id: 10, ownerId: 1 }, ...options }))
    await flushPromises()
    expect(editor.findComponent(ReferenceInput).props()).toMatchObject({ value: 1, disabled: true })
    editor.findComponent(Switch).vm.$emit('update:checked', false)
    await editor.find('textarea').setValue('')
    const save = button(editor, '保存')
    await save.trigger('click'); await save.trigger('click'); await flushPromises()
    expect(api.getBasicData).toHaveBeenCalledWith('model', 11)
    expect(api.saveBasicData).toHaveBeenCalledTimes(1)
    expect(api.saveBasicData).toHaveBeenCalledWith('fixtureOrder', { boxId: 1, orderNo: '0000123', enabled: false, remark: null }, record)
    expect(save.props('loading')).toBe(true)
    await button(editor, '取消').trigger('click'); expect(editor.emitted('close')).toBeUndefined()
    finish(record); await flushPromises(); expect(editor.emitted('saved')).toHaveLength(1)
    expect(buildRequest('fixtureOrder', { ...record, boxId: 99 }, 1).boxId).toBe(1)
    expect(validateDraft('fixtureOrder', { boxId: 1, enabled: true, orderNo: 'x'.repeat(129) }).orderNo).toBeTruthy()
    expect(validateDraft('fixtureOrder', { boxId: 1, enabled: false, orderNo: '0001', remark: 'x'.repeat(501) }).remark).toBeTruthy()
  })
  it('业务拒绝/冲突保留草稿，冲突禁止旧版本再提交；草稿关闭需确认', async () => {
    vi.mocked(api.saveBasicData).mockRejectedValue(new ApiError(CONFLICT_MESSAGE))
    const editor = keep(mount(BasicDataEditor, { props: { type: 'fixtureOrder', id: 10, ownerId: 1 }, ...options }))
    await flushPromises()
    await editor.find('input[aria-label="生产订单号"]').setValue('0000999')
    await button(editor, '保存').trigger('click'); await flushPromises()
    expect(editor.text()).toContain(CONFLICT_MESSAGE)
    expect((editor.find('input[aria-label="生产订单号"]').element as HTMLInputElement).value).toBe('0000999')
    expect(button(editor, '保存').props('disabled')).toBe(true)
    const confirm = vi.spyOn(Modal, 'confirm').mockReturnValue({ destroy: vi.fn(), update: vi.fn() })
    await button(editor, '取消').trigger('click')
    expect(confirm).toHaveBeenCalledWith(expect.objectContaining({ title: '放弃未保存的修改？' }))
    expect(editor.emitted('close')).toBeUndefined()
  })
  it('跨箱记录拒绝编辑，保存前治具资格改变时禁止写入', async () => {
    const wrongOwner = keep(mount(BasicDataEditor, { props: { type: 'fixtureOrder', id: 10, ownerId: 2 }, ...options }))
    await flushPromises(); expect(wrongOwner.text()).toContain('记录归属已改变')
    const editor = keep(mount(BasicDataEditor, { props: { type: 'fixtureOrder', id: 10, ownerId: 1 }, ...options }))
    await flushPromises()
    vi.mocked(api.getBasicData).mockImplementation(async (type, id) => type === 'container' ? { id, containerModelId: 11 } : { id, containerCategory: 'BOX', usageType: 'MAGAZINE' })
    await button(editor, '保存').trigger('click'); await flushPromises()
    expect(api.saveBasicData).not.toHaveBeenCalled(); expect(editor.text()).toContain('仅专用治具箱')
  })
  it('批量删除携带所选版本，冲突不移除行且不丢选择', async () => {
    vi.mocked(api.deleteBasicData).mockRejectedValue(new ApiError(CONFLICT_MESSAGE))
    const grid = keep(mount(BasicDataGrid, { props: { type: 'fixtureOrder', ownerId: 1, embedded: true }, ...options }))
    await flushPromises()
    const table = grid.findComponent(ResizableTable).findComponent(Table)
    table.props('rowSelection')!.onChange!([10], [record]); await flushPromises()
    await button(grid, '批量删除').trigger('click'); await flushPromises()
    await button(grid, '确认删除').trigger('click'); await flushPromises()
    expect(api.deleteBasicData).toHaveBeenCalledWith('fixtureOrder', [record], true)
    expect(grid.text()).toContain(CONFLICT_MESSAGE)
    expect(table.props('rowSelection')!.selectedRowKeys).toEqual([10])
    expect(button(grid, '确认删除').props('disabled')).toBe(true)
  })
  it('嵌入子弹窗打开期间不可关闭父管理弹窗', async () => {
    const page = keep(mount(BasicDataPage, { props: { type: 'container' }, ...options }))
    await flushPromises()
    page.findComponent(BasicDataGrid).vm.$emit('manage', { id: 1, containerName: '治具箱' }, 'fixtureOrder')
    await flushPromises()
    const nested = page.findAllComponents(BasicDataGrid).find(grid => grid.props('type') === 'fixtureOrder')!
    expect(nested.props('ownerId')).toBe(1)
    nested.vm.$emit('childOpen', true); await flushPromises()
    expect(button(page, '关闭').props('disabled')).toBe(true)
    nested.vm.$emit('childOpen', false); await flushPromises()
    expect(button(page, '关闭').props('disabled')).toBe(false)
  })
})
