export function getHttpStatusTone(status?: number) {
  if (status === undefined) return 'default'
  if (status >= 500) return 'error'
  if (status >= 400) return 'warning'
  if (status >= 300) return 'processing'
  return 'success'
}
