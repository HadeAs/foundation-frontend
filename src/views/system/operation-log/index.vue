<script setup lang="ts">
defineOptions({ name: 'OperationLogManagementView' })

import {
  Button as AButton,
  Input as AInput,
  Modal as AModal,
  RangePicker as ARangePicker,
  Select as ASelect,
  Tag as ATag,
  message,
  type TableColumnsType,
  type TablePaginationConfig,
} from 'ant-design-vue'
import type { Dayjs } from 'dayjs'
import { computed, ref } from 'vue'

import { getErrorMessage } from '@/api/http'
import { pageOperationLogs, type SysOperationLog } from '@/api/log'
import ResizableTable from '@/components/common/ResizableTable.vue'
import { formatDateTime } from '@/utils/date'

import { getHttpStatusTone } from '../api-log/status'

const operationOptions = [
  { label: '创建', value: 'CREATE' },
  { label: '更新', value: 'UPDATE' },
  { label: '删除', value: 'DELETE' },
  { label: '其他', value: 'OTHER' },
]
const operationLabels: Record<string, string> = Object.fromEntries(operationOptions.map((item) => [item.value, item.label]))
const operationColors: Record<string, string> = { CREATE: 'green', UPDATE: 'blue', DELETE: 'red', OTHER: 'default' }
const methodColors: Record<string, string> = { GET: 'blue', POST: 'green', PUT: 'orange', PATCH: 'gold', DELETE: 'red' }

const keyword = ref('')
const operationType = ref<string>()
const timeRange = ref<[Dayjs, Dayjs]>()
const records = ref<SysOperationLog[]>([])
const loading = ref(false)
const currentPage = ref(1)
const pageSize = ref(20)
const total = ref(0)
const detailOpen = ref(false)
const detailLog = ref<SysOperationLog>()

const columns: TableColumnsType = [
  { title: '操作时间', dataIndex: 'createdTime', key: 'createdTime', width: 165 },
  { title: '操作用户', dataIndex: 'username', key: 'username', width: 120 },
  { title: '操作类型', dataIndex: 'operationType', key: 'operationType', width: 100, align: 'center' },
  { title: '方法', dataIndex: 'requestMethod', key: 'requestMethod', width: 82, align: 'center' },
  { title: '请求路径', dataIndex: 'requestPath', key: 'requestPath', width: 300 },
  { title: '状态码', dataIndex: 'statusCode', key: 'statusCode', width: 90, align: 'center' },
  { title: '耗时', dataIndex: 'durationMs', key: 'durationMs', width: 100, align: 'right' },
  { title: 'IP 地址', dataIndex: 'ipAddress', key: 'ipAddress', width: 135 },
  { title: '操作消息', dataIndex: 'message', key: 'message', width: 250 },
  { title: 'Trace ID', dataIndex: 'traceId', key: 'traceId', width: 220 },
  { title: '操作', key: 'action', width: 78, align: 'center' },
]

const pagination = computed<TablePaginationConfig>(() => ({
  current: currentPage.value,
  pageSize: pageSize.value,
  total: total.value,
  showSizeChanger: true,
  pageSizeOptions: ['10', '20', '50', '100'],
  showTotal: (count) => `共 ${count} 条`,
}))

async function load() {
  loading.value = true
  try {
    const result = await pageOperationLogs(
      currentPage.value,
      pageSize.value,
      keyword.value,
      operationType.value,
      timeRange.value?.[0].toISOString(),
      timeRange.value?.[1].toISOString(),
    )
    records.value = result.records || []
    total.value = Number(result.total || 0)
    currentPage.value = Number(result.current || currentPage.value)
    pageSize.value = Number(result.size || pageSize.value)
  } catch (error) {
    records.value = []
    total.value = 0
    message.error(getErrorMessage(error))
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
  operationType.value = undefined
  timeRange.value = undefined
  currentPage.value = 1
  await load()
}

function handleTableChange(next: TablePaginationConfig) {
  const nextSize = next.pageSize || pageSize.value
  currentPage.value = nextSize === pageSize.value ? next.current || 1 : 1
  pageSize.value = nextSize
  void load()
}

function openDetail(record: SysOperationLog) {
  detailLog.value = record
  detailOpen.value = true
}

load()
</script>

<template>
  <main class="management-page">
    <section class="query-panel">
      <div class="query-fields">
        <a-input v-model:value="keyword" allow-clear placeholder="请输入用户、请求路径、IP 或 Trace ID" @press-enter="search" />
        <a-select v-model:value="operationType" allow-clear placeholder="全部类型" :options="operationOptions" />
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
        <a-button class="secondary-action" :disabled="loading" @click="load">刷新</a-button>
      </div>
    </section>

    <section class="table-panel">
      <header class="table-toolbar">
        <div>
          <h1>操作日志</h1>
          <span>记录系统变更操作与请求链路</span>
        </div>
      </header>

      <ResizableTable
        class="log-table"
        row-key="logId"
        size="middle"
        table-layout="fixed"
        :columns="columns"
        :data-source="records"
        :loading="loading"
        :pagination="pagination"
        @change="handleTableChange"
      >
        <template #bodyCell="{ column, record }">
          <template v-if="column.key === 'createdTime'">{{ formatDateTime(record.createdTime) }}</template>
          <template v-else-if="column.key === 'username'">
            <strong>{{ record.username || '未知用户' }}</strong>
          </template>
          <template v-else-if="column.key === 'operationType'">
            <a-tag :color="operationColors[record.operationType] || 'default'">
              {{ operationLabels[record.operationType] || record.operationType || '未知' }}
            </a-tag>
          </template>
          <template v-else-if="column.key === 'requestMethod'">
            <a-tag :color="methodColors[record.requestMethod] || 'default'">{{ record.requestMethod || '—' }}</a-tag>
          </template>
          <template v-else-if="column.key === 'requestPath'">
            <code class="path-cell" :title="record.requestPath">{{ record.requestPath || '—' }}</code>
          </template>
          <template v-else-if="column.key === 'statusCode'">
            <a-tag :color="getHttpStatusTone(record.statusCode)">{{ record.statusCode ?? '—' }}</a-tag>
          </template>
          <template v-else-if="column.key === 'durationMs'">{{ record.durationMs ?? 0 }} ms</template>
          <template v-else-if="column.key === 'ipAddress'">
            <span class="cell-text">{{ record.ipAddress || '—' }}</span>
          </template>
          <template v-else-if="column.key === 'message'">
            <span class="cell-text" :title="record.message">{{ record.message || '—' }}</span>
          </template>
          <template v-else-if="column.key === 'traceId'">
            <code class="trace-cell" :title="record.traceId">{{ record.traceId || '—' }}</code>
          </template>
          <template v-else-if="column.key === 'action'">
            <a-button type="link" size="small" @click="openDetail(record)">详情</a-button>
          </template>
        </template>
        <template #emptyText><div class="empty-table">暂无符合条件的操作日志</div></template>
      </ResizableTable>
    </section>

    <a-modal v-model:open="detailOpen" title="操作日志详情" :width="820" :footer="null">
      <dl class="log-detail">
        <div><dt>操作时间</dt><dd>{{ formatDateTime(detailLog?.createdTime) }}</dd></div>
        <div><dt>操作用户</dt><dd>{{ detailLog?.username || '未知用户' }}</dd></div>
        <div><dt>操作类型</dt><dd>{{ operationLabels[detailLog?.operationType || ''] || detailLog?.operationType || '未知' }}</dd></div>
        <div><dt>请求方法</dt><dd>{{ detailLog?.requestMethod || '—' }}</dd></div>
        <div><dt>状态码</dt><dd><a-tag :color="getHttpStatusTone(detailLog?.statusCode)">{{ detailLog?.statusCode ?? '—' }}</a-tag></dd></div>
        <div><dt>执行耗时</dt><dd>{{ detailLog?.durationMs ?? 0 }} ms</dd></div>
        <div><dt>IP 地址</dt><dd>{{ detailLog?.ipAddress || '—' }}</dd></div>
        <div><dt>来源系统</dt><dd>{{ detailLog?.sourceSystem || '—' }}</dd></div>
        <div class="full-detail"><dt>请求路径</dt><dd><code>{{ detailLog?.requestPath || '—' }}</code></dd></div>
        <div class="full-detail"><dt>请求体</dt><dd><pre>{{ detailLog?.requestBody || '—' }}</pre></dd></div>
        <div class="full-detail"><dt>操作消息</dt><dd class="long-text">{{ detailLog?.message || '—' }}</dd></div>
        <div><dt>业务日期</dt><dd>{{ detailLog?.bizDate || '—' }}</dd></div>
        <div><dt>归档状态</dt><dd>{{ detailLog?.archivedFlag ? '已归档' : '未归档' }}</dd></div>
        <div><dt>归档时间</dt><dd>{{ formatDateTime(detailLog?.archivedTime) }}</dd></div>
        <div><dt>日志编号</dt><dd>{{ detailLog?.logId ?? '—' }}</dd></div>
        <div class="half-detail"><dt>Trace ID</dt><dd><code>{{ detailLog?.traceId || '—' }}</code></dd></div>
        <div class="half-detail"><dt>幂等键</dt><dd><code>{{ detailLog?.idempotentKey || '—' }}</code></dd></div>
      </dl>
    </a-modal>
  </main>
</template>

<style scoped>
.query-panel { display: flex; align-items: center; justify-content: space-between; gap: 16px; padding: 11px 13px; border: 1px solid var(--shell-border); background: var(--shell-panel); }
.query-fields { display: grid; width: min(940px, 76%); grid-template-columns: minmax(280px, 1fr) 140px 345px; gap: 8px; }
.query-actions { display: flex; gap: 7px; }
.query-actions :deep(.ant-btn) { min-width: 58px; }
.secondary-action { color: var(--shell-ink); background: var(--shell-hover); }
.secondary-action:hover { color: var(--brand) !important; background: color-mix(in srgb, var(--brand) 11%, var(--shell-panel)) !important; }
.table-panel { margin-top: 8px; border: 1px solid var(--shell-border); background: var(--shell-panel); }
.table-toolbar { display: flex; min-height: 58px; align-items: center; padding: 8px 13px; border-bottom: 1px solid var(--shell-border); }
.table-toolbar h1 { margin: 0; color: var(--shell-ink); font-size: 18px; font-weight: 600; }
.table-toolbar span { display: block; margin-top: 2px; color: var(--shell-muted); font-size: 12px; }
.log-table :deep(.ant-table) { color: var(--shell-ink); background: var(--shell-panel); }
.log-table :deep(.ant-table-thead > tr > th) { padding-block: 9px; color: var(--shell-muted); font-size: 13px; font-weight: 600; background: var(--shell-hover); }
.log-table :deep(.ant-table-tbody > tr > td) { padding-block: 8px; }
.log-table :deep(.ant-table-tbody > tr:hover > td) { background: color-mix(in srgb, var(--brand) 7%, var(--shell-panel)); }
.log-table :deep(.ant-pagination) { margin: 13px; }
.path-cell, .trace-cell, .cell-text { display: block; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.path-cell, .trace-cell { color: var(--brand-deep); font-family: 'SFMono-Regular', Consolas, monospace; font-size: 13px; }
.cell-text { color: var(--shell-muted); }
.empty-table { display: flex; min-height: 180px; align-items: center; justify-content: center; color: var(--shell-muted); }
.log-detail { display: grid; margin: 8px 0 0; grid-template-columns: repeat(4, minmax(0, 1fr)); border-top: 1px solid var(--shell-border); border-left: 1px solid var(--shell-border); }
.log-detail > div { min-width: 0; padding: 10px 12px; border-right: 1px solid var(--shell-border); border-bottom: 1px solid var(--shell-border); }
.log-detail dt { color: var(--shell-muted); font-size: 12px; }
.log-detail dd { min-width: 0; margin: 4px 0 0; overflow-wrap: anywhere; }
.log-detail code { color: var(--brand-deep); font-family: 'SFMono-Regular', Consolas, monospace; font-size: 12px; }
.log-detail .full-detail { grid-column: 1 / -1; }
.log-detail pre { max-height: 140px; margin: 0; overflow: auto; color: var(--shell-ink); font-family: 'SFMono-Regular', Consolas, monospace; font-size: 12px; white-space: pre-wrap; }
.long-text { max-height: 100px; overflow: auto; white-space: pre-wrap; }
.log-detail .half-detail { grid-column: span 2; }
</style>
