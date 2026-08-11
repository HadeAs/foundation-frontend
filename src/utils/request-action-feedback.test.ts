import { afterEach, describe, expect, it, vi } from 'vitest'

import {
  acquireRequestAction,
  installRequestActionFeedback,
  releaseRequestAction,
} from './request-action-feedback'

describe('request action feedback', () => {
  afterEach(() => {
    document.body.innerHTML = ''
    vi.useRealTimers()
  })

  it('locks an action button until all requests finish and skips query buttons', async () => {
    vi.useFakeTimers()
    installRequestActionFeedback()

    const saveButton = document.createElement('button')
    saveButton.className = 'ant-btn'
    saveButton.textContent = '保存'
    document.body.append(saveButton)
    saveButton.click()

    const firstRequest = acquireRequestAction()
    const secondRequest = acquireRequestAction()
    await Promise.resolve()
    expect(saveButton.getAttribute('aria-disabled')).toBe('true')
    expect(saveButton.classList.contains('global-request-loading')).toBe(true)

    releaseRequestAction(firstRequest)
    vi.runAllTimers()
    expect(saveButton.getAttribute('aria-disabled')).toBe('true')

    releaseRequestAction(secondRequest)
    vi.runAllTimers()
    expect(saveButton.hasAttribute('aria-disabled')).toBe(false)
    expect(saveButton.classList.contains('global-request-loading')).toBe(false)

    const queryButton = document.createElement('button')
    queryButton.className = 'ant-btn'
    queryButton.textContent = '查询'
    document.body.append(queryButton)
    queryButton.click()
    expect(acquireRequestAction()).toBeUndefined()
  })
})
