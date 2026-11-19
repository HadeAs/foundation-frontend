import { mount, flushPromises } from '@vue/test-utils'
import { Button, Input, Modal, Select } from 'ant-design-vue'
import { defineComponent, ref } from 'vue'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ApiError, CONFLICT_MESSAGE } from '@/api/http'
import * as api from '@/api/long-token'
import ResizableTable from '@/components/common/ResizableTable.vue'
import LongTokenEditor from '@/components/system/long-token/LongTokenEditor.vue'
import LongTokenSecret from '@/components/system/long-token/LongTokenSecret.vue'
import Page from './index.vue'

vi.mock('@/api/long-token', async (original) => ({
  ...(await original<typeof api>()),
  getLongTokenScopes: vi.fn(),
  pageLongTokens: vi.fn(),
  revokeLongToken: vi.fn(),
}))
const scopes = [
  { scopeCode: 'one', name: '范围一', description: '' },
  { scopeCode: 'two', name: '范围二', description: '' },
]
const record: api.LongTokenMetadata = {
  tokenId: '001',
  scopeCode: 'one',
  name: 'scanner',
  enabled: true,
  version: 8,
  authorizationVersion: 3,
  apiCodes: ['report'],
}
const options = {
  global: {
    stubs: {
      ResizableTable: {
        props: ['columns', 'dataSource', 'pagination'],
        template:
          '<section><article v-for="record in dataSource"><span>{{ record.name }}</span><div v-for="column in columns"><slot name="bodyCell" :column="column" :record="record"/></div></article><slot v-if="!dataSource.length" name="emptyText"/></section>',
      },
      AModal: {
        props: ['open', 'confirmLoading', 'okButtonProps'],
        template: '<section v-if="open"><slot/></section>',
      },
      LongTokenEditor: true,
      LongTokenSecret: true,
    },
  },
}
const wrappers: ReturnType<typeof mount>[] = []
function create() {
  const wrapper = mount(Page, options)
  wrappers.push(wrapper)
  return wrapper
}
function button(wrapper: ReturnType<typeof mount>, label: string) {
  return wrapper.findAllComponents(Button).find((item) => item.text().replace(/\s/g, '') === label)!
}
beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(api.getLongTokenScopes).mockResolvedValue(scopes)
  vi.mocked(api.pageLongTokens).mockImplementation(async (query) => ({
    records: [{ ...record, scopeCode: query.scopeCode }],
    total: 30,
  }))
  vi.mocked(api.revokeLongToken).mockResolvedValue(undefined)
})
afterEach(() => {
  wrappers.splice(0).forEach((wrapper) => wrapper.unmount())
  vi.restoreAllMocks()
})
describe('长期 Token 管理页', () => {
  it('后端范围驱动查询；筛选、分页、刷新使用已应用条件，重置清空关键词状态', async () => {
    const wrapper = create()
    await flushPromises()
    expect(api.pageLongTokens).toHaveBeenLastCalledWith({
      scopeCode: 'one',
      page: 1,
      size: 20,
      keyword: '',
      enabled: undefined,
    })
    wrapper.findComponent(Input).vm.$emit('update:value', ' scanner ')
    wrapper.getComponent(Select).vm.$emit('update:value', 'false')
    await button(wrapper, '查询').trigger('click')
    await flushPromises()
    expect(api.pageLongTokens).toHaveBeenLastCalledWith(
      expect.objectContaining({ keyword: 'scanner', enabled: false, page: 1 }),
    )
    wrapper.findComponent(Input).vm.$emit('update:value', 'unapplied')
    wrapper.findComponent(ResizableTable).vm.$emit('change', { current: 2, pageSize: 20 })
    await flushPromises()
    expect(api.pageLongTokens).toHaveBeenLastCalledWith(
      expect.objectContaining({ keyword: 'scanner', page: 2 }),
    )
    await button(wrapper, '刷新').trigger('click')
    await flushPromises()
    expect(api.pageLongTokens).toHaveBeenLastCalledWith(
      expect.objectContaining({ keyword: 'scanner', page: 2 }),
    )
    await button(wrapper, '重置').trigger('click')
    await flushPromises()
    expect(api.pageLongTokens).toHaveBeenLastCalledWith(
      expect.objectContaining({ keyword: '', enabled: undefined, page: 1 }),
    )
    const tableColumns = wrapper.findComponent(ResizableTable).props('columns')
    expect(tableColumns.some((column) => column.key === 'scopeName')).toBe(false)
    expect(tableColumns.some((column) => column.sorter)).toBe(false)
  })
  it('多个范围时无范围选择器，列表和创建均使用后端首项', async () => {
    vi.mocked(api.getLongTokenScopes).mockResolvedValue([...scopes].reverse())
    const wrapper = create()
    await flushPromises()
    expect(wrapper.findAllComponents(Select)).toHaveLength(1)
    expect(wrapper.getComponent(Select).attributes('aria-label')).toBe('Token 状态')
    expect(api.pageLongTokens).toHaveBeenCalledWith(expect.objectContaining({ scopeCode: 'two' }))
    await button(wrapper, '创建Token').trigger('click')
    expect(wrapper.getComponent(LongTokenEditor).props('scope')).toEqual(scopes[1])
  })
  it('范围加载失败与空范围不会创建无效 Token', async () => {
    vi.mocked(api.getLongTokenScopes).mockRejectedValueOnce(new ApiError('未部署长期 Token 接口'))
    const wrapper = create()
    await flushPromises()
    expect(wrapper.text()).toContain('加载失败')
    expect(button(wrapper, '创建Token').props('disabled')).toBe(true)
    expect(api.pageLongTokens).not.toHaveBeenCalled()
    vi.mocked(api.getLongTokenScopes).mockResolvedValue([])
    await button(wrapper, '重新加载').trigger('click')
    await flushPromises()
    expect(wrapper.text()).toContain('暂无可用接入范围')
    expect(button(wrapper, '创建Token').props('disabled')).toBe(true)
  })
  it('停用需确认与版本；请求期间防重复，冲突后禁止重发', async () => {
    let reject!: (value: unknown) => void
    vi.mocked(api.revokeLongToken).mockReturnValue(
      new Promise((_, fail) => {
        reject = fail
      }),
    )
    const wrapper = create()
    await flushPromises()
    await button(wrapper, '停用').trigger('click')
    expect(api.revokeLongToken).not.toHaveBeenCalled()
    const modal = wrapper.findComponent(Modal)
    modal.vm.$emit('ok')
    await flushPromises()
    expect(modal.props('confirmLoading')).toBe(true)
    modal.vm.$emit('ok')
    modal.vm.$emit('cancel')
    await flushPromises()
    expect(api.revokeLongToken).toHaveBeenCalledOnce()
    expect(api.revokeLongToken).toHaveBeenCalledWith(
      expect.objectContaining({ tokenId: '001', version: 8 }),
    )
    reject(new ApiError(CONFLICT_MESSAGE))
    await flushPromises()
    expect(modal.props('okButtonProps')!.disabled).toBe(true)
    expect(wrapper.text()).toContain(CONFLICT_MESSAGE)
  })
  it('已停用或无版本行不能写入，没有删除/重新启用入口', async () => {
    vi.mocked(api.pageLongTokens).mockResolvedValue({
      records: [{ ...record, enabled: false }],
      total: 1,
    })
    const wrapper = create()
    await flushPromises()
    expect(button(wrapper, '停用').props('disabled')).toBe(true)
    expect(button(wrapper, '接口授权').props('disabled')).toBe(true)
    expect(wrapper.text()).not.toContain('删除')
    expect(wrapper.findAllComponents(Button).some((item) => item.text() === '启用')).toBe(false)
  })
  it('创建明文不进入列表，切换标签页时清空且缓存激活后不恢复', async () => {
    const visible = ref(true)
    const Harness = defineComponent({
      components: { Page },
      setup: () => ({ visible }),
      template: '<KeepAlive><Page v-if="visible"/></KeepAlive>',
    })
    const wrapper = mount(Harness, options)
    wrappers.push(wrapper)
    await flushPromises()
    await button(wrapper, '创建Token').trigger('click')
    wrapper
      .findComponent(LongTokenEditor)
      .vm.$emit('created', { metadata: record, token: 'one-time-secret' })
    wrapper.findComponent(LongTokenEditor).vm.$emit('close')
    await flushPromises()
    expect(wrapper.findComponent(LongTokenSecret).props('token')).toBe('one-time-secret')
    expect(JSON.stringify(wrapper.findComponent(ResizableTable).props())).not.toContain(
      'one-time-secret',
    )
    visible.value = false
    await flushPromises()
    visible.value = true
    await flushPromises()
    expect(wrapper.findComponent(LongTokenSecret).exists()).toBe(false)
  })
})
