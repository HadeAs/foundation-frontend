import { mount, flushPromises } from '@vue/test-utils'
import { Button, Form, Input, InputPassword, Modal } from 'ant-design-vue'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import * as api from '@/api/jdbc-config'
import { ApiError, CONFLICT_MESSAGE } from '@/api/http'
import JdbcConfigModal from './JdbcConfigModal.vue'

vi.mock('@/api/jdbc-config', async (original) => ({
  ...(await original<typeof api>()),
  getJdbcConfig: vi.fn(),
  saveJdbcConfig: vi.fn(),
}))
const existing = {
  configured: true,
  enabled: true,
  jdbcUrl: 'jdbc:test',
  username: 'test',
  driverClassName: 'test.Driver',
  passwordSet: true,
  version: 3,
}
const wrappers: ReturnType<typeof mount>[] = []
function create(profile: api.JdbcProfile = 'MES') {
  const wrapper = mount(JdbcConfigModal, {
    props: { profile },
    global: {
      stubs: {
        AModal: { template: '<section><slot/><footer><slot name="footer"/></footer></section>' },
      },
    },
  })
  wrappers.push(wrapper)
  return wrapper
}
function button(wrapper: ReturnType<typeof mount>, text: string) {
  return wrapper.findAllComponents(Button).find((item) => item.text().replace(/\s/g, '') === text)!
}
beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(api.getJdbcConfig).mockResolvedValue({ ...existing })
  vi.mocked(api.saveJdbcConfig).mockResolvedValue({ ...existing, version: 4 })
})
afterEach(() => {
  wrappers.splice(0).forEach((wrapper) => wrapper.unmount())
  Modal.destroyAll()
  vi.restoreAllMocks()
  document.body.innerHTML = ''
})

describe('连接配置弹窗本地 DOM', () => {
  it('查询期间禁止保存，无修改关闭不询问丢弃草稿', async () => {
    vi.mocked(api.getJdbcConfig).mockReturnValue(new Promise(() => {}))
    const confirm = vi.spyOn(Modal, 'confirm')
    const wrapper = create()
    await flushPromises()
    expect(button(wrapper, '保存').props('disabled')).toBe(true)
    await button(wrapper, '取消').trigger('click')
    await flushPromises()
    expect(confirm).not.toHaveBeenCalled()
    expect(wrapper.emitted('close')).toHaveLength(1)
  })
  it('已有配置密码不回显；留空保存不发送密码，携带当前版本', async () => {
    const wrapper = create('WMS')
    await flushPromises()
    expect(api.getJdbcConfig).toHaveBeenCalledWith('WMS')
    expect(wrapper.text()).toContain('驱动类名')
    expect(wrapper.findComponent(InputPassword).props('value')).toBe('')
    await button(wrapper, '保存').trigger('click')
    await flushPromises()
    expect(api.saveJdbcConfig).toHaveBeenCalledWith('WMS', {
      enabled: true,
      jdbcUrl: 'jdbc:test',
      username: 'test',
      driverClassName: 'test.Driver',
      version: 3,
    })
    expect(wrapper.emitted('saved')).toHaveLength(1)
    expect(wrapper.emitted('close')).toHaveLength(1)
  })
  it('首次保存必须有密码，提交密码保留空格且不发送版本', async () => {
    vi.mocked(api.getJdbcConfig).mockResolvedValue({ configured: false })
    const wrapper = create()
    await flushPromises()
    const form = wrapper.findComponent(Form).props('model')!
    Object.assign(form, { jdbcUrl: 'jdbc:new', username: 'new', driverClassName: 'new.Driver' })
    await button(wrapper, '保存').trigger('click')
    await flushPromises()
    expect(api.saveJdbcConfig).not.toHaveBeenCalled()
    wrapper.findComponent(InputPassword).vm.$emit('update:value', ' test password ')
    await button(wrapper, '保存').trigger('click')
    await flushPromises()
    expect(api.saveJdbcConfig).toHaveBeenCalledWith('MES', {
      enabled: false,
      jdbcUrl: 'jdbc:new',
      username: 'new',
      driverClassName: 'new.Driver',
      password: ' test password ',
    })
  })
  it('驱动类名为空时阻止保存，填写后可提交', async () => {
    vi.mocked(api.getJdbcConfig).mockResolvedValue({ configured: false })
    const wrapper = create()
    await flushPromises()
    const form = wrapper.findComponent(Form).props('model')!
    Object.assign(form, { jdbcUrl: 'jdbc:new', username: 'new', password: 'password' })
    await button(wrapper, '保存').trigger('click')
    await flushPromises()
    expect(wrapper.text()).toContain('请输入驱动类名')
    expect(api.saveJdbcConfig).not.toHaveBeenCalled()
    form.driverClassName = 'new.Driver'
    await button(wrapper, '保存').trigger('click')
    await flushPromises()
    expect(api.saveJdbcConfig).toHaveBeenCalledWith(
      'MES',
      expect.objectContaining({ driverClassName: 'new.Driver' }),
    )
  })
  it('加载失败不展示空白可保存表单，支持重试', async () => {
    vi.mocked(api.getJdbcConfig).mockRejectedValueOnce(new ApiError('运行密钥不可用'))
    const wrapper = create()
    await flushPromises()
    expect(wrapper.text()).toContain('运行密钥不可用')
    expect(wrapper.findComponent(Form).exists()).toBe(false)
    expect(button(wrapper, '保存').props('disabled')).toBe(true)
    await button(wrapper, '重试').trigger('click')
    await flushPromises()
    expect(wrapper.findComponent(Form).exists()).toBe(true)
  })
  it('保存期间锁定提交和关闭，冲突保留输入并阻止重复保存', async () => {
    let rejectSave!: (error: Error) => void
    vi.mocked(api.saveJdbcConfig).mockImplementation(
      () =>
        new Promise((_, reject) => {
          rejectSave = reject
        }),
    )
    const wrapper = create()
    await flushPromises()
    wrapper.findComponent(InputPassword).vm.$emit('update:value', 'new password')
    await button(wrapper, '保存').trigger('click')
    await flushPromises()
    expect(button(wrapper, '保存').props('loading')).toBe(true)
    expect(button(wrapper, '取消').props('disabled')).toBe(true)
    wrapper.findComponent(Modal).vm.$emit('cancel')
    await button(wrapper, '保存').trigger('click')
    expect(wrapper.emitted('close')).toBeUndefined()
    expect(api.saveJdbcConfig).toHaveBeenCalledOnce()
    rejectSave(new ApiError(CONFLICT_MESSAGE))
    await flushPromises()
    expect(wrapper.findComponent(InputPassword).props('value')).toBe('new password')
    expect(button(wrapper, '保存').props('disabled')).toBe(true)
    const confirm = vi
      .spyOn(Modal, 'confirm')
      .mockReturnValue({ destroy: vi.fn(), update: vi.fn() })
    await button(wrapper, '重新加载').trigger('click')
    expect(api.getJdbcConfig).toHaveBeenCalledOnce()
    await confirm.mock.calls[0]![0].onOk!()
    await flushPromises()
    expect(wrapper.findComponent(InputPassword).props('value')).toBe('')
    expect(button(wrapper, '保存').props('disabled')).toBe(false)
  })
  it('普通保存错误保留草稿可重试；关闭需要确认，销毁后密码清空', async () => {
    vi.mocked(api.saveJdbcConfig).mockRejectedValueOnce(new ApiError('没有保存权限'))
    const wrapper = create()
    await flushPromises()
    wrapper.findComponent(Input).vm.$emit('update:value', 'jdbc:changed')
    wrapper.findComponent(InputPassword).vm.$emit('update:value', 'temporary')
    const form = wrapper.findComponent(Form).props('model')!
    await button(wrapper, '保存').trigger('click')
    await flushPromises()
    expect(form.password).toBe('temporary')
    expect(form.jdbcUrl).toBe('jdbc:changed')
    expect(button(wrapper, '保存').props('disabled')).toBe(false)
    const confirm = vi
      .spyOn(Modal, 'confirm')
      .mockReturnValue({ destroy: vi.fn(), update: vi.fn() })
    await button(wrapper, '取消').trigger('click')
    expect(confirm).toHaveBeenCalled()
    wrapper.unmount()
    wrappers.pop()
    expect(form.password).toBe('')
  })
})
