import { getBasicData } from '@/api/basic-data'
import { ApiError } from '@/api/http'
import type { DataRecord } from './schema'

export type ContainerManagement = 'slot' | 'fixtureOrder'
export function canManageContainer(
  model: DataRecord | null | undefined,
  kind: ContainerManagement,
) {
  return kind === 'slot'
    ? model?.containerCategory === 'VEHICLE_SLOT'
    : model?.containerCategory === 'BOX' && model.usageType === 'FIXTURE_BOX'
}
export async function requireContainerCapability(id: number, kind: ContainerManagement) {
  const container = await getBasicData('container', id)
  const model =
    typeof container.containerModelId === 'number'
      ? await getBasicData('model', container.containerModelId)
      : undefined
  if (!canManageContainer(model, kind))
    throw new ApiError(
      kind === 'slot'
        ? '仅有装载位载具支持装载位管理，请刷新列表'
        : '仅专用治具箱支持适用订单管理，请刷新列表',
    )
  return container
}
