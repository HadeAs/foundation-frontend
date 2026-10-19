<script setup lang="ts">
import {
  Alert as AAlert,
  Button as AButton,
  Input as AInput,
  Modal as AModal,
  Select as ASelect,
  Tag as ATag,
  message,
  type TableColumnsType,
  type TableProps,
} from 'ant-design-vue'
import { computed, onActivated, onBeforeUnmount, onDeactivated, ref, watch } from 'vue'
import {
  deleteBasicData,
  getBasicDictionaries,
  getBasicData,
  isVersionConflict,
  pageBasicData,
  type BasicQuery,
  type DictionaryItem,
} from '@/api/basic-data'
import { ApiError, getErrorMessage } from '@/api/http'
import {
  relationKey,
  relationLabel,
  resolveRelations,
  type RelationMap,
} from '@/business/basic-data/relations'
import {
  lineRelations,
  objects,
  recordLabel,
  sortableFields,
  type DataRecord,
  type ObjectType,
} from '@/business/basic-data/schema'
import {
  canManageContainer,
  requireContainerCapability,
  type ContainerManagement,
} from '@/business/basic-data/container-capabilities'
import ResizableTable from '@/components/common/ResizableTable.vue'
import { formatDateTime } from '@/utils/date'
import BasicDataEditor from './BasicDataEditor.vue'
import DataState from './DataState.vue'
import ReferenceInput from './ReferenceInput.vue'

const props = defineProps<{ type: ObjectType; ownerId?: number; embedded?: boolean }>()
const emit = defineEmits<{
  manage: [record: DataRecord, kind?: ContainerManagement]
  childOpen: [open: boolean]
}>()
const config = computed(() => objects[props.type])
const filters = ref<DataRecord>({}),
  applied = ref<DataRecord>({})
const page = ref(1),
  size = ref(20),
  total = ref(0)
const sortBy = ref<string>(),
  sortOrder = ref<'ASC' | 'DESC'>()
const rows = ref<DataRecord[]>([]),
  selected = ref<number[]>([])
const relations = ref<RelationMap>({}),
  dictionaries = ref<Record<string, DictionaryItem[]>>({})
const loading = ref(false),
  error = ref(''),
  dictError = ref('')
const editor = ref<{ id?: number; readonly: boolean }>()
const deletion = ref<{ rows: DataRecord[]; batch: boolean }>()
const deleting = ref(false),
  deleteError = ref(''),
  deleteConflict = ref(false),
  managing = ref<number>()
watch(
  () => !!editor.value || !!deletion.value,
  (open) => emit('childOpen', open),
)
let epoch = 0
const filterFields = computed(() =>
  config.value.fields.filter((field) => config.value.filters.includes(field.key)),
)
const relationFailed = computed(() =>
  Object.values(relations.value).some((record) => record === null),
)
const columns = computed<TableColumnsType>(() => {
  const keys = [
    ...config.value.columns,
    ...((!config.value.owner && props.type !== 'trafficArea') ||
    props.type === 'fixtureOrder' ||
    lineRelations.includes(props.type)
      ? ['createdTime', 'updatedTime']
      : []),
  ]
  return [
    ...keys.map((key) => ({
      key,
      dataIndex: key,
      title:
        key === 'createdTime'
          ? '创建时间'
          : key === 'updatedTime'
            ? '更新时间'
            : config.value.columnLabels?.[key] ||
              config.value.fields.find((field) => field.key === key)?.label,
      width: key.endsWith('Time') ? 180 : key === 'enabled' ? 100 : key === 'remark' ? 220 : 170,
      ellipsis: true,
      sorter: sortableFields(props.type).includes(key),
      sortOrder:
        sortBy.value === key
          ? sortOrder.value === 'ASC'
            ? ('ascend' as const)
            : ('descend' as const)
          : null,
      sortDirections: ['ascend' as const, 'descend' as const],
    })),
    {
      key: 'action',
      title: '操作',
      width: ['location', 'container', 'line'].includes(props.type) ? 260 : 190,
      fixed: 'right',
    },
  ]
})
const pagination = computed(() => ({
  current: page.value,
  pageSize: size.value,
  total: total.value,
  showSizeChanger: true,
  pageSizeOptions: ['10', '20', '50', '100'],
  showTotal: (count: number) => `共 ${count} 条`,
}))
const selection = computed(() => ({
  selectedRowKeys: selected.value,
  fixed: true,
  columnWidth: 46,
  onChange: (keys: (string | number)[]) => {
    selected.value = keys.map(Number)
  },
}))
async function loadDictionaries() {
  dictError.value = ''
  try {
    dictionaries.value = await getBasicDictionaries(props.type)
  } catch (cause) {
    dictError.value = getErrorMessage(cause)
  }
}
async function load() {
  const current = ++epoch
  loading.value = true
  error.value = ''
  selected.value = []
  try {
    if (config.value.owner && props.ownerId === undefined)
      throw new ApiError('缺少所属对象，无法查询')
    const query: BasicQuery = {
      ...applied.value,
      page: page.value,
      size: size.value,
      sortBy: sortBy.value,
      sortOrder: sortOrder.value,
    }
    if (config.value.owner) query[config.value.owner] = props.ownerId
    const result = await pageBasicData(props.type, query)
    const records: DataRecord[] = result.records || []
    if (current !== epoch) return
    total.value = result.total || 0
    if (!records.length && page.value > 1) {
      const lastPage = Math.max(1, Math.ceil(total.value / size.value))
      if (page.value > lastPage) {
        page.value = lastPage
        void load()
        return
      }
    }
    rows.value = records
    relations.value = {}
    loading.value = false
    const names = await resolveRelations(props.type, records)
    if (current === epoch) relations.value = names
  } catch (cause) {
    if (current === epoch) {
      rows.value = []
      total.value = 0
      error.value = getErrorMessage(cause)
    }
  } finally {
    if (current === epoch) loading.value = false
  }
}
const searchKey = computed(() => config.value.searchKey || 'keyword')
const searchPlaceholder = computed(() =>
  config.value.searchKey
    ? `请输入${config.value.fields.find((field) => field.key === config.value.searchKey)?.label}`
    : config.value.code
      ? `请输入${config.value.label}名称或编码`
      : '请输入关键字',
)
function query() {
  applied.value = {
    ...filters.value,
    [searchKey.value]: String(filters.value[searchKey.value] || '').trim(),
  }
  page.value = 1
  void load()
}
function refresh() {
  void load()
  void loadDictionaries()
}
function reset() {
  filters.value = {}
  applied.value = {}
  sortBy.value = undefined
  sortOrder.value = undefined
  page.value = 1
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
function display(record: DataRecord, key: string) {
  const value = record[key]
  if (key === 'boxCapacity' && record.containerCategory !== 'VEHICLE_SLOT') return '—'
  if (value === undefined || value === null || value === '') return '—'
  if (props.type === 'trafficArea' && key === 'status')
    return value === 'FREE' ? '空闲' : value === 'OCCUPIED' ? '占用' : String(value)
  const field = config.value.fields.find((item) => item.key === key)
  if (field?.target) return relationLabel(field.target, value, relations.value)
  if (field?.dict)
    return (
      dictionaries.value[field.dict]?.find((item) => item.value === value)?.label || String(value)
    )
  if (key.endsWith('Time')) return formatDateTime(String(value))
  return String(value)
}
function canManage(record: DataRecord, kind: ContainerManagement) {
  return canManageContainer(relations.value[relationKey('model', record.containerModelId)], kind)
}
async function manage(record: DataRecord, kind: ContainerManagement = 'slot') {
  if (managing.value !== undefined || record.id === undefined) return
  if (props.type === 'container' && !canManage(record, kind)) return
  managing.value = record.id
  try {
    const latest =
      props.type === 'container'
        ? await requireContainerCapability(record.id, kind)
        : await getBasicData(props.type, record.id)
    emit('manage', latest, kind)
  } catch (cause) {
    message.error(getErrorMessage(cause))
  } finally {
    managing.value = undefined
  }
}
function askDelete(records: DataRecord[], batch = false) {
  if (loading.value || deleting.value || !records.length) return
  deletion.value = { rows: records.map((record) => ({ ...record })), batch }
  deleteError.value = ''
  deleteConflict.value = false
}
async function confirmDelete() {
  if (!deletion.value || deleting.value || deleteConflict.value) return
  deleting.value = true
  try {
    if (props.type === 'fixtureOrder') {
      if (props.ownerId === undefined) throw new ApiError('缺少所属治具箱')
      await requireContainerCapability(props.ownerId, 'fixtureOrder')
    }
    await deleteBasicData(props.type, deletion.value.rows, deletion.value.batch)
    deletion.value = undefined
    message.success('删除成功')
    await load()
  } catch (cause) {
    deleteError.value = getErrorMessage(cause)
    deleteConflict.value = isVersionConflict(cause)
  } finally {
    deleting.value = false
  }
}
function saved() {
  editor.value = undefined
  message.success('保存成功')
  void load()
}
function refreshAfterDeleteConflict() {
  deletion.value = undefined
  void load()
}
let needsReload = false
onDeactivated(() => {
  epoch++
  loading.value = false
  sortBy.value = undefined
  sortOrder.value = undefined
  selected.value = []
  needsReload = true
})
onActivated(() => {
  if (needsReload) {
    needsReload = false
    page.value = 1
    void load()
    void loadDictionaries()
  }
})
onBeforeUnmount(() => {
  epoch++
})
void load()
void loadDictionaries()
</script>
<template>
  <main class="management-page basic-data-page" :class="{ embedded }">
    <section class="query-panel">
      <div class="query-fields">
        <AInput
          :value="filters[searchKey] as string | undefined"
          class="keyword"
          allow-clear
          :placeholder="searchPlaceholder"
          aria-label="查询关键字"
          @update:value="filters[searchKey] = $event"
          @press-enter="query"
        />
        <template v-for="item in filterFields" :key="item.key">
          <ReferenceInput
            v-if="item.target"
            class="filter-field"
            :value="filters[item.key] as number | undefined"
            :target="item.target"
            :label="item.label"
            :placeholder="`全部${objects[item.target].label}`"
            @update:value="filters[item.key] = $event"
          />
          <ASelect
            v-else
            class="filter-field"
            :value="filters[item.key] as string | undefined"
            allow-clear
            :aria-label="item.label"
            :placeholder="`全部${item.label}`"
            :options="
              (dictionaries[item.dict || ''] || []).map((value) => ({
                label: value.label || value.value,
                value: value.value,
              }))
            "
            @update:value="filters[item.key] = $event as string | undefined"
          />
        </template>
        <ASelect
          :value="filters.enabled === undefined ? undefined : filters.enabled ? 1 : 0"
          class="status-filter"
          allow-clear
          placeholder="全部状态"
          aria-label="状态"
          :options="[
            { label: '启用', value: 1 },
            { label: '停用', value: 0 },
          ]"
          @update:value="filters.enabled = $event === undefined ? undefined : $event === 1"
        />
      </div>
      <div class="query-actions">
        <AButton type="primary" @click="query">查询</AButton><AButton @click="reset">重置</AButton
        ><AButton @click="refresh">刷新</AButton>
      </div>
    </section>
    <AAlert v-if="dictError" show-icon type="warning" :message="`字典加载失败：${dictError}`"
      ><template #action
        ><AButton size="small" @click="loadDictionaries">重试</AButton></template
      ></AAlert
    >
    <AAlert
      v-if="relationFailed && !loading"
      show-icon
      type="warning"
      message="部分关联名称加载失败，已保留原始 ID。"
      ><template #action><AButton size="small" @click="load">重试</AButton></template></AAlert
    >
    <section class="table-panel">
      <header class="table-toolbar">
        <h1>{{ config.label }}</h1>
        <div class="toolbar-actions">
          <AButton
            danger
            :disabled="!selected.length || loading || deleting"
            @click="
              askDelete(
                rows.filter((row) => row.id !== undefined && selected.includes(row.id)),
                true,
              )
            "
            >批量删除</AButton
          ><AButton type="primary" @click="editor = { readonly: false }">新增</AButton>
        </div>
      </header>
      <ResizableTable
        :columns="columns"
        :column-settings="!embedded"
        :data-source="loading || error ? [] : rows"
        row-key="id"
        size="middle"
        table-layout="fixed"
        :row-selection="selection"
        :pagination="pagination"
        @change="tableChange"
      >
        <template #emptyText
          ><DataState :loading="loading" :error="error" @retry="load"
        /></template>
        <template #bodyCell="{ column, record }">
          <template v-if="column.key === 'action'"
            ><div class="row-actions">
              <AButton type="link" size="small" @click="editor = { id: record.id, readonly: true }"
                >查看</AButton
              >
              <AButton type="link" size="small" @click="editor = { id: record.id, readonly: false }"
                >编辑</AButton
              >
              <AButton
                v-if="type === 'location' || type === 'line'"
                type="link"
                size="small"
                :loading="managing === record.id"
                @click="manage(record)"
                >关联配置</AButton
              >
              <AButton
                v-if="type === 'container' && canManage(record, 'slot')"
                type="link"
                size="small"
                :loading="managing === record.id"
                @click="manage(record, 'slot')"
                >装载位</AButton
              >
              <AButton
                v-if="type === 'container' && canManage(record, 'fixtureOrder')"
                type="link"
                size="small"
                :loading="managing === record.id"
                @click="manage(record, 'fixtureOrder')"
                >适用订单</AButton
              >
              <AButton type="link" danger size="small" @click="askDelete([record])">删除</AButton>
            </div></template
          >
          <ATag
            v-else-if="column.key === 'enabled'"
            :color="record.enabled === true ? 'success' : undefined"
            >{{
              record.enabled === true ? '启用' : record.enabled === false ? '停用' : '未知'
            }}</ATag
          >
          <ATag
            v-else-if="type === 'trafficArea' && column.key === 'status'"
            :color="
              record.status === 'FREE'
                ? 'success'
                : record.status === 'OCCUPIED'
                  ? 'warning'
                  : undefined
            "
            >{{ display(record, 'status') }}</ATag
          >
          <strong
            v-else-if="column.key === config.name"
            :title="display(record, String(column.key))"
            >{{ display(record, String(column.key)) }}</strong
          >
          <span
            v-else
            :class="{ 'object-code': column.key === config.code }"
            :title="display(record, String(column.key))"
            >{{ display(record, String(column.key)) }}</span
          >
        </template>
      </ResizableTable>
    </section>
    <BasicDataEditor
      v-if="editor"
      :type="type"
      :id="editor.id"
      :readonly="editor.readonly"
      :owner-id="ownerId"
      @close="editor = undefined"
      @saved="saved"
    />
    <AModal
      :open="!!deletion"
      title="删除确认"
      :width="460"
      :mask-closable="false"
      :closable="!deleting"
      :keyboard="!deleting"
      @cancel="!deleting && (deletion = undefined)"
    >
      <AAlert
        v-if="deleteError"
        type="error"
        show-icon
        :message="deleteError"
        style="margin-bottom: 12px"
      />
      <p class="delete-text">
        {{
          deletion?.batch
            ? `是否确认删除选中的 ${deletion.rows.length} 条${config.label}？`
            : `是否确认删除${config.label}：${deletion?.rows[0] ? recordLabel(type, deletion.rows[0]) : ''}`
        }}
      </p>
      <template #footer
        ><AButton :disabled="deleting" @click="deletion = undefined">取消</AButton
        ><AButton v-if="deleteConflict" @click="refreshAfterDeleteConflict">刷新列表</AButton
        ><AButton
          danger
          type="primary"
          :loading="deleting"
          :disabled="deleteConflict"
          @click="confirmDelete"
          >确认删除</AButton
        ></template
      >
    </AModal>
  </main>
</template>
<style scoped>
.basic-data-page {
  display: flex;
  flex-direction: column;
  height: 100%;
  min-height: 0;
  overflow: hidden;
}
.query-fields {
  display: flex;
  align-items: center;
  gap: 8px;
  flex: 1;
  min-width: 0;
  flex-wrap: wrap;
}
.keyword {
  flex: 1;
  min-width: 160px;
}
.filter-field {
  width: 175px;
}
.status-filter {
  width: 110px;
}
.status-filter :deep(.ant-select-clear) {
  top: 50%;
  inset-inline-end: 11px;
  width: 16px;
  height: 16px;
  margin-top: 0;
  transform: translateY(-50%);
  display: flex;
  align-items: center;
  justify-content: center;
}
.status-filter :deep(.ant-select-clear .anticon) {
  font-size: 12px;
  line-height: 1;
}
.basic-data-page > .ant-alert {
  flex: none;
  margin-top: 8px;
}
.embedded {
  padding: 0;
  height: min(560px, 62vh);
}
.embedded > .query-panel {
  padding: 8px;
}
.embedded .query-actions {
  flex-wrap: wrap;
}
.embedded .filter-field {
  width: 155px;
}
.delete-text {
  margin: 0;
  overflow-wrap: anywhere;
}
.object-code {
  color: var(--brand);
}
</style>
