<script setup lang="ts">
import { Alert as AAlert, Button as AButton } from 'ant-design-vue'
import { computed, onBeforeUnmount, ref } from 'vue'
import { getErrorMessage } from '@/api/http'
import type { DataRecord } from '@/business/basic-data/schema'
import { lookupReference, resolveQueryReferences, type QueryRelations } from '@/business/logistics-query/references'
import { commonTechnical, fields, queryObjects, snapshotText, type QueryType, type ReferenceType } from '@/business/logistics-query/schema'
import { useQueryDictionaries } from '@/business/logistics-query/useDictionaries'
import DataState from '../basic-data/DataState.vue'
import QueryValue from './QueryValue.vue'
const props = defineProps<{ type: QueryType; id: number }>()
defineEmits<{ navigate: [type: ReferenceType, id: number]; boxes: [record: DataRecord] }>()
const config = queryObjects[props.type], keys = [...config.details, ...config.technical, ...commonTechnical]
const record = ref<DataRecord>(), loading = ref(false), error = ref(''), relations = ref<QueryRelations>({})
const { dictionaries, dictError, loadDictionaries } = useQueryDictionaries(props.type)
const relationFailed = computed(() => Object.values(relations.value).some(value => value === null))
let epoch = 0
async function load() {
  const current = ++epoch
  loading.value = true; error.value = ''; record.value = undefined; relations.value = {}
  try {
    const result = await lookupReference(props.type, props.id)
    if (current !== epoch) return
    record.value = result; loading.value = false
    const names = await resolveQueryReferences(keys, [result])
    if (current === epoch) relations.value = names
  } catch (cause) { if (current === epoch) error.value = getErrorMessage(cause) }
  finally { if (current === epoch) loading.value = false }
}
void load()
onBeforeUnmount(() => { epoch++ })
</script>
<template>
  <DataState v-if="loading || error" :loading="loading" :error="error" @retry="load" />
  <section v-else-if="record" class="query-detail">
    <AAlert v-if="dictError" type="warning" :message="`字典加载失败：${dictError}`" show-icon><template #action><AButton size="small" @click="loadDictionaries">重试</AButton></template></AAlert>
    <AAlert v-if="relationFailed" type="warning" message="部分关联名称加载失败，已保留原始 ID。" show-icon><template #action><AButton size="small" @click="load">重试</AButton></template></AAlert>
    <dl><div v-for="key in config.details" :key="key"><dt>{{ fields[key]!.label }}</dt><dd><QueryValue :field-key="key" :value="record[key]" :relations="relations" :dictionaries="dictionaries" links @navigate="(type, id) => $emit('navigate', type, id)" /></dd></div></dl>
    <AButton v-if="type === 'warehouse'" @click="$emit('boxes', record)">箱明细</AButton>
    <details><summary>追溯信息</summary><dl><div v-for="key in [...config.technical, ...commonTechnical]" :key="key"><dt>{{ fields[key]!.label }}</dt><dd><QueryValue :field-key="key" :value="record[key]" :relations="relations" :dictionaries="dictionaries" links @navigate="(type, id) => $emit('navigate', type, id)" /></dd></div></dl></details>
    <details v-for="key in config.snapshots" :key="key"><summary>{{ fields[key]!.label }}</summary><pre>{{ snapshotText(record[key]) }}</pre></details>
  </section>
</template>
<style scoped>
dl { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 12px 16px; margin: 12px 0; }
dt { color: var(--shell-muted); font-size: 13px; margin-bottom: 4px; }
dd { margin: 0; overflow-wrap: anywhere; }
dd :deep(.value-link) { white-space: normal; overflow-wrap: anywhere; }
summary { cursor: pointer; color: var(--brand); padding: 8px 0; border-top: 1px solid var(--shell-border); }
pre { white-space: pre-wrap; overflow-wrap: anywhere; padding: 12px; background: var(--shell-bg); font-size: 13px; max-height: 320px; overflow: auto; }
</style>
