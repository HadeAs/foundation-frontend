const activeStatuses = new Set(['PENDING', 'RUNNING'])

export function shouldPollAsyncTasks(statuses: Array<string | undefined>, detailOpen: boolean, visible: boolean) {
  return visible && (detailOpen || statuses.some((status) => status && activeStatuses.has(status)))
}
