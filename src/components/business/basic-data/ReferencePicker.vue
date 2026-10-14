<script setup lang="ts">
import { Button as AButton, Input as AInput, Modal as AModal, Table as ATable, Tag as ATag } from 'ant-design-vue'
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import { pageBasicData } from '@/api/basic-data'
import { getErrorMessage } from '@/api/http'
import { lookupRecord, relationKey, relationLabel, resolveRelations, type RelationMap } from '@/business/basic-data/relations'
import { objects, recordLabel, type DataRecord, type ObjectType } from '@/business/basic-data/schema'
import DataState from './DataState.vue'

const props = defineProps<{ type: ObjectType; selectedId?: number; areaId?: number; vehicleId?: number; containerKind?: 'box' | 'vehicle' }>()
const emit = defineEmits<{ select: [id: number]; close: [] }>()
const config = computed(() => objects[props.type])
const keyword = ref(''), applied = ref(''), error = ref(''), currentError = ref('')
const page = ref(1), size = ref(20), total = ref(0), loading = ref(false)
const rows = ref<DataRecord[]>([]), selected = ref<DataRecord>()
const relations = ref<RelationMap>({})
let epoch = 0
const ownerField = computed(() => config.value.fields.find((field) => field.target))
const columns = [{ title: '名称 / 编码', key: 'name' }, { title: '归属信息', key: 'owner', width: 200 }, { title: '状态', key: 'enabled', width: 110 }]
function inScope(row: DataRecord) { return (props.areaId === undefined || row.areaId === props.areaId) && (props.vehicleId === undefined || row.vehicleId === props.vehicleId) }
function unavailableReason(row: DataRecord) {
  if (!inScope(row)) return '不属于当前查询范围'
  if (!props.containerKind) return ''
  const model = relations.value[relationKey('model', row.containerModelId)]
  if (!model) return '规格未加载，暂不可选，请重试查询'
  const allowed = props.containerKind === 'box' ? ['BOX'] : ['VEHICLE_DIRECT', 'VEHICLE_SLOT']
  return allowed.includes(String(model.containerCategory)) ? '' : props.containerKind === 'box' ? '不是料箱，不可选' : '不是载具，不可选'
}
async function load() {
  const current = ++epoch
  loading.value = true; error.value = ''; currentError.value = ''; rows.value = []; selected.value = undefined
  try {
    const [result, picked] = await Promise.all([
      pageBasicData(props.type, { page: page.value, size: size.value, keyword: applied.value, areaId: props.areaId, vehicleId: props.vehicleId }),
      props.selectedId === undefined ? undefined : lookupRecord(props.type, props.selectedId).catch(() => { if (current === epoch) currentError.value = '当前选中项加载失败'; return undefined }),
    ])
    if (current !== epoch) return
    const records = (result.records || []).filter(inScope)
    rows.value = records; total.value = result.total || 0; relations.value = {}
    selected.value = picked && inScope(picked) ? picked : undefined
    const labels = await resolveRelations(props.type, picked ? [...records, picked] : records)
    if (current === epoch) relations.value = labels
  } catch (cause) { if (current === epoch) error.value = getErrorMessage(cause) }
  finally { if (current === epoch) loading.value = false }
}
function choose(row: DataRecord) { if (row.id !== undefined && !unavailableReason(row) && !loading.value) emit('select', row.id) }
function customRow(row: DataRecord) {
  return { tabindex: 0, 'aria-disabled': !!unavailableReason(row), title: unavailableReason(row), 'aria-label': `选择${recordLabel(props.type, row)}${row.id === props.selectedId ? '，已选' : ''}`, onClick: () => choose(row), onKeydown: (event: KeyboardEvent) => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); choose(row) } } }
}
watch(() => [props.type, props.areaId, props.vehicleId, props.containerKind], () => { keyword.value = ''; applied.value = ''; page.value = 1; void load() }, { immediate: true })
onBeforeUnmount(() => { epoch++ })
</script>
<template>
  <AModal open :title="`选择${config.label}`" :width="760" :mask-closable="false" @cancel="emit('close')">
    <div class="picker-query"><AInput v-model:value="keyword" allow-clear placeholder="搜索名称或编码" aria-label="搜索名称或编码" @press-enter="applied = keyword.trim(); page = 1; load()" /><AButton type="primary" @click="applied = keyword.trim(); page = 1; load()">查询</AButton></div>
    <p v-if="containerKind" class="picker-hint">仅可选择{{ containerKind === 'box' ? '料箱' : '载具' }}，规格不符或加载失败的记录不可选。</p>
    <button v-if="selected && !rows.some(row => row.id === selectedId)" class="current-selection" type="button" :disabled="loading || !!unavailableReason(selected)" @click="choose(selected)">已选：{{ recordLabel(type, selected) }} · {{ selected[config.code || ''] }} {{ unavailableReason(selected) }}</button>
    <p v-if="currentError" role="alert">{{ currentError }} <AButton type="link" size="small" @click="load">重试</AButton></p>
    <ATable :columns="columns" :data-source="loading || error ? [] : rows" row-key="id" size="small" :custom-row="customRow" :row-class-name="(row: DataRecord) => row.id === selectedId ? 'picked-row' : ''" :scroll="{ y: 320 }" :pagination="{ current: page, pageSize: size, total, showSizeChanger: true, pageSizeOptions: ['10', '20', '50', '100'], showTotal: (count: number) => `共 ${count} 条` }" @change="(pager) => { page = pager.pageSize !== size ? 1 : pager.current || 1; size = pager.pageSize || 20; load() }">
      <template #emptyText><DataState :loading="loading" :error="error" @retry="load" /></template>
      <template #bodyCell="{ column, record }">
        <template v-if="column.key === 'name'"><strong>{{ recordLabel(type, record) }}</strong><ATag v-if="record.id === selectedId" color="cyan">已选</ATag><div class="code">{{ record[config.code || ''] }}</div><small v-if="unavailableReason(record)">{{ unavailableReason(record) }}</small></template>
        <template v-else-if="column.key === 'owner'">{{ ownerField?.target ? relationLabel(ownerField.target, record[ownerField.key], relations) : '—' }}</template>
        <template v-else><ATag :color="record.enabled === true ? 'success' : undefined">{{ record.enabled === true ? '启用' : record.enabled === false ? '停用' : '未知' }}</ATag></template>
      </template>
    </ATable>
    <template #footer><AButton @click="emit('close')">取消</AButton></template>
  </AModal>
</template>
<style scoped>
.picker-query { display: flex; gap: 8px; margin-bottom: 12px; }
.code { color: var(--brand); font-size: 12px; }
.picker-hint { color: var(--shell-muted); margin: 0 0 8px; }
:deep(.ant-table-row[aria-disabled="true"]) { color: var(--shell-muted); cursor: not-allowed; }
.current-selection { width: 100%; text-align: left; padding: 8px 12px; margin-bottom: 10px; border: 1px solid var(--brand); background: var(--shell-panel); color: var(--brand); cursor: pointer; }
:deep(.ant-table-row) { cursor: pointer; }
:deep(.picked-row > td) { background: color-mix(in srgb, var(--brand) 12%, var(--shell-panel)) !important; }
:deep(.ant-table-row:focus-visible) { outline: 2px solid var(--brand); outline-offset: -2px; }
</style>
