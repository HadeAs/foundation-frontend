<script setup lang="ts">
defineOptions({ name: 'JobManagementView' })

import {
  Button as AButton,
  Form as AForm,
  FormItem as AFormItem,
  Input as AInput,
  InputNumber as AInputNumber,
  Modal as AModal,
  Popconfirm as APopconfirm,
  RangePicker as ARangePicker,
  Select as ASelect,
  Switch as ASwitch,
  Tag as ATag,
  Textarea as ATextarea,
  Modal,
  message,
  type FormInstance,
  type FormProps,
  type TableColumnsType,
  type TableProps,
} from 'ant-design-vue'
import type { Dayjs } from 'dayjs'
import { computed, nextTick, reactive, ref } from 'vue'

import {
  batchDeleteJobs,
  createJob,
  deleteJob,
  listJobHandlers,
  pageJobLogs,
  pageJobs,
  pauseJob,
  resumeJob,
  runJobNow,
  updateJob,
  type JobHandlerOption,
  type JobRequest,
  type SysJob,
  type SysJobLog,
} from '@/api/job'
import { getErrorMessage } from '@/api/http'
import ResizableTable from '@/components/common/ResizableTable.vue'
import { useTablePagination } from '@/composables/use-table-pagination'
import { useUnsavedChanges } from '@/composables/use-unsaved-changes'
import { createLatestRequest } from '@/utils/latest-request'
import { formatDateTime } from '@/utils/date'

type JobForm = {
  jobName: string
  jobGroup?: string
  jobScope: string
  cronExpression: string
  jobType?: string
  jobData?: string
  concurrencyPolicy: string
  timeoutSeconds: number
  maxRetries: number
  retryIntervalSeconds: number
  idempotencyKeyExpression?: string
  failureStrategy: string
  paramsSchemaJson?: string
  status: number
  remark?: string
}

const scopeOptions = [
  { label: '系统任务', value: 'SYSTEM' },
  { label: '业务任务', value: 'BUSINESS' },
]
const sourceOptions = [
  { label: '基座内置', value: 'FOUNDATION' },
  { label: '向导生成', value: 'GENERATOR' },
  { label: '手工创建', value: 'MANUAL' },
]
const concurrencyOptions = [
  { label: '禁止并发', value: 'FORBID' },
  { label: '允许并发', value: 'ALLOW' },
]
const failureOptions = [
  { label: '失败并记录', value: 'FAIL_AND_RECORD' },
  { label: '重试后失败', value: 'RETRY_THEN_FAIL' },
]
const cronOptions = [
  { label: '每分钟', value: '0 * * * * ?' },
  { label: '每 5 分钟', value: '0 */5 * * * ?' },
  { label: '每小时整点', value: '0 0 * * * ?' },
  { label: '每天零点', value: '0 0 0 * * ?' },
  { label: '每月 1 日零点', value: '0 0 0 1 * ?' },
]
const scopeLabels: Record<string, string> = Object.fromEntries(scopeOptions.map((item) => [item.value, item.label]))
const sourceLabels: Record<string, string> = Object.fromEntries(sourceOptions.map((item) => [item.value, item.label]))
const logStatusLabels: Record<string, string> = { RUNNING: '运行中', SUCCESS: '成功', FAILURE: '失败' }
const logStatusColors: Record<string, string> = { RUNNING: 'processing', SUCCESS: 'success', FAILURE: 'error' }

const keyword = ref('')
const jobScope = ref<string>()
const sourceType = ref<string>()
const records = ref<SysJob[]>([])
const loading = ref(false)
const runLatestLoad = createLatestRequest(loading)
const { currentPage, pageSize, total, pagination, handleTableChange } = useTablePagination(load)
const selectedIds = ref<number[]>([])
const modalOpen = ref(false)
const submitting = ref(false)
const editingJob = ref<SysJob>()
const formRef = ref<FormInstance>()
const handlers = ref<JobHandlerOption[]>([])
const handlerLoading = ref(false)
const cronPreset = ref<string>()
const deletingId = ref<number>()
const actionKey = ref<string>()

const logsOpen = ref(false)
const logJob = ref<SysJob>()
const logs = ref<SysJobLog[]>([])
const logLoading = ref(false)
const runLatestLogs = createLatestRequest(logLoading)
const {
  currentPage: logPage,
  pageSize: logPageSize,
  total: logTotal,
  pagination: logPagination,
  handleTableChange: handleLogTableChange,
} = useTablePagination(loadLogs)
const logTimeRange = ref<[Dayjs, Dayjs]>()
const detailOpen = ref(false)
const detailLog = ref<SysJobLog>()

const columns: TableColumnsType = [
  { title: '任务名称', dataIndex: 'jobName', key: 'jobName', width: 180 },
  { title: '任务分组', dataIndex: 'jobGroup', key: 'jobGroup', width: 120 },
  { title: '范围', dataIndex: 'jobScope', key: 'jobScope', width: 100, align: 'center' },
  { title: '来源', dataIndex: 'sourceType', key: 'sourceType', width: 100, align: 'center' },
  { title: 'Handler', dataIndex: 'jobType', key: 'jobType', width: 175 },
  { title: 'Cron 表达式', dataIndex: 'cronExpression', key: 'cronExpression', width: 180 },
  { title: '状态', dataIndex: 'status', key: 'status', width: 88, align: 'center' },
  { title: '更新时间', dataIndex: 'updatedTime', key: 'updatedTime', width: 155 },
  { title: '操作', key: 'action', width: 300, align: 'center' },
]
const logColumns: TableColumnsType = [
  { title: '执行状态', dataIndex: 'status', key: 'status', width: 95, align: 'center' },
  { title: '开始时间', dataIndex: 'startedTime', key: 'startedTime', width: 160 },
  { title: '结束时间', dataIndex: 'finishedTime', key: 'finishedTime', width: 160 },
  { title: '耗时', dataIndex: 'durationMs', key: 'durationMs', width: 100, align: 'right' },
  { title: '执行消息', dataIndex: 'message', key: 'message', width: 260 },
  { title: '操作', key: 'action', width: 74, align: 'center' },
]

function defaultForm(): JobForm {
  return {
    jobName: '',
    jobGroup: 'DEFAULT',
    jobScope: 'BUSINESS',
    cronExpression: '0 */5 * * * ?',
    jobType: undefined,
    jobData: undefined,
    concurrencyPolicy: 'FORBID',
    timeoutSeconds: 300,
    maxRetries: 0,
    retryIntervalSeconds: 60,
    idempotencyKeyExpression: undefined,
    failureStrategy: 'FAIL_AND_RECORD',
    paramsSchemaJson: undefined,
    status: 1,
    remark: undefined,
  }
}

const form = reactive<JobForm>(defaultForm())
const { requestClose: requestFormClose } = useUnsavedChanges(form, modalOpen)
const modalTitle = computed(() => editingJob.value ? '编辑定时任务' : '新增定时任务')
const handlerOptions = computed(() => handlers.value.map((item) => ({
  label: item.source ? `${item.label || item.type}（${item.source}）` : item.label || item.type,
  value: item.type,
})).filter((item) => item.value))
const rowSelection = computed<TableProps<SysJob>['rowSelection']>(() => ({
  selectedRowKeys: selectedIds.value,
  fixed: true,
  columnWidth: 48,
  onChange: (keys) => { selectedIds.value = keys.map(Number) },
  getCheckboxProps: (record) => ({ disabled: record.protectedFlag === true }),
}))
const rules: FormProps['rules'] = {
  jobName: [{ required: true, message: '请输入任务名称', trigger: 'blur' }],
  cronExpression: [{ required: true, message: '请输入 Cron 表达式', trigger: 'blur' }],
}

function clean(value?: string) {
  return value?.trim() || undefined
}

function toRequest(): JobRequest {
  return {
    jobName: form.jobName.trim(),
    jobGroup: clean(form.jobGroup),
    jobScope: form.jobScope,
    cronExpression: form.cronExpression.trim(),
    jobType: clean(form.jobType),
    jobData: clean(form.jobData),
    concurrencyPolicy: form.concurrencyPolicy,
    timeoutSeconds: form.timeoutSeconds,
    maxRetries: form.maxRetries,
    retryIntervalSeconds: form.retryIntervalSeconds,
    idempotencyKeyExpression: clean(form.idempotencyKeyExpression),
    failureStrategy: form.failureStrategy,
    paramsSchemaJson: clean(form.paramsSchemaJson),
    status: form.status,
    remark: clean(form.remark),
  }
}

async function load() {
  selectedIds.value = []
  try {
    const result = await runLatestLoad(() => pageJobs(currentPage.value, pageSize.value, keyword.value, jobScope.value, sourceType.value))
    if (!result) return
    records.value = result.records || []
    total.value = Number(result.total || 0)
    currentPage.value = Number(result.current || currentPage.value)
    pageSize.value = Number(result.size || pageSize.value)
  } catch {
    records.value = []
    total.value = 0
    message.error('定时任务数据获取失败，请稍后重试')
  }
}

async function search() {
  currentPage.value = 1
  await load()
}

async function resetQuery() {
  keyword.value = ''
  jobScope.value = undefined
  sourceType.value = undefined
  currentPage.value = 1
  await load()
}

async function loadHandlers() {
  handlerLoading.value = true
  try {
    handlers.value = await listJobHandlers()
  } catch {
    handlers.value = []
    message.error('任务 Handler 获取失败，请稍后重试')
  } finally {
    handlerLoading.value = false
  }
}

function syncCronPreset() {
  cronPreset.value = cronOptions.some((item) => item.value === form.cronExpression)
    ? form.cronExpression
    : undefined
}

function applyCronPreset(value: unknown) {
  if (typeof value === 'string') form.cronExpression = value
}

function resetForm() {
  Object.assign(form, defaultForm())
  syncCronPreset()
  nextTick(() => formRef.value?.clearValidate())
}

function openCreate() {
  editingJob.value = undefined
  resetForm()
  modalOpen.value = true
  void loadHandlers()
}

function openEdit(record: SysJob) {
  if (record.jobId === undefined) return
  editingJob.value = record
  Object.assign(form, defaultForm(), {
    jobName: record.jobName || '',
    jobGroup: record.jobGroup,
    jobScope: record.jobScope || 'BUSINESS',
    cronExpression: record.cronExpression || '',
    jobType: record.jobType,
    jobData: record.jobData,
    concurrencyPolicy: record.concurrencyPolicy || 'FORBID',
    timeoutSeconds: record.timeoutSeconds ?? 300,
    maxRetries: record.maxRetries ?? 0,
    retryIntervalSeconds: record.retryIntervalSeconds ?? 60,
    idempotencyKeyExpression: record.idempotencyKeyExpression,
    failureStrategy: record.failureStrategy || 'FAIL_AND_RECORD',
    paramsSchemaJson: record.paramsSchemaJson,
    status: record.status === 0 ? 0 : 1,
    remark: record.remark,
  })
  syncCronPreset()
  modalOpen.value = true
  nextTick(() => formRef.value?.clearValidate())
  void loadHandlers()
}

async function submit() {
  try {
    await formRef.value?.validate()
  } catch {
    return
  }
  submitting.value = true
  try {
    if (editingJob.value?.jobId === undefined) {
      await createJob(toRequest())
      message.success('定时任务已新增')
    } else {
      await updateJob(editingJob.value.jobId, toRequest())
      message.success('定时任务已更新')
    }
    modalOpen.value = false
    await load()
  } catch (error) {
    message.error(getErrorMessage(error))
  } finally {
    submitting.value = false
  }
}

async function remove(record: SysJob) {
  if (record.jobId === undefined || record.protectedFlag) return
  deletingId.value = record.jobId
  try {
    await deleteJob(record.jobId)
    if (records.value.length === 1 && currentPage.value > 1) currentPage.value -= 1
    message.success('定时任务已删除')
    await load()
  } catch (error) {
    message.error(getErrorMessage(error))
  } finally {
    deletingId.value = undefined
  }
}

function removeSelected() {
  Modal.confirm({
    title: `确认删除选中的 ${selectedIds.value.length} 个定时任务？`,
    content: '删除后任务将不再触发，历史执行日志不受影响。',
    okText: '删除',
    cancelText: '取消',
    onOk: async () => {
      try {
        await batchDeleteJobs(selectedIds.value)
        selectedIds.value = []
        message.success('定时任务已批量删除')
        await load()
      } catch (error) {
        message.error(getErrorMessage(error))
        throw error
      }
    },
  })
}

function executeNow(record: SysJob) {
  if (record.jobId === undefined) return
  Modal.confirm({
    title: `确认立即执行“${record.jobName || '该任务'}”？`,
    content: '该操作会在服务端创建一次真实执行。',
    okText: '立即执行',
    cancelText: '取消',
    onOk: async () => {
      actionKey.value = `run:${record.jobId}`
      try {
        await runJobNow(record.jobId!)
        message.success('任务已提交执行')
      } catch (error) {
        message.error(getErrorMessage(error))
        throw error
      } finally {
        actionKey.value = undefined
      }
    },
  })
}

async function toggleStatus(record: SysJob) {
  if (record.jobId === undefined) return
  const resume = record.status === 0
  actionKey.value = `status:${record.jobId}`
  try {
    if (resume) await resumeJob(record.jobId)
    else await pauseJob(record.jobId)
    message.success(resume ? '任务已恢复' : '任务已暂停')
    await load()
  } catch (error) {
    message.error(getErrorMessage(error))
  } finally {
    actionKey.value = undefined
  }
}

async function loadLogs() {
  const jobId = logJob.value?.jobId
  if (jobId === undefined) return
  try {
    const result = await runLatestLogs(() => pageJobLogs(
      jobId,
      logPage.value,
      logPageSize.value,
      logTimeRange.value?.[0].toISOString(),
      logTimeRange.value?.[1].toISOString(),
    ))
    if (!result) return
    logs.value = result.records || []
    logTotal.value = Number(result.total || 0)
    logPage.value = Number(result.current || logPage.value)
    logPageSize.value = Number(result.size || logPageSize.value)
  } catch {
    logs.value = []
    logTotal.value = 0
    message.error('执行日志获取失败，请稍后重试')
  }
}

function openLogs(record: SysJob) {
  if (record.jobId === undefined) return
  logJob.value = record
  logPage.value = 1
  logTimeRange.value = undefined
  logsOpen.value = true
  void loadLogs()
}

async function searchLogs() {
  logPage.value = 1
  await loadLogs()
}

async function resetLogQuery() {
  logTimeRange.value = undefined
  logPage.value = 1
  await loadLogs()
}

function openLogDetail(record: SysJobLog) {
  detailLog.value = record
  detailOpen.value = true
}

load()
</script>

<template>
  <main class="management-page">
    <section class="query-panel">
      <div class="query-fields">
        <a-input v-model:value="keyword" allow-clear placeholder="请输入任务名称、分组或 Handler" @press-enter="search" />
        <a-select v-model:value="jobScope" allow-clear placeholder="全部范围" :options="scopeOptions" />
        <a-select v-model:value="sourceType" allow-clear placeholder="全部来源" :options="sourceOptions" />
      </div>
      <div class="query-actions">
        <a-button type="primary" :loading="loading" @click="search">查询</a-button>
        <a-button class="secondary-action" :disabled="loading" @click="resetQuery">重置</a-button>
        <a-button class="secondary-action" :disabled="loading" @click="load">刷新</a-button>
      </div>
    </section>

    <section class="table-panel">
      <header class="table-toolbar">
        <h1>定时任务</h1>
        <div class="toolbar-actions">
          <a-button v-if="selectedIds.length" danger class="secondary-action" @click="removeSelected">
            批量删除（{{ selectedIds.length }}）
          </a-button>
          <a-button type="primary" @click="openCreate">新增任务</a-button>
        </div>
      </header>

      <ResizableTable
        class="job-table"
        row-key="jobId"
        size="middle"
        table-layout="fixed"
        :columns="columns"
        :data-source="records"
        :loading="loading"
        :pagination="pagination"
        :row-selection="rowSelection"
        @change="handleTableChange"
      >
        <template #bodyCell="{ column, record }">
          <template v-if="column.key === 'jobName'">
            <strong>{{ record.jobName || '—' }}</strong>
          </template>
          <template v-else-if="column.key === 'jobGroup'">
            <span class="cell-text">{{ record.jobGroup || '—' }}</span>
          </template>
          <template v-else-if="column.key === 'jobScope'">
            <a-tag :color="record.jobScope === 'SYSTEM' ? 'blue' : 'cyan'">
              {{ scopeLabels[record.jobScope] || record.jobScope || '未知' }}
            </a-tag>
          </template>
          <template v-else-if="column.key === 'sourceType'">
            <span>{{ sourceLabels[record.sourceType] || record.sourceType || '未知' }}</span>
          </template>
          <template v-else-if="column.key === 'jobType'">
            <code class="mono-cell">{{ record.jobType || '—' }}</code>
          </template>
          <template v-else-if="column.key === 'cronExpression'">
            <code class="mono-cell">{{ record.cronExpression || '—' }}</code>
          </template>
          <template v-else-if="column.key === 'status'">
            <span class="status-cell" :class="{ paused: record.status === 0 }"><i />{{ record.status === 0 ? '暂停' : '运行' }}</span>
          </template>
          <template v-else-if="column.key === 'updatedTime'">
            <span class="cell-text">{{ formatDateTime(record.updatedTime) }}</span>
          </template>
          <template v-else-if="column.key === 'action'">
            <div class="row-actions">
              <a-button type="link" size="small" :loading="actionKey === `run:${record.jobId}`" @click="executeNow(record)">立即执行</a-button>
              <a-button type="link" size="small" :loading="actionKey === `status:${record.jobId}`" @click="toggleStatus(record)">
                {{ record.status === 0 ? '恢复' : '暂停' }}
              </a-button>
              <a-button type="link" size="small" @click="openLogs(record)">日志</a-button>
              <a-button type="link" size="small" @click="openEdit(record)">编辑</a-button>
              <a-popconfirm
                title="确认删除该定时任务？"
                description="删除后任务将不再触发。"
                ok-text="删除"
                cancel-text="取消"
                :disabled="record.protectedFlag"
                @confirm="remove(record)"
              >
                <a-button type="link" danger size="small" :disabled="record.protectedFlag" :loading="deletingId === record.jobId">删除</a-button>
              </a-popconfirm>
            </div>
          </template>
        </template>
        <template #emptyText><div class="empty-table">暂无符合条件的定时任务</div></template>
      </ResizableTable>
    </section>

    <a-modal
      :open="modalOpen"
      :title="modalTitle"
      :width="860"
      :confirm-loading="submitting"
      :mask-closable="false"
      ok-text="保存"
      cancel-text="取消"
      @ok="submit"
      @cancel="requestFormClose"
    >
      <a-form ref="formRef" class="job-form" layout="vertical" :model="form" :rules="rules">
        <div class="form-grid">
          <a-form-item label="任务名称" name="jobName">
            <a-input v-model:value="form.jobName" placeholder="请输入任务名称" />
          </a-form-item>
          <a-form-item label="任务分组" name="jobGroup">
            <a-input v-model:value="form.jobGroup" placeholder="例如 DEFAULT" />
          </a-form-item>
          <a-form-item label="任务范围" name="jobScope">
            <a-select v-model:value="form.jobScope" :disabled="editingJob?.protectedFlag" :options="scopeOptions" />
          </a-form-item>
          <a-form-item label="Handler" name="jobType">
            <a-select
              v-model:value="form.jobType"
              allow-clear
              show-search
              :loading="handlerLoading"
              :options="handlerOptions"
              placeholder="请选择后端 Handler"
            />
          </a-form-item>
          <a-form-item class="full-field" label="Cron 表达式" name="cronExpression">
            <div class="cron-field">
              <a-select
                v-model:value="cronPreset"
                allow-clear
                placeholder="常用预设"
                :options="cronOptions"
                @change="applyCronPreset"
              />
              <a-input v-model:value="form.cronExpression" placeholder="请输入原始 Cron 表达式" @change="syncCronPreset" />
            </div>
          </a-form-item>
          <a-form-item label="并发策略" name="concurrencyPolicy">
            <a-select v-model:value="form.concurrencyPolicy" :options="concurrencyOptions" />
          </a-form-item>
          <a-form-item label="运行状态" name="status">
            <div class="switch-field">
              <a-switch v-model:checked="form.status" :checked-value="1" :un-checked-value="0" />
              <span>{{ form.status === 1 ? '运行' : '暂停' }}</span>
            </div>
          </a-form-item>
          <a-form-item class="full-field" label="任务参数" name="jobData">
            <a-textarea v-model:value="form.jobData" :rows="3" placeholder="请输入 Handler 所需参数，格式由后端 Handler 定义" />
          </a-form-item>

          <details class="advanced-fields full-field">
            <summary>高级执行策略</summary>
            <div class="advanced-grid">
              <a-form-item label="超时时间（秒）" name="timeoutSeconds">
                <a-input-number v-model:value="form.timeoutSeconds" :min="1" :precision="0" />
              </a-form-item>
              <a-form-item label="最大重试次数" name="maxRetries">
                <a-input-number v-model:value="form.maxRetries" :min="0" :precision="0" />
              </a-form-item>
              <a-form-item label="重试间隔（秒）" name="retryIntervalSeconds">
                <a-input-number v-model:value="form.retryIntervalSeconds" :min="0" :precision="0" />
              </a-form-item>
              <a-form-item label="失败策略" name="failureStrategy">
                <a-select v-model:value="form.failureStrategy" :options="failureOptions" />
              </a-form-item>
              <a-form-item class="full-field" label="幂等键表达式" name="idempotencyKeyExpression">
                <a-input v-model:value="form.idempotencyKeyExpression" placeholder="请输入幂等键表达式" />
              </a-form-item>
              <a-form-item class="full-field" label="参数 Schema" name="paramsSchemaJson">
                <a-textarea v-model:value="form.paramsSchemaJson" :rows="3" placeholder="请输入参数 Schema JSON" />
              </a-form-item>
            </div>
          </details>

          <a-form-item class="full-field" label="备注" name="remark">
            <a-textarea v-model:value="form.remark" :rows="2" :maxlength="255" placeholder="请输入备注信息" />
          </a-form-item>
        </div>
      </a-form>
    </a-modal>

    <a-modal v-model:open="logsOpen" :title="`执行日志 · ${logJob?.jobName || ''}`" :width="1040" :footer="null">
      <div class="log-query-bar">
        <a-range-picker
          v-model:value="logTimeRange"
          show-time
          format="YYYY-MM-DD HH:mm:ss"
          :placeholder="['开始时间', '结束时间']"
        />
        <div class="log-query-actions">
          <a-button type="primary" :loading="logLoading" @click="searchLogs">查询</a-button>
          <a-button class="secondary-action" :disabled="logLoading" @click="resetLogQuery">重置</a-button>
          <a-button class="secondary-action" :disabled="logLoading" @click="loadLogs">刷新</a-button>
        </div>
      </div>
      <ResizableTable
        class="log-table"
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
          <template v-if="column.key === 'status'">
            <a-tag :color="logStatusColors[record.status] || 'default'">{{ logStatusLabels[record.status] || record.status || '未知' }}</a-tag>
          </template>
          <template v-else-if="column.key === 'startedTime'">{{ formatDateTime(record.startedTime) }}</template>
          <template v-else-if="column.key === 'finishedTime'">{{ formatDateTime(record.finishedTime) }}</template>
          <template v-else-if="column.key === 'durationMs'">{{ record.durationMs ?? 0 }} ms</template>
          <template v-else-if="column.key === 'message'">
            <span class="log-message" :title="record.message || record.exceptionText">{{ record.message || record.exceptionText || '—' }}</span>
          </template>
          <template v-else-if="column.key === 'action'">
            <a-button type="link" size="small" @click="openLogDetail(record)">详情</a-button>
          </template>
        </template>
        <template #emptyText><div class="empty-table">暂无执行日志</div></template>
      </ResizableTable>
    </a-modal>

    <a-modal v-model:open="detailOpen" title="执行日志详情" :width="720" :footer="null">
      <dl class="log-detail">
        <div><dt>执行状态</dt><dd>{{ logStatusLabels[detailLog?.status || ''] || detailLog?.status || '未知' }}</dd></div>
        <div><dt>开始时间</dt><dd>{{ formatDateTime(detailLog?.startedTime) }}</dd></div>
        <div><dt>结束时间</dt><dd>{{ formatDateTime(detailLog?.finishedTime) }}</dd></div>
        <div><dt>执行耗时</dt><dd>{{ detailLog?.durationMs ?? 0 }} ms</dd></div>
        <div class="full-detail"><dt>执行消息</dt><dd>{{ detailLog?.message || '—' }}</dd></div>
        <div class="full-detail"><dt>失败原因</dt><dd><pre>{{ detailLog?.exceptionText || '—' }}</pre></dd></div>
      </dl>
    </a-modal>
  </main>
</template>

<style scoped>
.query-fields { display: grid; width: min(820px, 70%); grid-template-columns: minmax(280px, 1fr) 135px 135px; gap: 8px; }
.job-table :deep(.ant-table), .log-table :deep(.ant-table) { color: var(--shell-ink); background: var(--shell-panel); }
.job-table :deep(.ant-table-thead > tr > th), .log-table :deep(.ant-table-thead > tr > th) { padding-block: 9px; color: var(--shell-muted); font-size: 13px; font-weight: 600; background: var(--shell-hover); }
.job-table :deep(.ant-table-tbody > tr > td), .log-table :deep(.ant-table-tbody > tr > td) { padding-block: 8px; }
.job-table :deep(.ant-table-tbody > tr:hover > td), .log-table :deep(.ant-table-tbody > tr:hover > td) { background: color-mix(in srgb, var(--brand) 7%, var(--shell-panel)); }
.job-table :deep(.ant-pagination), .log-table :deep(.ant-pagination) { margin: 13px; }
.cell-text { display: block; overflow: hidden; color: var(--shell-muted); text-overflow: ellipsis; white-space: nowrap; }
.mono-cell { display: block; overflow: hidden; color: var(--brand-deep); font-family: 'SFMono-Regular', Consolas, monospace; font-size: 13px; text-overflow: ellipsis; white-space: nowrap; }
.status-cell { display: inline-flex; align-items: center; gap: 6px; }
.status-cell i { width: 7px; height: 7px; border-radius: 50%; background: #26aa80; }
.status-cell.paused i { background: #d89a28; }
.empty-table { display: flex; min-height: 180px; align-items: center; justify-content: center; color: var(--shell-muted); }
.job-form { padding-top: 8px; }
.form-grid, .advanced-grid { display: grid; column-gap: 18px; grid-template-columns: repeat(2, minmax(0, 1fr)); }
.form-grid :deep(.ant-form-item), .advanced-grid :deep(.ant-form-item) { margin-bottom: 14px; }
.form-grid :deep(.ant-input-number), .advanced-grid :deep(.ant-input-number) { width: 100%; }
.full-field { grid-column: 1 / -1; }
.cron-field { display: grid; grid-template-columns: 180px minmax(0, 1fr); gap: 8px; }
.switch-field { display: flex; min-height: 34px; align-items: center; gap: 9px; color: var(--shell-muted); }
.advanced-fields { margin-bottom: 14px; border: 1px solid var(--shell-border); background: color-mix(in srgb, var(--shell-hover) 55%, var(--shell-panel)); }
.advanced-fields summary { padding: 10px 12px; color: var(--brand-deep); cursor: pointer; font-weight: 600; }
.advanced-fields[open] summary { border-bottom: 1px solid var(--shell-border); }
.advanced-grid { padding: 14px 14px 0; }
.log-query-bar { display: flex; align-items: center; justify-content: space-between; gap: 12px; margin-bottom: 8px; }
.log-query-bar :deep(.ant-picker) { width: 345px; }
.log-query-actions { display: flex; gap: 7px; }
.log-query-actions :deep(.ant-btn) { min-width: 58px; }
.log-table { height: 500px; border: 1px solid var(--shell-border); }
.log-message { display: block; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.log-detail { display: grid; margin: 10px 0 0; grid-template-columns: repeat(2, minmax(0, 1fr)); border-top: 1px solid var(--shell-border); border-left: 1px solid var(--shell-border); }
.log-detail > div { min-width: 0; padding: 12px; border-right: 1px solid var(--shell-border); border-bottom: 1px solid var(--shell-border); }
.log-detail dt { color: var(--shell-muted); font-size: 12px; }
.log-detail dd { margin: 5px 0 0; overflow-wrap: anywhere; }
.log-detail .full-detail { grid-column: 1 / -1; }
.log-detail pre { max-height: 220px; margin: 0; overflow: auto; color: var(--shell-ink); font-family: 'SFMono-Regular', Consolas, monospace; font-size: 12px; white-space: pre-wrap; }
</style>
