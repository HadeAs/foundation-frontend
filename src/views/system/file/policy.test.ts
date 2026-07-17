import { describe, expect, it } from 'vitest'

import { canDeleteFile, formatFileSize } from './policy'

describe('文件管理约束', () => {
  it('保护未过期的系统托管文件', () => {
    expect(canDeleteFile('exports', false)).toBe(false)
    expect(canDeleteFile('exports', true)).toBe(true)
    expect(canDeleteFile('documents', false)).toBe(true)
  })

  it('使用易读单位显示文件大小', () => {
    expect(formatFileSize(512)).toBe('512 B')
    expect(formatFileSize(1536)).toBe('1.5 KB')
    expect(formatFileSize(2 * 1024 * 1024)).toBe('2 MB')
  })
})
