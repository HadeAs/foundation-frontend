export type ConfigValueType = 'string' | 'boolean' | 'number' | 'json'

export function getConfigValueError(type: ConfigValueType, value?: string) {
  const text = value?.trim()
  if (!text) return '请输入参数值'
  if (type === 'boolean' && text !== 'true' && text !== 'false') return '布尔值只能填写 true 或 false'
  if (type === 'number' && !Number.isFinite(Number(text))) return '请输入有效数字'
  if (type === 'json') {
    try {
      JSON.parse(text)
    } catch {
      return '请输入有效的 JSON 内容'
    }
  }
  return undefined
}
