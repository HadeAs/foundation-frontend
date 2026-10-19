<script setup lang="ts">
import {
  Input as AInput,
  InputNumber as AInputNumber,
  RangePicker as ARangePicker,
  Select as ASelect,
} from 'ant-design-vue'
import dayjs, { type Dayjs } from 'dayjs'
import type { DictionaryItem } from '@/api/basic-data'
import type { DataRecord } from '@/business/basic-data/schema'
import { filterField, isQueryType, type QueryType } from '@/business/logistics-query/schema'
import { formatDateTime } from '@/utils/date'
import ReferenceInput from '../basic-data/ReferenceInput.vue'
import QueryReference from './QueryReference.vue'
const props = defineProps<{
  keys: string[]
  draft: DataRecord
  dictionaries: Record<string, DictionaryItem[]>
  dictError: string
}>()
const emit = defineEmits<{ change: [draft: DataRecord]; query: [] }>()
function update(key: string, value: DataRecord[string]) {
  const next = { ...props.draft, [key]: value }
  if (key === 'originVehicleId' && props.draft[key] !== value) next.originVehicleSlotId = undefined
  if (key === 'destinationVehicleId' && props.draft[key] !== value)
    next.destinationVehicleSlotId = undefined
  emit('change', next)
}
function range(key: string): [Dayjs, Dayjs] | undefined {
  const start = props.draft[key.replace(/Range$/, 'Start')],
    end = props.draft[key.replace(/Range$/, 'End')]
  return start && end
    ? [dayjs(formatDateTime(String(start))), dayjs(formatDateTime(String(end)))]
    : undefined
}
function updateRange(key: string, value: [Dayjs, Dayjs] | null) {
  emit('change', {
    ...props.draft,
    [key.replace(/Range$/, 'Start')]: value
      ? `${value[0].format('YYYY-MM-DDTHH:mm:ss')}+08:00`
      : undefined,
    [key.replace(/Range$/, 'End')]: value
      ? `${value[1].format('YYYY-MM-DDTHH:mm:ss')}+08:00`
      : undefined,
  })
}
function vehicleId(key: string) {
  const value =
    key === 'originVehicleSlotId'
      ? props.draft.originVehicleId
      : key === 'destinationVehicleSlotId'
        ? props.draft.destinationVehicleId
        : undefined
  return typeof value === 'number' ? value : undefined
}
</script>
<template>
  <div class="query-fields">
    <div
      v-for="key in keys"
      :key="key"
      class="query-field"
      :class="{ 'range-field': key.endsWith('Range') }"
    >
      <ARangePicker
        v-if="key.endsWith('Range')"
        :value="range(key)"
        show-time
        format="YYYY-MM-DD HH:mm:ss"
        :placeholder="[`${filterField(key).label}起`, `${filterField(key).label}止`]"
        :aria-label="`${filterField(key).label}范围（上海时间）`"
        @update:value="updateRange(key, $event ? [dayjs($event[0]), dayjs($event[1])] : null)"
      />
      <template v-else-if="filterField(key).target">
        <QueryReference
          v-if="isQueryType(filterField(key).target!)"
          :target="filterField(key).target! as QueryType"
          :value="draft[key] as number | undefined"
          :label="filterField(key).label"
          @update:value="update(key, $event)"
        />
        <ReferenceInput
          v-else
          :target="filterField(key).target! as 'container' | 'location' | 'slot'"
          :value="draft[key] as number | undefined"
          :label="filterField(key).label"
          :vehicle-id="vehicleId(key)"
          @update:value="update(key, $event)"
        />
      </template>
      <ASelect
        v-else-if="filterField(key).dict"
        :value="draft[key] as string | undefined"
        allow-clear
        :placeholder="`全部${filterField(key).label}`"
        :aria-label="filterField(key).label"
        :options="
          (dictionaries[filterField(key).dict!] || []).map((item) => ({
            value: item.value,
            label: item.label || item.value,
          }))
        "
        :not-found-content="dictError ? '字典加载失败，请重试' : '暂无字典项'"
        @update:value="update(key, $event as string | undefined)"
      />
      <AInputNumber
        v-else-if="filterField(key).number"
        :value="draft[key] as number | undefined"
        :placeholder="filterField(key).label"
        :aria-label="filterField(key).label"
        @update:value="update(key, $event)"
        @press-enter="$emit('query')"
      />
      <AInput
        v-else
        :value="draft[key] as string | undefined"
        allow-clear
        :placeholder="filterField(key).label"
        :aria-label="filterField(key).label"
        @update:value="update(key, $event)"
        @press-enter="$emit('query')"
      />
    </div>
  </div>
</template>
<style scoped>
.query-fields {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  min-width: 0;
}
.query-field {
  width: 190px;
}
.query-field > * {
  width: 100%;
}
.range-field {
  width: 380px;
}
</style>
