<script setup lang="ts">
defineOptions({ name: 'DictManagementView' })

import { DatabaseOutlined } from '@ant-design/icons-vue'
import {
  Button as AButton,
  Form as AForm,
  FormItem as AFormItem,
  Input as AInput,
  InputNumber as AInputNumber,
  Modal as AModal,
  Popconfirm as APopconfirm,
  Select as ASelect,
  Switch as ASwitch,
  Tag as ATag,
  Textarea as ATextarea,
  Modal,
  message,
  type FormInstance,
  type FormProps,
  type TableColumnsType,
  type TablePaginationConfig,
  type TableProps,
} from 'ant-design-vue'
import { computed, nextTick, reactive, ref } from 'vue'

import {
  batchDeleteDictItems,
  batchDeleteDictTypes,
  createDictItem,
  createDictType,
  deleteDictItem,
  deleteDictType,
  downloadDictTemplate,
  exportDict,
  getDictDisableImpact,
  importDict,
  listManagedDictItems,
  pageDictChangeLogs,
  pageDictTypes,
  refreshDictCache,
  saveDictItemOrder,
  updateDictItem,
  updateDictType,
  type DictItemRequest,
  type DictTypeRequest,
  type SysDictChangeLog,
  type SysDictItem,
  type SysDictType,
} from '@/api/dict'
import { getErrorMessage } from '@/api/http'
import ResizableTable from '@/components/common/ResizableTable.vue'
import { formatDateTime } from '@/utils/date'
import { downloadBlob } from '@/utils/download'

import { moveDictItem } from './order'

type DictTypeForm = DictTypeRequest & { dictScope: string; status: number }
type DictItemForm = DictItemRequest & { tagType: string; sortNo: number; status: number }

const scopeOptions = [
  { label: '系统', value: 'FOUNDATION' },
  { label: '业务', value: 'BUSINESS' },
]
const statusOptions = [
  { label: '启用', value: 1 },
  { label: '禁用', value: 0 },
]
const tagOptions = [
  { label: '默认', value: '' },
  { label: '蓝色', value: 'primary' },
  { label: '绿色', value: 'success' },
  { label: '黄色', value: 'warning' },
  { label: '红色', value: 'danger' },
  { label: '灰色', value: 'info' },
]
const tagColors: Record<string, string> = {
  primary: 'processing',
  success: 'success',
  warning: 'warning',
  danger: 'error',
  info: 'default',
}
const targetLabels: Record<string, string> = { TYPE: '字典类型', ITEM: '字典项' }
const actionLabels: Record<string, string> = {
  CREATE: '新增',
  UPDATE: '修改',
  DELETE: '删除',
  IMPORT: '导入',
}

const keyword = ref('')
const status = ref<number>()
const scope = ref<string>()
const types = ref<SysDictType[]>([])
const typeLoading = ref(false)
const currentPage = ref(1)
const pageSize = ref(20)
const total = ref(0)
const selectedType = ref<SysDictType>()
const selectedTypeIds = ref<number[]>([])

const items = ref<SysDictItem[]>([])
const itemLoading = ref(false)
const selectedItemIds = ref<number[]>([])
const orderDirty = ref(false)

const typeModalOpen = ref(false)
const typeSubmitting = ref(false)
const editingType = ref<SysDictType>()
const typeFormRef = ref<FormInstance>()
const itemModalOpen = ref(false)
const itemSubmitting = ref(false)
const editingItemId = ref<number>()
const itemFormRef = ref<FormInstance>()

const cacheRefreshing = ref(false)
const importing = ref(false)
const exporting = ref(false)
const templateLoading = ref(false)
const importInput = ref<HTMLInputElement>()

const logModalOpen = ref(false)
const logs = ref<SysDictChangeLog[]>([])
const logLoading = ref(false)
const logPage = ref(1)
const logPageSize = ref(20)
const logTotal = ref(0)

const typeColumns: TableColumnsType = [
  { title: '字典名称', dataIndex: 'dictName', key: 'dictName', width: 145 },
  { title: '字典编码', dataIndex: 'dictCode', key: 'dictCode', width: 180 },
  { title: '范围', dataIndex: 'dictScope', key: 'dictScope', width: 82, align: 'center' },
  { title: '状态', dataIndex: 'status', key: 'status', width: 78, align: 'center' },
  { title: '操作', key: 'action', width: 112, align: 'center' },
]
const itemColumns: TableColumnsType = [
  { title: '显示名称', dataIndex: 'itemLabel', key: 'itemLabel', width: 140 },
  { title: '字典值', dataIndex: 'itemValue', key: 'itemValue', width: 150 },
  { title: '标签', dataIndex: 'tagType', key: 'tagType', width: 86, align: 'center' },
  { title: '排序', dataIndex: 'sortNo', key: 'sortNo', width: 82, align: 'center' },
  { title: '状态', dataIndex: 'status', key: 'status', width: 78, align: 'center' },
  { title: '操作', key: 'action', width: 190, align: 'center' },
]
const logColumns: TableColumnsType = [
  { title: '字典编码', dataIndex: 'dictCode', key: 'dictCode', width: 170 },
  { title: '对象', dataIndex: 'targetType', key: 'targetType', width: 90 },
  { title: '动作', dataIndex: 'actionType', key: 'actionType', width: 80 },
  { title: '变更前', dataIndex: 'beforeJson', key: 'beforeJson', width: 230 },
  { title: '变更后', dataIndex: 'afterJson', key: 'afterJson', width: 230 },
  { title: '操作人', dataIndex: 'operator', key: 'operator', width: 110 },
  { title: '变更时间', dataIndex: 'createdTime', key: 'createdTime', width: 160 },
]

const typePagination = computed<TablePaginationConfig>(() => ({
  current: currentPage.value,
  pageSize: pageSize.value,
  total: total.value,
  showSizeChanger: true,
  pageSizeOptions: ['10', '20', '50', '100'],
  showTotal: (count) => `共 ${count} 条`,
}))
const logPagination = computed<TablePaginationConfig>(() => ({
  current: logPage.value,
  pageSize: logPageSize.value,
  total: logTotal.value,
  showSizeChanger: true,
  pageSizeOptions: ['10', '20', '50', '100'],
  showTotal: (count) => `共 ${count} 条`,
}))
const typeRowSelection = computed<TableProps<SysDictType>['rowSelection']>(() => ({
  selectedRowKeys: selectedTypeIds.value,
  fixed: true,
  columnWidth: 48,
  onChange: (keys) => { selectedTypeIds.value = keys.map(Number) },
  getCheckboxProps: (record) => ({ disabled: record.builtinFlag === true }),
}))
const itemRowSelection = computed<TableProps<SysDictItem>['rowSelection']>(() => ({
  selectedRowKeys: selectedItemIds.value,
  fixed: true,
  columnWidth: 48,
  onChange: (keys) => { selectedItemIds.value = keys.map(Number) },
  getCheckboxProps: (record) => ({ disabled: record.builtinFlag === true }),
}))

function defaultTypeForm(): DictTypeForm {
  return { dictCode: '', dictName: '', dictScope: 'BUSINESS', status: 1, remark: undefined }
}
function defaultItemForm(): DictItemForm {
  return {
    dictCode: selectedType.value?.dictCode || '',
    itemLabel: '',
    itemValue: '',
    tagType: '',
    sortNo: (items.value.length + 1) * 10,
    status: 1,
    remark: undefined,
  }
}
const typeForm = reactive<DictTypeForm>(defaultTypeForm())
const itemForm = reactive<DictItemForm>(defaultItemForm())
const typeRules: FormProps['rules'] = {
  dictCode: [{ required: true, message: '请输入字典编码', trigger: 'blur' }],
  dictName: [{ required: true, message: '请输入字典名称', trigger: 'blur' }],
  dictScope: [{ required: true, message: '请选择字典范围', trigger: 'change' }],
}
const itemRules: FormProps['rules'] = {
  itemLabel: [{ required: true, message: '请输入显示名称', trigger: 'blur' }],
  itemValue: [{ required: true, message: '请输入字典值', trigger: 'blur' }],
}

function clean(value?: string) {
  return value?.trim() || undefined
}
function toTypeRequest(): DictTypeRequest {
  return {
    dictCode: typeForm.dictCode.trim(),
    dictName: typeForm.dictName.trim(),
    dictScope: typeForm.dictScope,
    status: typeForm.status,
    remark: clean(typeForm.remark),
  }
}
function toItemRequest(): DictItemRequest {
  return {
    dictCode: itemForm.dictCode,
    itemLabel: itemForm.itemLabel.trim(),
    itemValue: itemForm.itemValue.trim(),
    tagType: clean(itemForm.tagType),
    sortNo: itemForm.sortNo,
    status: itemForm.status,
    remark: clean(itemForm.remark),
  }
}

async function loadItems() {
  const code = selectedType.value?.dictCode
  selectedItemIds.value = []
  orderDirty.value = false
  if (!code) {
    items.value = []
    return
  }
  itemLoading.value = true
  try {
    items.value = await listManagedDictItems(code)
  } catch {
    items.value = []
    message.error('字典项获取失败，请稍后重试')
  } finally {
    itemLoading.value = false
  }
}

async function selectType(record: SysDictType) {
  if (selectedType.value?.dictTypeId === record.dictTypeId) return
  selectedType.value = record
  await loadItems()
}

async function loadTypes() {
  typeLoading.value = true
  try {
    const result = await pageDictTypes(
      currentPage.value,
      pageSize.value,
      keyword.value,
      status.value,
      scope.value,
    )
    types.value = result.records || []
    total.value = Number(result.total || 0)
    currentPage.value = Number(result.current || currentPage.value)
    pageSize.value = Number(result.size || pageSize.value)
    const current = types.value.find((record) => record.dictTypeId === selectedType.value?.dictTypeId)
    selectedType.value = current || types.value[0]
    await loadItems()
  } catch {
    types.value = []
    selectedType.value = undefined
    items.value = []
    message.error('字典类型获取失败，请稍后重试')
  } finally {
    typeLoading.value = false
  }
}

async function search() {
  currentPage.value = 1
  await loadTypes()
}
async function resetQuery() {
  keyword.value = ''
  status.value = undefined
  scope.value = undefined
  currentPage.value = 1
  await loadTypes()
}
function handleTypeTableChange(next: TablePaginationConfig) {
  const nextSize = next.pageSize || pageSize.value
  currentPage.value = nextSize === pageSize.value ? next.current || 1 : 1
  pageSize.value = nextSize
  void loadTypes()
}

function openCreateType() {
  editingType.value = undefined
  Object.assign(typeForm, defaultTypeForm())
  typeModalOpen.value = true
  nextTick(() => typeFormRef.value?.clearValidate())
}
function openEditType(record: SysDictType) {
  editingType.value = record
  Object.assign(typeForm, defaultTypeForm(), record, {
    dictScope: record.dictScope === 'FOUNDATION' ? 'FOUNDATION' : 'BUSINESS',
    status: record.status === 0 ? 0 : 1,
  })
  typeModalOpen.value = true
  nextTick(() => typeFormRef.value?.clearValidate())
}
async function confirmDisableType() {
  const id = editingType.value?.dictTypeId
  if (!id || editingType.value?.status !== 1 || typeForm.status !== 0) return true
  const impact = await getDictDisableImpact(id)
  return new Promise<boolean>((resolve) => {
    Modal.confirm({
      title: '确认停用该字典？',
      content: `停用后 ${impact.activeItemCount || 0} 个启用项将不可供业务读取，已知引用 ${impact.knownUsageCount || 0} 处。`,
      okText: '确认停用',
      cancelText: '取消',
      onOk: () => resolve(true),
      onCancel: () => resolve(false),
    })
  })
}
async function submitType() {
  try {
    await typeFormRef.value?.validate()
    if (!await confirmDisableType()) return
  } catch (error) {
    if (error instanceof Error) message.error(getErrorMessage(error))
    return
  }
  typeSubmitting.value = true
  try {
    if (editingType.value?.dictTypeId === undefined) {
      await createDictType(toTypeRequest())
      message.success('字典类型已新增')
    } else {
      await updateDictType(editingType.value.dictTypeId, toTypeRequest())
      message.success('字典类型已更新')
    }
    typeModalOpen.value = false
    await loadTypes()
  } catch (error) {
    message.error(getErrorMessage(error))
  } finally {
    typeSubmitting.value = false
  }
}
async function removeType(record: SysDictType) {
  if (record.dictTypeId === undefined || record.builtinFlag) return
  try {
    await deleteDictType(record.dictTypeId)
    message.success('字典类型已删除')
    await loadTypes()
  } catch (error) {
    message.error(getErrorMessage(error))
  }
}
function removeSelectedTypes() {
  Modal.confirm({
    title: `确认删除选中的 ${selectedTypeIds.value.length} 个字典类型？`,
    content: '字典类型及其字典项将一并删除。',
    okText: '删除',
    cancelText: '取消',
    onOk: async () => {
      await batchDeleteDictTypes(selectedTypeIds.value)
      selectedTypeIds.value = []
      message.success('字典类型已批量删除')
      await loadTypes()
    },
  })
}

function openCreateItem() {
  if (!selectedType.value?.dictCode) return
  editingItemId.value = undefined
  Object.assign(itemForm, defaultItemForm())
  itemModalOpen.value = true
  nextTick(() => itemFormRef.value?.clearValidate())
}
function openEditItem(record: SysDictItem) {
  if (record.dictItemId === undefined) return
  editingItemId.value = record.dictItemId
  Object.assign(itemForm, defaultItemForm(), record, {
    dictCode: selectedType.value?.dictCode || record.dictCode || '',
    tagType: record.tagType || '',
    sortNo: record.sortNo || 0,
    status: record.status === 0 ? 0 : 1,
  })
  itemModalOpen.value = true
  nextTick(() => itemFormRef.value?.clearValidate())
}
async function submitItem() {
  try {
    await itemFormRef.value?.validate()
  } catch {
    return
  }
  itemSubmitting.value = true
  try {
    if (editingItemId.value === undefined) {
      await createDictItem(toItemRequest())
      message.success('字典项已新增')
    } else {
      await updateDictItem(editingItemId.value, toItemRequest())
      message.success('字典项已更新')
    }
    itemModalOpen.value = false
    await loadItems()
  } catch (error) {
    message.error(getErrorMessage(error))
  } finally {
    itemSubmitting.value = false
  }
}
async function removeItem(record: SysDictItem) {
  if (record.dictItemId === undefined || record.builtinFlag) return
  try {
    await deleteDictItem(record.dictItemId)
    message.success('字典项已删除')
    await loadItems()
  } catch (error) {
    message.error(getErrorMessage(error))
  }
}
function moveItem(record: SysDictItem, offset: -1 | 1) {
  if (record.dictItemId === undefined) return
  const next = moveDictItem(items.value, record.dictItemId, offset)
  if (next === items.value) return
  items.value = next
  orderDirty.value = true
}
async function persistOrder() {
  const code = selectedType.value?.dictCode
  if (!code) return
  const sorted = items.value.flatMap((item) =>
    item.dictItemId === undefined ? [] : [{ dictItemId: item.dictItemId, sortNo: item.sortNo || 0 }],
  )
  try {
    await saveDictItemOrder(code, sorted)
    orderDirty.value = false
    message.success('字典项排序已保存')
  } catch (error) {
    message.error(getErrorMessage(error))
  }
}
function removeSelectedItems() {
  Modal.confirm({
    title: `确认删除选中的 ${selectedItemIds.value.length} 个字典项？`,
    okText: '删除',
    cancelText: '取消',
    onOk: async () => {
      await batchDeleteDictItems(selectedItemIds.value)
      selectedItemIds.value = []
      message.success('字典项已批量删除')
      await loadItems()
    },
  })
}

async function downloadTemplate() {
  templateLoading.value = true
  try {
    const response = await downloadDictTemplate()
    downloadBlob(response.data, '数据字典导入模板.csv')
  } catch (error) {
    message.error(getErrorMessage(error))
  } finally {
    templateLoading.value = false
  }
}
async function exportCurrent() {
  exporting.value = true
  try {
    const code = selectedType.value?.dictCode
    const response = await exportDict(code)
    downloadBlob(response.data, code ? `${code}.csv` : '数据字典.csv')
  } catch (error) {
    message.error(getErrorMessage(error))
  } finally {
    exporting.value = false
  }
}
async function handleImport(event: Event) {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  input.value = ''
  if (!file) return
  importing.value = true
  try {
    const result = await importDict(file)
    const changed = (result.createdTypes || 0) + (result.updatedTypes || 0)
      + (result.createdItems || 0) + (result.updatedItems || 0)
    message.success(`导入完成，共写入 ${changed} 条，跳过 ${result.skippedRows || 0} 条`)
    if (result.errors?.length) {
      Modal.warning({ title: '部分数据未导入', content: result.errors.slice(0, 8).join('；') })
    }
    await loadTypes()
  } catch (error) {
    message.error(getErrorMessage(error))
  } finally {
    importing.value = false
  }
}
async function refreshCache() {
  cacheRefreshing.value = true
  try {
    await refreshDictCache()
    message.success('字典缓存已刷新')
  } catch (error) {
    message.error(getErrorMessage(error))
  } finally {
    cacheRefreshing.value = false
  }
}

async function loadLogs() {
  logLoading.value = true
  try {
    const result = await pageDictChangeLogs(
      logPage.value,
      logPageSize.value,
      selectedType.value?.dictCode,
    )
    logs.value = result.records || []
    logTotal.value = Number(result.total || 0)
    logPage.value = Number(result.current || logPage.value)
    logPageSize.value = Number(result.size || logPageSize.value)
  } catch {
    message.error('变更记录获取失败，请稍后重试')
  } finally {
    logLoading.value = false
  }
}
function openLogs() {
  logPage.value = 1
  logModalOpen.value = true
  void loadLogs()
}
function handleLogTableChange(next: TablePaginationConfig) {
  const nextSize = next.pageSize || logPageSize.value
  logPage.value = nextSize === logPageSize.value ? next.current || 1 : 1
  logPageSize.value = nextSize
  void loadLogs()
}

loadTypes()
</script>

<template>
  <main class="management-page">
    <section class="query-panel">
      <div class="query-fields">
        <a-input v-model:value="keyword" allow-clear placeholder="请输入字典名称或编码" @press-enter="search" />
        <a-select v-model:value="scope" allow-clear placeholder="全部范围" :options="scopeOptions" />
        <a-select v-model:value="status" allow-clear placeholder="全部状态" :options="statusOptions" />
      </div>
      <div class="query-actions">
        <a-button type="primary" :loading="typeLoading" @click="search">查询</a-button>
        <a-button class="secondary-action" :disabled="typeLoading" @click="resetQuery">重置</a-button>
        <a-button class="secondary-action" :disabled="typeLoading" @click="loadTypes">刷新</a-button>
      </div>
    </section>

    <section class="utility-bar">
      <h1>数据维护</h1>
      <div class="toolbar-actions">
        <a-button class="secondary-action" :loading="templateLoading" @click="downloadTemplate">下载模板</a-button>
        <a-button class="secondary-action" :loading="importing" @click="importInput?.click()">导入 CSV</a-button>
        <a-button class="secondary-action" :loading="exporting" @click="exportCurrent">导出{{ selectedType ? '当前字典' : '全部字典' }}</a-button>
        <a-button class="secondary-action" @click="openLogs">变更记录</a-button>
        <a-button class="secondary-action" :loading="cacheRefreshing" @click="refreshCache">刷新缓存</a-button>
        <input ref="importInput" class="file-input" type="file" accept=".csv,text/csv" @change="handleImport" />
      </div>
    </section>

    <section class="dict-workspace">
      <div class="dict-panel type-panel">
        <header class="panel-toolbar">
          <div><h1>字典类型</h1></div>
          <div class="toolbar-actions">
            <a-button
              v-if="selectedTypeIds.length"
              danger
              class="secondary-action"
              @click="removeSelectedTypes"
            >批量删除</a-button>
            <a-button type="primary" @click="openCreateType">新增字典</a-button>
          </div>
        </header>
        <ResizableTable
          class="dict-table"
          row-key="dictTypeId"
          size="middle"
          table-layout="fixed"
          :columns="typeColumns"
          :data-source="types"
          :loading="typeLoading"
          :pagination="typePagination"
          :row-selection="typeRowSelection"
          :custom-row="(record: SysDictType) => ({ onClick: () => selectType(record) })"
          :row-class-name="(record: SysDictType) => record.dictTypeId === selectedType?.dictTypeId ? 'selected-row' : ''"
          @change="handleTypeTableChange"
        >
          <template #bodyCell="{ column, record }">
            <template v-if="column.key === 'dictName'">
              <strong class="primary-cell">{{ record.dictName || '—' }}</strong>
            </template>
            <template v-else-if="column.key === 'dictCode'">
              <code class="code-cell">{{ record.dictCode || '—' }}</code>
            </template>
            <template v-else-if="column.key === 'dictScope'">
              <a-tag :color="record.dictScope === 'FOUNDATION' ? 'blue' : 'cyan'">
                {{ record.dictScope === 'FOUNDATION' ? '系统' : record.dictScope === 'BUSINESS' ? '业务' : record.dictScope || '未知' }}
              </a-tag>
            </template>
            <template v-else-if="column.key === 'status'">
              <span class="status-text" :class="{ disabled: record.status === 0 }">
                <i></i>{{ record.status === 0 ? '禁用' : '启用' }}
              </span>
            </template>
            <template v-else-if="column.key === 'action'">
              <div class="row-actions">
                <a-button type="link" size="small" @click.stop="openEditType(record)">编辑</a-button>
                <a-popconfirm
                  title="确认删除该字典类型？"
                  description="所属字典项也会被删除。"
                  ok-text="删除"
                  cancel-text="取消"
                  :disabled="record.builtinFlag === true"
                  @confirm="removeType(record)"
                >
                  <a-button type="link" danger size="small" :disabled="record.builtinFlag === true" @click.stop>删除</a-button>
                </a-popconfirm>
              </div>
            </template>
          </template>
          <template #emptyText>
            <div class="empty-table"><DatabaseOutlined /><span>暂无符合条件的字典类型</span></div>
          </template>
        </ResizableTable>
      </div>

      <div class="dict-panel item-panel">
        <header class="panel-toolbar item-toolbar">
          <div>
            <h1>字典项</h1>
          </div>
          <div class="toolbar-actions item-actions">
            <template v-if="selectedItemIds.length">
              <a-button danger class="secondary-action" @click="removeSelectedItems">批量删除</a-button>
            </template>
            <a-button v-if="orderDirty" class="secondary-action" @click="persistOrder">保存排序</a-button>
            <a-button type="primary" :disabled="!selectedType" @click="openCreateItem">新增字典项</a-button>
          </div>
        </header>
        <ResizableTable
          class="dict-table"
          row-key="dictItemId"
          size="middle"
          table-layout="fixed"
          :columns="itemColumns"
          :data-source="items"
          :loading="itemLoading"
          :pagination="false"
          :row-selection="itemRowSelection"
        >
          <template #bodyCell="{ column, record, index }">
            <template v-if="column.key === 'itemLabel'">
              <strong class="primary-cell">{{ record.itemLabel || '—' }}</strong>
            </template>
            <template v-else-if="column.key === 'itemValue'">
              <code class="code-cell">{{ record.itemValue || '—' }}</code>
            </template>
            <template v-else-if="column.key === 'tagType'">
              <a-tag :color="tagColors[record.tagType]">{{ record.tagType || '默认' }}</a-tag>
            </template>
            <template v-else-if="column.key === 'status'">
              <span class="status-text" :class="{ disabled: record.status === 0 }">
                <i></i>{{ record.status === 0 ? '禁用' : '启用' }}
              </span>
            </template>
            <template v-else-if="column.key === 'action'">
              <div class="row-actions item-row-actions">
                <a-button type="link" size="small" :disabled="index === 0" @click="moveItem(record, -1)">上移</a-button>
                <a-button type="link" size="small" :disabled="index === items.length - 1" @click="moveItem(record, 1)">下移</a-button>
                <a-button type="link" size="small" @click="openEditItem(record)">编辑</a-button>
                <a-popconfirm
                  title="确认删除该字典项？"
                  ok-text="删除"
                  cancel-text="取消"
                  :disabled="record.builtinFlag === true"
                  @confirm="removeItem(record)"
                >
                  <a-button type="link" danger size="small" :disabled="record.builtinFlag === true">删除</a-button>
                </a-popconfirm>
              </div>
            </template>
          </template>
          <template #emptyText>
            <div class="empty-table"><DatabaseOutlined /><span>{{ selectedType ? '该字典暂无字典项' : '请先选择字典类型' }}</span></div>
          </template>
        </ResizableTable>
      </div>
    </section>

    <a-modal
      v-model:open="typeModalOpen"
      :title="editingType ? '编辑字典类型' : '新增字典类型'"
      :width="760"
      :confirm-loading="typeSubmitting"
      :mask-closable="false"
      ok-text="保存"
      cancel-text="取消"
      @ok="submitType"
    >
      <a-form ref="typeFormRef" class="modal-form" layout="vertical" :model="typeForm" :rules="typeRules">
        <div class="form-grid">
          <a-form-item label="字典名称" name="dictName">
            <a-input v-model:value="typeForm.dictName" :maxlength="128" placeholder="请输入字典名称" />
          </a-form-item>
          <a-form-item label="字典编码" name="dictCode">
            <a-input v-model:value="typeForm.dictCode" :disabled="Boolean(editingType)" :maxlength="64" placeholder="例如 async_task_status" />
          </a-form-item>
          <a-form-item label="字典范围" name="dictScope">
            <a-select v-model:value="typeForm.dictScope" :options="scopeOptions" />
          </a-form-item>
          <a-form-item label="启用状态" name="status">
            <div class="switch-field">
              <a-switch :checked="typeForm.status === 1" @change="typeForm.status = $event ? 1 : 0" />
              <span>{{ typeForm.status === 1 ? '已启用' : '已禁用' }}</span>
            </div>
          </a-form-item>
          <a-form-item class="full-field" label="备注" name="remark">
            <a-textarea v-model:value="typeForm.remark" :rows="3" :maxlength="255" placeholder="请输入备注信息" />
          </a-form-item>
        </div>
      </a-form>
    </a-modal>

    <a-modal
      v-model:open="itemModalOpen"
      :title="editingItemId === undefined ? '新增字典项' : '编辑字典项'"
      :width="760"
      :confirm-loading="itemSubmitting"
      :mask-closable="false"
      ok-text="保存"
      cancel-text="取消"
      @ok="submitItem"
    >
      <a-form ref="itemFormRef" class="modal-form" layout="vertical" :model="itemForm" :rules="itemRules">
        <div class="form-grid">
          <a-form-item label="显示名称" name="itemLabel">
            <a-input v-model:value="itemForm.itemLabel" :maxlength="128" placeholder="请输入显示名称" />
          </a-form-item>
          <a-form-item label="字典值" name="itemValue">
            <a-input v-model:value="itemForm.itemValue" :maxlength="128" placeholder="请输入字典值" />
          </a-form-item>
          <a-form-item label="标签颜色" name="tagType">
            <a-select v-model:value="itemForm.tagType" :options="tagOptions" />
          </a-form-item>
          <a-form-item label="排序号" name="sortNo">
            <a-input-number v-model:value="itemForm.sortNo" :min="0" :precision="0" class="number-input" />
          </a-form-item>
          <a-form-item label="启用状态" name="status">
            <div class="switch-field">
              <a-switch :checked="itemForm.status === 1" @change="itemForm.status = $event ? 1 : 0" />
              <span>{{ itemForm.status === 1 ? '已启用' : '已禁用' }}</span>
            </div>
          </a-form-item>
          <a-form-item class="full-field" label="备注" name="remark">
            <a-textarea v-model:value="itemForm.remark" :rows="3" :maxlength="255" placeholder="请输入备注信息" />
          </a-form-item>
        </div>
      </a-form>
    </a-modal>

    <a-modal v-model:open="logModalOpen" title="字典变更记录" :width="1120" :footer="null">
      <ResizableTable
        class="dict-table log-table"
        row-key="logId"
        size="middle"
        table-layout="fixed"
        :columns="logColumns"
        :data-source="logs"
        :loading="logLoading"
        :pagination="logPagination"
        @change="handleLogTableChange"
      >
        <template #bodyCell="{ column, record }">
          <template v-if="column.key === 'dictCode'"><code class="code-cell">{{ record.dictCode || '—' }}</code></template>
          <template v-else-if="column.key === 'targetType'">{{ targetLabels[record.targetType] || record.targetType || '未知' }}</template>
          <template v-else-if="column.key === 'actionType'">{{ actionLabels[record.actionType] || record.actionType || '未知' }}</template>
          <template v-else-if="column.key === 'beforeJson' || column.key === 'afterJson'">
            <span class="json-cell" :title="record[column.key]">{{ record[column.key] || '—' }}</span>
          </template>
          <template v-else-if="column.key === 'createdTime'">{{ formatDateTime(record.createdTime) }}</template>
        </template>
      </ResizableTable>
    </a-modal>
  </main>
</template>

<style scoped>
.query-panel { display: flex; align-items: center; justify-content: space-between; gap: 18px; padding: 11px 13px; border: 1px solid var(--shell-border); background: var(--shell-panel); }
.query-fields { display: grid; width: min(720px, 68%); grid-template-columns: minmax(260px, 2fr) 130px 130px; gap: 8px; }
.query-actions, .toolbar-actions { display: flex; align-items: center; gap: 7px; }
.query-actions :deep(.ant-btn) { min-width: 58px; }
.secondary-action { color: var(--shell-ink); background: var(--shell-hover); }
.secondary-action:hover { color: var(--brand) !important; background: color-mix(in srgb, var(--brand) 11%, var(--shell-panel)) !important; }
.dict-workspace { display: grid; min-width: 0; margin-top: 8px; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 8px; }
.dict-panel { min-width: 0; border: 1px solid var(--shell-border); background: var(--shell-panel); }
.panel-toolbar { display: flex; min-height: 58px; align-items: center; justify-content: space-between; gap: 12px; padding: 9px 13px; border-bottom: 1px solid var(--shell-border); }
.panel-toolbar > div:first-child { min-width: 0; }
.panel-toolbar h1 { margin: 0; color: var(--shell-ink); font-size: 18px; font-weight: 600; }
.item-actions { justify-content: flex-end; flex-wrap: wrap; }
.dict-table, .dict-table :deep(.ant-table), .dict-table :deep(.ant-table-container), .dict-table :deep(.ant-table-content) { border-radius: 0 !important; }
.dict-table :deep(.ant-table) { color: var(--shell-ink); background: var(--shell-panel); }
.dict-table :deep(.ant-table-thead > tr > th) { padding-block: 9px; color: var(--shell-muted); font-size: 13px; font-weight: 600; background: var(--shell-hover); }
.dict-table :deep(.ant-table-tbody > tr > td) { padding-block: 8px; }
.dict-table :deep(.ant-table-tbody > tr:hover > td), .dict-table :deep(.selected-row > td) { background: color-mix(in srgb, var(--brand) 8%, var(--shell-panel)) !important; }
.dict-table :deep(.ant-pagination) { margin: 13px; }
.primary-cell { color: var(--shell-ink); font-weight: 600; }
.code-cell { color: var(--brand-deep); font-family: 'SFMono-Regular', Consolas, monospace; font-size: 12px; }
.status-text { display: inline-flex; align-items: center; gap: 6px; white-space: nowrap; }
.status-text i { width: 7px; height: 7px; border-radius: 50%; background: #28aa81; }
.status-text.disabled i { background: #aab3b3; }
.row-actions { display: flex; align-items: center; justify-content: center; white-space: nowrap; }
.row-actions :deep(.ant-btn) { padding-inline: 4px; }
.empty-table { display: flex; min-height: 200px; align-items: center; justify-content: center; flex-direction: column; gap: 10px; color: var(--shell-muted); }
.empty-table :deep(.anticon) { font-size: 30px; }
.utility-bar { display: flex; min-height: 52px; align-items: center; justify-content: space-between; margin-top: 8px; padding: 8px 13px; border: 1px solid var(--shell-border); background: var(--shell-panel); }
.utility-bar > h1 { margin: 0; color: var(--shell-ink); font-size: 18px; font-weight: 600; }
.file-input { display: none; }
.modal-form { padding-top: 8px; }
.form-grid { display: grid; column-gap: 18px; grid-template-columns: repeat(2, minmax(0, 1fr)); }
.form-grid :deep(.ant-form-item) { margin-bottom: 14px; }
.full-field { grid-column: 1 / -1; }
.switch-field { display: flex; min-height: 34px; align-items: center; gap: 9px; color: var(--shell-muted); }
.number-input { width: 100%; }
.json-cell { display: block; overflow: hidden; color: var(--shell-muted); text-overflow: ellipsis; white-space: nowrap; }
.log-table { margin-top: 10px; }
</style>
