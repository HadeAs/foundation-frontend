import type { Ref } from 'vue'

export function createLatestRequest(loading: Ref<boolean>) {
  let version = 0

  return async function runLatest<T>(request: () => Promise<T>, trackLoading = true) {
    const current = ++version
    if (trackLoading) loading.value = true
    try {
      const result = await request()
      return current === version ? result : undefined
    } catch (error) {
      if (current === version) throw error
      return undefined
    } finally {
      if (current === version) loading.value = false
    }
  }
}
