import { describe, expect, it } from 'vitest'

import { getConfigValueError } from './value'

describe('getConfigValueError', () => {
  it('validates typed config values', () => {
    expect(getConfigValueError('boolean', 'yes')).toContain('true')
    expect(getConfigValueError('number', 'Infinity')).toBe('请输入有效数字')
    expect(getConfigValueError('json', '{broken}')).toContain('JSON')
    expect(getConfigValueError('json', '{"enabled":true}')).toBeUndefined()
  })
})
