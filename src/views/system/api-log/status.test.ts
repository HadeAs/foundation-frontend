import { describe, expect, it } from 'vitest'

import { getHttpStatusTone } from './status'

describe('HTTP 状态显示', () => {
  it('按状态码区间返回对应色调', () => {
    expect(getHttpStatusTone(200)).toBe('success')
    expect(getHttpStatusTone(302)).toBe('processing')
    expect(getHttpStatusTone(404)).toBe('warning')
    expect(getHttpStatusTone(503)).toBe('error')
  })
})
