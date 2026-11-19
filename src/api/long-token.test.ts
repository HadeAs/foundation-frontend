import { afterEach, describe, expect, it, vi } from 'vitest'
import contract from '../../doc/nari-logistics.openapi.json'
import { apiClient, CONFLICT_MESSAGE } from './http'
import {
  authorizeLongToken,
  canAuthorizeToken,
  canRevokeToken,
  createLongToken,
  getLongTokenApis,
  getLongTokenScopes,
  isLongTokenOutcomeUnknown,
  LongTokenOutcomeUnknownError,
  pageLongTokens,
  revokeLongToken,
} from './long-token'

const row = {
  tokenId: '9007199254740993123',
  scopeCode: 'device/provider',
  name: 'scanner',
  enabled: true,
  version: 7,
  authorizationVersion: 0,
  apiCodes: [],
}
afterEach(() => vi.restoreAllMocks())
describe('平台长期 Token 请求', () => {
  it('读取平台范围和完整接口目录，不调用业务 Token 接口', async () => {
    const get = vi
      .spyOn(apiClient, 'get')
      .mockResolvedValueOnce({
        data: { data: [{ scopeCode: 'one', name: '一个', description: '' }] },
      })
      .mockResolvedValueOnce({
        data: {
          data: [
            {
              scopeCode: 'other',
              apiCode: 'report',
              name: '上报',
              method: 'POST',
              path: '/report',
            },
          ],
        },
      })
    await getLongTokenScopes()
    expect((await getLongTokenApis())[0]!.scopeCode).toBe('other')
    expect(get.mock.calls.map((call) => call[0])).toEqual([
      '/api/v1/system/long-tokens/scopes',
      '/api/v1/system/long-tokens/interfaces',
    ])
  })
  it('分页保留 false 与字符串 ID，仅提交声明的筛选条件并剔除响应密钥', async () => {
    const get = vi.spyOn(apiClient, 'get').mockResolvedValue({
      data: {
        data: {
          records: [{ ...row, token: 'not-for-list', tokenHash: 'not-for-list' }],
          total: 1,
        },
      },
    })
    const result = await pageLongTokens({
      scopeCode: row.scopeCode,
      page: 2,
      size: 50,
      keyword: ' scanner ',
      enabled: false,
    })
    expect(result.records[0]!.tokenId).toBe(row.tokenId)
    expect(JSON.stringify(result)).not.toContain('not-for-list')
    expect(get).toHaveBeenCalledWith('/api/v1/system/long-tokens', {
      params: { scopeCode: row.scopeCode, page: 2, size: 50, keyword: 'scanner', enabled: false },
    })
  })
  it('创建显式传空授权数组，不使用兼容默认权限', async () => {
    const post = vi
      .spyOn(apiClient, 'post')
      .mockResolvedValue({ data: { data: { metadata: row, token: 'one-time-secret' } } })
    const local = vi.spyOn(Storage.prototype, 'setItem')
    const result = await createLongToken({
      scopeCode: row.scopeCode,
      name: ' scanner ',
      apiCodes: [],
    })
    expect(result.token).toBe('one-time-secret')
    expect(post).toHaveBeenCalledWith('/api/v1/system/long-tokens', {
      scopeCode: row.scopeCode,
      name: 'scanner',
      apiCodes: [],
    })
    expect(local).not.toHaveBeenCalled()
  })
  it('停用凭据用 version，授权同时携带两个独立版本，路径安全编码', async () => {
    const post = vi.spyOn(apiClient, 'post').mockResolvedValue({ data: { code: 0, data: null } })
    const put = vi.spyOn(apiClient, 'put').mockResolvedValue({ data: { data: row } })
    await revokeLongToken(row)
    expect(post).toHaveBeenCalledWith(
      `/api/v1/system/long-tokens/device%2Fprovider/${row.tokenId}/revoke`,
      { version: 7 },
    )
    await authorizeLongToken(row, ['other.report'])
    expect(put).toHaveBeenCalledWith(
      `/api/v1/system/long-tokens/device%2Fprovider/${row.tokenId}/authorization`,
      { apiCodes: ['other.report'], version: 7, authorizationVersion: 0 },
    )
  })
  it('缺版本/停用/未知授权不允许写入，授权版本 0 有效', async () => {
    const post = vi.spyOn(apiClient, 'post'),
      put = vi.spyOn(apiClient, 'put')
    expect(canAuthorizeToken(row)).toBe(true)
    expect(canAuthorizeToken({ ...row, authorizationVersion: undefined })).toBe(false)
    expect(canAuthorizeToken({ ...row, apiCodes: undefined })).toBe(false)
    expect(canRevokeToken({ ...row, enabled: false })).toBe(false)
    await expect(revokeLongToken({ ...row, version: undefined })).rejects.toThrow('版本缺失')
    await expect(authorizeLongToken({ ...row, enabled: false }, [])).rejects.toThrow('状态')
    expect(post).not.toHaveBeenCalled()
    expect(put).not.toHaveBeenCalled()
  })
  it('拒绝超限/重复授权；业务失败与冲突不作为成功结果', async () => {
    const post = vi.spyOn(apiClient, 'post').mockResolvedValue({ data: { code: 40900 } })
    await expect(
      createLongToken({ scopeCode: 'one', name: 'one', apiCodes: ['a', 'a'] }),
    ).rejects.toThrow('不能重复')
    await expect(
      createLongToken({
        scopeCode: 'one',
        name: 'one',
        apiCodes: Array.from({ length: 101 }, (_, i) => String(i)),
      }),
    ).rejects.toThrow('100')
    expect(post).not.toHaveBeenCalled()
    await expect(createLongToken({ scopeCode: 'one', name: 'one', apiCodes: [] })).rejects.toThrow(
      CONFLICT_MESSAGE,
    )
    const get = vi
      .spyOn(apiClient, 'get')
      .mockResolvedValue({ data: { code: 40300, message: '无管理权限' } })
    await expect(getLongTokenScopes()).rejects.toThrow('无管理权限')
    get.mockResolvedValue({ data: { data: {} } })
    await expect(getLongTokenApis()).rejects.toThrow('目录响应无效')
  })
  it('创建缺少明文时不允许当作可自动重试的失败', async () => {
    vi.spyOn(apiClient, 'post').mockResolvedValue({ data: { code: 0, data: { metadata: row } } })
    await expect(
      createLongToken({ scopeCode: row.scopeCode, name: 'one', apiCodes: [] }),
    ).rejects.toBeInstanceOf(LongTokenOutcomeUnknownError)
    expect(isLongTokenOutcomeUnknown(new LongTokenOutcomeUnknownError('unknown'))).toBe(true)
  })
  it('六项平台接口及请求字段与当前契约一致，不编造排序/续期能力', () => {
    const paths = Object.entries(contract.paths).filter(([path]) =>
      path.startsWith('/api/v1/system/long-tokens'),
    )
    expect(paths.reduce((sum, [, operations]) => sum + Object.keys(operations).length, 0)).toBe(6)
    const requestSchema = (body: {
      content: { 'application/json': { schema: { $ref: string } } }
    }) =>
      Object.entries(contract.components.schemas).find(
        ([name]) => `#/components/schemas/${name}` === body.content['application/json'].schema.$ref,
      )?.[1]
    const create = requestSchema(contract.paths['/api/v1/system/long-tokens'].post.requestBody)
    expect(create).toHaveProperty('properties', {
      apiCodes: expect.objectContaining({ maxItems: 100 }),
      name: expect.any(Object),
      scopeCode: expect.any(Object),
    })
    const authorization = requestSchema(
      contract.paths['/api/v1/system/long-tokens/{scopeCode}/{tokenId}/authorization'].put
        .requestBody,
    )
    expect(
      authorization && 'required' in authorization && [...authorization.required].sort(),
    ).toEqual(['apiCodes', 'authorizationVersion', 'version'])
    expect(
      contract.paths['/api/v1/system/long-tokens'].get.parameters.map(
        (parameter) => parameter.name,
      ),
    ).toEqual(['scopeCode', 'page', 'size', 'keyword', 'enabled'])
  })
})
