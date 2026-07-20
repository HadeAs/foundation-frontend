import { ref } from 'vue'
import { describe, expect, it, vi } from 'vitest'

const { confirm } = vi.hoisted(() => ({ confirm: vi.fn() }))
vi.mock('ant-design-vue', () => ({ Modal: { confirm } }))

import { useUnsavedChanges } from './use-unsaved-changes'

describe('useUnsavedChanges', () => {
  it('未修改时直接关闭，修改后要求确认', async () => {
    const open = ref(false)
    const form = { name: '原值' }
    const { requestClose } = useUnsavedChanges(form, open)
    open.value = true
    await Promise.resolve()
    await Promise.resolve()

    requestClose()
    expect(open.value).toBe(false)

    open.value = true
    await Promise.resolve()
    await Promise.resolve()
    form.name = '新值'
    requestClose()
    expect(confirm).toHaveBeenCalledTimes(1)
    expect(open.value).toBe(true)
  })
})
