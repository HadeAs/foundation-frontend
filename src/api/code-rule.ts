import type { components } from '@/types/api'

import { apiClient, type ApiResult, unwrapResult } from './http'

export type CodeRuleRequest = components['schemas']['CodeRuleRequest']
export type SysCodeRule = components['schemas']['SysCodeRule']
export type CodePreviewResponse = components['schemas']['CodePreviewResponse']
export type CodeRulePage = components['schemas']['PageResultSysCodeRule']

export async function pageCodeRules(
  page: number,
  size: number,
  keyword?: string,
  status?: number,
) {
  return unwrapResult(
    await apiClient.get<ApiResult<CodeRulePage>>('/api/v1/system/code-rules', {
      params: { page, size, keyword: keyword?.trim() || undefined, status },
    }),
  )
}

export async function createCodeRule(request: CodeRuleRequest) {
  return unwrapResult(
    await apiClient.post<ApiResult<SysCodeRule>>('/api/v1/system/code-rules', request),
  )
}

export async function updateCodeRule(ruleId: number, request: CodeRuleRequest) {
  return unwrapResult(
    await apiClient.put<ApiResult<SysCodeRule>>(`/api/v1/system/code-rules/${ruleId}`, request),
  )
}

export function deleteCodeRule(ruleId: number) {
  return apiClient.delete(`/api/v1/system/code-rules/${ruleId}`)
}

export function batchDeleteCodeRules(ids: number[]) {
  return apiClient.post('/api/v1/system/code-rules/batch/delete', { ids })
}

export async function previewCode(ruleCode: string) {
  return unwrapResult(
    await apiClient.post<ApiResult<CodePreviewResponse>>(
      `/api/v1/system/code-rules/${encodeURIComponent(ruleCode)}/preview`,
    ),
  )
}

export async function generateNextCode(ruleCode: string) {
  return unwrapResult(
    await apiClient.post<ApiResult<CodePreviewResponse>>(
      `/api/v1/system/code-rules/${encodeURIComponent(ruleCode)}/next`,
    ),
  )
}
