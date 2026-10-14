import type { DataRecord, ObjectType } from '../basic-data/schema'

export type RuntimeType = 'vehicleLoad' | 'locationState' | 'containerState' | 'boxBinding'
export interface RuntimeField {
  key: string
  label: string
  target?: ObjectType
  dict?: string
  kind?: 'boolean' | 'time'
  containerKind?: 'box' | 'vehicle'
}
export interface RuntimeConfig {
  label: string
  resource: string
  schema: string
  fields: RuntimeField[]
  columns: string[]
  filters: string[]
  more: string[]
  technical: RuntimeField[]
  state?: boolean
}
const field = (key: string, label: string): RuntimeField => ({ key, label })
const relation = (key: string, label: string, target: ObjectType, containerKind?: 'box' | 'vehicle'): RuntimeField => ({ key, label, target, containerKind })
const enumeration = (key: string, label: string, dict: string): RuntimeField => ({ key, label, dict })
const time = (key: string, label: string): RuntimeField => ({ key, label, kind: 'time' })
export const timestamps = [time('createdTime', '创建时间'), time('updatedTime', '更新时间')]
export const traceFields = [field('id', '记录 ID'), field('version', '版本'), field('bizDate', '业务日期'), field('sourceSystem', '来源系统'), field('traceId', 'Trace ID'), field('idempotentKey', '幂等键')]
export const runtimeObjects: Record<RuntimeType, RuntimeConfig> = {
  vehicleLoad: {
    label: '箱车装载关系', resource: 'nari-vehicle-load', schema: 'NariVehicleLoad',
    fields: [relation('boxId', '料箱', 'container', 'box'), relation('vehicleId', '载具', 'container', 'vehicle'), enumeration('relationMode', '装载方式', 'nari_vehicle_loading_mode'), relation('vehicleSlotId', '装载位', 'slot'), enumeration('bindingStatus', '关系状态', 'nari_vehicle_binding_status'), time('boundTime', '绑定时间'), time('unboundTime', '解绑时间'), ...timestamps],
    columns: ['boxId', 'vehicleId', 'relationMode', 'vehicleSlotId', 'bindingStatus', 'boundTime', 'unboundTime', 'createdTime', 'updatedTime'],
    filters: ['vehicleId', 'boxId', 'bindingStatus'], more: ['relationMode', 'vehicleSlotId'],
    technical: [field('activeBoxId', '有效料箱索引'), field('activeVehicleSlotId', '有效装载位索引')],
  },
  locationState: {
    label: '位置运行状态', resource: 'nari-location-state', schema: 'NariLocationState', state: true,
    fields: [relation('locationId', '固定位置', 'location'), enumeration('presenceState', '在位状态', 'nari_location_presence'), relation('currentContainerId', '当前容器', 'container'), { ...field('autoLogisticsEnabled', '自动物流'), kind: 'boolean' }, field('reservationKey', '预占标识'), time('reservedTime', '预占时间'), time('presenceUpdatedTime', '在位更新时间'), ...timestamps],
    columns: ['locationId', 'presenceState', 'currentContainerId', 'autoLogisticsEnabled', 'reservationKey', 'presenceUpdatedTime', 'createdTime', 'updatedTime'],
    filters: ['locationId', 'presenceState', 'currentContainerId'], more: ['autoLogisticsEnabled', 'reservationKey'], technical: [],
  },
  containerState: {
    label: '容器运行状态', resource: 'nari-container-state', schema: 'NariContainerState', state: true,
    fields: [relation('containerId', '容器', 'container'), enumeration('contentState', '内容状态', 'nari_content_state'), enumeration('runtimeUsage', '当前用途', 'nari_box_runtime_usage'), field('orderNo', '生产订单号'), field('materialCode', '物料编码'), field('materialBatch', '物料批次'), field('totalQuantity', '总数量'), enumeration('rivetState', '铆接状态', 'nari_rivet_state'), enumeration('fixtureState', '治具状态', 'nari_fixture_state'), relation('lastProductionLineId', '最近产线', 'line'), field('reservationKey', '预占标识'), time('reservedTime', '预占时间'), field('warehouseRequestId', '缴库请求 ID'), ...timestamps],
    columns: ['containerId', 'contentState', 'runtimeUsage', 'orderNo', 'materialCode', 'totalQuantity', 'reservationKey', 'createdTime', 'updatedTime'],
    filters: ['containerId', 'contentState', 'runtimeUsage'], more: ['orderNo', 'materialCode', 'materialBatch', 'rivetState', 'fixtureState', 'lastProductionLineId', 'reservationKey', 'warehouseRequestId'], technical: [],
  },
  boxBinding: {
    label: '物料绑箱关系', resource: 'nari-box-binding', schema: 'NariBoxBinding',
    fields: [relation('boxId', '料箱', 'container', 'box'), enumeration('bindingMode', '绑定方式', 'nari_box_binding_mode'), field('orderNo', '生产订单号'), field('materialCode', '物料编码'), field('materialBatch', '物料批次'), field('panelCode', '板件唯一码'), field('quantity', '数量'), enumeration('bindingStatus', '关系状态', 'nari_box_binding_status'), time('boundTime', '绑定时间'), time('unboundTime', '解绑时间'), ...timestamps],
    columns: ['boxId', 'bindingMode', 'orderNo', 'materialCode', 'materialBatch', 'panelCode', 'quantity', 'bindingStatus', 'boundTime', 'unboundTime', 'createdTime', 'updatedTime'],
    filters: ['boxId', 'bindingStatus', 'bindingMode'], more: ['orderNo', 'materialCode', 'materialBatch', 'panelCode'], technical: [field('activePanelCode', '有效板件唯一码索引')],
  },
}
export const runtimeSortFields = ['id', 'createdTime', 'updatedTime']
export function defaultRuntimeFilters(type: RuntimeType): DataRecord {
  return runtimeObjects[type].state ? {} : { bindingStatus: 'ACTIVE' }
}
export function changeRuntimeFilter(type: RuntimeType, draft: DataRecord, key: string, value: DataRecord[string]) {
  if (type === 'vehicleLoad' && key === 'vehicleId' && draft.vehicleId !== value) draft.vehicleSlotId = undefined
  draft[key] = value
}
