import { describe, expect, it } from 'vitest'

import type { SysUser } from '@/api/user'

import { getUserDepartmentText, getUserRoleIds, getUserRoleText } from './relations'

describe('用户关联摘要', () => {
  it('直接读取查询接口返回的部门和多个角色', () => {
    const user = {
      roles: [
        { roleId: 1, roleName: '系统管理员' },
        { roleId: 2, roleCode: 'AUDITOR' },
      ],
      department: { deptId: 3, deptName: '技术中心' },
    } satisfies SysUser

    expect(getUserDepartmentText(user)).toBe('技术中心')
    expect(getUserRoleIds(user)).toEqual([1, 2])
    expect(getUserRoleText(user)).toBe('系统管理员、AUDITOR')
  })

  it('未分配关联资源时返回空值', () => {
    const user = { roles: [] } satisfies SysUser
    expect(getUserDepartmentText(user)).toBe('')
    expect(getUserRoleIds(user)).toEqual([])
    expect(getUserRoleText(user)).toBe('')
  })
})
