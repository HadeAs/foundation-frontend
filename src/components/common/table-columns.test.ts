import type { TableColumnsType } from 'ant-design-vue'
import { describe, expect, it } from 'vitest'

import { getTableScrollWidth, isActionColumn } from './table-columns'

describe('table column behavior', () => {
  it('calculates the live scroll width and identifies the action column', () => {
    const columns: TableColumnsType = [
      { title: '名称', key: 'name', width: 180 },
      { title: '状态', key: 'status', width: 80, children: undefined },
      { title: '详情', key: 'detail', children: [{ title: '备注', key: 'remark', width: 260 }] },
      { title: '操作', key: 'action', width: 160 },
    ]

    expect(getTableScrollWidth(columns)).toBe(680)
    expect(isActionColumn(columns[3]!)).toBe(true)
    expect(isActionColumn(columns[0]!)).toBe(false)
  })
})
