import type { DashboardMetric } from '@/api/dashboard'

const groupNames: Record<string, string> = {
  api: '接口运行',
  database: '数据资源',
  file: '文件资源',
  job: '任务调度',
  security: '安全审计',
  system: '系统运行',
  task: '任务处理',
}

const toneMeta = {
  primary: { label: '常规', color: '#0d9496' },
  success: { label: '正常', color: '#28a87d' },
  warning: { label: '关注', color: '#d9962f' },
  danger: { label: '异常', color: '#cf5f54' },
  info: { label: '信息', color: '#5b82bd' },
} as const

export type DashboardChartItem = {
  key: string
  label: string
  count: number
  ratio: number
  color?: string
}

export function buildMetricGroups(metrics: DashboardMetric[]): DashboardChartItem[] {
  const counts = new Map<string, number>()
  for (const metric of metrics) {
    const key = metric.group?.trim() || 'other'
    counts.set(key, (counts.get(key) || 0) + 1)
  }
  return [...counts.entries()]
    .map(([key, count]) => ({
      key,
      label: groupNames[key.toLowerCase()] || (key === 'other' ? '其他指标' : key),
      count,
      ratio: metrics.length ? count / metrics.length * 100 : 0,
    }))
    .sort((left, right) => right.count - left.count || left.key.localeCompare(right.key))
}

export function buildToneSegments(metrics: DashboardMetric[]): DashboardChartItem[] {
  const counts = new Map<keyof typeof toneMeta, number>()
  for (const metric of metrics) {
    const tone = metric.tone && metric.tone in toneMeta
      ? metric.tone as keyof typeof toneMeta
      : 'primary'
    counts.set(tone, (counts.get(tone) || 0) + 1)
  }
  return [...counts.entries()].map(([key, count]) => ({
    key,
    label: toneMeta[key].label,
    count,
    ratio: metrics.length ? count / metrics.length * 100 : 0,
    color: toneMeta[key].color,
  }))
}

export function buildDonutGradient(segments: DashboardChartItem[]) {
  if (!segments.length) return 'conic-gradient(var(--shell-border) 0 100%)'
  let start = 0
  return `conic-gradient(${segments.map((segment) => {
    const end = start + segment.ratio
    const stop = `${segment.color} ${start}% ${end}%`
    start = end
    return stop
  }).join(', ')})`
}
