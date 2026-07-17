import { describe, expect, it } from 'vitest'

import { moveDictItem } from './order'

describe('dictionary item ordering', () => {
  const items = [
    { dictItemId: 1, itemLabel: '一', sortNo: 10 },
    { dictItemId: 2, itemLabel: '二', sortNo: 20 },
    { dictItemId: 3, itemLabel: '三', sortNo: 30 },
  ]

  it('moves an item and recalculates stable sort numbers', () => {
    const moved = moveDictItem(items, 2, -1)
    expect(moved.map((item) => item.dictItemId)).toEqual([2, 1, 3])
    expect(moved.map((item) => item.sortNo)).toEqual([10, 20, 30])
    expect(moveDictItem(items, 1, -1)).toBe(items)
  })
})
