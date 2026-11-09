import openapi from '../../doc/nari-logistics.openapi.json'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { apiClient, CONFLICT_MESSAGE } from './http'
import { createConfig, updateConfig } from './config'
import { getJdbcConfig, saveJdbcConfig, isManagedJdbcKey } from './jdbc-config'

const configured = {
  configured: true,
  enabled: true,
  jdbcUrl: 'jdbc:test',
  username: 'test',
  driverClassName: 'test.Driver',
  passwordSet: true,
  version: 2,
}
afterEach(() => vi.restoreAllMocks())

describe('MES/WMS 连接配置契约', () => {
  it.each(['MES', 'WMS'] as const)('只调用 %s 专用接口，并只保留安全响应字段', async (profile) => {
    const get = vi.spyOn(apiClient, 'get').mockResolvedValue({
      data: {
        code: 0,
        data: { ...configured, password: 'unexpected', ciphertext: 'unexpected' },
      },
    })
    const result = await getJdbcConfig(profile)
    expect(get).toHaveBeenCalledWith(`/api/v1/business/nari-logistics/jdbc-configs/${profile}`)
    expect(result).toEqual({ ...configured, profile })
    const put = vi
      .spyOn(apiClient, 'put')
      .mockResolvedValue({ data: { code: 0, data: configured } })
    const request = {
      enabled: true,
      jdbcUrl: 'jdbc:test',
      username: 'test',
      driverClassName: 'test.Driver',
      version: 2,
    }
    await saveJdbcConfig(profile, request)
    expect(put).toHaveBeenCalledWith(
      `/api/v1/business/nari-logistics/jdbc-configs/${profile}`,
      request,
    )
  })
  it('区分未配置、响应不完整和业务错误', async () => {
    const get = vi
      .spyOn(apiClient, 'get')
      .mockResolvedValue({ data: { data: { configured: false } } })
    expect((await getJdbcConfig('MES')).configured).toBe(false)
    for (const data of [
      undefined,
      {},
      { ...configured, version: null },
      { ...configured, profile: 'WMS' },
    ]) {
      get.mockResolvedValue({ data: { data } })
      await expect(getJdbcConfig('MES')).rejects.toThrow('响应不完整')
    }
    get.mockResolvedValue({ data: { code: 40900 } })
    await expect(getJdbcConfig('MES')).rejects.toThrow(CONFLICT_MESSAGE)
    get.mockResolvedValue({ data: { code: 50300, message: '运行密钥不可用' } })
    await expect(getJdbcConfig('MES')).rejects.toThrow('运行密钥不可用')
  })
  it('与最新 OpenAPI 的请求字段、必填项、长度和 profile 保持一致', () => {
    const doc = openapi
    const schema = doc.components.schemas.NariJdbcConfigSave
    expect(Object.keys(schema.properties).sort()).toEqual([
      'driverClassName',
      'enabled',
      'jdbcUrl',
      'password',
      'username',
      'version',
    ])
    expect(schema.required.sort()).toEqual(['driverClassName', 'enabled', 'jdbcUrl', 'username'])
    expect(schema.properties.jdbcUrl.maxLength).toBe(500)
    for (const key of ['username', 'password', 'driverClassName'] as const)
      expect(schema.properties[key].maxLength).toBe(128)
    expect(schema.properties.password.writeOnly).toBe(true)
    expect(
      doc.paths['/api/v1/business/nari-logistics/jdbc-configs/{profile}'].get.parameters[0].schema
        .enum,
    ).toEqual(['MES', 'WMS'])
  })
  it('禁止通过通用参数接口创建或改名为受管键，普通键不受影响', async () => {
    const post = vi.spyOn(apiClient, 'post').mockResolvedValue({ data: { data: {} } })
    const put = vi.spyOn(apiClient, 'put')
    for (const key of ['nari.jdbc.mes', 'NARI.JDBC.WMS', ' Nari.Jdbc.Mes ']) {
      expect(isManagedJdbcKey(key)).toBe(true)
      const request = { configKey: key, configValue: '{}' }
      await expect(createConfig(request)).rejects.toThrow('连接配置')
      await expect(updateConfig(1, request, 2)).rejects.toThrow('连接配置')
    }
    expect(post).not.toHaveBeenCalled()
    expect(put).not.toHaveBeenCalled()
    expect(isManagedJdbcKey('nari.jdbc.mes.other')).toBe(false)
    await createConfig({ configKey: 'ordinary', configValue: 'value' })
    expect(post).toHaveBeenCalledOnce()
  })
})
