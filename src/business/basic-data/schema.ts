export type ObjectType =
  | 'factory'
  | 'floor'
  | 'area'
  | 'trafficArea'
  | 'line'
  | 'storage'
  | 'location'
  | 'model'
  | 'container'
  | 'locationLine'
  | 'locationModel'
  | 'locationUsage'
  | 'locationStorage'
  | 'slot'
  | 'fixtureOrder'
  | 'resourceLine'
  | 'lineProcessStorage'
export type FieldValue = string | number | boolean | null | undefined
export type DataRecord = Record<string, FieldValue> & {
  id?: number
  version?: number
  enabled?: boolean
}
export interface Field {
  key: string
  label: string
  kind: 'text' | 'textarea' | 'integer' | 'positive' | 'boolean' | 'relation' | 'enum'
  required: boolean
  target?: ObjectType
  dict?: string
}
export interface ObjectConfig {
  label: string
  resource: string
  schema: string
  code?: string
  name?: string
  owner?: string
  searchKey?: string
  fields: Field[]
  columns: string[]
  columnLabels?: Record<string, string>
  filters: string[]
}

const field = (
  key: string,
  label: string,
  kind: Field['kind'] = 'text',
  required = true,
): Field => ({ key, label, kind, required })
const relation = (key: string, label: string, target: ObjectType, required = true): Field => ({
  ...field(key, label, 'relation', required),
  target,
})
const enumeration = (key: string, label: string, dict: string): Field => ({
  ...field(key, label, 'enum'),
  dict,
})
const enabled = field('enabled', '状态', 'boolean')
const remark = field('remark', '备注', 'textarea', false)
const locationOwner = relation('locationId', '固定位置', 'location')

export const objects: Record<ObjectType, ObjectConfig> = {
  factory: {
    label: '工厂',
    resource: 'nari-factory',
    schema: 'Factory',
    code: 'factoryCode',
    name: 'factoryName',
    fields: [field('factoryCode', '工厂编码'), field('factoryName', '工厂名称'), enabled, remark],
    columns: ['factoryCode', 'factoryName', 'enabled', 'remark'],
    filters: [],
  },
  floor: {
    label: '楼层',
    resource: 'nari-floor',
    schema: 'Floor',
    code: 'floorCode',
    name: 'floorName',
    fields: [
      field('floorCode', '楼层编码'),
      field('floorName', '楼层名称'),
      relation('factoryId', '所属工厂', 'factory'),
      field('floorNumber', '楼层序号', 'integer'),
      enabled,
      remark,
    ],
    columns: ['floorCode', 'floorName', 'factoryId', 'floorNumber', 'enabled', 'remark'],
    filters: ['factoryId'],
  },
  area: {
    label: '区域',
    resource: 'nari-area',
    schema: 'Area',
    code: 'areaCode',
    name: 'areaName',
    fields: [
      field('areaCode', '区域编码'),
      field('areaName', '区域名称'),
      relation('floorId', '所属楼层', 'floor'),
      enabled,
      remark,
    ],
    columns: ['areaCode', 'areaName', 'floorId', 'enabled', 'remark'],
    filters: ['floorId'],
  },
  trafficArea: {
    label: '交管区域',
    resource: 'nari-traffic-area',
    schema: 'TrafficArea',
    code: 'areaCode',
    name: 'areaName',
    fields: [field('areaCode', '交管区域编码'), field('areaName', '交管区域名称'), enabled, remark],
    columns: [
      'areaCode',
      'areaName',
      'enabled',
      'status',
      'lockSource',
      'occupancyKey',
      'lastOperatorName',
      'lastOperationTime',
      'remark',
    ],
    columnLabels: {
      enabled: '启用状态',
      status: '运行状态',
      lockSource: '锁定来源',
      occupancyKey: '占用标识',
      lastOperatorName: '最后操作人',
      lastOperationTime: '最后操作时间',
    },
    filters: [],
  },
  line: {
    label: '产线',
    resource: 'nari-production-line',
    schema: 'ProductionLine',
    code: 'lineCode',
    name: 'lineName',
    fields: [
      field('lineCode', '产线编码'),
      field('lineName', '产线名称'),
      relation('areaId', '所属区域', 'area'),
      enumeration('lineType', '产线类型', 'nari_line_type'),
      field('mesLineCode', 'MES 产线编码', 'text', false),
      enabled,
      remark,
    ],
    columns: ['lineCode', 'lineName', 'areaId', 'lineType', 'mesLineCode', 'enabled'],
    filters: ['areaId', 'lineType'],
  },
  storage: {
    label: '存储区',
    resource: 'nari-storage-zone',
    schema: 'StorageZone',
    code: 'storageCode',
    name: 'storageName',
    fields: [
      field('storageCode', '存储区编码'),
      field('storageName', '存储区名称'),
      relation('areaId', '所属区域', 'area'),
      enumeration('storageType', '存储区类型', 'nari_storage_type'),
      enabled,
      remark,
    ],
    columns: ['storageCode', 'storageName', 'areaId', 'storageType', 'enabled', 'remark'],
    filters: ['areaId', 'storageType'],
  },
  location: {
    label: '固定位置',
    resource: 'nari-location',
    schema: 'Location',
    code: 'locationCode',
    name: 'locationName',
    fields: [
      field('locationCode', '位置编码'),
      field('locationName', '位置名称'),
      relation('areaId', '所属区域', 'area'),
      relation('storageZoneId', '静态归属存储区', 'storage', false),
      enumeration('locationType', '位置类型', 'nari_location_type'),
      enumeration('agvVendor', 'AGV 厂商', 'nari_agv_vendor'),
      enabled,
      remark,
    ],
    columns: [
      'locationCode',
      'locationName',
      'areaId',
      'storageZoneId',
      'locationType',
      'agvVendor',
      'enabled',
    ],
    filters: ['areaId', 'locationType'],
  },
  model: {
    label: '容器规格',
    resource: 'nari-container-model',
    schema: 'ContainerModel',
    code: 'modelCode',
    name: 'modelName',
    fields: [
      field('modelCode', '规格编码'),
      field('modelName', '规格名称'),
      enumeration('containerCategory', '容器大类', 'nari_container_category'),
      enumeration('usageType', '用途类型', 'nari_container_usage'),
      field('boxCapacity', '料箱容量', 'positive', false),
      enabled,
      remark,
    ],
    columns: ['modelCode', 'modelName', 'containerCategory', 'usageType', 'boxCapacity', 'enabled'],
    filters: ['containerCategory', 'usageType'],
  },
  container: {
    label: '容器台账',
    resource: 'nari-container',
    schema: 'Container',
    code: 'containerCode',
    name: 'containerName',
    fields: [
      field('containerCode', '容器编码'),
      field('containerName', '容器名称'),
      relation('factoryId', '所属工厂', 'factory'),
      relation('containerModelId', '容器规格', 'model'),
      enabled,
      remark,
    ],
    columns: [
      'containerCode',
      'containerName',
      'factoryId',
      'containerModelId',
      'enabled',
      'remark',
    ],
    filters: ['factoryId', 'containerModelId'],
  },
  locationLine: {
    label: '位置服务产线',
    resource: 'nari-location-line',
    schema: 'LocationLine',
    owner: 'locationId',
    fields: [locationOwner, relation('productionLineId', '服务产线', 'line'), enabled, remark],
    columns: ['productionLineId', 'enabled', 'remark'],
    filters: ['productionLineId'],
  },
  locationModel: {
    label: '位置允许容器规格',
    resource: 'nari-location-container-model',
    schema: 'LocationContainerModel',
    owner: 'locationId',
    fields: [locationOwner, relation('containerModelId', '允许容器规格', 'model'), enabled, remark],
    columns: ['containerModelId', 'enabled', 'remark'],
    filters: ['containerModelId'],
  },
  locationUsage: {
    label: '位置业务用途',
    resource: 'nari-location-usage',
    schema: 'LocationUsage',
    owner: 'locationId',
    fields: [
      locationOwner,
      enumeration('operationRole', '业务用途', 'nari_location_role'),
      enabled,
    ],
    columns: ['operationRole', 'enabled'],
    filters: ['operationRole'],
  },
  locationStorage: {
    label: '位置业务库关联',
    resource: 'nari-location-storage-zone',
    schema: 'LocationStorageZone',
    owner: 'locationId',
    fields: [
      locationOwner,
      enumeration('relationDirection', '关联方向', 'nari_location_relation_direction'),
      relation('storageZoneId', '业务存储区', 'storage'),
      enabled,
      remark,
    ],
    columns: ['relationDirection', 'storageZoneId', 'enabled', 'remark'],
    filters: ['relationDirection', 'storageZoneId'],
  },
  slot: {
    label: '料车装载位',
    resource: 'nari-vehicle-slot',
    schema: 'VehicleSlot',
    owner: 'vehicleId',
    code: 'slotCode',
    name: 'slotName',
    fields: [
      relation('vehicleId', '所属料车', 'container'),
      field('slotCode', '装载位编码'),
      field('slotName', '装载位名称', 'text', false),
      enabled,
      remark,
    ],
    columns: ['slotCode', 'slotName', 'enabled', 'remark'],
    filters: [],
  },
  fixtureOrder: {
    label: '治具箱适用订单',
    resource: 'nari-fixture-box-order',
    schema: 'FixtureBoxOrder',
    owner: 'boxId',
    name: 'orderNo',
    searchKey: 'orderNo',
    fields: [
      relation('boxId', '所属治具箱', 'container'),
      field('orderNo', '生产订单号'),
      enabled,
      remark,
    ],
    columns: ['orderNo', 'enabled', 'remark'],
    filters: [],
  },
  resourceLine: {
    label: '资源产线映射',
    resource: 'nari-resource-line',
    schema: 'ResourceLine',
    owner: 'productionLineId',
    name: 'resourceCode',
    searchKey: 'resourceCode',
    fields: [
      relation('productionLineId', '所属产线', 'line'),
      field('resourceCode', '资源编码'),
      enabled,
      remark,
    ],
    columns: ['resourceCode', 'enabled', 'remark'],
    filters: [],
  },
  lineProcessStorage: {
    label: '产线主工序配送区',
    resource: 'nari-line-process-storage-zone',
    schema: 'LineProcessStorageZone',
    owner: 'productionLineId',
    name: 'mainProcessCode',
    searchKey: 'mainProcessCode',
    fields: [
      relation('productionLineId', '所属产线', 'line'),
      field('mainProcessCode', '主工序编码'),
      relation('storageZoneId', '配送存储区', 'storage'),
      enabled,
      remark,
    ],
    columns: ['mainProcessCode', 'storageZoneId', 'enabled', 'remark'],
    filters: ['storageZoneId'],
  },
}

export const locationRelations: ObjectType[] = [
  'locationLine',
  'locationModel',
  'locationUsage',
  'locationStorage',
]
export const lineRelations: ObjectType[] = ['resourceLine', 'lineProcessStorage']
export function visibleFields(type: ObjectType, record: DataRecord) {
  return objects[type].fields.filter(
    (item) => item.key !== 'boxCapacity' || record.containerCategory === 'VEHICLE_SLOT',
  )
}
export function sortableFields(type: ObjectType) {
  if (type === 'trafficArea' || type === 'fixtureOrder' || lineRelations.includes(type))
    return ['id', 'createdTime', 'updatedTime']
  const config = objects[type]
  return [
    'id',
    'createdTime',
    'updatedTime',
    config.code,
    config.name,
    ...(type === 'floor' ? ['floorNumber'] : []),
  ].filter((key): key is string => !!key)
}
export function recordLabel(type: ObjectType, record: DataRecord) {
  const config = objects[type]
  return String(record[config.name || ''] || record[config.code || ''] || `ID ${record.id ?? '—'}`)
}
export function changeField(type: ObjectType, draft: DataRecord, key: string, value: FieldValue) {
  if (type === 'location' && key === 'areaId' && draft.areaId !== value)
    draft.storageZoneId = undefined
  draft[key] = value
  if (type === 'model' && key === 'containerCategory' && value !== 'VEHICLE_SLOT')
    draft.boxCapacity = undefined
}
export function buildRequest(
  type: ObjectType,
  draft: DataRecord,
  ownerId?: number,
  updating = false,
) {
  const config = objects[type]
  const body: DataRecord = {}
  for (const item of visibleFields(type, draft)) {
    const raw = item.key === config.owner ? ownerId : draft[item.key]
    const value = typeof raw === 'string' ? raw.trim() : raw
    if (value !== undefined && value !== null && value !== '') body[item.key] = value
    else if (updating && !item.required) body[item.key] = null
  }
  if (updating && type === 'model' && draft.containerCategory !== 'VEHICLE_SLOT')
    body.boxCapacity = null
  return body
}
export function validateDraft(type: ObjectType, draft: DataRecord) {
  const errors: Record<string, string> = {}
  for (const item of visibleFields(type, draft)) {
    const value = draft[item.key]
    const empty =
      value === undefined || value === null || (typeof value === 'string' && !value.trim())
    if (empty) {
      if (item.required) errors[item.key] = `请填写${item.label}`
      continue
    }
    if (item.kind === 'boolean' && typeof value !== 'boolean') errors[item.key] = '请选择状态'
    if (['integer', 'positive', 'relation'].includes(item.kind)) {
      if (typeof value !== 'number' || !Number.isSafeInteger(value)) errors[item.key] = '请输入整数'
      else if (item.kind !== 'integer' && value <= 0) errors[item.key] = '请输入正整数'
      else if (item.kind !== 'relation' && (value < -2147483648 || value > 2147483647))
        errors[item.key] = '超出整数范围'
    }
    const max = item.kind === 'textarea' ? 500 : item.kind === 'enum' ? 64 : 128
    if (typeof value === 'string' && value.length > max) errors[item.key] = `最多 ${max} 个字符`
  }
  if (type === 'model' && draft.containerCategory === 'VEHICLE')
    errors.containerCategory = '请选择新版容器大类'
  return errors
}
