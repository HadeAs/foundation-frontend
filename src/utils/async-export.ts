import type { AsyncTaskRequest } from '@/api/async-task'

export function buildExportTaskRequest(
  taskType: string,
  taskName: string,
  resource: string,
  sourceFilters: Record<string, unknown>,
): AsyncTaskRequest {
  const filters = Object.fromEntries(
    Object.entries(sourceFilters).filter(([key, value]) =>
      key !== 'page' && key !== 'size' && value !== undefined && value !== '',
    ),
  )
  return {
    taskType,
    taskName,
    paramsJson: JSON.stringify({ resource, filters }),
  }
}

export function isTerminalTaskStatus(status?: string) {
  return status === 'SUCCESS' || status === 'FAILURE' || status === 'CANCELED'
}
