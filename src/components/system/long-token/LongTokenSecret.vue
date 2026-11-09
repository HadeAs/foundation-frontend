<script setup lang="ts">
import {
  Alert as AAlert,
  Button as AButton,
  Modal as AModal,
  Textarea as ATextarea,
  message,
} from 'ant-design-vue'
import { onBeforeUnmount, ref } from 'vue'
const props = defineProps<{ token: string }>()
const emit = defineEmits<{ close: [] }>()
const secret = ref(props.token)
let confirmation: ReturnType<typeof AModal.confirm> | undefined
onBeforeUnmount(() => {
  secret.value = ''
  confirmation?.destroy()
})
function close() {
  if (confirmation) return
  confirmation = AModal.confirm({
    title: '确认已安全保存 Token？',
    content: '关闭后无法再次查看明文。',
    okText: '已保存，关闭',
    cancelText: '返回查看',
    onCancel: () => {
      confirmation = undefined
    },
    onOk: () => {
      secret.value = ''
      emit('close')
    },
  })
}
async function copy() {
  try {
    await navigator.clipboard.writeText(secret.value)
    message.success('Token 已复制，请妥善保管')
  } catch {
    message.warning('无法自动复制，请选中文本手动复制')
  }
}
</script>
<template>
  <a-modal open title="Token 已创建" :width="680" :mask-closable="false" @cancel="close">
    <a-alert
      type="warning"
      show-icon
      message="明文仅展示一次，请立即安全保存，不要发送到聊天或日志中。"
    />
    <a-textarea
      :value="secret"
      readonly
      :rows="4"
      aria-label="新建 Token 明文"
      class="secret-value"
    />
    <template #footer
      ><a-button @click="copy">复制 Token</a-button
      ><a-button type="primary" @click="close">已保存，关闭</a-button></template
    >
  </a-modal>
</template>
<style scoped>
.secret-value {
  margin-top: 12px;
  overflow-wrap: anywhere;
}
</style>
