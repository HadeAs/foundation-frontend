<script setup lang="ts">
import {
  Alert as AAlert,
  Button as AButton,
  type TableColumnsType,
  type TableProps,
} from 'ant-design-vue'
import { computed, onBeforeUnmount, ref } from 'vue'
import { getErrorMessage } from '@/api/http'
import { pageLogisticsData } from '@/api/logistics-query'
import type { DataRecord } from '@/business/basic-data/schema'
import {
  fields,
  prepareFilters,
  queryObjects,
  type QueryType,
  type ReferenceType,
} from '@/business/logistics-query/schema'
import { resolveQueryReferences, type QueryRelations } from '@/business/logistics-query/references'
import { useQueryDictionaries } from '@/business/logistics-query/useDictionaries'
import ResizableTable from '@/components/common/ResizableTable.vue'
import DataState from '../basic-data/DataState.vue'
import QueryFilters from './QueryFilters.vue'
import QueryValue from './QueryValue.vue'

const props = defineProps<{ type: QueryType; warehouseRecordId?: number; embedded?: boolean }>()
defineEmits<{ navigate: [type: ReferenceType, id: number]; boxes: [record: DataRecord] }>()
const config = queryObjects[props.type]
const draft = ref<DataRecord>({}),
  applied = ref<DataRecord>({}),
  more = ref(false),
  validation = ref('')
const loading = ref(false),
  error = ref(''),
  rows = ref<DataRecord[]>([]),
  relations = ref<QueryRelations>({})
const page = ref(1),
  size = ref(20),
  total = ref(0),
  sortBy = ref<string | undefined>('createdTime'),
  sortOrder = ref<'ASC' | 'DESC' | undefined>('DESC')
const { dictionaries, dictError, loadDictionaries } = useQueryDictionaries(props.type)
const relationFailed = computed(() =>
  Object.values(relations.value).some((value) => value === null),
)
const moreKeys = computed(() =>
  config.more.filter((key) => props.warehouseRecordId === undefined || key !== 'warehouseRecordId'),
)
const columnKeys = computed(() =>
  config.columns.filter(
    (key) => props.warehouseRecordId === undefined || key !== 'warehouseRecordId',
  ),
)
const columns = computed<TableColumnsType>(() => [
  ...columnKeys.value.map((key) => ({
    key,
    dataIndex: key,
    title: fields[key]!.label,
    width: fields[key]!.time ? 185 : fields[key]!.target ? 215 : fields[key]!.number ? 120 : 180,
    ellipsis: true,
    sorter: config.sort.includes(key),
    sortOrder:
      sortBy.value === key
        ? sortOrder.value === 'ASC'
          ? ('ascend' as const)
          : ('descend' as const)
        : null,
    sortDirections: ['ascend' as const, 'descend' as const],
  })),
  { key: 'action', title: '操作', fixed: 'right', width: props.type === 'warehouse' ? 165 : 100 },
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
let epoch = 0
async function load() {
  const current = ++epoch
  loading.value = true
  error.value = ''
  relations.value = {}
  try {
    const result = await pageLogisticsData(props.type, {
      ...applied.value,
      ...(props.warehouseRecordId !== undefined
        ? { warehouseRecordId: props.warehouseRecordId }
        : {}),
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
    // Only resolve visible columns, not every relation in the full response.
    const names = await resolveQueryReferences(columnKeys.value, rows.value)
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
function query() {
  try {
    const filters = prepareFilters(props.type, draft.value)
    validation.value = ''
    applied.value = filters
    page.value = 1
    void load()
  } catch (cause) {
    validation.value = cause instanceof Error ? cause.message : getErrorMessage(cause)
  }
}
function reset() {
  draft.value = {}
  applied.value = {}
  validation.value = ''
  page.value = 1
  sortBy.value = 'createdTime'
  sortOrder.value = 'DESC'
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
void load()
onBeforeUnmount(() => {
  epoch++
})
</script>
<template>
  <section class="management-page logistics-list" :class="{ embedded }">
    <section class="query-panel query-layout">
      <div class="query-main">
        <QueryFilters
          :keys="config.filters"
          :draft="draft"
          :dictionaries="dictionaries"
          :dict-error="dictError"
          @change="draft = $event"
          @query="query"
        />
        <div class="query-actions">
          <AButton type="link" :aria-expanded="more" @click="more = !more">{{
            more ? '收起条件' : '更多条件'
          }}</AButton
          ><AButton type="primary" @click="query">查询</AButton
          ><AButton @click="reset">重置</AButton
          ><AButton
            @click="
              load()
              loadDictionaries()
            "
            >刷新</AButton
          >
        </div>
      </div>
      <QueryFilters
        v-if="more"
        class="more-conditions"
        :keys="moreKeys"
        :draft="draft"
        :dictionaries="dictionaries"
        :dict-error="dictError"
        @change="draft = $event"
        @query="query"
      />
      <AAlert v-if="validation" type="error" show-icon :message="validation" />
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
      <header v-if="!embedded" class="table-toolbar">
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
          ><DataState :loading="loading" :error="error" @retry="load"
        /></template>
        <template #bodyCell="{ column, record }">
          <template v-if="column.key === 'action'"
            ><AButton
              type="link"
              size="small"
              :disabled="record.id === undefined"
              @click="$emit('navigate', type, record.id)"
              >查看</AButton
            ><AButton
              v-if="type === 'warehouse'"
              type="link"
              size="small"
              :disabled="record.id === undefined"
              @click="$emit('boxes', record)"
              >箱明细</AButton
            ></template
          >
          <AButton
            v-else-if="column.key === config.identity && record.id !== undefined"
            type="link"
            size="small"
            class="identity-link"
            :title="String(record[config.identity] ?? '—')"
            @click="$emit('navigate', type, record.id)"
            >{{ record[config.identity] ?? '—' }}</AButton
          >
          <QueryValue
            v-else
            :field-key="String(column.key)"
            :value="record[String(column.key)]"
            :relations="relations"
            :dictionaries="dictionaries"
            links
            @navigate="(target, id) => $emit('navigate', target, id)"
          />
        </template>
      </ResizableTable>
    </section>
  </section>
</template>
<style scoped>
.logistics-list {
  display: flex;
  flex-direction: column;
  height: 100%;
  min-height: 0;
  overflow: hidden;
}
.logistics-list > .query-layout {
  display: flex;
  flex-direction: column;
  align-items: stretch;
  gap: 8px;
}
.query-main {
  display: flex;
  align-items: flex-start;
  gap: 8px;
}
.query-main > :first-child {
  flex: 1;
}
.query-actions {
  flex-wrap: nowrap;
}
.more-conditions {
  max-height: 200px;
  overflow-y: auto;
  padding: 4px 0;
}
.logistics-list > .ant-alert {
  flex: none;
  margin-top: 8px;
}
.identity-link {
  max-width: 100%;
  overflow: hidden;
  text-overflow: ellipsis;
  padding-left: 0;
}
.embedded {
  height: min(560px, 60vh);
}
.embedded .query-main {
  flex-wrap: wrap;
}
.embedded .query-actions {
  margin-left: auto;
}
.embedded .more-conditions {
  max-height: 130px;
}
.embedded :deep(.ant-table-cell) {
  padding: 6px 10px;
}
</style>
