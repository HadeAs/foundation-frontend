import type { RuntimeConnection } from '@/api/dashboard'

export const connectionStates = {
  UP: { label: '正常', color: 'success' },
  WARN: { label: '告警', color: 'warning' },
  DOWN: { label: '异常', color: 'error' },
  UNKNOWN: { label: '未知', color: 'default' },
  UNCONFIGURED: { label: '未配置', color: 'processing' },
  DISABLED: { label: '停用', color: 'default' },
} as const

export function connectionState(item: RuntimeConnection, serverNow: number, failed: boolean) {
  if (failed) return { ...connectionStates.UNKNOWN, reason: '查询失败，显示上次记录' }
  if (item.status === 'DISABLED' || item.status === 'UNCONFIGURED') {
    return { ...connectionStates[item.status], reason: '' }
  }
  const checkedAt = item.checkedAt ? Date.parse(item.checkedAt) : NaN
  if (!Number.isFinite(checkedAt)) {
    return { ...connectionStates.UNKNOWN, reason: '尚无有效检查时间' }
  }
  if (!Number.isFinite(serverNow) || serverNow - checkedAt >= item.staleAfterSeconds * 1000) {
    return { ...connectionStates.UNKNOWN, reason: '检查结果已过期' }
  }
  return { ...(connectionStates[item.status] || connectionStates.UNKNOWN), reason: '' }
}
