import { describe, expect, it } from 'vitest'

import { formatDateTime } from './date'

describe('date formatting', () => {
  it('always renders Asia/Shanghai time', () => {
    expect(formatDateTime('2026-07-15T00:00:00Z')).toBe('2026-07-15 08:00:00')
  })

  it('preserves invalid backend values for diagnostics', () => {
    expect(formatDateTime('unknown-time')).toBe('unknown-time')
  })
})
