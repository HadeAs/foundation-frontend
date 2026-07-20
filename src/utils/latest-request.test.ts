import { ref } from 'vue'
import { describe, expect, it } from 'vitest'

import { createLatestRequest } from './latest-request'

describe('createLatestRequest', () => {
  it('只返回最后一次查询结果，并在最后一次请求结束后关闭加载状态', async () => {
    const loading = ref(false)
    const runLatest = createLatestRequest(loading)
    let finishFirst!: (value: string) => void
    let finishSecond!: (value: string) => void

    const first = runLatest(() => new Promise<string>((resolve) => { finishFirst = resolve }))
    const second = runLatest(() => new Promise<string>((resolve) => { finishSecond = resolve }))
    expect(loading.value).toBe(true)

    finishFirst('旧结果')
    await expect(first).resolves.toBeUndefined()
    expect(loading.value).toBe(true)

    finishSecond('新结果')
    await expect(second).resolves.toBe('新结果')
    expect(loading.value).toBe(false)
  })

  it('静默请求替代普通请求后仍会关闭加载状态', async () => {
    const loading = ref(false)
    const runLatest = createLatestRequest(loading)
    let finishVisible!: (value: string) => void
    let finishSilent!: (value: string) => void

    const visible = runLatest(() => new Promise<string>((resolve) => { finishVisible = resolve }))
    const silent = runLatest(() => new Promise<string>((resolve) => { finishSilent = resolve }), false)

    finishVisible('旧结果')
    await expect(visible).resolves.toBeUndefined()
    expect(loading.value).toBe(true)

    finishSilent('轮询结果')
    await expect(silent).resolves.toBe('轮询结果')
    expect(loading.value).toBe(false)
  })
})
