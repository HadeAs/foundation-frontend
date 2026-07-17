import { describe, expect, it } from 'vitest'

import { shouldPollAsyncTasks } from './polling'

describe('异步任务轮询', () => {
  it('仅在页面可见且存在进行中任务或详情打开时轮询', () => {
    expect(shouldPollAsyncTasks(['SUCCESS', 'RUNNING'], false, true)).toBe(true)
    expect(shouldPollAsyncTasks(['SUCCESS'], true, true)).toBe(true)
    expect(shouldPollAsyncTasks(['RUNNING'], false, false)).toBe(false)
    expect(shouldPollAsyncTasks(['SUCCESS'], false, true)).toBe(false)
  })
})
