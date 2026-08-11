const QUERY_ACTIONS = new Set(['查询', '重置', '刷新'])
const CLAIM_WINDOW_MS = 250
const RELEASE_DELAY_MS = 80

export type RequestAction = {
  button: HTMLButtonElement
  count: number
  releaseTimer?: ReturnType<typeof setTimeout>
  feedbackApplied: boolean
}

let pendingAction: RequestAction | undefined
let installed = false

function actionLabel(button: HTMLButtonElement) {
  return button.textContent?.replace(/\s+/g, '') || ''
}

function handleClick(event: MouseEvent) {
  const button = (event.target as Element | null)?.closest<HTMLButtonElement>('button.ant-btn')
  if (button?.dataset.requestBusy === 'true') {
    event.preventDefault()
    event.stopImmediatePropagation()
    return
  }
  if (!button || button.disabled || QUERY_ACTIONS.has(actionLabel(button))) return

  const action: RequestAction = {
    button,
    count: 0,
    feedbackApplied: false,
  }
  pendingAction = action
  window.setTimeout(() => {
    if (pendingAction === action && action.count === 0) pendingAction = undefined
  }, CLAIM_WINDOW_MS)
}

export function installRequestActionFeedback() {
  if (installed) return
  installed = true
  document.addEventListener('click', handleClick, true)
}

export function acquireRequestAction() {
  const action = pendingAction
  if (!action || !action.button.isConnected) return undefined
  if (action.releaseTimer) clearTimeout(action.releaseTimer)
  action.count += 1

  queueMicrotask(() => {
    if (action.count === 0 || !action.button.isConnected) return
    action.button.dataset.requestBusy = 'true'
    action.button.setAttribute('aria-disabled', 'true')
    action.button.setAttribute('aria-busy', 'true')
    if (!action.button.classList.contains('ant-btn-loading')) {
      action.button.classList.add('global-request-loading')
      action.feedbackApplied = true
    }
  })
  return action
}

export function releaseRequestAction(action?: RequestAction) {
  if (!action) return
  action.count = Math.max(0, action.count - 1)
  if (action.count > 0) return

  action.releaseTimer = window.setTimeout(() => {
    if (action.count > 0) return
    if (action.button.isConnected) {
      delete action.button.dataset.requestBusy
      action.button.removeAttribute('aria-disabled')
      action.button.removeAttribute('aria-busy')
      if (action.feedbackApplied) action.button.classList.remove('global-request-loading')
    }
    if (pendingAction === action) pendingAction = undefined
  }, RELEASE_DELAY_MS)
}
