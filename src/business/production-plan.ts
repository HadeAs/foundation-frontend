import dayjs, { type Dayjs } from 'dayjs'
import type { ProductionPlanQuery } from '@/api/production-plan'
import { formatDateTime } from '@/utils/date'

export type PlanDateRange = [Dayjs, Dayjs] | null

// Match the existing system display zone (Asia/Shanghai), including browsers in other time zones.
export function todayPlanRange(): PlanDateRange {
  const today = dayjs(formatDateTime(new Date()).slice(0, 10))
  return [today, today]
}
export function planDateQuery(range: PlanDateRange): Pick<ProductionPlanQuery, 'plannedStartTimeStart' | 'plannedStartTimeEnd'> {
  return range ? {
    plannedStartTimeStart: `${range[0].format('YYYY-MM-DD')}T00:00:00.000+08:00`,
    plannedStartTimeEnd: `${range[1].format('YYYY-MM-DD')}T23:59:59.999+08:00`,
  } : {}
}

export const planStatusOptions = [
  { value: 'PLANNED', label: '计划中（未到配送时间 / 待配送）' },
  { value: 'EXECUTING', label: '配送中' },
  { value: 'COMPLETED', label: '配送完成' },
  { value: 'CANCELLED', label: '配送异常' },
]
export function planStatusDisplay(status?: string) {
  switch (status) {
    case 'EXECUTING': return { label: '配送中', color: 'processing', reason: '后端计划状态：EXECUTING' }
    case 'COMPLETED': return { label: '配送完成', color: 'success', reason: '后端计划状态：COMPLETED' }
    case 'CANCELLED': return { label: '配送异常', color: 'error', reason: '后端计划状态：CANCELLED' }
    default: return { label: '状态待确认', color: undefined, reason: status === 'PLANNED' ? '后端计划状态：PLANNED；缺少自动触发时间依据，暂不能区分未到配送时间与待配送。' : `后端计划状态：${status || '未返回'}` }
  }
}
export function planMaintenanceReason(status?: string) {
  return status === 'PLANNED' ? '缺少自动触发时间依据，暂不能确认计划是否允许维护。' : '仅未到配送时间的计划允许修改、删除及调序。'
}
