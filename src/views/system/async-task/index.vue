<script setup lang="ts">
defineOptions({ name: 'AsyncTaskManagementView' })

import {
  Button as AButton,
  Form as AForm,
  FormItem as AFormItem,
  Input as AInput,
  Modal as AModal,
  Popconfirm as APopconfirm,
  Progress as AProgress,
  RangePicker as ARangePicker,
  Select as ASelect,
  Tag as ATag,
  Textarea as ATextarea,
  message,
  type FormInstance,
  type FormProps,
  type TableColumnsType,
} from 'ant-design-vue'
import type { Dayjs } from 'dayjs'
import {
  computed,
  nextTick,
  onActivated,
  onBeforeUnmount,
  onDeactivated,
  onMounted,
  reactive,
  ref,
  watch,
} from 'vue'

import {
  cancelAsyncTask,
  createAsyncTask,
  getAsyncTask,
  pageAsyncTaskLogs,
  pageAsyncTasks,
  type AsyncTaskRequest,
  type SysAsyncTask,
  type SysAsyncTaskLog,
} from '@/api/async-task'
import { listDictItems, type DictItemResponse } from '@/api/dict'
import { downloadFile } from '@/api/file'
import { getErrorMessage } from '@/api/http'
import ResizableTable from '@/components/common/ResizableTable.vue'
import { useTablePagination } from '@/composables/use-table-pagination'
import { useUnsavedChanges } from '@/composables/use-unsaved-changes'
import { formatDateTime } from '@/utils/date'
import { downloadBlob } from '@/utils/download'
import { createLatestRequest } from '@/utils/latest-request'

import { shouldPollAsyncTasks } from './polling'

type AsyncTaskForm = {
  taskType: string
  taskName: string
  paramsJson?: string
  idempotentKey?: string
  remark?: string
}

const fallbackStatusItems: DictItemResponse[] = [
  { label: '等待', value: 'PENDING', tagType: 'info' },
  { label: '运行中', value: 'RUNNING', tagType: 'warning' },
  { label: '成功', value: 'SUCCESS', tagType: 'success' },
  { label: '失败', value: 'FAILURE', tagType: 'danger' },
  { label: '已取消', value: 'CANCELED', tagType: 'info' },
]
const tagColors: Record<string, string> = {
  primary: 'processing',
  success: 'success',
  warning: 'warning',
  danger: 'error',
  info: 'default',
}
const logColors: Record<string, string> = { ERROR: 'error', WARN: 'warning', INFO: 'processing', DEBUG: 'default' }

const keyword = ref('')
const status = ref<string>()
const taskType = ref('')
const timeRange = ref<[Dayjs, Dayjs]>()
const records = ref<SysAsyncTask[]>([])
const loading = ref(false)
const runLatestLoad = createLatestRequest(loading)
const { currentPage, pageSize, total, pagination, handleTableChange } = useTablePagination(load)
const statusItems = ref<DictItemResponse[]>(fallbackStatusItems)

const createOpen = ref(false)
const submitting = ref(false)
const formRef = ref<FormInstance>()

const detailOpen = ref(false)
const detailTaskId = ref<number>()
const detailTask = ref<SysAsyncTask>()
const detailLoading = ref(false)
const logs = ref<SysAsyncTaskLog[]>([])
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
const cancelingId = ref<number>()
const downloadingId = ref<number>()

let pollTimer: number | undefined
let pollingNow = false
const pageActive = ref(true)

const columns: TableColumnsType = [
  { title: '任务名称', dataIndex: 'taskName', key: 'taskName', width: 190 },
  { title: '任务类型', dataIndex: 'taskType', key: 'taskType', width: 150 },
  { title: '状态', dataIndex: 'status', key: 'status', width: 100, align: 'center' },
  { title: '进度', dataIndex: 'progress', key: 'progress', width: 180 },
  { title: '结果文件', key: 'resultFile', width: 190 },
  { title: '失败原因', dataIndex: 'failureReason', key: 'failureReason', width: 230 },
  { title: '操作人', dataIndex: 'operator', key: 'operator', width: 110 },
  { title: '创建时间', dataIndex: 'createdTime', key: 'createdTime', width: 155 },
  { title: '操作', key: 'action', width: 130, align: 'center' },
]
const logColumns: TableColumnsType = [
  { title: '级别', dataIndex: 'logLevel', key: 'logLevel', width: 82, align: 'center' },
  { title: '日志内容', dataIndex: 'message', key: 'message', width: 590 },
  { title: '记录时间', dataIndex: 'createdTime', key: 'createdTime', width: 160 },
]

function defaultForm(): AsyncTaskForm {
  return { taskType: '', taskName: '', paramsJson: undefined, idempotentKey: undefined, remark: undefined }
}

const form = reactive<AsyncTaskForm>(defaultForm())
const { requestClose: requestCreateClose } = useUnsavedChanges(form, createOpen)
const statusOptions = computed(() => statusItems.value.map((item) => ({ label: item.label, value: item.value })))
const rules: FormProps['rules'] = {
  taskType: [{ required: true, message: '请输入任务类型', trigger: 'blur' }],
  taskName: [{ required: true, message: '请输入任务名称', trigger: 'blur' }],
}

function clean(value?: string) {
  return value?.trim() || undefined
}

function toRequest(): AsyncTaskRequest {
  return {
    taskType: form.taskType.trim(),
    taskName: form.taskName.trim(),
    paramsJson: clean(form.paramsJson),
    idempotentKey: clean(form.idempotentKey),
    remark: clean(form.remark),
  }
}

function getStatusItem(value?: string) {
  return statusItems.value.find((item) => item.value === value)
}

function statusLabel(value?: string) {
  return getStatusItem(value)?.label || value || '未知'
}

function statusColor(value?: string) {
  return tagColors[getStatusItem(value)?.tagType || ''] || 'default'
}

function isActive(record: SysAsyncTask) {
  return record.status === 'PENDING' || record.status === 'RUNNING'
}

async function loadStatusItems() {
  try {
    const result = await listDictItems('async_task_status')
    if (result.length) statusItems.value = result
  } catch {
    message.warning('异步任务状态字典获取失败，已使用标准状态显示')
  }
}

async function load(silent = false) {
  try {
    const result = await runLatestLoad(() => pageAsyncTasks(
      currentPage.value,
      pageSize.value,
      keyword.value,
      status.value,
      taskType.value,
      timeRange.value?.[0].toISOString(),
      timeRange.value?.[1].toISOString(),
    ), !silent)
    if (!result) return
    records.value = result.records || []
    total.value = Number(result.total || 0)
    currentPage.value = Number(result.current || currentPage.value)
    pageSize.value = Number(result.size || pageSize.value)
  } catch {
    if (!silent) {
      records.value = []
      total.value = 0
      message.error('异步任务数据获取失败，请稍后重试')
    }
  } finally {
    syncPolling()
  }
}

async function search() {
  currentPage.value = 1
  await load()
}

async function resetQuery() {
  keyword.value = ''
  status.value = undefined
  taskType.value = ''
  timeRange.value = undefined
  currentPage.value = 1
  await load()
}

function openCreate() {
  Object.assign(form, defaultForm())
  createOpen.value = true
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
    await createAsyncTask(toRequest())
    createOpen.value = false
    message.success('异步任务已登记')
    currentPage.value = 1
    await load()
  } catch (error) {
    message.error(getErrorMessage(error))
  } finally {
    submitting.value = false
  }
}

async function loadDetail(silent = false) {
  if (detailTaskId.value === undefined) return
  if (!silent) detailLoading.value = true
  try {
    detailTask.value = await getAsyncTask(detailTaskId.value)
  } catch {
    if (!silent) message.error('任务详情获取失败，请稍后重试')
  } finally {
    if (!silent) detailLoading.value = false
  }
}

async function loadLogs(silent = false) {
  const taskId = detailTaskId.value
  if (taskId === undefined) return
  try {
    const result = await runLatestLogs(() => pageAsyncTaskLogs(
      taskId,
      logPage.value,
      logPageSize.value,
      logTimeRange.value?.[0].toISOString(),
      logTimeRange.value?.[1].toISOString(),
    ), !silent)
    if (!result) return
    logs.value = result.records || []
    logTotal.value = Number(result.total || 0)
    logPage.value = Number(result.current || logPage.value)
    logPageSize.value = Number(result.size || logPageSize.value)
  } catch {
    if (!silent) {
      logs.value = []
      logTotal.value = 0
      message.error('任务日志获取失败，请稍后重试')
    }
  }
}

function openDetail(record: SysAsyncTask) {
  if (record.taskId === undefined) return
  detailTaskId.value = record.taskId
  detailTask.value = record
  logPage.value = 1
  logTimeRange.value = undefined
  detailOpen.value = true
  void Promise.all([loadDetail(), loadLogs()])
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

async function cancelTask(record: SysAsyncTask) {
  if (record.taskId === undefined || !isActive(record)) return
  cancelingId.value = record.taskId
  try {
    const updated = await cancelAsyncTask(record.taskId)
    if (detailTaskId.value === record.taskId) detailTask.value = updated
    message.success('任务已取消')
    await load()
  } catch (error) {
    message.error(getErrorMessage(error))
  } finally {
    cancelingId.value = undefined
  }
}

async function downloadResult(record: SysAsyncTask) {
  if (record.resultFileId === undefined) return
  downloadingId.value = record.resultFileId
  try {
    const response = await downloadFile(record.resultFileId)
    downloadBlob(response.data, record.resultFileName || `任务结果-${record.taskId || record.resultFileId}`)
  } catch (error) {
    message.error(getErrorMessage(error))
  } finally {
    downloadingId.value = undefined
  }
}

function stopPolling() {
  if (pollTimer !== undefined) window.clearInterval(pollTimer)
  pollTimer = undefined
}

function syncPolling() {
  const shouldPoll = shouldPollAsyncTasks(
    records.value.map((record) => record.status),
    detailOpen.value,
    pageActive.value && document.visibilityState === 'visible',
  )
  if (!shouldPoll) stopPolling()
  else if (pollTimer === undefined) pollTimer = window.setInterval(refreshPolling, 5000)
}

async function refreshPolling() {
  if (pollingNow || !pageActive.value || document.visibilityState !== 'visible') {
    syncPolling()
    return
  }
  pollingNow = true
  try {
    await load(true)
    if (detailOpen.value) await Promise.all([loadDetail(true), loadLogs(true)])
  } finally {
    pollingNow = false
    syncPolling()
  }
}

function handleVisibilityChange() {
  if (document.visibilityState === 'visible') void refreshPolling()
  else syncPolling()
}

watch(detailOpen, (open) => {
  if (!open) {
    detailTaskId.value = undefined
    detailTask.value = undefined
    logs.value = []
  }
  syncPolling()
})

onMounted(() => {
  document.addEventListener('visibilitychange', handleVisibilityChange)
  void loadStatusItems()
  void load()
})

onActivated(() => {
  pageActive.value = true
  void refreshPolling()
})

onDeactivated(() => {
  pageActive.value = false
  stopPolling()
})

onBeforeUnmount(() => {
  document.removeEventListener('visibilitychange', handleVisibilityChange)
  stopPolling()
})
</script>

<template>
  <main class="management-page">
    <section class="query-panel">
      <div class="query-fields">
        <a-input v-model:value="keyword" allow-clear placeholder="请输入任务名称或操作人" @press-enter="search" />
        <a-input v-model:value="taskType" allow-clear placeholder="请输入任务类型" @press-enter="search" />
        <a-select v-model:value="status" allow-clear placeholder="全部状态" :options="statusOptions" />
        <a-range-picker
          v-model:value="timeRange"
          show-time
          format="YYYY-MM-DD HH:mm:ss"
          :placeholder="['开始时间', '结束时间']"
        />
      </div>
      <div class="query-actions">
        <a-button type="primary" :loading="loading" @click="search">查询</a-button>
        <a-button class="secondary-action" :disabled="loading" @click="resetQuery">重置</a-button>
        <a-button class="secondary-action" :disabled="loading" @click="load()">刷新</a-button>
      </div>
    </section>

    <section class="table-panel">
      <header class="table-toolbar">
        <div>
          <h1>异步任务</h1>
          <span class="polling-note">进行中任务每 5 秒自动刷新</span>
        </div>
        <a-button type="primary" @click="openCreate">登记任务</a-button>
      </header>

      <ResizableTable
        class="task-table"
        row-key="taskId"
        size="middle"
        table-layout="fixed"
        :columns="columns"
        :data-source="records"
        :loading="loading"
        :pagination="pagination"
        @change="handleTableChange"
      >
        <template #bodyCell="{ column, record }">
          <template v-if="column.key === 'taskName'">
            <strong>{{ record.taskName || '—' }}</strong>
          </template>
          <template v-else-if="column.key === 'taskType'">
            <code class="mono-cell">{{ record.taskType || '—' }}</code>
          </template>
          <template v-else-if="column.key === 'status'">
            <a-tag :color="statusColor(record.status)">{{ statusLabel(record.status) }}</a-tag>
          </template>
          <template v-else-if="column.key === 'progress'">
            <a-progress :percent="record.progress ?? 0" size="small" :status="record.status === 'FAILURE' ? 'exception' : record.status === 'SUCCESS' ? 'success' : 'active'" />
          </template>
          <template v-else-if="column.key === 'resultFile'">
            <a-button
              v-if="record.resultFileId !== undefined"
              type="link"
              size="small"
              class="file-link"
              :loading="downloadingId === record.resultFileId"
              @click="downloadResult(record)"
            >{{ record.resultFileName || '下载结果文件' }}</a-button>
            <span v-else class="cell-text">—</span>
          </template>
          <template v-else-if="column.key === 'failureReason'">
            <span class="cell-text" :title="record.failureReason">{{ record.failureReason || '—' }}</span>
          </template>
          <template v-else-if="column.key === 'operator'">
            <span>{{ record.operator || '—' }}</span>
          </template>
          <template v-else-if="column.key === 'createdTime'">
            <span class="cell-text">{{ formatDateTime(record.createdTime) }}</span>
          </template>
          <template v-else-if="column.key === 'action'">
            <div class="row-actions">
              <a-button type="link" size="small" @click="openDetail(record)">详情</a-button>
              <a-popconfirm
                title="确认取消该异步任务？"
                description="运行中的任务可能需要等待后端安全停止。"
                ok-text="取消任务"
                cancel-text="返回"
                @confirm="cancelTask(record)"
              >
                <a-button type="link" danger size="small" :disabled="!isActive(record)" :loading="cancelingId === record.taskId">取消</a-button>
              </a-popconfirm>
            </div>
          </template>
        </template>
        <template #emptyText><div class="empty-table">暂无符合条件的异步任务</div></template>
      </ResizableTable>
    </section>

    <a-modal
      :open="createOpen"
      title="登记异步任务"
      :width="760"
      :confirm-loading="submitting"
      :mask-closable="false"
      ok-text="登记"
      cancel-text="取消"
      @ok="submit"
      @cancel="requestCreateClose"
    >
      <a-form ref="formRef" class="task-form" layout="vertical" :model="form" :rules="rules">
        <div class="form-grid">
          <a-form-item label="任务类型" name="taskType">
            <a-input v-model:value="form.taskType" placeholder="例如 IMPORT、EXPORT 或 BATCH" />
          </a-form-item>
          <a-form-item label="任务名称" name="taskName">
            <a-input v-model:value="form.taskName" placeholder="请输入任务名称" />
          </a-form-item>
          <a-form-item class="full-field" label="任务参数" name="paramsJson">
            <a-textarea v-model:value="form.paramsJson" :rows="5" placeholder="请输入任务参数 JSON，具体结构由任务处理器定义" />
          </a-form-item>
          <a-form-item class="full-field" label="幂等键" name="idempotentKey">
            <a-input v-model:value="form.idempotentKey" placeholder="可选，用于避免重复登记任务" />
          </a-form-item>
          <a-form-item class="full-field" label="备注" name="remark">
            <a-textarea v-model:value="form.remark" :rows="2" :maxlength="255" placeholder="请输入备注信息" />
          </a-form-item>
        </div>
      </a-form>
    </a-modal>

    <a-modal v-model:open="detailOpen" title="异步任务详情" :width="1040" :footer="null">
      <div class="detail-loading" :class="{ active: detailLoading }">
        <dl class="task-detail">
          <div><dt>任务名称</dt><dd>{{ detailTask?.taskName || '—' }}</dd></div>
          <div><dt>任务类型</dt><dd><code>{{ detailTask?.taskType || '—' }}</code></dd></div>
          <div><dt>任务状态</dt><dd><a-tag :color="statusColor(detailTask?.status)">{{ statusLabel(detailTask?.status) }}</a-tag></dd></div>
          <div><dt>执行进度</dt><dd><a-progress :percent="detailTask?.progress ?? 0" size="small" /></dd></div>
          <div><dt>操作人</dt><dd>{{ detailTask?.operator || '—' }}</dd></div>
          <div><dt>创建时间</dt><dd>{{ formatDateTime(detailTask?.createdTime) }}</dd></div>
          <div><dt>开始时间</dt><dd>{{ formatDateTime(detailTask?.startedTime) }}</dd></div>
          <div><dt>结束时间</dt><dd>{{ formatDateTime(detailTask?.finishedTime) }}</dd></div>
          <div class="full-detail"><dt>结果文件</dt><dd>
            <a-button
              v-if="detailTask?.resultFileId !== undefined"
              type="link"
              size="small"
              :loading="downloadingId === detailTask.resultFileId"
              @click="downloadResult(detailTask)"
            >{{ detailTask.resultFileName || '下载结果文件' }}</a-button>
            <span v-else>—</span>
          </dd></div>
          <div class="full-detail"><dt>失败原因</dt><dd class="long-text">{{ detailTask?.failureReason || '—' }}</dd></div>
          <div class="full-detail"><dt>任务参数</dt><dd><pre>{{ detailTask?.paramsJson || '—' }}</pre></dd></div>
        </dl>
      </div>

      <header class="log-toolbar">
        <h2>任务日志</h2>
        <div class="log-query-controls">
          <a-range-picker
            v-model:value="logTimeRange"
            show-time
            format="YYYY-MM-DD HH:mm:ss"
            :placeholder="['开始时间', '结束时间']"
          />
          <a-button type="primary" :loading="logLoading" @click="searchLogs">查询</a-button>
          <a-button class="secondary-action" :disabled="logLoading" @click="resetLogQuery">重置</a-button>
          <a-button class="secondary-action" :disabled="logLoading" @click="loadLogs()">刷新</a-button>
        </div>
      </header>
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
          <template v-if="column.key === 'logLevel'">
            <a-tag :color="logColors[record.logLevel] || 'default'">{{ record.logLevel || 'INFO' }}</a-tag>
          </template>
          <template v-else-if="column.key === 'message'">
            <span class="log-message" :title="record.message">{{ record.message || '—' }}</span>
          </template>
          <template v-else-if="column.key === 'createdTime'">{{ formatDateTime(record.createdTime) }}</template>
        </template>
        <template #emptyText><div class="empty-table">暂无任务日志</div></template>
      </ResizableTable>
    </a-modal>
  </main>
</template>

<style scoped>
.query-fields { display: grid; width: min(1110px, 82%); grid-template-columns: minmax(230px, 1fr) minmax(160px, .65fr) 130px 320px; gap: 8px; }
.polling-note { display: block; margin-top: 2px; color: var(--shell-muted); font-size: 12px; }
.task-table :deep(.ant-table), .log-table :deep(.ant-table) { color: var(--shell-ink); background: var(--shell-panel); }
.task-table :deep(.ant-table-thead > tr > th), .log-table :deep(.ant-table-thead > tr > th) { padding-block: 9px; color: var(--shell-muted); font-size: 13px; font-weight: 600; background: var(--shell-hover); }
.task-table :deep(.ant-table-tbody > tr > td), .log-table :deep(.ant-table-tbody > tr > td) { padding-block: 8px; }
.task-table :deep(.ant-table-tbody > tr:hover > td), .log-table :deep(.ant-table-tbody > tr:hover > td) { background: color-mix(in srgb, var(--brand) 7%, var(--shell-panel)); }
.task-table :deep(.ant-pagination), .log-table :deep(.ant-pagination) { margin: 13px; }
.mono-cell { display: block; overflow: hidden; color: var(--brand-deep); font-family: 'SFMono-Regular', Consolas, monospace; font-size: 13px; text-overflow: ellipsis; white-space: nowrap; }
.cell-text, .log-message { display: block; overflow: hidden; color: var(--shell-muted); text-overflow: ellipsis; white-space: nowrap; }
.file-link { display: block; max-width: 100%; padding-inline: 0; overflow: hidden; text-overflow: ellipsis; }
.empty-table { display: flex; min-height: 150px; align-items: center; justify-content: center; color: var(--shell-muted); }
.task-form { padding-top: 8px; }
.form-grid { display: grid; column-gap: 18px; grid-template-columns: repeat(2, minmax(0, 1fr)); }
.form-grid :deep(.ant-form-item) { margin-bottom: 14px; }
.full-field { grid-column: 1 / -1; }
.detail-loading { transition: opacity .16s ease; }
.detail-loading.active { opacity: .55; }
.task-detail { display: grid; margin: 4px 0 0; grid-template-columns: repeat(4, minmax(0, 1fr)); border-top: 1px solid var(--shell-border); border-left: 1px solid var(--shell-border); }
.task-detail > div { min-width: 0; padding: 9px 11px; border-right: 1px solid var(--shell-border); border-bottom: 1px solid var(--shell-border); }
.task-detail dt { color: var(--shell-muted); font-size: 12px; }
.task-detail dd { min-width: 0; margin: 4px 0 0; overflow-wrap: anywhere; }
.task-detail dd code { color: var(--brand-deep); font-family: 'SFMono-Regular', Consolas, monospace; }
.task-detail .full-detail { grid-column: 1 / -1; }
.task-detail .full-detail :deep(.ant-btn) { height: auto; padding: 0; }
.task-detail pre { max-height: 110px; margin: 0; overflow: auto; color: var(--shell-ink); font-family: 'SFMono-Regular', Consolas, monospace; font-size: 12px; white-space: pre-wrap; }
.long-text { max-height: 72px; overflow: auto !important; white-space: pre-wrap; }
.log-toolbar { display: flex; align-items: center; justify-content: space-between; padding: 12px 0 8px; }
.log-toolbar h2 { margin: 0; font-size: 16px; }
.log-query-controls { display: flex; align-items: center; gap: 7px; }
.log-query-controls :deep(.ant-picker) { width: 320px; }
.log-query-controls :deep(.ant-btn) { min-width: 58px; }
.log-table { height: 300px; border: 1px solid var(--shell-border); }
</style>
