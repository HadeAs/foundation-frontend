const dateTimeFormatter = new Intl.DateTimeFormat('zh-CN', {
  timeZone: 'Asia/Shanghai',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
  hourCycle: 'h23',
})

export function formatDateTime(value?: string | number | Date) {
  if (value === undefined || value === null || value === '') return '--'
  const date = value instanceof Date ? value : new Date(value)
  if (Number.isNaN(date.getTime())) return String(value)
  const parts = Object.fromEntries(
    dateTimeFormatter.formatToParts(date).map((part) => [part.type, part.value]),
  )
  return `${parts.year}-${parts.month}-${parts.day} ${parts.hour}:${parts.minute}:${parts.second}`
}
