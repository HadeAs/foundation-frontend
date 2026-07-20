const activeStatuses = new Set(['PENDING', 'RUNNING'])

export function shouldPollAsyncTasks(
  statuses: Array<string | undefined>,
  detailStatus: string | undefined,
  visible: boolean,
) {
  return visible && (
    activeStatuses.has(detailStatus || '')
    || statuses.some((status) => activeStatuses.has(status || ''))
  )
}
