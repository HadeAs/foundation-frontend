<script setup lang="ts">
defineOptions({ name: 'LifecycleManagementView' })

import {
  Button as AButton,
  Input as AInput,
  Modal as AModal,
  RangePicker as ARangePicker,
  Segmented as ASegmented,
  Tag as ATag,
  message,
  type TableColumnsType,
} from 'ant-design-vue'
import type { Dayjs } from 'dayjs'
import { computed, ref } from 'vue'

import { getErrorMessage } from '@/api/http'
import {
  getLifecycleOverview,
  pageLifecycleCleanupLogs,
  type LifecycleCleanupLog,
  type LifecycleJob,
  type LifecycleOverview,
  type LifecyclePolicy,
} from '@/api/lifecycle'
import ResizableTable from '@/components/common/ResizableTable.vue'
import { useTablePagination } from '@/composables/use-table-pagination'
import { formatDateTime } from '@/utils/date'
import { createLatestRequest } from '@/utils/latest-request'

type ViewMode = 'overview' | 'logs'

const statusLabels: Record<string, string> = {
  SUCCESS: '成功',
  FAILED: '失败',
  RUNNING: '执行中',
  PENDING: '待执行',
  SKIPPED: '已跳过',
}
const statusColors: Record<string, string> = {
  SUCCESS: 'success',
  FAILED: 'error',
  RUNNING: 'processing',
  PENDING: 'warning',
  SKIPPED: 'default',
}

const mode = ref<ViewMode>('overview')
const overview = ref<LifecycleOverview>({})
const policies = ref<LifecyclePolicy[]>([])
const jobs = ref<LifecycleJob[]>([])
const overviewLoading = ref(false)
const runLatestOverview = createLatestRequest(overviewLoading)
const keyword = ref('')
const policyCode = ref('')
const targetName = ref('')
const status = ref('')
const timeRange = ref<[Dayjs, Dayjs]>()
const logRecords = ref<LifecycleCleanupLog[]>([])
const logLoading = ref(false)
const runLatestLogs = createLatestRequest(logLoading)
const { currentPage, pageSize, total, pagination, handleTableChange } = useTablePagination(loadLogs)
const detailOpen = ref(false)
const detailLog = ref<LifecycleCleanupLog>()

const policyColumns: TableColumnsType = [
  { title: '治理策略', dataIndex: 'label', key: 'label', width: 150 },
  { title: '策略编码', dataIndex: 'policyCode', key: 'policyCode', width: 200 },
  { title: '保留天数', dataIndex: 'retentionDays', key: 'retentionDays', width: 100, align: 'right' },
  { title: '最近状态', dataIndex: 'latestStatus', key: 'latestStatus', width: 105, align: 'center' },
  { title: '影响行数', dataIndex: 'latestAffectedRows', key: 'latestAffectedRows', width: 100, align: 'right' },
  { title: '最近执行', dataIndex: 'latestStartedTime', key: 'latestStartedTime', width: 165 },
]

const jobColumns: TableColumnsType = [
  { title: '任务名称', dataIndex: 'jobName', key: 'jobName', width: 150 },
  { title: '任务类型', dataIndex: 'jobType', key: 'jobType', width: 150 },
  { title: 'Cron', dataIndex: 'cronExpression', key: 'cronExpression', width: 150 },
  { title: '状态', key: 'jobStatus', width: 100, align: 'center' },
]

const logColumns: TableColumnsType = [
  { title: '开始时间', dataIndex: 'startedTime', key: 'startedTime', width: 165 },
  { title: '策略编码', dataIndex: 'policyCode', key: 'policyCode', width: 190 },
  { title: '清理目标', dataIndex: 'targetName', key: 'targetName', width: 180 },
  { title: '保留天数', dataIndex: 'retentionDays', key: 'retentionDays', width: 100, align: 'right' },
  { title: '影响行数', dataIndex: 'affectedRows', key: 'affectedRows', width: 105, align: 'right' },
  { title: '执行状态', dataIndex: 'status', key: 'status', width: 105, align: 'center' },
  { title: '耗时', dataIndex: 'durationMs', key: 'durationMs', width: 100, align: 'right' },
  { title: '执行人', dataIndex: 'operator', key: 'operator', width: 120 },
  { title: '执行消息', dataIndex: 'message', key: 'message', width: 260 },
  { title: '操作', key: 'action', width: 78, align: 'center' },
]

const summaryItems = computed(() => {
  const summary = overview.value.summary
  return [
    { label: '治理策略', value: summary?.policyCount ?? 0, suffix: '项' },
    { label: '清理任务', value: summary?.totalJobCount ?? 0, suffix: '项' },
    { label: '已启用任务', value: summary?.enabledJobCount ?? 0, suffix: '项' },
    { label: '已有执行记录', value: summary?.policiesWithHistoryCount ?? 0, suffix: '项' },
    { label: '最近失败', value: summary?.latestFailureCount ?? 0, suffix: '次', danger: Boolean(summary?.latestFailureCount) },
    { label: '最近执行时间', value: formatDateTime(summary?.latestExecutionTime), suffix: '' },
  ]
})

function statusName(value?: string) {
  return statusLabels[value || ''] || value || '暂无记录'
}

async function loadOverview() {
  try {
    const result = await runLatestOverview(getLifecycleOverview)
    if (!result) return
    overview.value = result
    policies.value = result.policies || []
    jobs.value = result.jobs || []
  } catch (error) {
    overview.value = {}
    policies.value = []
    jobs.value = []
    message.error(getErrorMessage(error))
  }
}

async function loadLogs() {
  try {
    const result = await runLatestLogs(() => pageLifecycleCleanupLogs(
      currentPage.value,
      pageSize.value,
      keyword.value,
      policyCode.value,
      targetName.value,
      status.value,
      timeRange.value?.[0].toISOString(),
      timeRange.value?.[1].toISOString(),
    ))
    if (!result) return
    logRecords.value = result.records || []
    total.value = Number(result.total || 0)
    currentPage.value = Number(result.current || currentPage.value)
    pageSize.value = Number(result.size || pageSize.value)
  } catch (error) {
    logRecords.value = []
    total.value = 0
    message.error(getErrorMessage(error))
  }
}

async function switchMode(value: string | number) {
  mode.value = value as ViewMode
  if (mode.value === 'logs' && !logRecords.value.length && !logLoading.value) await loadLogs()
}

async function refresh() {
  if (mode.value === 'overview') await loadOverview()
  else await loadLogs()
}

async function search() {
  currentPage.value = 1
  await loadLogs()
}

async function resetQuery() {
  keyword.value = ''
  policyCode.value = ''
  targetName.value = ''
  status.value = ''
  timeRange.value = undefined
  currentPage.value = 1
  await loadLogs()
}

function openDetail(record: LifecycleCleanupLog) {
  detailLog.value = record
  detailOpen.value = true
}

loadOverview()
</script>

<template>
  <main class="management-page lifecycle-page">
    <header class="page-heading">
      <div>
        <h1>生命周期治理</h1>
        <span>集中查看数据保留策略、清理任务及执行结果</span>
      </div>
      <a-button :loading="overviewLoading || logLoading" @click="refresh">刷新</a-button>
    </header>

    <section class="summary-strip">
      <div v-for="item in summaryItems" :key="item.label" :class="{ danger: item.danger }">
        <span>{{ item.label }}</span>
        <strong>{{ item.value }}<small>{{ item.suffix }}</small></strong>
      </div>
    </section>

    <section class="lifecycle-workspace">
      <header class="workspace-toolbar">
        <a-segmented
          :value="mode"
          :options="[
            { label: '治理概览', value: 'overview' },
            { label: '清理日志', value: 'logs' },
          ]"
          @change="switchMode"
        />
      </header>

      <div v-if="mode === 'overview'" class="overview-grid">
        <section class="overview-panel">
          <header><h2>治理策略</h2><span>共 {{ policies.length }} 项</span></header>
          <ResizableTable
            class="lifecycle-table"
            row-key="policyCode"
            size="middle"
            table-layout="fixed"
            :columns="policyColumns"
            :data-source="policies"
            :loading="overviewLoading"
            :pagination="false"
          >
            <template #bodyCell="{ column, record }">
              <template v-if="column.key === 'label'">
                <strong :title="record.targetDescription">{{ record.label || '未命名策略' }}</strong>
              </template>
              <template v-else-if="column.key === 'policyCode'"><code>{{ record.policyCode || '—' }}</code></template>
              <template v-else-if="column.key === 'retentionDays'">{{ record.retentionDays ?? 0 }} 天</template>
              <template v-else-if="column.key === 'latestStatus'">
                <a-tag :color="statusColors[record.latestStatus] || 'default'">{{ statusName(record.latestStatus) }}</a-tag>
              </template>
              <template v-else-if="column.key === 'latestAffectedRows'">{{ record.latestAffectedRows ?? 0 }}</template>
              <template v-else-if="column.key === 'latestStartedTime'">{{ formatDateTime(record.latestStartedTime) }}</template>
            </template>
            <template #emptyText><div class="empty-table">暂无治理策略</div></template>
          </ResizableTable>
        </section>

        <section class="overview-panel">
          <header><h2>清理任务</h2><span>共 {{ jobs.length }} 项</span></header>
          <ResizableTable
            class="lifecycle-table"
            row-key="jobId"
            size="middle"
            table-layout="fixed"
            :columns="jobColumns"
            :data-source="jobs"
            :loading="overviewLoading"
            :pagination="false"
          >
            <template #bodyCell="{ column, record }">
              <template v-if="column.key === 'jobName'">
                <strong :title="record.purpose">{{ record.label || record.jobName || '未命名任务' }}</strong>
              </template>
              <template v-else-if="column.key === 'jobType'"><code>{{ record.jobType || '—' }}</code></template>
              <template v-else-if="column.key === 'cronExpression'"><code>{{ record.cronExpression || '—' }}</code></template>
              <template v-else-if="column.key === 'jobStatus'">
                <a-tag :color="record.available && record.enabled ? 'success' : 'default'">
                  {{ !record.available ? '不可用' : record.enabled ? '已启用' : '未启用' }}
                </a-tag>
              </template>
            </template>
            <template #emptyText><div class="empty-table">暂无清理任务</div></template>
          </ResizableTable>
        </section>
      </div>

      <div v-else class="logs-view">
        <section class="query-panel">
          <div class="query-fields">
            <a-input v-model:value="keyword" allow-clear placeholder="请输入策略、目标、消息或执行人" @press-enter="search" />
            <a-input v-model:value="policyCode" allow-clear placeholder="策略编码" @press-enter="search" />
            <a-input v-model:value="targetName" allow-clear placeholder="清理目标" @press-enter="search" />
            <a-input v-model:value="status" allow-clear placeholder="执行状态" @press-enter="search" />
            <a-range-picker
              v-model:value="timeRange"
              show-time
              format="YYYY-MM-DD HH:mm:ss"
              :placeholder="['开始时间', '结束时间']"
            />
          </div>
          <div class="query-actions">
            <a-button type="primary" :loading="logLoading" @click="search">查询</a-button>
            <a-button :disabled="logLoading" @click="resetQuery">重置</a-button>
          </div>
        </section>

        <section class="log-panel">
          <ResizableTable
            class="lifecycle-table"
            row-key="cleanupId"
            size="middle"
            table-layout="fixed"
            :columns="logColumns"
            :data-source="logRecords"
            :loading="logLoading"
            :pagination="pagination"
            @change="handleTableChange"
          >
            <template #bodyCell="{ column, record }">
              <template v-if="column.key === 'startedTime'">{{ formatDateTime(record.startedTime) }}</template>
              <template v-else-if="column.key === 'policyCode'"><code>{{ record.policyCode || '—' }}</code></template>
              <template v-else-if="column.key === 'targetName'"><strong>{{ record.targetName || '—' }}</strong></template>
              <template v-else-if="column.key === 'retentionDays'">{{ record.retentionDays ?? 0 }} 天</template>
              <template v-else-if="column.key === 'affectedRows'">{{ record.affectedRows ?? 0 }}</template>
              <template v-else-if="column.key === 'status'">
                <a-tag :color="statusColors[record.status] || 'default'">{{ statusName(record.status) }}</a-tag>
              </template>
              <template v-else-if="column.key === 'durationMs'">{{ record.durationMs ?? 0 }} ms</template>
              <template v-else-if="column.key === 'operator'">{{ record.operator || '系统' }}</template>
              <template v-else-if="column.key === 'message'"><span class="cell-text" :title="record.message">{{ record.message || '—' }}</span></template>
              <template v-else-if="column.key === 'action'">
                <a-button type="link" size="small" @click="openDetail(record)">详情</a-button>
              </template>
            </template>
            <template #emptyText><div class="empty-table">暂无符合条件的清理日志</div></template>
          </ResizableTable>
        </section>
      </div>
    </section>

    <a-modal v-model:open="detailOpen" title="清理日志详情" :width="840" :footer="null">
      <dl class="log-detail">
        <div><dt>开始时间</dt><dd>{{ formatDateTime(detailLog?.startedTime) }}</dd></div>
        <div><dt>完成时间</dt><dd>{{ formatDateTime(detailLog?.finishedTime) }}</dd></div>
        <div><dt>执行状态</dt><dd><a-tag :color="statusColors[detailLog?.status || ''] || 'default'">{{ statusName(detailLog?.status) }}</a-tag></dd></div>
        <div><dt>执行耗时</dt><dd>{{ detailLog?.durationMs ?? 0 }} ms</dd></div>
        <div><dt>策略编码</dt><dd><code>{{ detailLog?.policyCode || '—' }}</code></dd></div>
        <div><dt>清理目标</dt><dd>{{ detailLog?.targetName || '—' }}</dd></div>
        <div><dt>保留天数</dt><dd>{{ detailLog?.retentionDays ?? 0 }} 天</dd></div>
        <div><dt>影响行数</dt><dd>{{ detailLog?.affectedRows ?? 0 }}</dd></div>
        <div><dt>执行人</dt><dd>{{ detailLog?.operator || '系统' }}</dd></div>
        <div><dt>来源系统</dt><dd>{{ detailLog?.sourceSystem || '—' }}</dd></div>
        <div><dt>业务日期</dt><dd>{{ detailLog?.bizDate || '—' }}</dd></div>
        <div><dt>归档状态</dt><dd>{{ detailLog?.archivedFlag ? '已归档' : '未归档' }}</dd></div>
        <div class="full-detail"><dt>执行消息</dt><dd class="long-text">{{ detailLog?.message || '—' }}</dd></div>
        <div class="half-detail"><dt>Trace ID</dt><dd><code>{{ detailLog?.traceId || '—' }}</code></dd></div>
        <div class="half-detail"><dt>幂等键</dt><dd><code>{{ detailLog?.idempotentKey || '—' }}</code></dd></div>
      </dl>
    </a-modal>
  </main>
</template>

<style scoped>
.lifecycle-page { width: 100%; min-width: 0; padding: 8px 10px 10px; color: var(--shell-ink); }
.page-heading { display: flex; min-height: 58px; flex: none; align-items: center; justify-content: space-between; padding: 8px 13px; border: 1px solid var(--shell-border); background: var(--shell-panel); }
.page-heading h1, .overview-panel h2 { margin: 0; color: var(--shell-ink); font-size: 18px; font-weight: 600; }
.page-heading span, .overview-panel header span { display: block; margin-top: 2px; color: var(--shell-muted); font-size: 12px; }
.summary-strip { display: grid; flex: none; margin-top: 8px; border: 1px solid var(--shell-border); background: var(--shell-panel); grid-template-columns: repeat(6, minmax(0, 1fr)); }
.summary-strip > div { min-width: 0; padding: 10px 13px; border-right: 1px solid var(--shell-border); }
.summary-strip > div:last-child { border-right: 0; }
.summary-strip span { display: block; color: var(--shell-muted); font-size: 12px; }
.summary-strip strong { display: block; margin-top: 3px; overflow: hidden; color: var(--shell-ink); font-size: 20px; font-weight: 600; text-overflow: ellipsis; white-space: nowrap; }
.summary-strip small { margin-left: 3px; font-size: 12px; font-weight: 500; }
.summary-strip .danger strong { color: #d94c4c; }
.lifecycle-workspace { display: flex; min-height: 0; flex: 1; flex-direction: column; margin-top: 8px; overflow: hidden; border: 1px solid var(--shell-border); background: var(--shell-panel); }
.workspace-toolbar { display: flex; min-height: 52px; flex: none; align-items: center; padding: 8px 13px; border-bottom: 1px solid var(--shell-border); }
.overview-grid { display: grid; min-height: 0; flex: 1; gap: 10px; background: var(--shell-bg); grid-template-columns: repeat(2, minmax(0, 1fr)); }
.overview-panel { display: flex; min-width: 0; min-height: 0; flex-direction: column; overflow: hidden; background: var(--shell-panel); }
.overview-panel > header { display: flex; min-height: 48px; flex: none; align-items: center; justify-content: space-between; padding: 8px 13px; border-bottom: 1px solid var(--shell-border); }
.overview-panel h2 { font-size: 16px; }
.overview-panel > .resizable-table-host, .log-panel > .resizable-table-host { min-height: 0; flex: 1; }
.logs-view { display: flex; min-height: 0; flex: 1; flex-direction: column; overflow: hidden; }
.query-panel { display: flex; flex: none; align-items: center; justify-content: space-between; gap: 12px; padding: 10px 13px; border-bottom: 1px solid var(--shell-border); }
.query-fields { display: grid; min-width: 0; flex: 1; grid-template-columns: minmax(220px, 1fr) 150px 145px 120px 320px; gap: 8px; }
.query-actions { flex: none; }
.log-panel { display: flex; min-height: 0; flex: 1; flex-direction: column; overflow: hidden; }
.lifecycle-table :deep(.ant-table) { color: var(--shell-ink); background: var(--shell-panel); }
.lifecycle-table :deep(.ant-table-thead > tr > th) { padding-block: 9px; color: var(--shell-muted); font-size: 13px; font-weight: 600; background: var(--shell-hover); }
.lifecycle-table :deep(.ant-table-tbody > tr > td) { padding-block: 8px; }
.lifecycle-table :deep(.ant-table-tbody > tr:hover > td) { background: color-mix(in srgb, var(--brand) 7%, var(--shell-panel)); }
.lifecycle-table :deep(.ant-pagination) { margin: 13px; }
.lifecycle-table code, .log-detail code { color: var(--brand-deep); font-family: 'SFMono-Regular', Consolas, monospace; font-size: 12px; }
.cell-text { display: block; overflow: hidden; color: var(--shell-muted); text-overflow: ellipsis; white-space: nowrap; }
.empty-table { display: flex; min-height: 150px; align-items: center; justify-content: center; color: var(--shell-muted); }
.log-detail { display: grid; margin: 8px 0 0; grid-template-columns: repeat(4, minmax(0, 1fr)); border-top: 1px solid var(--shell-border); border-left: 1px solid var(--shell-border); }
.log-detail > div { min-width: 0; padding: 10px 12px; border-right: 1px solid var(--shell-border); border-bottom: 1px solid var(--shell-border); }
.log-detail dt { color: var(--shell-muted); font-size: 12px; }
.log-detail dd { min-width: 0; margin: 4px 0 0; overflow-wrap: anywhere; }
.log-detail .full-detail { grid-column: 1 / -1; }
.log-detail .half-detail { grid-column: span 2; }
.long-text { max-height: 110px; overflow: auto; white-space: pre-wrap; }
</style>
