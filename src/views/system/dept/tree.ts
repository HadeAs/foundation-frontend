import type { SysDept } from '@/api/dept'

export type DeptNode = Omit<SysDept, 'children'> & { children?: DeptNode[] }
export type DeptOption = { value: number; title: string; children?: DeptOption[] }

export function normalizeDeptTree(depts: SysDept[]): DeptNode[] {
  return depts
    .map(({ children, ...dept }) => {
      const normalizedChildren = normalizeDeptTree(children || [])
      return { ...dept, children: normalizedChildren.length ? normalizedChildren : undefined }
    })
    .sort((left, right) => (left.sortNo || 0) - (right.sortNo || 0))
}

export function toDeptOptions(nodes: DeptNode[], excludedId?: number): DeptOption[] {
  return nodes.flatMap((node) => {
    if (node.deptId === undefined || node.deptId === excludedId) return []
    const children = toDeptOptions(node.children || [], excludedId)
    return [{
      value: node.deptId,
      title: node.deptName || node.deptCode || '未命名部门',
      children: children.length ? children : undefined,
    }]
  })
}

export function collectExpandableDeptIds(nodes: DeptNode[]): number[] {
  return nodes.flatMap((node) => [
    ...(node.deptId === undefined || !node.children?.length ? [] : [node.deptId]),
    ...collectExpandableDeptIds(node.children || []),
  ])
}

export function collectDeptNames(nodes: DeptNode[]): Map<number, string> {
  return new Map(nodes.flatMap((node) => [
    ...(node.deptId === undefined ? [] : [[node.deptId, node.deptName || node.deptCode || '未命名部门'] as const]),
    ...collectDeptNames(node.children || []),
  ]))
}
