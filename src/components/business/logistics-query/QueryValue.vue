<script setup lang="ts">
import { computed } from 'vue'
import { Tag as ATag } from 'ant-design-vue'
import type { DictionaryItem } from '@/api/basic-data'
import type { FieldValue } from '@/business/basic-data/schema'
import { fields, type ReferenceType } from '@/business/logistics-query/schema'
import { referenceKey, referenceLabel, type QueryRelations } from '@/business/logistics-query/references'
import { formatDateTime } from '@/utils/date'
const props = defineProps<{ fieldKey: string; value: FieldValue; relations: QueryRelations; dictionaries: Record<string, DictionaryItem[]>; links?: boolean }>()
defineEmits<{ navigate: [type: ReferenceType, id: number] }>()
const field = computed(() => fields[props.fieldKey]!)
const item = computed(() => field.value.dict ? props.dictionaries[field.value.dict]?.find(item => item.value === props.value) : undefined)
const color = computed(() => ({ success: 'success', warning: 'warning', danger: 'error', error: 'error', primary: 'processing', info: 'default' }[item.value?.tagType || '']))
const label = computed(() => {
  if (props.value === undefined || props.value === null || props.value === '') return '—'
  if (field.value.target && typeof props.value === 'number') {
    const row = props.relations[referenceKey(field.value.target, props.value)]
    return row ? referenceLabel(field.value.target, row) : `ID ${props.value}（${row === null ? '名称加载失败' : '加载中'}）`
  }
  return field.value.time ? formatDateTime(String(props.value)) : item.value?.label || String(props.value)
})
</script>
<template>
  <button v-if="links && field.target && typeof value === 'number'" type="button" class="value-link" :title="label" @click="$emit('navigate', field.target, value)">{{ label }}</button>
  <ATag v-else-if="field.dict && value !== null && value !== undefined && value !== ''" class="value-tag" :color="color" :title="label">{{ label }}</ATag>
  <span v-else :title="label">{{ label }}</span>
</template>
<style scoped>
.value-link { color: var(--brand); border: 0; background: none; padding: 0; cursor: pointer; font: inherit; max-width: 100%; text-align: left; overflow: hidden; text-overflow: ellipsis; vertical-align: middle; }
.value-link:focus-visible { outline: 2px solid var(--brand); outline-offset: 2px; }
.value-tag { max-width: 100%; overflow: hidden; text-overflow: ellipsis; vertical-align: middle; margin: 0; }
</style>
