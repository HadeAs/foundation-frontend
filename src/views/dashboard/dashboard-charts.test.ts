import { describe, expect, it } from 'vitest'

import { buildDonutGradient, buildMetricGroups, buildToneSegments } from './dashboard-charts'

describe('dashboard charts', () => {
  const metrics = [
    { name: '接口调用', group: 'api', tone: 'success' },
    { name: '接口耗时', group: 'api', tone: 'warning' },
    { name: '表数量', group: 'database' },
    { name: '其他指标' },
  ]

  it('summarizes metrics by group using real item counts', () => {
    expect(buildMetricGroups(metrics)).toEqual([
      { key: 'api', label: '接口运行', count: 2, ratio: 50 },
      { key: 'database', label: '数据资源', count: 1, ratio: 25 },
      { key: 'other', label: '其他指标', count: 1, ratio: 25 },
    ])
  })

  it('builds tone segments and a conic gradient', () => {
    const segments = buildToneSegments(metrics)
    expect(segments.map(({ key, count, ratio }) => ({ key, count, ratio }))).toEqual([
      { key: 'success', count: 1, ratio: 25 },
      { key: 'warning', count: 1, ratio: 25 },
      { key: 'primary', count: 2, ratio: 50 },
    ])
    expect(buildDonutGradient(segments)).toContain('conic-gradient(')
  })
})
