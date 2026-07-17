import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'

import ResizableHeaderCell from './ResizableHeaderCell.vue'

describe('ResizableHeaderCell', () => {
  it('supports keyboard resizing and respects the minimum width', async () => {
    const resized: number[] = []
    const wrapper = mount(ResizableHeaderCell, {
      props: {
        width: 100,
        minWidth: 90,
        onColumnResize: (width) => resized.push(width),
      },
      slots: { default: '菜单名称' },
    })
    const handle = wrapper.get('[role="separator"]')

    await handle.trigger('keydown', { key: 'ArrowRight' })
    await handle.trigger('keydown', { key: 'ArrowLeft' })
    await wrapper.setProps({ width: 90 })
    await handle.trigger('keydown', { key: 'ArrowLeft' })

    expect(resized).toEqual([110, 90, 90])
  })
})
