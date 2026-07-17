<script setup lang="ts">
defineOptions({ name: 'ConfigManagementView' })

import { ControlOutlined } from '@ant-design/icons-vue'
import {
  Button as AButton,
  Form as AForm,
  FormItem as AFormItem,
  Input as AInput,
  Modal as AModal,
  Popconfirm as APopconfirm,
  Select as ASelect,
  Switch as ASwitch,
  Tag as ATag,
  Textarea as ATextarea,
  message,
  type FormInstance,
  type FormProps,
  type TableColumnsType,
  type TablePaginationConfig,
} from 'ant-design-vue'
import { computed, nextTick, reactive, ref } from 'vue'

import {
  createConfig,
  deleteConfig,
  pageConfigs,
  refreshConfigCache,
  updateConfig,
  type ConfigRequest,
  type SysConfig,
} from '@/api/config'
import { getErrorMessage } from '@/api/http'
import ResizableTable from '@/components/common/ResizableTable.vue'
import { formatDateTime } from '@/utils/date'

import { getConfigValueError, type ConfigValueType } from './value'

type ConfigScope = 'FOUNDATION' | 'BUSINESS'
type ConfigForm = Omit<ConfigRequest, 'configType' | 'configScope'> & {
  configType: ConfigValueType
  configScope: ConfigScope
  editable: boolean
  sensitiveFlag: boolean
}

const typeOptions = [
  { label: '字符串', value: 'string' },
  { label: '布尔值', value: 'boolean' },
  { label: '数字', value: 'number' },
  { label: 'JSON', value: 'json' },
]
const scopeOptions = [
  { label: '系统', value: 'FOUNDATION' },
  { label: '业务', value: 'BUSINESS' },
]
const typeLabels: Record<string, string> = Object.fromEntries(typeOptions.map((item) => [item.value, item.label]))
const scopeLabels: Record<string, string> = Object.fromEntries(scopeOptions.map((item) => [item.value, item.label]))

const keyword = ref('')
const group = ref('')
const scope = ref<string>()
const records = ref<SysConfig[]>([])
const loading = ref(false)
const currentPage = ref(1)
const pageSize = ref(20)
const total = ref(0)
const modalOpen = ref(false)
const submitting = ref(false)
const refreshingCache = ref(false)
const deletingId = ref<number>()
const editingId = ref<number>()
const formRef = ref<FormInstance>()

const columns: TableColumnsType = [
  { title: '参数键', dataIndex: 'configKey', key: 'configKey', width: 210 },
  { title: '参数值', dataIndex: 'configValue', key: 'configValue', width: 220 },
  { title: '类型', dataIndex: 'configType', key: 'configType', width: 90 },
  { title: '分组', dataIndex: 'configGroup', key: 'configGroup', width: 120 },
  { title: '范围', dataIndex: 'configScope', key: 'configScope', width: 90, align: 'center' },
  { title: '保护', dataIndex: 'editable', key: 'editable', width: 90, align: 'center' },
  { title: '更新时间', dataIndex: 'updatedTime', key: 'updatedTime', width: 155 },
  { title: '操作', key: 'action', width: 110, align: 'center' },
]

function defaultForm(): ConfigForm {
  return {
    configKey: '',
    configValue: '',
    configType: 'string',
    configGroup: undefined,
    configScope: 'BUSINESS',
    editable: true,
    sensitiveFlag: false,
    remark: undefined,
  }
}

const form = reactive<ConfigForm>(defaultForm())
const modalTitle = computed(() => editingId.value === undefined ? '新增参数' : '编辑参数')
const pagination = computed<TablePaginationConfig>(() => ({
  current: currentPage.value,
  pageSize: pageSize.value,
  total: total.value,
  showSizeChanger: true,
  pageSizeOptions: ['10', '20', '50', '100'],
  showTotal: (count) => `共 ${count} 条`,
}))

const rules: FormProps['rules'] = {
  configKey: [{ required: true, message: '请输入参数键', trigger: 'blur' }],
  configValue: [{
    validator: async () => {
      const error = getConfigValueError(form.configType, form.configValue)
      if (error) throw new Error(error)
    },
    trigger: 'blur',
  }],
  configType: [{ required: true, message: '请选择参数类型', trigger: 'change' }],
  configScope: [{ required: true, message: '请选择参数范围', trigger: 'change' }],
}

function clean(value?: string) {
  return value?.trim() || undefined
}

function toRequest(source: ConfigForm): ConfigRequest {
  return {
    configKey: source.configKey.trim(),
    configValue: source.configValue.trim(),
    configType: source.configType,
    configGroup: clean(source.configGroup),
    configScope: source.configScope,
    editable: source.editable,
    sensitiveFlag: source.sensitiveFlag,
    remark: clean(source.remark),
  }
}

async function load() {
  loading.value = true
  try {
    const result = await pageConfigs(currentPage.value, pageSize.value, keyword.value, group.value, scope.value)
    records.value = result.records || []
    total.value = Number(result.total || 0)
    currentPage.value = Number(result.current || currentPage.value)
    pageSize.value = Number(result.size || pageSize.value)
  } catch {
    message.error('数据获取失败，请稍后重试')
  } finally {
    loading.value = false
  }
}

async function search() {
  currentPage.value = 1
  await load()
}

async function resetQuery() {
  keyword.value = ''
  group.value = ''
  scope.value = undefined
  currentPage.value = 1
  await load()
}

function handleTableChange(next: TablePaginationConfig) {
  const nextSize = next.pageSize || pageSize.value
  currentPage.value = nextSize === pageSize.value ? next.current || 1 : 1
  pageSize.value = nextSize
  void load()
}

function resetForm() {
  Object.assign(form, defaultForm())
  nextTick(() => formRef.value?.clearValidate())
}

function openCreate() {
  editingId.value = undefined
  resetForm()
  modalOpen.value = true
}

function openEdit(record: SysConfig) {
  if (record.configId === undefined || record.editable === false) return
  editingId.value = record.configId
  Object.assign(form, defaultForm(), record, {
    configType: typeOptions.some((item) => item.value === record.configType) ? record.configType : 'string',
    configScope: record.configScope === 'FOUNDATION' ? 'FOUNDATION' : 'BUSINESS',
    editable: true,
    sensitiveFlag: record.sensitiveFlag === true,
  })
  modalOpen.value = true
  nextTick(() => formRef.value?.clearValidate())
}

async function submit() {
  try {
    await formRef.value?.validate()
  } catch {
    return
  }

  submitting.value = true
  try {
    if (editingId.value === undefined) {
      await createConfig(toRequest(form))
      message.success('参数已新增')
    } else {
      await updateConfig(editingId.value, toRequest(form))
      message.success('参数已更新')
    }
    modalOpen.value = false
    await load()
  } catch (error) {
    message.error(getErrorMessage(error))
  } finally {
    submitting.value = false
  }
}

async function remove(record: SysConfig) {
  if (record.configId === undefined || record.editable === false) return
  deletingId.value = record.configId
  try {
    await deleteConfig(record.configId)
    if (records.value.length === 1 && currentPage.value > 1) currentPage.value -= 1
    message.success('参数已删除')
    await load()
  } catch (error) {
    message.error(getErrorMessage(error))
  } finally {
    deletingId.value = undefined
  }
}

async function refreshCache() {
  refreshingCache.value = true
  try {
    await refreshConfigCache()
    message.success('参数缓存已刷新')
  } catch (error) {
    message.error(getErrorMessage(error))
  } finally {
    refreshingCache.value = false
  }
}

load()
</script>

<template>
  <main class="management-page">
    <section class="query-panel">
      <div class="query-fields">
        <a-input
          v-model:value="keyword"
          allow-clear
          placeholder="请输入参数键或参数值"
          @press-enter="search"
        />
        <a-input v-model:value="group" allow-clear placeholder="请输入参数分组" @press-enter="search" />
        <a-select
          v-model:value="scope"
          allow-clear
          placeholder="全部范围"
          :options="scopeOptions"
        />
      </div>
      <div class="query-actions">
        <a-button type="primary" :loading="loading" @click="search">查询</a-button>
        <a-button class="secondary-action" :disabled="loading" @click="resetQuery">重置</a-button>
        <a-button class="secondary-action" :disabled="loading" @click="load">刷新</a-button>
      </div>
    </section>

    <section class="table-panel">
      <header class="table-toolbar">
        <h1>参数列表</h1>
        <div class="toolbar-actions">
          <a-button class="secondary-action" :loading="refreshingCache" @click="refreshCache">刷新缓存</a-button>
          <a-button type="primary" @click="openCreate">新增参数</a-button>
        </div>
      </header>

      <ResizableTable
        class="config-table"
        row-key="configId"
        size="middle"
        table-layout="fixed"
        :columns="columns"
        :data-source="records"
        :loading="loading"
        :pagination="pagination"
        @change="handleTableChange"
      >
        <template #bodyCell="{ column, record }">
          <template v-if="column.key === 'configKey'">
            <code class="config-key">{{ record.configKey || '—' }}</code>
          </template>
          <template v-else-if="column.key === 'configValue'">
            <span class="cell-text" :title="record.sensitiveFlag ? '敏感参数' : record.configValue">
              {{ record.sensitiveFlag ? '••••••••' : record.configValue || '—' }}
            </span>
          </template>
          <template v-else-if="column.key === 'configType'">
            <a-tag>{{ typeLabels[record.configType] || record.configType || '未知' }}</a-tag>
          </template>
          <template v-else-if="column.key === 'configGroup'">
            <span class="cell-text">{{ record.configGroup || '—' }}</span>
          </template>
          <template v-else-if="column.key === 'configScope'">
            <a-tag :color="record.configScope === 'FOUNDATION' ? 'blue' : 'cyan'">
              {{ scopeLabels[record.configScope] || record.configScope || '未知' }}
            </a-tag>
          </template>
          <template v-else-if="column.key === 'editable'">
            <a-tag :color="record.editable === false ? 'orange' : 'green'">
              {{ record.editable === false ? '受保护' : '可编辑' }}
            </a-tag>
          </template>
          <template v-else-if="column.key === 'updatedTime'">
            <span class="cell-text">{{ formatDateTime(record.updatedTime) }}</span>
          </template>
          <template v-else-if="column.key === 'action'">
            <div class="row-actions">
              <a-button type="link" size="small" :disabled="record.editable === false" @click="openEdit(record)">编辑</a-button>
              <a-popconfirm
                title="确认删除该参数？"
                description="删除后可能影响依赖该参数的系统功能。"
                ok-text="删除"
                cancel-text="取消"
                @confirm="remove(record)"
              >
                <a-button
                  type="link"
                  danger
                  size="small"
                  :disabled="record.editable === false"
                  :loading="deletingId === record.configId"
                >删除</a-button>
              </a-popconfirm>
            </div>
          </template>
        </template>
        <template #emptyText>
          <div class="empty-table"><ControlOutlined /><span>暂无符合条件的参数</span></div>
        </template>
      </ResizableTable>
    </section>

    <a-modal
      v-model:open="modalOpen"
      :title="modalTitle"
      :width="800"
      :confirm-loading="submitting"
      :mask-closable="false"
      ok-text="保存"
      cancel-text="取消"
      @ok="submit"
    >
      <a-form ref="formRef" class="config-form" layout="vertical" :model="form" :rules="rules">
        <div class="form-grid">
          <a-form-item label="参数键" name="configKey">
            <a-input v-model:value="form.configKey" :maxlength="128" placeholder="例如 system.upload.max-size" />
          </a-form-item>
          <a-form-item label="参数类型" name="configType">
            <a-select v-model:value="form.configType" :options="typeOptions" />
          </a-form-item>
          <a-form-item label="参数分组" name="configGroup">
            <a-input v-model:value="form.configGroup" :maxlength="64" placeholder="请输入参数分组" />
          </a-form-item>
          <a-form-item label="参数范围" name="configScope">
            <a-select v-model:value="form.configScope" :options="scopeOptions" />
          </a-form-item>
          <a-form-item class="full-field" label="参数值" name="configValue">
            <a-textarea
              v-model:value="form.configValue"
              :rows="form.configType === 'json' ? 5 : 3"
              placeholder="请输入参数值"
            />
          </a-form-item>
          <div class="form-pair full-field">
            <a-form-item label="允许编辑" name="editable">
              <div class="switch-field">
                <a-switch v-model:checked="form.editable" />
                <span>{{ form.editable ? '可编辑' : '受保护' }}</span>
              </div>
            </a-form-item>
            <a-form-item label="敏感参数" name="sensitiveFlag">
              <div class="switch-field">
                <a-switch v-model:checked="form.sensitiveFlag" />
                <span>{{ form.sensitiveFlag ? '敏感' : '普通' }}</span>
              </div>
            </a-form-item>
          </div>
          <a-form-item class="full-field" label="备注" name="remark">
            <a-textarea v-model:value="form.remark" :rows="3" :maxlength="255" placeholder="请输入备注信息" />
          </a-form-item>
        </div>
      </a-form>
    </a-modal>
  </main>
</template>

<style scoped>
.query-panel { display: flex; align-items: center; justify-content: space-between; gap: 18px; padding: 11px 13px; border: 1px solid var(--shell-border); background: var(--shell-panel); }
.query-fields { display: grid; width: min(820px, 70%); grid-template-columns: minmax(260px, 2fr) minmax(150px, 1fr) 130px; gap: 8px; }
.query-actions, .toolbar-actions { display: flex; gap: 7px; }
.query-actions :deep(.ant-btn) { min-width: 58px; }
.secondary-action { color: var(--shell-ink); background: var(--shell-hover); }
.secondary-action:hover { color: var(--brand) !important; background: color-mix(in srgb, var(--brand) 11%, var(--shell-panel)) !important; }
.table-panel { margin-top: 8px; border: 1px solid var(--shell-border); background: var(--shell-panel); }
.table-toolbar { display: flex; min-height: 58px; align-items: center; justify-content: space-between; padding: 9px 13px; border-bottom: 1px solid var(--shell-border); }
.table-toolbar h1 { margin: 0; color: var(--shell-ink); font-size: 18px; font-weight: 600; }
.config-table :deep(.ant-table) { color: var(--shell-ink); background: var(--shell-panel); }
.config-table :deep(.ant-table-thead > tr > th) { padding-block: 9px; color: var(--shell-muted); font-size: 13px; font-weight: 600; background: var(--shell-hover); }
.config-table :deep(.ant-table-tbody > tr > td) { padding-block: 8px; }
.config-table :deep(.ant-table-tbody > tr:hover > td) { background: color-mix(in srgb, var(--brand) 7%, var(--shell-panel)); }
.config-table :deep(.ant-pagination) { margin: 13px; }
.config-key { color: var(--brand-deep); font-family: 'SFMono-Regular', Consolas, monospace; font-size: 13px; }
.cell-text { display: block; overflow: hidden; color: var(--shell-muted); text-overflow: ellipsis; white-space: nowrap; }
.row-actions { display: flex; align-items: center; justify-content: center; white-space: nowrap; }
.row-actions :deep(.ant-btn) { padding-inline: 5px; }
.empty-table { display: flex; min-height: 180px; align-items: center; justify-content: center; flex-direction: column; gap: 10px; color: var(--shell-muted); }
.empty-table :deep(.anticon) { font-size: 30px; }
.config-form { padding-top: 8px; }
.form-grid { display: grid; column-gap: 18px; grid-template-columns: repeat(2, minmax(0, 1fr)); }
.form-grid :deep(.ant-form-item) { margin-bottom: 14px; }
.full-field { grid-column: 1 / -1; }
.form-pair { display: grid; column-gap: 18px; grid-template-columns: repeat(2, minmax(0, 1fr)); }
.switch-field { display: flex; min-height: 34px; align-items: center; gap: 9px; color: var(--shell-muted); }
</style>
