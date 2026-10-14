import { getBasicData } from '@/api/basic-data'
import { objects, recordLabel, type DataRecord, type ObjectType } from './schema'

// Deduplicate concurrent lookups only: reopened forms always read current backend data.
const pending = new Map<string, Promise<DataRecord>>()
export function lookupRecord(type: ObjectType, id: number) {
  const key = `${type}:${id}`
  const existing = pending.get(key)
  if (existing) return existing
  const request = getBasicData(type, id).finally(() => pending.delete(key))
  pending.set(key, request)
  return request
}
export type RelationMap = Record<string, DataRecord | null>
export const relationKey = (target: ObjectType, id: unknown) => `${target}:${id}`
export async function resolveRelations(type: ObjectType, rows: DataRecord[]): Promise<RelationMap> {
  return resolveReferenceFields(objects[type].fields, rows)
}
export async function resolveReferenceFields(fields: { key: string; target?: ObjectType }[], rows: DataRecord[]): Promise<RelationMap> {
  const requests = new Map<string, { target: ObjectType; id: number }>()
  for (const row of rows) for (const field of fields) {
    const id = row[field.key]
    if (field.target && typeof id === 'number') requests.set(relationKey(field.target, id), { target: field.target, id })
  }
  return Object.fromEntries(await Promise.all([...requests].map(async ([key, item]) => {
    try { return [key, await lookupRecord(item.target, item.id)] }
    catch { return [key, null] }
  })))
}
export function relationLabel(target: ObjectType, id: unknown, relations: RelationMap) {
  if (id === undefined || id === null || id === '') return '—'
  const record = relations[relationKey(target, id)]
  return record ? recordLabel(target, record) : `ID ${id}（${record === null ? '名称加载失败' : '名称加载中'}）`
}
