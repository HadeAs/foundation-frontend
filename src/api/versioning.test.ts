import { beforeEach, describe, expect, it, vi } from 'vitest'

import { deleteDept } from './dept'
import { apiClient } from './http'
import { batchDeleteJobs } from './job'
import { deleteMenu } from './menu'

describe('乐观锁请求契约', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  it('批量删除提交资源 ID 与版本', async () => {
    const post = vi.spyOn(apiClient, 'post').mockResolvedValue({ data: {} })

    await batchDeleteJobs([{ id: 1, version: 2 }, { id: 3, version: 4 }])

    expect(post).toHaveBeenCalledWith('/api/v1/system/jobs/batch/delete', {
      items: [{ id: 1, version: 2 }, { id: 3, version: 4 }],
    })
  })

  it('菜单和部门子树删除只提交根节点版本', async () => {
    const remove = vi.spyOn(apiClient, 'delete').mockResolvedValue({ data: {} })

    await deleteMenu(10, 5)
    await deleteDept(20, 6)

    expect(remove).toHaveBeenNthCalledWith(1, '/api/v1/system/menus/10', {
      params: { version: 5 },
    })
    expect(remove).toHaveBeenNthCalledWith(2, '/api/v1/system/depts/20', {
      params: { version: 6 },
    })
  })
})
