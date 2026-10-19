<script setup lang="ts">
import { Button as AButton, Modal as AModal } from 'ant-design-vue'
import { computed, ref } from 'vue'
import { objects, type DataRecord } from '@/business/basic-data/schema'
import { isQueryType, queryObjects, type ReferenceType } from '@/business/logistics-query/schema'
import QueryDetail from './QueryDetail.vue'
import QueryList from './QueryList.vue'
import BasicIdentity from './BasicIdentity.vue'
export interface ViewerEntry {
  type: ReferenceType
  id: number
  boxes?: boolean
  label?: string
}
const props = defineProps<{ initial: ViewerEntry }>()
defineEmits<{ close: [] }>()
let sequence = 0
const stack = ref([{ ...props.initial, key: sequence++ }])
const current = computed(() => stack.value[stack.value.length - 1]!)
const title = computed(() =>
  current.value.boxes
    ? `箱明细 · ${current.value.label || '缴库记录'}`
    : `查看${isQueryType(current.value.type) ? queryObjects[current.value.type].label : objects[current.value.type].label}`,
)
function navigate(type: ReferenceType, id: number) {
  stack.value.push({ type, id, key: sequence++ })
}
function boxes(record: DataRecord) {
  if (record.id !== undefined)
    stack.value.push({
      type: 'warehouseBox',
      id: record.id,
      boxes: true,
      label: String(record.applicationNo ?? '缴库记录'),
      key: sequence++,
    })
}
</script>
<template>
  <AModal
    open
    :title="title"
    :width="current.boxes ? 1040 : 760"
    :mask-closable="false"
    :body-style="{ maxHeight: '65vh', overflowY: 'auto' }"
    @cancel="$emit('close')"
  >
    <div v-for="entry in stack" v-show="entry.key === current.key" :key="entry.key">
      <QueryList
        v-if="entry.boxes"
        type="warehouseBox"
        :warehouse-record-id="entry.id"
        embedded
        @navigate="navigate"
      />
      <QueryDetail
        v-else-if="isQueryType(entry.type)"
        :type="entry.type"
        :id="entry.id"
        @navigate="navigate"
        @boxes="boxes"
      />
      <BasicIdentity v-else :type="entry.type" :id="entry.id" />
    </div>
    <template #footer
      ><AButton v-if="stack.length > 1" @click="stack.pop()">返回</AButton
      ><AButton @click="$emit('close')">关闭</AButton></template
    >
  </AModal>
</template>
