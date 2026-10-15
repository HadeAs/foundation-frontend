import { onBeforeUnmount, ref } from 'vue'
import type { DictionaryItem } from '@/api/basic-data'
import { getErrorMessage } from '@/api/http'
import { getLogisticsDictionaries } from '@/api/logistics-query'
import type { QueryType } from './schema'

export function useQueryDictionaries(type: QueryType) {
  const dictionaries = ref<Record<string, DictionaryItem[]>>({}), dictError = ref('')
  let epoch = 0
  async function loadDictionaries() {
    const current = ++epoch
    dictError.value = ''
    try { const result = await getLogisticsDictionaries(type); if (current === epoch) dictionaries.value = result }
    catch (cause) { if (current === epoch) dictError.value = getErrorMessage(cause) }
  }
  void loadDictionaries()
  onBeforeUnmount(() => { epoch++ })
  return { dictionaries, dictError, loadDictionaries }
}
