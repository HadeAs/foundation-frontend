import type { SysDictItem } from '@/api/dict'

export function moveDictItem(items: SysDictItem[], dictItemId: number, offset: -1 | 1) {
  const index = items.findIndex((item) => item.dictItemId === dictItemId)
  const target = index + offset
  if (index < 0 || target < 0 || target >= items.length) return items

  const next = [...items]
  const [item] = next.splice(index, 1)
  if (!item) return items
  next.splice(target, 0, item)
  return next.map((current, position) => ({ ...current, sortNo: (position + 1) * 10 }))
}
