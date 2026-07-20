<script setup lang="ts">
defineOptions({ name: 'LoginLogManagementView' })

import {
  Button as AButton,
  Input as AInput,
  Modal as AModal,
  RangePicker as ARangePicker,
  Select as ASelect,
  Tag as ATag,
  message,
  type TableColumnsType,
} from 'ant-design-vue'
import type { Dayjs } from 'dayjs'
import { ref } from 'vue'

import { getErrorMessage } from '@/api/http'
import { pageLoginLogs, type SysLoginLog } from '@/api/log'
import ResizableTable from '@/components/common/ResizableTable.vue'
import { useTablePagination } from '@/composables/use-table-pagination'
import { formatDateTime } from '@/utils/date'
import { createLatestRequest } from '@/utils/latest-request'

const resultOptions = [
  { label: '成功', value: 'true' },
  { label: '失败', value: 'false' },
]

const keyword = ref('')
const success = ref<string>()
const timeRange = ref<[Dayjs, Dayjs]>()
const records = ref<SysLoginLog[]>([])
const loading = ref(false)
const runLatestLoad = createLatestRequest(loading)
const { currentPage, pageSize, total, pagination, handleTableChange } = useTablePagination(load)
const detailOpen = ref(false)
const detailLog = ref<SysLoginLog>()

const columns: TableColumnsType = [
  { title: '登录时间', dataIndex: 'createdTime', key: 'createdTime', width: 165 },
  { title: '登录账号', dataIndex: 'username', key: 'username', width: 140 },
  { title: '登录结果', dataIndex: 'successFlag', key: 'successFlag', width: 100, align: 'center' },
  { title: 'IP 地址', dataIndex: 'ipAddress', key: 'ipAddress', width: 145 },
  { title: '结果消息', dataIndex: 'message', key: 'message', width: 270 },
  { title: '来源系统', dataIndex: 'sourceSystem', key: 'sourceSystem', width: 120 },
  { title: 'Trace ID', dataIndex: 'traceId', key: 'traceId', width: 230 },
  { title: '操作', key: 'action', width: 78, align: 'center' },
]


async function load() {
  try {
    const result = await runLatestLoad(() => pageLoginLogs(
      currentPage.value,
      pageSize.value,
      keyword.value,
      success.value === undefined ? undefined : success.value === 'true',
      timeRange.value?.[0].toISOString(),
      timeRange.value?.[1].toISOString(),
    ))
    if (!result) return
    records.value = result.records || []
    total.value = Number(result.total || 0)
    currentPage.value = Number(result.current || currentPage.value)
    pageSize.value = Number(result.size || pageSize.value)
  } catch (error) {
    records.value = []
    total.value = 0
    message.error(getErrorMessage(error))
  }
}

async function search() {
  currentPage.value = 1
  await load()
}

async function resetQuery() {
  keyword.value = ''
  success.value = undefined
  timeRange.value = undefined
  currentPage.value = 1
  await load()
}

function openDetail(record: SysLoginLog) {
  detailLog.value = record
  detailOpen.value = true
}

load()
</script>

<template>
  <main class="management-page">
    <section class="query-panel">
      <div class="query-fields">
        <a-input v-model:value="keyword" allow-clear placeholder="请输入登录账号、IP 或 Trace ID" @press-enter="search" />
        <a-select v-model:value="success" allow-clear placeholder="全部结果" :options="resultOptions" />
        <a-range-picker
          v-model:value="timeRange"
          show-time
          format="YYYY-MM-DD HH:mm:ss"
          :placeholder="['开始时间', '结束时间']"
        />
      </div>
      <div class="query-actions">
        <a-button type="primary" :loading="loading" @click="search">查询</a-button>
        <a-button :disabled="loading" @click="resetQuery">重置</a-button>
        <a-button :disabled="loading" @click="load">刷新</a-button>
      </div>
    </section>

    <section class="table-panel">
      <header class="table-toolbar">
        <div>
          <h1>登录日志</h1>
          <span>记录账号访问结果与登录来源</span>
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
            <strong>{{ record.username || '未知账号' }}</strong>
          </template>
          <template v-else-if="column.key === 'successFlag'">
            <a-tag :color="record.successFlag ? 'success' : 'error'">{{ record.successFlag ? '成功' : '失败' }}</a-tag>
          </template>
          <template v-else-if="column.key === 'ipAddress'">
            <span class="cell-text">{{ record.ipAddress || '—' }}</span>
          </template>
          <template v-else-if="column.key === 'message'">
            <span class="cell-text" :title="record.message">{{ record.message || '—' }}</span>
          </template>
          <template v-else-if="column.key === 'sourceSystem'">{{ record.sourceSystem || '—' }}</template>
          <template v-else-if="column.key === 'traceId'">
            <code class="trace-cell" :title="record.traceId">{{ record.traceId || '—' }}</code>
          </template>
          <template v-else-if="column.key === 'action'">
            <a-button type="link" size="small" @click="openDetail(record)">详情</a-button>
          </template>
        </template>
        <template #emptyText><div class="empty-table">暂无符合条件的登录日志</div></template>
      </ResizableTable>
    </section>

    <a-modal v-model:open="detailOpen" title="登录日志详情" :width="780" :footer="null">
      <dl class="log-detail">
        <div><dt>登录时间</dt><dd>{{ formatDateTime(detailLog?.createdTime) }}</dd></div>
        <div><dt>登录账号</dt><dd>{{ detailLog?.username || '未知账号' }}</dd></div>
        <div><dt>登录结果</dt><dd><a-tag :color="detailLog?.successFlag ? 'success' : 'error'">{{ detailLog?.successFlag ? '成功' : '失败' }}</a-tag></dd></div>
        <div><dt>IP 地址</dt><dd>{{ detailLog?.ipAddress || '—' }}</dd></div>
        <div><dt>来源系统</dt><dd>{{ detailLog?.sourceSystem || '—' }}</dd></div>
        <div><dt>业务日期</dt><dd>{{ detailLog?.bizDate || '—' }}</dd></div>
        <div><dt>归档状态</dt><dd>{{ detailLog?.archivedFlag ? '已归档' : '未归档' }}</dd></div>
        <div><dt>归档时间</dt><dd>{{ formatDateTime(detailLog?.archivedTime) }}</dd></div>
        <div class="full-detail"><dt>结果消息</dt><dd class="long-text">{{ detailLog?.message || '—' }}</dd></div>
        <div class="full-detail"><dt>User-Agent</dt><dd class="long-text">{{ detailLog?.userAgent || '—' }}</dd></div>
        <div class="half-detail"><dt>Trace ID</dt><dd><code>{{ detailLog?.traceId || '—' }}</code></dd></div>
        <div class="half-detail"><dt>幂等键</dt><dd><code>{{ detailLog?.idempotentKey || '—' }}</code></dd></div>
      </dl>
    </a-modal>
  </main>
</template>

<style scoped>
.query-fields { display: grid; width: min(930px, 76%); grid-template-columns: minmax(280px, 1fr) 130px 345px; gap: 8px; }
.log-table :deep(.ant-table) { color: var(--shell-ink); background: var(--shell-panel); }
.log-table :deep(.ant-table-thead > tr > th) { padding-block: 9px; color: var(--shell-muted); font-size: 13px; font-weight: 600; background: var(--shell-hover); }
.log-table :deep(.ant-table-tbody > tr > td) { padding-block: 8px; }
.log-table :deep(.ant-table-tbody > tr:hover > td) { background: color-mix(in srgb, var(--brand) 7%, var(--shell-panel)); }
.log-table :deep(.ant-pagination) { margin: 13px; }
.cell-text, .trace-cell { display: block; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.cell-text { color: var(--shell-muted); }
.trace-cell { color: var(--brand-deep); font-family: 'SFMono-Regular', Consolas, monospace; font-size: 13px; }
.empty-table { display: flex; min-height: 180px; align-items: center; justify-content: center; color: var(--shell-muted); }
.log-detail { display: grid; margin: 8px 0 0; grid-template-columns: repeat(4, minmax(0, 1fr)); border-top: 1px solid var(--shell-border); border-left: 1px solid var(--shell-border); }
.log-detail > div { min-width: 0; padding: 10px 12px; border-right: 1px solid var(--shell-border); border-bottom: 1px solid var(--shell-border); }
.log-detail dt { color: var(--shell-muted); font-size: 12px; }
.log-detail dd { min-width: 0; margin: 4px 0 0; overflow-wrap: anywhere; }
.log-detail code { color: var(--brand-deep); font-family: 'SFMono-Regular', Consolas, monospace; font-size: 12px; }
.log-detail .full-detail { grid-column: 1 / -1; }
.long-text { max-height: 100px; overflow: auto; white-space: pre-wrap; }
.log-detail .half-detail { grid-column: span 2; }
</style>
