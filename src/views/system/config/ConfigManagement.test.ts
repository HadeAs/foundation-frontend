import { mount, flushPromises } from '@vue/test-utils'
import { Button, Form, MenuItem } from 'ant-design-vue'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import * as api from '@/api/config'
import ConfigManagement from './index.vue'
import JdbcConfigModal from './JdbcConfigModal.vue'

vi.mock('@/api/config', async (original) => ({
  ...(await original<typeof api>()),
  pageConfigs: vi.fn(),
  createConfig: vi.fn(),
  updateConfig: vi.fn(),
  deleteConfig: vi.fn(),
}))
const wrappers: ReturnType<typeof mount>[] = []
function create() {
  const wrapper = mount(ConfigManagement, {
    global: {
      stubs: {
        ResizableTable: {
          props: ['columns', 'dataSource'],
          template:
            '<section><article v-for="record in dataSource"><div v-for="column in columns"><slot name="bodyCell" :record="record" :column="column"/></div></article></section>',
        },
        AModal: { template: '<section><slot/></section>' },
        ADropdown: { template: '<div><slot/><slot name="overlay"/></div>' },
        JdbcConfigModal: true,
      },
    },
  })
  wrappers.push(wrapper)
  return wrapper
}
beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(api.pageConfigs).mockResolvedValue({
    records: [
      {
        configId: 1,
        configKey: 'NaRi.JdBc.MeS',
        configValue: 'must-not-display',
        editable: true,
        sensitiveFlag: false,
        version: 1,
      },
      { configId: 2, configKey: 'ordinary', configValue: 'normal', editable: true, version: 2 },
    ],
    total: 2,
  })
})
afterEach(() => wrappers.splice(0).forEach((wrapper) => wrapper.unmount()))
describe('通用系统参数受管键保护', () => {
  it('受管值掩码且不能编辑/删除，普通参数不受影响', async () => {
    const wrapper = create()
    await flushPromises()
    expect(wrapper.html()).not.toContain('must-not-display')
    const rows = wrapper.findAll('article')
    expect(rows[0]!.text()).toContain('受管')
    const managed = rows[0]!.findAllComponents(Button)
    for (const button of managed) expect(button.props('disabled')).toBe(true)
    // Even direct handler invocation cannot bypass the managed-key guard.
    managed[0]!.vm.$emit('click')
    await flushPromises()
    expect(wrapper.findComponent(Form).props('model')!.configKey).toBe('')
    const ordinary = rows[1]!.findAllComponents(Button)
    for (const button of ordinary) expect(button.props('disabled')).toBe(false)
    await ordinary[0]!.trigger('click')
    expect(wrapper.findComponent(Form).props('model')!.configKey).toBe('ordinary')
  })
  it('连接配置入口分别打开对应 profile；关闭后销毁表单', async () => {
    const wrapper = create()
    await flushPromises()
    const items = wrapper.findAllComponents(MenuItem)
    items[0]!.vm.$emit('click')
    await flushPromises()
    expect(wrapper.findComponent(JdbcConfigModal).props('profile')).toBe('MES')
    wrapper.findComponent(JdbcConfigModal).vm.$emit('close')
    await flushPromises()
    expect(wrapper.findComponent(JdbcConfigModal).exists()).toBe(false)
    items[1]!.vm.$emit('click')
    await flushPromises()
    expect(wrapper.findComponent(JdbcConfigModal).props('profile')).toBe('WMS')
  })
})
