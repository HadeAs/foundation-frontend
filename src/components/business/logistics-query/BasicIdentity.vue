<script setup lang="ts">
import { onBeforeUnmount, ref } from 'vue'
import { ApiError, getErrorMessage } from '@/api/http'
import { objects, type DataRecord } from '@/business/basic-data/schema'
import { lookupReference } from '@/business/logistics-query/references'
import DataState from '../basic-data/DataState.vue'
const props = defineProps<{ type: 'container' | 'location' | 'slot'; id: number }>()
const config = objects[props.type], record = ref<DataRecord>(), loading = ref(false), error = ref('')
let epoch = 0
async function load() {
  const current = ++epoch
  loading.value = true; error.value = ''
  try { const result = await lookupReference(props.type, props.id); if (current === epoch) { if (!result || result.id === undefined) throw new ApiError('关联记录不存在或暂不可用'); record.value = result } }
  catch (cause) { if (current === epoch) error.value = getErrorMessage(cause) }
  finally { if (current === epoch) loading.value = false }
}
void load()
onBeforeUnmount(() => { epoch++ })
</script>
<template>
  <DataState v-if="loading || error" :loading="loading" :error="error" @retry="load" />
  <dl v-else-if="record"><div v-for="key in [config.code!, config.name!, 'enabled', 'remark']" :key="key"><dt>{{ config.fields.find(field => field.key === key)?.label || key }}</dt><dd>{{ key === 'enabled' ? record[key] === true ? '启用' : record[key] === false ? '停用' : '未确认' : record[key] ?? '—' }}</dd></div></dl>
</template>
<style scoped>
dl { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 12px 16px; margin: 0; }
dt { color: var(--shell-muted); font-size: 13px; margin-bottom: 4px; }
dd { margin: 0; overflow-wrap: anywhere; }
</style>
