import { getLogisticsData } from '@/api/logistics-query'
import { lookupRecord } from '@/business/basic-data/relations'
import { recordLabel, type DataRecord } from '@/business/basic-data/schema'
import { fields, isQueryType, queryRecordLabel, type ReferenceType } from './schema'

export type QueryRelations = Record<string, DataRecord | null>
export const referenceKey = (type: ReferenceType, id: number) => `${type}:${id}`
const pending = new Map<string, Promise<DataRecord>>()
export function lookupReference(type: ReferenceType, id: number): Promise<DataRecord> {
  if (!isQueryType(type)) return lookupRecord(type, id)
  const key = referenceKey(type, id)
  if (!pending.has(key)) pending.set(key, getLogisticsData(type, id).finally(() => pending.delete(key)))
  return pending.get(key)!
}
export function referenceLabel(type: ReferenceType, record: DataRecord) {
  return isQueryType(type) ? queryRecordLabel(type, record) : recordLabel(type, record)
}
export async function resolveQueryReferences(keys: string[], records: DataRecord[]) {
  const unique = new Map<string, { target: ReferenceType; id: number }>()
  for (const key of keys) {
    const target = fields[key]?.target
    if (!target) continue
    for (const record of records) if (typeof record[key] === 'number') unique.set(referenceKey(target, record[key]), { target, id: record[key] })
  }
  const entries = await Promise.all([...unique].map(async ([key, { target, id }]) => {
    try { return [key, await lookupReference(target, id)] as const } catch { return [key, null] as const }
  }))
  return Object.fromEntries(entries)
}
