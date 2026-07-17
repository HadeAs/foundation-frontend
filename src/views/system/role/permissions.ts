import type { SysMenu } from '@/api/menu'

export function includeAncestorMenuIds(menus: SysMenu[], selectedIds: number[]) {
  const menuById = new Map(menus.flatMap((menu) =>
    menu.menuId === undefined ? [] : [[menu.menuId, menu] as const],
  ))
  const result = new Set(selectedIds)

  for (const selectedId of selectedIds) {
    let parentId = menuById.get(selectedId)?.parentId
    const visited = new Set<number>()
    while (parentId && !visited.has(parentId)) {
      result.add(parentId)
      visited.add(parentId)
      parentId = menuById.get(parentId)?.parentId
    }
  }
  return [...result]
}
