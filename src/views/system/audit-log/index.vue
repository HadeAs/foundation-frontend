<script setup lang="ts">
defineOptions({ name: 'AuditLogManagementView' })

import {
  Button as AButton,
  Input as AInput,
  Modal as AModal,
  RangePicker as ARangePicker,
  Tag as ATag,
  message,
  type TableColumnsType,
  type TablePaginationConfig,
} from 'ant-design-vue'
import type { Dayjs } from 'dayjs'
import { computed, ref } from 'vue'

import { getErrorMessage } from '@/api/http'
import { pageAuditLogs, type SysAuditLog } from '@/api/log'
import ResizableTable from '@/components/common/ResizableTable.vue'
import { formatDateTime } from '@/utils/date'

const actionLabels: Record<string, string> = {
  CREATE: '创建',
  UPDATE: '更新',
  DELETE: '删除',
  INSERT: '新增',
  OTHER: '其他',
}
const actionColors: Record<string, string> = {
  CREATE: 'green',
  INSERT: 'green',
  UPDATE: 'blue',
  DELETE: 'red',
  OTHER: 'default',
}

const keyword = ref('')
const targetType = ref('')
const actionType = ref('')
const operator = ref('')
const timeRange = ref<[Dayjs, Dayjs]>()
const records = ref<SysAuditLog[]>([])
const loading = ref(false)
const currentPage = ref(1)
const pageSize = ref(20)
const total = ref(0)
const detailOpen = ref(false)
const detailLog = ref<SysAuditLog>()

const columns: TableColumnsType = [
  { title: '审计时间', dataIndex: 'createdTime', key: 'createdTime', width: 165 },
  { title: '操作人', dataIndex: 'operator', key: 'operator', width: 120 },
  { title: '动作类型', dataIndex: 'actionType', key: 'actionType', width: 105, align: 'center' },
  { title: '目标类型', dataIndex: 'targetType', key: 'targetType', width: 145 },
  { title: '目标名称', dataIndex: 'targetName', key: 'targetName', width: 180 },
  { title: '目标编号', dataIndex: 'targetId', key: 'targetId', width: 130 },
  { title: '变更摘要', dataIndex: 'summary', key: 'summary', width: 300 },
  { title: 'IP 地址', dataIndex: 'ipAddress', key: 'ipAddress', width: 140 },
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

function actionName(value?: string) {
  return actionLabels[value || ''] || value || '未知'
}

async function load() {
  loading.value = true
  try {
    const result = await pageAuditLogs(
      currentPage.value,
      pageSize.value,
      keyword.value,
      targetType.value,
      actionType.value,
      operator.value,
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
  targetType.value = ''
  actionType.value = ''
  operator.value = ''
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

function openDetail(record: SysAuditLog) {
  detailLog.value = record
  detailOpen.value = true
}

load()
</script>

<template>
  <main class="management-page">
    <section class="query-panel">
      <div class="query-fields">
        <a-input v-model:value="keyword" allow-clear placeholder="请输入目标、摘要、IP 或 Trace ID" @press-enter="search" />
        <a-input v-model:value="targetType" allow-clear placeholder="目标类型" @press-enter="search" />
        <a-input v-model:value="actionType" allow-clear placeholder="动作类型" @press-enter="search" />
        <a-input v-model:value="operator" allow-clear placeholder="操作人" @press-enter="search" />
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
          <h1>审计日志</h1>
          <span>追踪业务对象变更及变更前后内容</span>
        </div>
      </header>

      <ResizableTable
        class="log-table"
        row-key="auditId"
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
          <template v-else-if="column.key === 'operator'">
            <strong>{{ record.operator || '未知用户' }}</strong>
          </template>
          <template v-else-if="column.key === 'actionType'">
            <a-tag :color="actionColors[record.actionType] || 'default'">{{ actionName(record.actionType) }}</a-tag>
          </template>
          <template v-else-if="column.key === 'targetType'">
            <code class="code-cell" :title="record.targetType">{{ record.targetType || '—' }}</code>
          </template>
          <template v-else-if="column.key === 'targetName'">
            <span class="cell-text" :title="record.targetName">{{ record.targetName || '—' }}</span>
          </template>
          <template v-else-if="column.key === 'targetId'">
            <code class="code-cell" :title="record.targetId">{{ record.targetId || '—' }}</code>
          </template>
          <template v-else-if="column.key === 'summary'">
            <span class="cell-text" :title="record.summary">{{ record.summary || '—' }}</span>
          </template>
          <template v-else-if="column.key === 'ipAddress'">{{ record.ipAddress || '—' }}</template>
          <template v-else-if="column.key === 'traceId'">
            <code class="code-cell" :title="record.traceId">{{ record.traceId || '—' }}</code>
          </template>
          <template v-else-if="column.key === 'action'">
            <a-button type="link" size="small" @click="openDetail(record)">详情</a-button>
          </template>
        </template>
        <template #emptyText><div class="empty-table">暂无符合条件的审计日志</div></template>
      </ResizableTable>
    </section>

    <a-modal v-model:open="detailOpen" title="审计日志详情" :width="1000" :footer="null">
      <dl class="log-detail">
        <div><dt>审计时间</dt><dd>{{ formatDateTime(detailLog?.createdTime) }}</dd></div>
        <div><dt>操作人</dt><dd>{{ detailLog?.operator || '未知用户' }}</dd></div>
        <div><dt>动作类型</dt><dd><a-tag :color="actionColors[detailLog?.actionType || ''] || 'default'">{{ actionName(detailLog?.actionType) }}</a-tag></dd></div>
        <div><dt>IP 地址</dt><dd>{{ detailLog?.ipAddress || '—' }}</dd></div>
        <div><dt>目标类型</dt><dd><code>{{ detailLog?.targetType || '—' }}</code></dd></div>
        <div><dt>目标编号</dt><dd><code>{{ detailLog?.targetId || '—' }}</code></dd></div>
        <div><dt>目标名称</dt><dd>{{ detailLog?.targetName || '—' }}</dd></div>
        <div><dt>来源系统</dt><dd>{{ detailLog?.sourceSystem || '—' }}</dd></div>
        <div class="full-detail"><dt>变更摘要</dt><dd class="long-text">{{ detailLog?.summary || '—' }}</dd></div>
      </dl>

      <div class="change-grid">
        <section>
          <h2>变更前</h2>
          <pre>{{ detailLog?.beforeJson || '无变更前数据' }}</pre>
        </section>
        <section>
          <h2>变更后</h2>
          <pre>{{ detailLog?.afterJson || '无变更后数据' }}</pre>
        </section>
      </div>

      <dl class="log-detail detail-footer">
        <div><dt>业务日期</dt><dd>{{ detailLog?.bizDate || '—' }}</dd></div>
        <div><dt>归档状态</dt><dd>{{ detailLog?.archivedFlag ? '已归档' : '未归档' }}</dd></div>
        <div><dt>归档时间</dt><dd>{{ formatDateTime(detailLog?.archivedTime) }}</dd></div>
        <div><dt>审计编号</dt><dd>{{ detailLog?.auditId ?? '—' }}</dd></div>
        <div class="half-detail"><dt>Trace ID</dt><dd><code>{{ detailLog?.traceId || '—' }}</code></dd></div>
        <div class="half-detail"><dt>幂等键</dt><dd><code>{{ detailLog?.idempotentKey || '—' }}</code></dd></div>
      </dl>
    </a-modal>
  </main>
</template>

<style scoped>
.query-panel { display: flex; align-items: center; justify-content: space-between; gap: 12px; padding: 11px 13px; border: 1px solid var(--shell-border); background: var(--shell-panel); }
.query-fields { display: grid; min-width: 0; flex: 1; grid-template-columns: minmax(220px, 1fr) 125px 125px 125px 320px; gap: 8px; }
.query-actions { display: flex; flex: none; gap: 7px; }
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
.code-cell, .cell-text { display: block; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.code-cell { color: var(--brand-deep); font-family: 'SFMono-Regular', Consolas, monospace; font-size: 13px; }
.cell-text { color: var(--shell-muted); }
.empty-table { display: flex; min-height: 180px; align-items: center; justify-content: center; color: var(--shell-muted); }
.log-detail { display: grid; margin: 8px 0 0; grid-template-columns: repeat(4, minmax(0, 1fr)); border-top: 1px solid var(--shell-border); border-left: 1px solid var(--shell-border); }
.log-detail > div { min-width: 0; padding: 10px 12px; border-right: 1px solid var(--shell-border); border-bottom: 1px solid var(--shell-border); }
.log-detail dt { color: var(--shell-muted); font-size: 12px; }
.log-detail dd { min-width: 0; margin: 4px 0 0; overflow-wrap: anywhere; }
.log-detail code { color: var(--brand-deep); font-family: 'SFMono-Regular', Consolas, monospace; font-size: 12px; }
.log-detail .full-detail { grid-column: 1 / -1; }
.long-text { max-height: 100px; overflow: auto; white-space: pre-wrap; }
.log-detail .half-detail { grid-column: span 2; }
.change-grid { display: grid; margin-top: 12px; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 10px; }
.change-grid section { min-width: 0; border: 1px solid var(--shell-border); background: var(--shell-hover); }
.change-grid h2 { margin: 0; padding: 8px 11px; color: var(--shell-ink); border-bottom: 1px solid var(--shell-border); background: var(--shell-panel); font-size: 14px; font-weight: 600; }
.change-grid pre { min-height: 150px; max-height: 260px; margin: 0; padding: 11px; overflow: auto; color: var(--shell-ink); font-family: 'SFMono-Regular', Consolas, monospace; font-size: 12px; line-height: 1.65; white-space: pre-wrap; overflow-wrap: anywhere; }
.detail-footer { margin-top: 12px; }
</style>
