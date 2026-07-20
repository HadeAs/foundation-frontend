import { describe, expect, it, vi } from 'vitest'

import { useTablePagination } from './use-table-pagination'

describe('useTablePagination', () => {
  it('切换页码时保留页容量，切换页容量时回到第一页', () => {
    const load = vi.fn()
    const state = useTablePagination(load)
    state.handleTableChange({ current: 3, pageSize: 20 })
    expect(state.currentPage.value).toBe(3)

    state.handleTableChange({ current: 3, pageSize: 50 })
    expect(state.currentPage.value).toBe(1)
    expect(state.pageSize.value).toBe(50)
    expect(load).toHaveBeenCalledTimes(2)
  })
})
