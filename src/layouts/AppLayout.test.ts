import { mount } from '@vue/test-utils'
import { createPinia } from 'pinia'
import { createMemoryHistory, createRouter } from 'vue-router'
import { expect, it } from 'vitest'

import logisticsLogo from '@/assets/logistics-logo.png'
import AppLayout from './AppLayout.vue'

it('shows the logistics brand and preserves it through repeated sidebar toggles', async () => {
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [{ path: '/', component: { template: '<div />' } }],
  })
  await router.push('/')
  await router.isReady()
  const wrapper = mount(AppLayout, {
    global: {
      plugins: [createPinia(), router],
      stubs: { PageTabs: true, ThemePanel: true, ChangePasswordModal: true },
    },
  })
  try {
    expect(wrapper.get('.brand-title').text()).toBe('物流管理系统')
    expect(wrapper.get('.brand-logo').attributes('src')).toBe(logisticsLogo)
    for (let i = 0; i < 3; i++) {
      await wrapper.get('.collapse-button').trigger('click')
      expect(wrapper.get('.shell-brand').classes()).toContain('collapsed')
      expect(wrapper.get('.brand-title').attributes('aria-hidden')).toBe('true')
      expect(wrapper.get('.brand-logo').attributes('alt')).toBe('物流管理系统')
      await wrapper.get('.collapse-button').trigger('click')
      expect(wrapper.get('.shell-brand').classes()).not.toContain('collapsed')
      expect(wrapper.get('.brand-title').attributes('aria-hidden')).toBe('false')
      expect(wrapper.get('.brand-title').text()).toBe('物流管理系统')
    }
  } finally {
    wrapper.unmount()
  }
})
