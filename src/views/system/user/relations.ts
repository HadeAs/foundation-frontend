import type { SysUser } from '@/api/user'

export function getUserDepartmentText(user: SysUser) {
  return user.department?.deptName || user.department?.deptCode || (user.deptId ? `部门 ${user.deptId}` : '')
}

export function getUserRoleIds(user: SysUser) {
  return user.roles.flatMap((role) => role.roleId === undefined ? [] : [role.roleId])
}

export function getUserRoleText(user: SysUser) {
  return user.roles.map((role) => role.roleName || role.roleCode).filter(Boolean).join('、')
}
