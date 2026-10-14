<script setup lang="ts">
import { Alert as AAlert, Button as AButton, Modal as AModal } from 'ant-design-vue'
import { computed, onBeforeUnmount, ref } from 'vue'
import type { DictionaryItem } from '@/api/basic-data'
import { getErrorMessage } from '@/api/http'
import { getRuntimeData } from '@/api/runtime-business'
import { resolveReferenceFields, type RelationMap } from '@/business/basic-data/relations'
import type { DataRecord } from '@/business/basic-data/schema'
import { runtimeObjects, traceFields, type RuntimeType } from '@/business/runtime/schema'
import DataState from '../basic-data/DataState.vue'
import RuntimeValue from './RuntimeValue.vue'
const props = defineProps<{ type: RuntimeType; id: number; dictionaries: Record<string, DictionaryItem[]> }>()
defineEmits<{ close: [] }>()
const config = computed(() => runtimeObjects[props.type])
const record = ref<DataRecord>(), loading = ref(false), error = ref(''), relations = ref<RelationMap>({})
const relationFailed = computed(() => Object.values(relations.value).some(value => value === null))
let epoch = 0
async function load() {
  const current = ++epoch
  loading.value = true; error.value = ''; record.value = undefined; relations.value = {}
  try {
    const result = await getRuntimeData(props.type, props.id)
    if (current !== epoch) return
    record.value = result; loading.value = false
    const names = await resolveReferenceFields(config.value.fields, [result])
    if (current === epoch) relations.value = names
  } catch (cause) { if (current === epoch) error.value = getErrorMessage(cause) }
  finally { if (current === epoch) loading.value = false }
}
void load()
onBeforeUnmount(() => { epoch++ })
</script>
<template>
  <AModal open :title="`查看${config.label}`" :width="760" :mask-closable="false" :body-style="{ maxHeight: '65vh', overflowY: 'auto' }" @cancel="$emit('close')">
    <DataState v-if="loading || error" :loading="loading" :error="error" @retry="load" />
    <template v-else-if="record">
      <AAlert v-if="relationFailed" type="warning" show-icon message="部分关联名称加载失败，已保留原始 ID。"><template #action><AButton size="small" @click="load">重试</AButton></template></AAlert>
      <dl class="runtime-details"><div v-for="field in config.fields" :key="field.key"><dt>{{ field.label }}</dt><dd><RuntimeValue :field="field" :value="record[field.key]" :relations="relations" :dictionaries="dictionaries" /></dd></div></dl>
      <details><summary>追溯信息</summary><dl class="runtime-details"><div v-for="field in [...traceFields, ...config.technical]" :key="field.key"><dt>{{ field.label }}</dt><dd>{{ record[field.key] ?? '—' }}</dd></div></dl></details>
    </template>
    <template #footer><AButton @click="$emit('close')">关闭</AButton></template>
  </AModal>
</template>
<style scoped>
.runtime-details { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 12px 16px; margin: 12px 0; }
dt { color: var(--shell-muted); font-size: 13px; margin-bottom: 4px; }
dd { margin: 0; overflow-wrap: anywhere; }
summary { cursor: pointer; color: var(--brand); padding: 8px 0; border-top: 1px solid var(--shell-border); }
</style>
