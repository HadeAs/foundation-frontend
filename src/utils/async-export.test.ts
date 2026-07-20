import { describe, expect, it } from 'vitest'

import { buildExportTaskRequest, isTerminalTaskStatus } from './async-export'

describe('异步导出参数', () => {
  it('序列化业务筛选并排除分页参数和空值', () => {
    const request = buildExportTaskRequest('EXPORT_API_LOG', '接口日志导出', 'api-log', {
      keyword: 'error',
      statusCode: 500,
      startTime: undefined,
      page: 2,
      size: 20,
    })

    expect(request).toEqual({
      taskType: 'EXPORT_API_LOG',
      taskName: '接口日志导出',
      paramsJson: JSON.stringify({
        resource: 'api-log',
        filters: { keyword: 'error', statusCode: 500 },
      }),
    })
  })

  it('只将完成、失败和取消视为终态', () => {
    expect(isTerminalTaskStatus('RUNNING')).toBe(false)
    expect(isTerminalTaskStatus('SUCCESS')).toBe(true)
    expect(isTerminalTaskStatus('FAILURE')).toBe(true)
    expect(isTerminalTaskStatus('CANCELED')).toBe(true)
  })
})
