import { describe, expect, it } from 'vitest'

import { CONFLICT_MESSAGE, getErrorMessage } from './http'

describe('接口错误提示', () => {
  it('统一显示乐观锁冲突提示', () => {
    expect(getErrorMessage({
      isAxiosError: true,
      response: { status: 409, data: { code: 40900, message: 'Conflict' } },
    })).toBe(CONFLICT_MESSAGE)
  })
})
