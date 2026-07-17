import { describe, expect, it } from 'vitest'

import { collectDeptNames, collectExpandableDeptIds, normalizeDeptTree, toDeptOptions } from './tree'

describe('department tree helpers', () => {
  const tree = normalizeDeptTree([
    {
      deptId: 1,
      deptCode: 'HQ',
      deptName: '总部',
      sortNo: 2,
      children: [{ deptId: 2, parentId: 1, deptCode: 'IT', deptName: '信息部', sortNo: 1 }],
    },
    { deptId: 3, deptCode: 'FACTORY', deptName: '工厂', sortNo: 1 },
  ])

  it('sorts the tree and excludes the edited branch from parent options', () => {
    expect(collectExpandableDeptIds(tree)).toEqual([1])
    expect(toDeptOptions(tree, 1)).toEqual([{ value: 3, title: '工厂', children: undefined }])
  })

  it('collects names from every department level', () => {
    expect([...collectDeptNames(tree)]).toEqual([[3, '工厂'], [1, '总部'], [2, '信息部']])
  })
})
