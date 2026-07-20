import { describe, expect, it } from 'vitest'

import { shouldPollAsyncTasks } from './polling'

describe('异步任务轮询', () => {
  it('仅在页面可见且列表或详情中存在进行中任务时轮询', () => {
    expect(shouldPollAsyncTasks(['SUCCESS', 'RUNNING'], undefined, true)).toBe(true)
    expect(shouldPollAsyncTasks(['SUCCESS'], 'RUNNING', true)).toBe(true)
    expect(shouldPollAsyncTasks(['RUNNING'], undefined, false)).toBe(false)
    expect(shouldPollAsyncTasks(['SUCCESS'], 'SUCCESS', true)).toBe(false)
  })
})
