import { flushPromises, mount } from '@vue/test-utils'
import { Form, message } from 'ant-design-vue'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'

import Login from './index.vue'

const mocks = vi.hoisted(() => ({ login: vi.fn(), replace: vi.fn(), sync: vi.fn() }))
vi.mock('@/stores/auth', () => ({
  useAuthStore: () => ({ login: mocks.login, user: { menus: [] } }),
}))
vi.mock('vue-router', () => ({
  useRoute: () => ({ query: { redirect: '/dashboard' } }),
  useRouter: () => ({ replace: mocks.replace }),
}))
vi.mock('@/router/dynamic', () => ({
  syncDynamicRoutes: mocks.sync,
  getFirstAccessiblePath: () => '/dashboard',
}))

beforeEach(() => vi.clearAllMocks())
afterEach(() => vi.restoreAllMocks())

it('显示精简登录表单，保留自动填充和必填校验', async () => {
  const wrapper = mount(Login)
  try {
    expect(wrapper.get('h1').text()).toBe('南瑞生产中心物流管理系统')
    expect(wrapper.findAll('input')).toHaveLength(2)
    expect(wrapper.find('input[autocomplete="username"]').exists()).toBe(true)
    expect(wrapper.get('input[autocomplete="current-password"]').attributes('type')).toBe(
      'password',
    )
    expect(wrapper.get('button[type="submit"]').text().replace(/\s/g, '')).toBe('登录')
    expect(wrapper.text()).not.toMatch(/欢迎回来|安全登录|系统就绪|会话保护|统一权限/)
    await wrapper.get('form').trigger('submit')
    await flushPromises()
    expect(mocks.login).not.toHaveBeenCalled()
  } finally {
    wrapper.unmount()
  }
})

it('请求中禁用并转圈，阻止重复提交且成功后保留原跳转', async () => {
  let complete!: () => void
  mocks.login.mockImplementation(
    () =>
      new Promise<void>((resolve) => {
        complete = resolve
      }),
  )
  const wrapper = mount(Login)
  try {
    await wrapper.get('input[autocomplete="username"]').setValue('planner')
    await wrapper.get('input[autocomplete="current-password"]').setValue('example-password')
    wrapper.getComponent(Form).vm.$emit('finish')
    await flushPromises()
    expect(wrapper.get('button[type="submit"]').attributes('disabled')).toBeDefined()
    expect(wrapper.get('button[type="submit"]').classes()).toContain('ant-btn-loading')
    wrapper.getComponent(Form).vm.$emit('finish')
    expect(mocks.login).toHaveBeenCalledTimes(1)
    expect(mocks.login).toHaveBeenCalledWith({ username: 'planner', password: 'example-password' })
    complete()
    await flushPromises()
    expect(mocks.sync).toHaveBeenCalled()
    expect(mocks.replace).toHaveBeenCalledWith('/dashboard')
    expect(wrapper.get('button[type="submit"]').attributes('disabled')).toBeUndefined()
  } finally {
    wrapper.unmount()
  }
})

it('登录失败保留输入并展示错误消息', async () => {
  mocks.login.mockRejectedValue(new Error('用户名或密码错误'))
  const error = vi
    .spyOn(message, 'error')
    .mockImplementation(() => (() => {}) as ReturnType<typeof message.error>)
  const wrapper = mount(Login)
  try {
    await wrapper.get('input[autocomplete="username"]').setValue('planner')
    await wrapper.get('input[autocomplete="current-password"]').setValue('example-password')
    wrapper.getComponent(Form).vm.$emit('finish')
    await flushPromises()
    expect(error).toHaveBeenCalled()
    expect((wrapper.get('input[autocomplete="username"]').element as HTMLInputElement).value).toBe(
      'planner',
    )
    expect(
      (wrapper.get('input[autocomplete="current-password"]').element as HTMLInputElement).value,
    ).toBe('example-password')
    expect(mocks.replace).not.toHaveBeenCalled()
    expect(wrapper.get('button[type="submit"]').attributes('disabled')).toBeUndefined()
  } finally {
    wrapper.unmount()
  }
})
