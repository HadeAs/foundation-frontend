<script setup lang="ts">
import { CloseOutlined, SearchOutlined } from '@ant-design/icons-vue'
import {
  Button as AButton,
  Input as AInput,
  Modal as AModal,
  Table as ATable,
  type TableColumnsType,
  type TableProps,
} from 'ant-design-vue'
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import { pageLogisticsData } from '@/api/logistics-query'
import { getErrorMessage } from '@/api/http'
import type { DataRecord } from '@/business/basic-data/schema'
import {
  fields,
  queryObjects,
  queryRecordLabel,
  type QueryType,
} from '@/business/logistics-query/schema'
import {
  lookupReference,
  resolveQueryReferences,
  type QueryRelations,
} from '@/business/logistics-query/references'
import DataState from '../basic-data/DataState.vue'
import QueryValue from './QueryValue.vue'
const props = defineProps<{ target: QueryType; value?: number | null; label: string }>()
const emit = defineEmits<{ 'update:value': [value: number | undefined] }>()
const config = computed(() => queryObjects[props.target])
const open = ref(false),
  selected = ref<DataRecord>(),
  selectedError = ref(''),
  search = ref(''),
  applied = ref('')
const page = ref(1),
  size = ref(20),
  total = ref(0),
  rows = ref<DataRecord[]>([]),
  loading = ref(false),
  error = ref(''),
  relations = ref<QueryRelations>({})
let epoch = 0,
  selectedEpoch = 0
const keys = computed(() =>
  props.target === 'warehouseBox'
    ? ['orderNo', 'boxId', 'materialCode', 'materialBatch', 'createdTime']
    : [config.value.identity, 'createdTime'],
)
const columns = computed<TableColumnsType>(() =>
  keys.value.map((key) => ({
    key,
    dataIndex: key,
    title: fields[key]!.label,
    ellipsis: true,
    width: 180,
  })),
)
const valueLabel = computed(() =>
  selected.value
    ? queryRecordLabel(props.target, selected.value)
    : `ID ${props.value}（${selectedError.value ? '加载失败' : '加载中'}）`,
)
async function loadSelected() {
  const current = ++selectedEpoch
  selected.value = undefined
  selectedError.value = ''
  if (props.value === undefined || props.value === null) return
  try {
    const row = await lookupReference(props.target, props.value)
    if (current === selectedEpoch) selected.value = row
  } catch (cause) {
    if (current === selectedEpoch) selectedError.value = getErrorMessage(cause)
  }
}
async function load() {
  const current = ++epoch
  loading.value = true
  error.value = ''
  relations.value = {}
  try {
    const result = await pageLogisticsData(props.target, {
      page: page.value,
      size: size.value,
      [config.value.searchKey]: applied.value,
      sortBy: 'createdTime',
      sortOrder: 'DESC',
    })
    if (current !== epoch) return
    rows.value = result.records || []
    total.value = result.total || 0
    loading.value = false
    const names = await resolveQueryReferences(keys.value, rows.value)
    if (current === epoch) relations.value = names
  } catch (cause) {
    if (current === epoch) {
      rows.value = []
      error.value = getErrorMessage(cause)
    }
  } finally {
    if (current === epoch) loading.value = false
  }
}
function show() {
  open.value = true
  page.value = 1
  search.value = ''
  applied.value = ''
  void load()
  void loadSelected()
}
function close() {
  open.value = false
  epoch++
}
function select(row: DataRecord) {
  if (row.id !== undefined) {
    emit('update:value', row.id)
    close()
  }
}
function query() {
  applied.value = search.value.trim()
  page.value = 1
  void load()
}
const customRow = (row: DataRecord) => ({
  tabindex: 0,
  'aria-selected': row.id === props.value,
  onClick: () => select(row),
  onKeydown: (event: KeyboardEvent) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault()
      select(row)
    }
  },
})
const change: TableProps['onChange'] = (pager) => {
  page.value = pager.pageSize !== size.value ? 1 : pager.current || 1
  size.value = pager.pageSize || 20
  void load()
}
watch(
  () => [props.target, props.value],
  () => {
    close()
    void loadSelected()
  },
  { immediate: true },
)
onBeforeUnmount(() => {
  epoch++
  selectedEpoch++
})
</script>
<template>
  <div class="reference-control">
    <button
      type="button"
      class="reference-trigger"
      :aria-label="label"
      :title="value != null ? valueLabel : `请选择${label}`"
      @click="show"
    >
      <span>{{ value != null ? valueLabel : `请选择${label}` }}</span
      ><SearchOutlined />
    </button>
    <button
      v-if="value != null"
      type="button"
      class="reference-clear"
      :aria-label="`清除${label}`"
      @click="$emit('update:value', undefined)"
    >
      <CloseOutlined />
    </button>
    <AModal
      v-if="open"
      open
      :title="`选择${label}`"
      :width="760"
      :mask-closable="false"
      @cancel="close"
    >
      <div class="picker-query">
        <AInput
          v-model:value="search"
          allow-clear
          :placeholder="fields[config.searchKey]!.label"
          :aria-label="fields[config.searchKey]!.label"
          @press-enter="query"
        /><AButton type="primary" @click="query">查询</AButton>
      </div>
      <div v-if="value != null" class="current-selection">
        已选：<button v-if="selected" class="selected-link" @click="select(selected)">
          {{ valueLabel }}</button
        ><span v-else>{{ valueLabel }}</span
        ><AButton v-if="selectedError" type="link" size="small" @click="loadSelected"
          >重新加载</AButton
        >
      </div>
      <ATable
        :columns="columns"
        :data-source="loading || error ? [] : rows"
        row-key="id"
        size="small"
        :scroll="{ x: 700, y: 310 }"
        :custom-row="customRow"
        :row-class-name="(row: DataRecord) => (row.id === value ? 'query-selected-row' : '')"
        :pagination="
          loading || error
            ? false
            : {
                current: page,
                pageSize: size,
                total,
                showSizeChanger: true,
                pageSizeOptions: ['10', '20', '50', '100'],
                showTotal: (count: number) => `共 ${count} 条`,
              }
        "
        @change="change"
      >
        <template #emptyText
          ><DataState :loading="loading" :error="error" @retry="load"
        /></template>
        <template #bodyCell="{ column, record }"
          ><QueryValue
            :field-key="String(column.key)"
            :value="record[String(column.key)]"
            :relations="relations"
            :dictionaries="{}"
        /></template>
      </ATable>
      <template #footer><AButton @click="close">取消</AButton></template>
    </AModal>
  </div>
</template>
<style scoped>
.reference-control {
  display: flex;
  width: 100%;
  min-width: 0;
}
.reference-trigger {
  width: 100%;
  min-width: 0;
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 5px 10px;
  background: var(--shell-panel);
  color: var(--shell-ink);
  border: 1px solid var(--shell-border);
  border-radius: 6px;
  font: inherit;
  cursor: pointer;
}
.reference-trigger span {
  flex: 1;
  text-align: left;
  overflow: hidden;
  white-space: nowrap;
  text-overflow: ellipsis;
}
.reference-clear {
  flex: none;
  background: transparent;
  color: var(--shell-muted);
  border: 0;
  cursor: pointer;
}
.picker-query {
  display: flex;
  gap: 8px;
  margin-bottom: 12px;
}
.current-selection {
  margin-bottom: 8px;
  overflow-wrap: anywhere;
  color: var(--shell-muted);
}
.selected-link {
  color: var(--brand);
  background: none;
  border: 0;
  cursor: pointer;
  font: inherit;
}
:deep(.query-selected-row > td) {
  background: color-mix(in srgb, var(--brand) 11%, var(--shell-panel)) !important;
}
:deep(tr[tabindex]) {
  cursor: pointer;
}
:deep(tr[tabindex]:focus-visible) {
  outline: 2px solid var(--brand);
  outline-offset: -2px;
}
</style>
