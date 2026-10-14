import dayjs from 'dayjs'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { planDateQuery, planMaintenanceReason, planStatusDisplay, todayPlanRange } from './production-plan'

afterEach(() => vi.useRealTimers())
describe('生产计划日期与状态边界', () => {
  it('当天与现有系统上海时区一致，范围包含完整一天，清空则不筛日期', () => {
    vi.useFakeTimers(); vi.setSystemTime(new Date('2026-10-14T16:01:00Z'))
    expect(planDateQuery(todayPlanRange())).toEqual({ plannedStartTimeStart: '2026-10-15T00:00:00.000+08:00', plannedStartTimeEnd: '2026-10-15T23:59:59.999+08:00' })
    expect(planDateQuery([dayjs('2026-10-01'), dayjs('2026-10-14')])).toEqual({ plannedStartTimeStart: '2026-10-01T00:00:00.000+08:00', plannedStartTimeEnd: '2026-10-14T23:59:59.999+08:00' })
    expect(planDateQuery(null)).toEqual({})
  })
  it('计划状态按确认映射，缺失依据保留原值，不猜测 PLANNED 阶段', () => {
    expect(planStatusDisplay('EXECUTING').label).toBe('配送中')
    expect(planStatusDisplay('COMPLETED').label).toBe('配送完成')
    expect(planStatusDisplay('CANCELLED').label).toBe('配送异常')
    for (const value of ['PLANNED', 'NEW_STATE', undefined]) {
      expect(planStatusDisplay(value)).toMatchObject({ label: '状态待确认', color: undefined })
      expect(planStatusDisplay(value).reason).toContain(value || '未返回')
    }
    expect(planMaintenanceReason('PLANNED')).toContain('缺少自动触发时间依据')
  })
})
