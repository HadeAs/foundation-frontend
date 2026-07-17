<script setup lang="ts">
import { LockOutlined } from '@ant-design/icons-vue'
import {
  Form as AForm,
  FormItem as AFormItem,
  InputPassword as AInputPassword,
  Modal as AModal,
  message,
} from 'ant-design-vue'
import { reactive, ref } from 'vue'
import { useRouter } from 'vue-router'

import { changePassword } from '@/api/auth'
import { getErrorMessage } from '@/api/http'
import { useAuthStore } from '@/stores/auth'

const open = defineModel<boolean>('open', { required: true })
const router = useRouter()
const auth = useAuthStore()
const saving = ref(false)
const form = reactive({ oldPassword: '', newPassword: '', confirmPassword: '' })

async function submit() {
  if (!form.oldPassword) {
    message.error('请输入当前密码')
    return
  }
  if (form.newPassword.length < 8 || form.newPassword.length > 72) {
    message.error('新密码长度必须为 8 至 72 位')
    return
  }
  if (form.newPassword !== form.confirmPassword) {
    message.error('两次输入的新密码不一致')
    return
  }
  saving.value = true
  try {
    await changePassword({ oldPassword: form.oldPassword, newPassword: form.newPassword })
    message.success('密码修改成功，请重新登录')
    open.value = false
    await auth.logout()
    await router.replace('/login')
  } catch (error) {
    message.error(getErrorMessage(error))
  } finally {
    saving.value = false
  }
}
</script>

<template>
  <a-modal v-model:open="open" title="修改密码" :confirm-loading="saving" @ok="submit">
    <a-form :model="form" layout="vertical">
      <a-form-item label="当前密码" required>
        <a-input-password v-model:value="form.oldPassword" autocomplete="current-password">
          <template #prefix><LockOutlined /></template>
        </a-input-password>
      </a-form-item>
      <a-form-item label="新密码" extra="至少 8 位，最多 72 位" required>
        <a-input-password v-model:value="form.newPassword" autocomplete="new-password" />
      </a-form-item>
      <a-form-item label="确认新密码" required>
        <a-input-password v-model:value="form.confirmPassword" autocomplete="new-password" />
      </a-form-item>
    </a-form>
  </a-modal>
</template>
