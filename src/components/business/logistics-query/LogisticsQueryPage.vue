<script setup lang="ts">
import { onActivated, onDeactivated, ref } from 'vue'
import type { DataRecord } from '@/business/basic-data/schema'
import type { QueryType, ReferenceType } from '@/business/logistics-query/schema'
import QueryList from './QueryList.vue'
import QueryViewer, { type ViewerEntry } from './QueryViewer.vue'
defineProps<{ type: Exclude<QueryType, 'warehouseBox'> }>()
const active = ref(true),
  viewer = ref<ViewerEntry>()
function navigate(type: ReferenceType, id: number) {
  viewer.value = { type, id }
}
function boxes(record: DataRecord) {
  if (record.id !== undefined)
    viewer.value = {
      type: 'warehouseBox',
      id: record.id,
      boxes: true,
      label: String(record.applicationNo ?? '缴库记录'),
    }
}
onDeactivated(() => {
  active.value = false
  viewer.value = undefined
})
onActivated(() => {
  active.value = true
})
</script>
<template>
  <QueryList v-if="active" :type="type" @navigate="navigate" @boxes="boxes" />
  <QueryViewer v-if="viewer" :initial="viewer" @close="viewer = undefined" />
</template>
