<script setup lang="ts">
import { computed } from 'vue'
import { Tag as ATag } from 'ant-design-vue'
import type { DictionaryItem } from '@/api/basic-data'
import { relationKey, relationLabel, type RelationMap } from '@/business/basic-data/relations'
import { objects, recordLabel, type FieldValue } from '@/business/basic-data/schema'
import type { RuntimeField } from '@/business/runtime/schema'
import { formatDateTime } from '@/utils/date'
const props = defineProps<{
  field: RuntimeField
  value: FieldValue
  relations: RelationMap
  dictionaries: Record<string, DictionaryItem[]>
}>()
const related = computed(() =>
  props.field.target ? props.relations[relationKey(props.field.target, props.value)] : undefined,
)
const item = computed(() =>
  props.field.dict
    ? props.dictionaries[props.field.dict]?.find((item) => item.value === props.value)
    : undefined,
)
const color = computed(
  () =>
    ({
      success: 'success',
      warning: 'warning',
      danger: 'error',
      error: 'error',
      primary: 'processing',
      info: 'default',
    })[item.value?.tagType || ''],
)
const text = computed(() => {
  if (props.field.kind === 'boolean')
    return props.value === true ? '开启' : props.value === false ? '关闭' : '未确认'
  if (props.value === undefined || props.value === null || props.value === '') return '—'
  if (props.field.target) return relationLabel(props.field.target, props.value, props.relations)
  if (props.field.kind === 'time') return formatDateTime(String(props.value))
  return item.value?.label || String(props.value)
})
</script>
<template>
  <div
    v-if="field.target && related"
    class="runtime-reference"
    :title="`${recordLabel(field.target, related)} / ${related[objects[field.target].code || ''] || ''}`"
  >
    <strong>{{ recordLabel(field.target, related) }}</strong>
    <span>{{ related[objects[field.target].code || ''] }}</span>
  </div>
  <ATag v-else-if="field.dict && value != null && value !== ''" :color="color" :title="text">{{
    text
  }}</ATag>
  <span v-else :title="text">{{ text }}</span>
</template>
<style scoped>
.runtime-reference {
  display: flex;
  flex-direction: column;
  min-width: 0;
  line-height: 1.5;
}
.runtime-reference strong,
.runtime-reference span {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.runtime-reference span {
  font-size: 12px;
  color: var(--brand);
}
.ant-tag {
  max-width: 100%;
  overflow: hidden;
  text-overflow: ellipsis;
  vertical-align: middle;
}
</style>
