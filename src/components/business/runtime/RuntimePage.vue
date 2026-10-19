<script setup lang="ts">
import {
  Alert as AAlert,
  Button as AButton,
  Input as AInput,
  Select as ASelect,
  type TableColumnsType,
  type TableProps,
} from 'ant-design-vue'
import { computed, onActivated, onBeforeUnmount, onDeactivated, ref } from 'vue'
import type { DictionaryItem } from '@/api/basic-data'
import { getErrorMessage } from '@/api/http'
import { getRuntimeDictionaries, pageRuntimeData } from '@/api/runtime-business'
import { resolveReferenceFields, type RelationMap } from '@/business/basic-data/relations'
import type { DataRecord, FieldValue } from '@/business/basic-data/schema'
import {
  changeRuntimeFilter,
  defaultRuntimeFilters,
  runtimeObjects,
  runtimeSortFields,
  type RuntimeField,
  type RuntimeType,
} from '@/business/runtime/schema'
import ResizableTable from '@/components/common/ResizableTable.vue'
import DataState from '../basic-data/DataState.vue'
import ReferenceInput from '../basic-data/ReferenceInput.vue'
import RuntimeDetail from './RuntimeDetail.vue'
import RuntimeValue from './RuntimeValue.vue'

const props = defineProps<{ type: RuntimeType }>()
const config = computed(() => runtimeObjects[props.type])
const filters = ref<DataRecord>(defaultRuntimeFilters(props.type)),
  applied = ref<DataRecord>({ ...filters.value })
const more = ref(false),
  loading = ref(false),
  error = ref(''),
  dictError = ref('')
const rows = ref<DataRecord[]>([]),
  relations = ref<RelationMap>({}),
  dictionaries = ref<Record<string, DictionaryItem[]>>({})
const page = ref(1),
  size = ref(20),
  total = ref(0),
  sortBy = ref<string>(),
  sortOrder = ref<'ASC' | 'DESC'>()
const detailId = ref<number>()
const fieldMap = computed(() =>
  Object.fromEntries(config.value.fields.map((field) => [field.key, field])),
)
const filterFields = computed(() =>
  [...config.value.filters, ...(more.value ? config.value.more : [])].map(
    (key) => fieldMap.value[key]!,
  ),
)
const relationFailed = computed(() => Object.values(relations.value).some((row) => row === null))
let epoch = 0,
  dictEpoch = 0,
  needsReload = false
const columns = computed<TableColumnsType>(() => [
  ...config.value.columns.map((key) => ({
    key,
    dataIndex: key,
    title: fieldMap.value[key]!.label,
    width: fieldMap.value[key]!.target
      ? 200
      : key.endsWith('Time')
        ? 180
        : key === 'quantity' || key === 'totalQuantity'
          ? 110
          : 170,
    ellipsis: true,
    sorter: runtimeSortFields.includes(key),
    sortOrder:
      sortBy.value === key
        ? sortOrder.value === 'ASC'
          ? ('ascend' as const)
          : ('descend' as const)
        : null,
    sortDirections: ['ascend' as const, 'descend' as const],
  })),
  { key: 'action', title: '操作', fixed: 'right', width: 100 },
])
const pagination = computed(() =>
  loading.value || error.value
    ? false
    : {
        current: page.value,
        pageSize: size.value,
        total: total.value,
        showSizeChanger: true,
        pageSizeOptions: ['10', '20', '50', '100'],
        showTotal: (count: number) => `共 ${count} 条`,
      },
)
async function loadDictionaries() {
  const current = ++dictEpoch
  dictError.value = ''
  try {
    const values = await getRuntimeDictionaries(props.type)
    if (current === dictEpoch) dictionaries.value = values
  } catch (cause) {
    if (current === dictEpoch) dictError.value = getErrorMessage(cause)
  }
}
async function load() {
  const current = ++epoch
  loading.value = true
  error.value = ''
  relations.value = {}
  try {
    const result = await pageRuntimeData(props.type, {
      ...applied.value,
      page: page.value,
      size: size.value,
      sortBy: sortBy.value,
      sortOrder: sortOrder.value,
    })
    if (current !== epoch) return
    rows.value = result.records || []
    total.value = result.total || 0
    const last = Math.max(1, Math.ceil(total.value / size.value))
    if (!rows.value.length && page.value > last) {
      page.value = last
      void load()
      return
    }
    loading.value = false
    const names = await resolveReferenceFields(config.value.fields, rows.value)
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
function updateFilter(field: RuntimeField, value: FieldValue) {
  changeRuntimeFilter(props.type, filters.value, field.key, value)
}
function query() {
  applied.value = Object.fromEntries(
    Object.entries(filters.value).map(([key, value]) => [
      key,
      typeof value === 'string' ? value.trim() : value,
    ]),
  )
  page.value = 1
  void load()
}
function reset() {
  filters.value = defaultRuntimeFilters(props.type)
  applied.value = { ...filters.value }
  page.value = 1
  sortBy.value = undefined
  sortOrder.value = undefined
  void load()
}
const tableChange: TableProps['onChange'] = (pager, _filters, sorter, extra) => {
  const value = Array.isArray(sorter) ? sorter[0] : sorter
  if (extra.action === 'sort') {
    sortBy.value = value?.order ? String(value.columnKey) : undefined
    sortOrder.value = value?.order ? (value.order === 'ascend' ? 'ASC' : 'DESC') : undefined
  }
  page.value = extra.action === 'sort' || pager.pageSize !== size.value ? 1 : pager.current || 1
  size.value = pager.pageSize || 20
  void load()
}
onDeactivated(() => {
  epoch++
  dictEpoch++
  detailId.value = undefined
  needsReload = true
})
onActivated(() => {
  if (needsReload) {
    needsReload = false
    more.value = false
    reset()
    void loadDictionaries()
  }
})
onBeforeUnmount(() => {
  epoch++
  dictEpoch++
})
void load()
void loadDictionaries()
</script>
<template>
  <main class="management-page runtime-page">
    <section class="query-panel">
      <div class="runtime-filters">
        <div v-for="field in filterFields" :key="field.key" class="runtime-filter">
          <ReferenceInput
            v-if="field.target"
            :value="filters[field.key] as number | undefined"
            :target="field.target"
            :label="field.label"
            :container-kind="field.containerKind"
            :vehicle-id="
              field.key === 'vehicleSlotId' ? (filters.vehicleId as number | undefined) : undefined
            "
            @update:value="updateFilter(field, $event)"
          />
          <ASelect
            v-else-if="field.dict"
            :value="filters[field.key] as string | undefined"
            allow-clear
            :placeholder="`全部${field.label}`"
            :aria-label="field.label"
            :options="
              (dictionaries[field.dict] || []).map((item) => ({
                value: item.value,
                label: item.label || item.value,
              }))
            "
            :not-found-content="dictError ? '字典加载失败，请重试' : '暂无可用字典项'"
            @update:value="updateFilter(field, $event as string | undefined)"
          />
          <ASelect
            v-else-if="field.kind === 'boolean'"
            :value="filters[field.key] === undefined ? undefined : filters[field.key] ? 1 : 0"
            allow-clear
            :aria-label="field.label"
            placeholder="全部自动物流状态"
            :options="[
              { value: 1, label: '开启' },
              { value: 0, label: '关闭' },
            ]"
            @update:value="updateFilter(field, $event === undefined ? undefined : $event === 1)"
          />
          <AInput
            v-else
            :value="filters[field.key] as string | undefined"
            allow-clear
            :placeholder="field.label"
            :aria-label="field.label"
            @update:value="updateFilter(field, $event)"
            @press-enter="query"
          />
        </div>
      </div>
      <div class="query-actions">
        <AButton type="link" :aria-expanded="more" @click="more = !more">{{
          more ? '收起条件' : '更多条件'
        }}</AButton
        ><AButton type="primary" @click="query">查询</AButton><AButton @click="reset">重置</AButton
        ><AButton
          @click="
            load()
            loadDictionaries()
          "
          >刷新</AButton
        >
      </div>
    </section>
    <AAlert v-if="dictError" type="warning" show-icon :message="`字典加载失败：${dictError}`"
      ><template #action
        ><AButton size="small" @click="loadDictionaries">重试</AButton></template
      ></AAlert
    >
    <AAlert
      v-if="relationFailed && !loading"
      type="warning"
      show-icon
      message="部分关联名称加载失败，已保留原始 ID。"
      ><template #action><AButton size="small" @click="load">重试</AButton></template></AAlert
    >
    <section class="table-panel">
      <header class="table-toolbar">
        <h1>{{ config.label }}</h1>
      </header>
      <ResizableTable
        :columns="columns"
        :data-source="loading || error ? [] : rows"
        row-key="id"
        size="middle"
        table-layout="fixed"
        :pagination="pagination"
        @change="tableChange"
      >
        <template #emptyText
          ><DataState
            :loading="loading"
            :error="error"
            :empty-text="config.state ? '暂无运行状态' : '暂无数据'"
            @retry="load"
        /></template>
        <template #bodyCell="{ column, record }">
          <AButton
            v-if="column.key === 'action'"
            type="link"
            size="small"
            :disabled="record.id === undefined"
            @click="detailId = record.id"
            >查看</AButton
          >
          <RuntimeValue
            v-else-if="fieldMap[String(column.key)]"
            :field="fieldMap[String(column.key)]!"
            :value="record[String(column.key)]"
            :relations="relations"
            :dictionaries="dictionaries"
          />
        </template>
      </ResizableTable>
    </section>
    <RuntimeDetail
      v-if="detailId !== undefined"
      :key="detailId"
      :type="type"
      :id="detailId"
      :dictionaries="dictionaries"
      @close="detailId = undefined"
    />
  </main>
</template>
<style scoped>
.runtime-page {
  display: flex;
  flex-direction: column;
  height: 100%;
  min-height: 0;
  overflow: hidden;
}
.runtime-filters {
  display: flex;
  flex: 1;
  flex-wrap: wrap;
  gap: 8px;
  min-width: 0;
}
.runtime-filter {
  width: 190px;
}
.runtime-filter > .ant-select {
  width: 100%;
}
.runtime-page > .ant-alert {
  flex: none;
  margin-top: 8px;
}
</style>
