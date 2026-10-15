import type { DataRecord } from '@/business/basic-data/schema'

export type QueryType = 'task' | 'operation' | 'warehouse' | 'warehouseBox' | 'receiving'
export type ReferenceType = QueryType | 'container' | 'location' | 'slot'
export interface QueryField {
  label: string
  number?: boolean
  time?: boolean
  target?: ReferenceType
  dict?: string
}
export interface QueryConfig {
  label: string
  resource: string
  schema: string
  identity: string
  searchKey: string
  filters: string[]
  more: string[]
  columns: string[]
  details: string[]
  technical: string[]
  snapshots: string[]
  sort: string[]
}
const labels: Record<string, string> = {
  version: '版本', bizDate: '业务日期', sourceSystem: '来源系统', traceId: 'Trace ID', idempotentKey: '幂等键',
  taskNo: '运输任务号', taskStatus: '任务状态', orderNo: '生产订单号', businessCode: '业务编码', callNo: '叫料单号', agvCode: 'AGV 编码', agvName: 'AGV 名称', schedulerTaskNo: '调度任务号', queueNo: '队列序号',
  triggerMode: '触发方式', dispatchMode: '调度方式', destinationMode: '目的地模式', vendor: 'AGV 厂商', sendAttemptCount: '发送次数', reason: '原因', productionPlanId: '生产计划 ID',
  activeCancelRequestId: '当前取消请求 ID', createRequestId: '创建请求 ID', intentKey: '业务意图键', originLocationCode: '起点位置编码', destinationLocationCode: '终点位置编码',
  eventType: '事件类型', eventKey: '事件键', externalEventKey: '外部事件键', operationKey: '操作键', cancelStatus: '取消状态', evidenceSource: '证据来源', requestId: '请求 ID', requestHash: '请求摘要', taskVersion: '任务版本',
  applicationNo: '缴库申请号', objectId: '业务对象 ID', sapDocumentNos: 'SAP 凭证号', submittedVersion: '提交版本', boxVersion: '料箱版本', materialCode: '物料编码', materialBatch: '物料批次', quantity: '数量',
  wmsCleanupStatus: 'WMS 清理状态', cleanupRequestId: '清理请求 ID', contentKey: '内容键', receivingNo: '接收单号', remark: '备注',
  dispatchRequestSnapshot: '调度请求快照', warehouseBoxSnapshot: '缴库箱快照', beforeState: '操作前状态', afterState: '操作后状态', resultSnapshot: '操作结果快照', bindingSnapshot: '绑箱快照', wmsScopeSnapshot: 'WMS 范围快照',
}
export const fields: Record<string, QueryField> = Object.fromEntries(Object.entries(labels).map(([key, label]) => [key, { label }]))
for (const key of ['version', 'queueNo', 'sendAttemptCount', 'productionPlanId', 'taskVersion', 'objectId', 'submittedVersion', 'boxVersion', 'quantity']) fields[key]!.number = true
const references: Record<string, [string, ReferenceType]> = {
  containerId: ['容器', 'container'], boxId: ['料箱', 'container'], activeBoxId: ['当前有效料箱', 'container'], emptyBoxId: ['空箱', 'container'],
  originVehicleId: ['起点载具', 'container'], destinationVehicleId: ['终点载具', 'container'], originVehicleSlotId: ['起点装载位', 'slot'], destinationVehicleSlotId: ['终点装载位', 'slot'],
  locationId: ['位置', 'location'], originLocationId: ['起点位置', 'location'], destinationLocationId: ['终点位置', 'location'], emptyOriginLocationId: ['空箱起点', 'location'], emptyDestinationLocationId: ['空箱终点', 'location'],
  taskId: ['关联运输任务', 'task'], logisticsTaskId: ['关联运输任务', 'task'], warehouseRecordId: ['所属缴库记录', 'warehouse'], receivingRecordId: ['关联接收记录', 'receiving'], warehouseRecordBoxId: ['缴库箱明细', 'warehouseBox'],
}
for (const [key, [label, target]] of Object.entries(references)) fields[key] = { label, target, number: true }
for (const [key, label] of Object.entries({ createdTime: '创建时间', updatedTime: '更新时间', cancelSentTime: '取消发送时间', completedTime: '任务完成时间', lastSentTime: '最近发送时间', nextCheckTime: '下次检查时间', settledTime: '结算时间', statusUpdatedTime: '状态更新时间', occurredTime: '事件发生时间', succeededTime: '缴库成功时间', cleanupSentTime: '清理发送时间', cleanupCompletedTime: '清理完成时间', receivedTime: '接收时间' })) fields[key] = { label, time: true }
for (const [key, dict] of Object.entries({ taskStatus: 'nari_logistics_task_status', cancelStatus: 'nari_task_cancel_status', wmsCleanupStatus: 'nari_wms_cleanup_status', triggerMode: 'nari_task_trigger_mode', dispatchMode: 'nari_dispatch_mode', destinationMode: 'nari_destination_mode', evidenceSource: 'nari_evidence_source', vendor: 'nari_agv_vendor' })) fields[key]!.dict = dict

export const commonTechnical = ['version', 'bizDate', 'sourceSystem', 'traceId', 'idempotentKey']
const times = ['createdTime', 'updatedTime']
export const queryObjects: Record<QueryType, QueryConfig> = {
  task: {
    label: '物流运输任务', schema: 'NariLogisticsTask', resource: 'nari-logistics-task', identity: 'taskNo', searchKey: 'taskNo',
    filters: ['taskNo', 'orderNo', 'taskStatus', 'containerId'],
    more: ['businessCode', 'callNo', 'agvCode', 'schedulerTaskNo', 'originLocationCode', 'destinationLocationCode', 'dispatchMode', 'triggerMode', 'destinationMode', 'vendor', 'queueNo', 'productionPlanId', 'originLocationId', 'destinationLocationId', 'originVehicleId', 'originVehicleSlotId', 'destinationVehicleId', 'destinationVehicleSlotId', 'emptyBoxId', 'emptyOriginLocationId', 'emptyDestinationLocationId', 'completedTimeRange', 'statusUpdatedTimeRange', 'lastSentTimeRange', 'cancelSentTimeRange', 'settledTimeRange', 'nextCheckTimeRange', 'sendAttemptCount', 'createRequestId', 'activeCancelRequestId', 'intentKey'],
    columns: ['taskNo', 'taskStatus', 'orderNo', 'containerId', 'originLocationCode', 'destinationLocationCode', 'agvCode', 'queueNo', ...times],
    details: ['taskNo', 'taskStatus', 'orderNo', 'businessCode', 'callNo', 'containerId', 'agvCode', 'agvName', 'schedulerTaskNo', 'queueNo', 'triggerMode', 'dispatchMode', 'destinationMode', 'vendor', 'productionPlanId', 'originLocationCode', 'originLocationId', 'destinationLocationCode', 'destinationLocationId', 'originVehicleId', 'originVehicleSlotId', 'destinationVehicleId', 'destinationVehicleSlotId', 'emptyBoxId', 'emptyOriginLocationId', 'emptyDestinationLocationId', 'sendAttemptCount', 'reason', 'lastSentTime', 'cancelSentTime', 'completedTime', 'settledTime', 'statusUpdatedTime', 'nextCheckTime', ...times],
    technical: ['activeCancelRequestId', 'createRequestId', 'intentKey'], snapshots: ['dispatchRequestSnapshot', 'warehouseBoxSnapshot'], sort: [...times, 'queueNo'],
  },
  operation: {
    label: '业务操作记录', schema: 'NariOperationRecord', resource: 'nari-operation-record', identity: 'eventKey', searchKey: 'eventKey',
    filters: ['eventType', 'taskId', 'occurredTimeRange'], more: ['containerId', 'locationId', 'warehouseRecordId', 'receivingRecordId', 'cancelStatus', 'evidenceSource', 'operationKey', 'eventKey', 'externalEventKey', 'requestId', 'requestHash', 'taskVersion'],
    columns: ['occurredTime', 'eventType', 'taskId', 'containerId', 'evidenceSource', 'cancelStatus', 'reason', ...times],
    details: ['eventType', 'eventKey', 'operationKey', 'occurredTime', 'evidenceSource', 'cancelStatus', 'taskId', 'containerId', 'locationId', 'warehouseRecordId', 'receivingRecordId', 'reason', ...times],
    technical: ['externalEventKey', 'requestId', 'requestHash', 'taskVersion'], snapshots: ['beforeState', 'afterState', 'resultSnapshot'], sort: times,
  },
  warehouse: {
    label: '缴库成功记录', schema: 'NariWarehouseRecord', resource: 'nari-warehouse-record', identity: 'applicationNo', searchKey: 'applicationNo',
    filters: ['applicationNo', 'succeededTimeRange'], more: ['objectId', 'requestId', 'submittedVersion'], columns: ['applicationNo', 'objectId', 'sapDocumentNos', 'succeededTime', ...times],
    details: ['applicationNo', 'objectId', 'sapDocumentNos', 'succeededTime', 'submittedVersion', ...times], technical: ['requestId'], snapshots: [], sort: times,
  },
  warehouseBox: {
    label: '缴库成功箱明细', schema: 'NariWarehouseRecordBox', resource: 'nari-warehouse-record-box', identity: 'orderNo', searchKey: 'orderNo',
    filters: ['boxId', 'orderNo', 'materialCode', 'wmsCleanupStatus'], more: ['warehouseRecordId', 'materialBatch', 'quantity', 'activeBoxId', 'boxVersion', 'contentKey', 'cleanupRequestId', 'cleanupSentTimeRange', 'cleanupCompletedTimeRange', 'nextCheckTimeRange'],
    columns: ['warehouseRecordId', 'boxId', 'orderNo', 'materialCode', 'materialBatch', 'quantity', 'wmsCleanupStatus', ...times],
    details: ['warehouseRecordId', 'boxId', 'orderNo', 'materialCode', 'materialBatch', 'quantity', 'wmsCleanupStatus', 'reason', 'cleanupSentTime', 'cleanupCompletedTime', 'nextCheckTime', ...times], technical: ['activeBoxId', 'boxVersion', 'cleanupRequestId', 'contentKey'], snapshots: ['bindingSnapshot', 'wmsScopeSnapshot'], sort: times,
  },
  receiving: {
    label: '库房接收记录', schema: 'NariReceivingRecord', resource: 'nari-receiving-record', identity: 'receivingNo', searchKey: 'receivingNo',
    filters: ['receivingNo', 'boxId', 'receivedTimeRange'], more: ['logisticsTaskId', 'warehouseRecordBoxId', 'requestId', 'remark'], columns: ['receivingNo', 'boxId', 'logisticsTaskId', 'warehouseRecordBoxId', 'receivedTime', 'remark', ...times],
    details: ['receivingNo', 'boxId', 'logisticsTaskId', 'warehouseRecordBoxId', 'receivedTime', 'remark', ...times], technical: ['requestId'], snapshots: [], sort: times,
  },
}
export function isQueryType(type: ReferenceType): type is QueryType { return type in queryObjects }
export function queryRecordLabel(type: QueryType, record: DataRecord) {
  if (type === 'warehouseBox') return `订单 ${record.orderNo ?? '—'} / ${record.materialCode ?? '—'} / ${record.materialBatch ?? '—'}`
  return String(record[queryObjects[type].identity] ?? '编号未返回')
}
export function filterField(key: string) { return fields[key.replace(/Range$/, '')]! }
export function filterKeys(type: QueryType) { return [...queryObjects[type].filters, ...queryObjects[type].more] }
export function queryKeys(type: QueryType) { return filterKeys(type).flatMap(key => key.endsWith('Range') ? [key.replace(/Range$/, 'Start'), key.replace(/Range$/, 'End')] : [key]) }
export function prepareFilters(type: QueryType, draft: DataRecord) {
  const result: DataRecord = {}
  for (const key of queryKeys(type)) {
    const raw = draft[key], value = typeof raw === 'string' ? raw.trim() : raw
    if (value === undefined || value === null || value === '') continue
    if (fields[key]?.number && (typeof value !== 'number' || !Number.isSafeInteger(value))) throw new Error(`${fields[key]!.label}请输入有效整数`)
    result[key] = value
  }
  for (const key of filterKeys(type).filter(key => key.endsWith('Range'))) {
    const start = result[key.replace(/Range$/, 'Start')], end = result[key.replace(/Range$/, 'End')]
    if (start && end && Date.parse(String(start)) > Date.parse(String(end))) throw new Error(`${filterField(key).label}开始时间不能晚于结束时间`)
  }
  return result
}
export function snapshotText(value: unknown) {
  if (value === null || value === undefined || value === '') return '—'
  if (typeof value !== 'string') return JSON.stringify(value, null, 2)
  try { return JSON.stringify(JSON.parse(value), null, 2) } catch { return value }
}
