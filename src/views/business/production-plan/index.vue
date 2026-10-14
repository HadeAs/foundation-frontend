<script setup lang="ts">
import { Alert as AAlert, Button as AButton, Input as AInput, RangePicker as ARangePicker, Select as ASelect, Tag as ATag, Tooltip as ATooltip, type TableColumnsType, type TableProps } from 'ant-design-vue'
import { computed, onActivated, onBeforeUnmount, onDeactivated, ref } from 'vue'
import dayjs from 'dayjs'
import { getErrorMessage } from '@/api/http'
import { pageProductionPlans, productionPlanSortFields, type ProductionPlan, type ProductionPlanQuery } from '@/api/production-plan'
import { relationLabel, resolveReferenceFields, type RelationMap } from '@/business/basic-data/relations'
import { planDateQuery, planMaintenanceReason, planStatusDisplay, planStatusOptions, todayPlanRange } from '@/business/production-plan'
import DataState from '@/components/business/basic-data/DataState.vue'
import ReferenceInput from '@/components/business/basic-data/ReferenceInput.vue'
import ResizableTable from '@/components/common/ResizableTable.vue'
import { formatDateTime } from '@/utils/date'

defineOptions({ name: 'BusinessProductionPlan' })
const filters = ref<ProductionPlanQuery>({}), dates = ref(todayPlanRange())
const applied = ref<ProductionPlanQuery>(planDateQuery(dates.value))
const more = ref(false), loading = ref(false), error = ref('')
const rows = ref<ProductionPlan[]>([]), relations = ref<RelationMap>({})
const page = ref(1), size = ref(20), total = ref(0), sortBy = ref<string>(), sortOrder = ref<'ASC' | 'DESC'>()
let epoch = 0, needsReload = false
const relationFailed = computed(() => Object.values(relations.value).some(value => value === null))
const fields = [
  { key: 'sequenceNo', title: '计划顺序', width: 110 },
  { key: 'orderNo', title: '生产订单号', width: 180 },
  { key: 'planNo', title: '计划单号', width: 180 },
  { key: 'plannedQuantity', title: '订单数量', width: 110 },
  { key: 'resourceCode', title: '资源编码', width: 150 },
  { key: 'productionLineId', title: '物流产线', width: 190 },
  { key: 'mainProcessCode', title: '主工序编码', width: 150 },
  { key: 'deliveryStorageZoneId', title: '配送存储区', width: 200 },
  { key: 'plannedStartTime', title: '计划开工时间', width: 190 },
  { key: 'triggerTime', title: '预计自动触发时间', width: 180 },
  { key: 'planStatus', title: '物流状态', width: 150 },
  { key: 'taskCount', title: '运输任务', width: 110 },
]
const columns = computed<TableColumnsType>(() => [
  ...fields.map(field => ({ ...field, dataIndex: field.key, ellipsis: true, sorter: productionPlanSortFields.includes(field.key), sortOrder: sortBy.value === field.key ? sortOrder.value === 'ASC' ? 'ascend' as const : 'descend' as const : null })),
  { key: 'action', title: '操作', width: 280, fixed: 'right' },
])
const unavailableTools = [
  { label: '下载导入模板', reason: '尚未提供生产计划模板下载接口。' },
  { label: 'Excel 导入', reason: '尚未提供生产计划 Excel 导入接口。' },
  { label: '调整顺序', reason: '尚未提供调序接口及自动触发时间依据，暂不开放计划勾选。' },
]
const pagination = computed(() => loading.value || error.value ? false : ({ current: page.value, pageSize: size.value, total: total.value, showSizeChanger: true, pageSizeOptions: ['10', '20', '50', '100'], showTotal: (count: number) => `共 ${count} 条` }))

function rowActions(record: ProductionPlan) {
  return [
    { label: '变更记录', reason: '尚未提供按具体计划查询变更记录的接口。' },
    { label: '修改', reason: planMaintenanceReason(record.planStatus) },
    { label: '插单', reason: '尚未提供插单接口及后端插单资格、原因，不能确认是否允许插单。' },
    { label: '删除', reason: planMaintenanceReason(record.planStatus) },
  ]
}
async function load() {
  const current = ++epoch
  loading.value = true; error.value = ''; relations.value = {}
  try {
    const result = await pageProductionPlans({ ...applied.value, page: page.value, size: size.value, sortBy: sortBy.value, sortOrder: sortOrder.value })
    if (current !== epoch) return
    rows.value = result.records || []; total.value = result.total || 0
    const last = Math.max(1, Math.ceil(total.value / size.value))
    if (!rows.value.length && page.value > last) { page.value = last; void load(); return }
    loading.value = false
    const names = await resolveReferenceFields([{ key: 'productionLineId', target: 'line' }, { key: 'deliveryStorageZoneId', target: 'storage' }], rows.value)
    if (current === epoch) relations.value = names
  } catch (cause) { if (current === epoch) { rows.value = []; error.value = getErrorMessage(cause) } }
  finally { if (current === epoch) loading.value = false }
}
function query() {
  applied.value = { ...Object.fromEntries(Object.entries(filters.value).map(([key, value]) => [key, typeof value === 'string' ? value.trim() : value])), ...planDateQuery(dates.value) }
  page.value = 1; void load()
}
function reset() {
  filters.value = {}; dates.value = todayPlanRange(); sortBy.value = undefined; sortOrder.value = undefined; query()
}
const tableChange: TableProps['onChange'] = (pager, _filters, sorter, extra) => {
  const value = Array.isArray(sorter) ? sorter[0] : sorter
  if (extra.action === 'sort') {
    sortBy.value = value?.order ? String(value.columnKey) : undefined
    sortOrder.value = value?.order ? value.order === 'ascend' ? 'ASC' : 'DESC' : undefined
  }
  page.value = extra.action === 'sort' || pager.pageSize !== size.value ? 1 : pager.current || 1
  size.value = pager.pageSize || 20; void load()
}
onDeactivated(() => { epoch++; needsReload = true })
onActivated(() => { if (needsReload) { needsReload = false; more.value = false; reset() } })
onBeforeUnmount(() => { epoch++ })
void load()
</script>
<template>
  <main class="management-page production-plan-page">
    <section class="query-panel">
      <div class="plan-filters">
        <AInput v-model:value="filters.orderNo" allow-clear aria-label="生产订单号" placeholder="生产订单号" @press-enter="query" />
        <AInput v-model:value="filters.resourceCode" allow-clear aria-label="资源编码" placeholder="资源编码" @press-enter="query" />
        <ARangePicker :value="dates || undefined" class="plan-date-range" format="YYYY-MM-DD" :placeholder="['开工开始日期', '开工结束日期']" aria-label="计划开工日期范围" @update:value="dates = $event ? [dayjs($event[0]), dayjs($event[1])] : null" />
        <ASelect v-model:value="filters.planStatus" class="plan-status-filter" allow-clear aria-label="计划状态" placeholder="全部计划状态" :options="planStatusOptions" />
        <template v-if="more">
          <AInput v-model:value="filters.planNo" allow-clear aria-label="计划单号" placeholder="计划单号" @press-enter="query" />
          <AInput v-model:value="filters.mainProcessCode" allow-clear aria-label="主工序编码" placeholder="主工序编码" @press-enter="query" />
          <ReferenceInput v-model:value="filters.productionLineId" class="plan-reference" target="line" label="物流产线" />
          <ReferenceInput v-model:value="filters.deliveryStorageZoneId" class="plan-reference" target="storage" label="配送存储区" />
        </template>
      </div>
      <div class="query-actions"><AButton type="link" :aria-expanded="more" @click="more = !more">{{ more ? '收起条件' : '更多条件' }}</AButton><AButton type="primary" @click="query">查询</AButton><AButton @click="reset">重置</AButton></div>
    </section>
    <AAlert v-if="relationFailed && !loading" type="warning" show-icon message="部分关联名称加载失败，已保留原始 ID。"><template #action><AButton size="small" @click="load">重试</AButton></template></AAlert>
    <section class="table-panel">
      <header class="table-toolbar">
        <h1>生产计划单</h1>
        <div class="plan-tools">
          <ATooltip v-for="tool in unavailableTools" :key="tool.label" :title="tool.reason" :trigger="['hover', 'focus']">
            <span tabindex="0" :aria-label="`${tool.label}：${tool.reason}`"><AButton :type="tool.label === 'Excel 导入' ? 'primary' : 'default'" disabled>{{ tool.label }}</AButton></span>
          </ATooltip>
          <AButton @click="load">刷新</AButton>
        </div>
      </header>
      <ResizableTable :columns="columns" :data-source="loading || error ? [] : rows" row-key="id" size="middle" table-layout="fixed" :pagination="pagination" @change="tableChange">
        <template #emptyText><DataState :loading="loading" :error="error" empty-text="暂无生产计划" @retry="load" /></template>
        <template #bodyCell="{ column, record }">
          <template v-if="column.key === 'productionLineId'">{{ relationLabel('line', record.productionLineId, relations) }}</template>
          <template v-else-if="column.key === 'deliveryStorageZoneId'">{{ relationLabel('storage', record.deliveryStorageZoneId, relations) }}</template>
          <template v-else-if="column.key === 'plannedStartTime'">{{ formatDateTime(record.plannedStartTime) }}</template>
          <ATooltip v-else-if="column.key === 'planStatus'" :title="planStatusDisplay(record.planStatus).reason" :trigger="['hover', 'focus']">
            <span tabindex="0" :aria-label="planStatusDisplay(record.planStatus).reason"><ATag :color="planStatusDisplay(record.planStatus).color">{{ planStatusDisplay(record.planStatus).label }}</ATag></span>
          </ATooltip>
          <ATooltip v-else-if="column.key === 'triggerTime' || column.key === 'taskCount'" :title="column.key === 'triggerTime' ? '尚未提供自动触发时间或有效提前量配置。' : '尚未提供关联任务数量和查询接口。'" :trigger="['hover', 'focus']">
            <span tabindex="0" :aria-label="column.key === 'triggerTime' ? '预计自动触发时间未提供' : '关联任务数未提供'">—</span>
          </ATooltip>
          <div v-else-if="column.key === 'action'" class="plan-actions">
            <ATooltip v-for="action in rowActions(record)" :key="action.label" :title="action.reason" :trigger="['hover', 'focus']">
              <span tabindex="0" :aria-label="`${action.label}：${action.reason}`"><AButton type="link" size="small" disabled>{{ action.label }}</AButton></span>
            </ATooltip>
          </div>
          <template v-else>{{ record[String(column.key)] ?? '—' }}</template>
        </template>
      </ResizableTable>
    </section>
  </main>
</template>
<style scoped>
.production-plan-page { display: flex; flex-direction: column; height: 100%; min-height: 0; overflow: hidden; }
.plan-filters { display: flex; flex: 1; flex-wrap: wrap; gap: 8px; min-width: 0; }
.plan-filters > .ant-input-affix-wrapper, .plan-reference { width: 180px; }
.plan-date-range { width: 300px; }
.plan-status-filter { width: 250px; }
.plan-tools, .plan-actions { display: flex; align-items: center; gap: 8px; }
.plan-actions { gap: 0; white-space: nowrap; }
.production-plan-page > .ant-alert { flex: none; margin-top: 8px; }
</style>
