import { Modal } from 'ant-design-vue'
import { nextTick, toRaw, watch, type Ref } from 'vue'

export function useUnsavedChanges(source: object, open: Ref<boolean>) {
  let baseline = ''
  const snapshot = () => JSON.stringify(toRaw(source))
  const markClean = () => { baseline = snapshot() }

  watch(open, async (visible) => {
    if (!visible) return
    await nextTick()
    markClean()
  })

  function requestClose() {
    if (snapshot() === baseline) {
      open.value = false
      return
    }
    Modal.confirm({
      title: '放弃未保存的修改？',
      content: '当前表单内容已经变更，关闭后修改将不会保存。',
      okText: '放弃修改',
      cancelText: '继续编辑',
      okType: 'danger',
      onOk: () => { open.value = false },
    })
  }

  return { markClean, requestClose }
}
