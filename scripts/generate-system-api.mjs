import { readFile, writeFile } from 'node:fs/promises'
import { URL } from 'node:url'
import openapiTS, { astToString } from 'openapi-typescript'

const document = JSON.parse(
  await readFile(new URL('../doc/nari-logistics.openapi.json', import.meta.url), 'utf8'),
)
document.paths = Object.fromEntries(
  Object.entries(document.paths).filter(([path]) =>
    /^\/api\/v1\/(auth|system|monitor|files|dashboard|bootstrap)(\/|$)/.test(path),
  ),
)
const schemas = document.components.schemas
const referenced = new Set()
function collect(value) {
  if (!value || typeof value !== 'object') return
  if (typeof value.$ref === 'string' && value.$ref.startsWith('#/components/schemas/')) {
    const name = value.$ref.slice('#/components/schemas/'.length)
    if (!referenced.has(name)) {
      if (!schemas[name]) throw new Error(`Missing schema: ${name}`)
      referenced.add(name)
      collect(schemas[name])
    }
  }
  for (const child of Object.values(value)) collect(child)
}
collect(document.paths)
document.components.schemas = Object.fromEntries(
  Object.entries(schemas).filter(([name]) => referenced.has(name)),
)
await writeFile(
  new URL('../src/types/api.d.ts', import.meta.url),
  astToString(await openapiTS(document)),
)
