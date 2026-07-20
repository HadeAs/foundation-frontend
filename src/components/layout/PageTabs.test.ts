import { flushPromises, mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { nextTick } from 'vue'
import { createMemoryHistory, createRouter } from 'vue-router'
import { afterEach, describe, expect, it } from 'vitest'

import { useTabsStore } from '@/stores/tabs'

import PageTabs from './PageTabs.vue'

describe('PageTabs', () => {
  afterEach(() => {
    document.body.innerHTML = ''
    sessionStorage.clear()
  })

  it('opens tab actions on right click and applies them to that tab', async () => {
    const pinia = createPinia()
    setActivePinia(pinia)
    const router = createRouter({
      history: createMemoryHistory(),
      routes: [
        { path: '/dashboard', component: { template: '<div />' } },
        { path: '/system/user', component: { template: '<div />' } },
        { path: '/system/role', component: { template: '<div />' } },
      ],
    })
    const tabs = useTabsStore()
    tabs.add({ path: '/dashboard', title: '工作台', routeName: 'dashboard', fixed: true })
    tabs.add({ path: '/system/user', title: '用户管理', routeName: 'user' })
    tabs.add({ path: '/system/role', title: '角色管理', routeName: 'role' })
    await router.push('/system/role')
    await router.isReady()

    const wrapper = mount(PageTabs, { attachTo: document.body, global: { plugins: [pinia, router] } })
    await wrapper.findAll('.page-tab')[1]!.trigger('contextmenu')
    await nextTick()

    const closeRight = Array.from(document.querySelectorAll<HTMLElement>('.ant-dropdown-menu-item'))
      .find((item) => item.textContent?.includes('关闭右侧'))
    expect(closeRight).toBeTruthy()
    closeRight!.click()
    await flushPromises()

    expect(tabs.items.map((tab) => tab.path)).toEqual(['/dashboard', '/system/user'])
    expect(router.currentRoute.value.path).toBe('/system/user')
    wrapper.unmount()
  })
})
