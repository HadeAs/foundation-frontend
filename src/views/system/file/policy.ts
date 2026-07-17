export const fileGroups = [
  { label: '手工上传', value: 'default', managed: false },
  { label: '文档资料', value: 'documents', managed: false },
  { label: '图片', value: 'images', managed: false },
  { label: '导出结果', value: 'exports', managed: true },
  { label: '导入结果', value: 'imports', managed: true },
  { label: '业务附件', value: 'attachments', managed: true },
  { label: '系统生成', value: 'generated', managed: true },
]

export function canDeleteFile(group?: string, expired = false) {
  return !fileGroups.some((item) => item.value === group && item.managed) || expired
}

export function formatFileSize(bytes?: number) {
  if (bytes === undefined) return '—'
  if (bytes < 1024) return `${bytes} B`
  const units = ['KB', 'MB', 'GB']
  let value = bytes / 1024
  let unit = 0
  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024
    unit += 1
  }
  return `${new Intl.NumberFormat('zh-CN', { maximumFractionDigits: 2 }).format(value)} ${units[unit]}`
}
