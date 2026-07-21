import { flushPromises, mount } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import ResizableTable from './ResizableTable.vue'

class ResizeObserverMock {
  observe() {}
  disconnect() {}
}

describe('ResizableTable', () => {
  beforeEach(() => vi.stubGlobal('ResizeObserver', ResizeObserverMock))

  afterEach(() => {
    document.body.innerHTML = ''
    vi.unstubAllGlobals()
  })

  it('applies confirmed column visibility settings', async () => {
    const wrapper = mount(ResizableTable, {
      attachTo: document.body,
      props: {
        columns: [
          { title: '名称', dataIndex: 'name', key: 'name', width: 120 },
          { title: '状态', dataIndex: 'status', key: 'status', width: 90 },
          { title: '操作', key: 'action', width: 100 },
        ],
        dataSource: [],
        pagination: false,
      },
    })

    await wrapper.find('.column-settings-trigger').trigger('click')
    await flushPromises()
    const nameItem = Array.from(document.querySelectorAll<HTMLElement>('.column-settings-item'))
      .find((item) => item.textContent?.includes('名称'))
    expect(nameItem).toBeTruthy()
    nameItem!.querySelector<HTMLInputElement>('input')!.click()
    const confirm = Array.from(document.querySelectorAll<HTMLButtonElement>('.column-settings-footer button'))
      .find((button) => button.textContent?.includes('确认'))
    confirm!.click()
    await flushPromises()

    expect(wrapper.findAll('th').map((cell) => cell.text()).join()).not.toContain('名称')
    expect(wrapper.findAll('th').map((cell) => cell.text()).join()).toContain('状态')
    wrapper.unmount()
  })
})
