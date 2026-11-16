<script setup lang="ts">
import { LockOutlined, UserOutlined } from '@ant-design/icons-vue'
import {
  Button as AButton,
  Form as AForm,
  FormItem as AFormItem,
  Input as AInput,
  InputPassword as AInputPassword,
  message,
} from 'ant-design-vue'
import { reactive, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'

import { getErrorMessage } from '@/api/http'
import { getFirstAccessiblePath, syncDynamicRoutes } from '@/router/dynamic'
import { useAuthStore } from '@/stores/auth'

const auth = useAuthStore()
const route = useRoute()
const router = useRouter()
const submitting = ref(false)
const form = reactive({ username: '', password: '' })

async function handleSubmit() {
  if (submitting.value) return
  submitting.value = true
  try {
    await auth.login(form)
    syncDynamicRoutes(router, auth.user?.menus || [])
    const redirect =
      typeof route.query.redirect === 'string'
        ? route.query.redirect
        : getFirstAccessiblePath() || '/403'
    await router.replace(redirect)
  } catch (error) {
    message.error(getErrorMessage(error))
  } finally {
    submitting.value = false
  }
}
</script>

<template>
  <main class="login-page">
    <header class="login-header"><h1>南瑞生产中心物流管理系统</h1></header>
    <section class="login-panel" aria-label="账号登录">
      <a-form :model="form" layout="vertical" autocomplete="on" @finish="handleSubmit">
        <a-form-item
          label="用户名"
          name="username"
          :rules="[{ required: true, message: '请输入用户名' }]"
        >
          <a-input
            v-model:value="form.username"
            size="large"
            autocomplete="username"
            placeholder="请输入用户名"
          >
            <template #prefix><UserOutlined /></template>
          </a-input>
        </a-form-item>
        <a-form-item
          label="密码"
          name="password"
          :rules="[{ required: true, message: '请输入密码' }]"
        >
          <a-input-password
            v-model:value="form.password"
            size="large"
            autocomplete="current-password"
            placeholder="请输入密码"
          >
            <template #prefix><LockOutlined /></template>
          </a-input-password>
        </a-form-item>
        <a-button
          class="submit-button"
          type="primary"
          html-type="submit"
          size="large"
          block
          :loading="submitting"
          :disabled="submitting"
          >登录</a-button
        >
      </a-form>
    </section>
  </main>
</template>

<style scoped>
.login-page {
  position: relative;
  display: grid;
  min-height: 100vh;
  min-height: 100svh;
  padding: 160px 24px;
  place-items: center;
  color: #23394c;
  background: linear-gradient(90deg, #2d827f 0%, #458f6d 50%, #77ab49 100%);
}
.login-header {
  position: absolute;
  top: clamp(40px, 8vh, 88px);
  right: 24px;
  left: 24px;
  text-align: center;
}
.login-header h1 {
  margin: 0;
  color: #fff;
  font-size: clamp(28px, 2.4vw, 38px);
  font-weight: 600;
  line-height: 1.4;
  letter-spacing: 0.06em;
}
.login-panel {
  width: min(100%, 400px);
  padding: 32px 36px 36px;
  border: 1px solid #dce5ed;
  border-radius: 6px;
  background: #fff;
  box-shadow: 0 16px 48px rgb(21 59 86 / 12%);
}
:deep(.ant-form-item) {
  margin-bottom: 24px;
}
:deep(.ant-form-item-label > label) {
  color: #23394c;
  font-size: 14px;
  font-weight: 500;
}
:deep(.ant-input-affix-wrapper) {
  height: 44px;
  padding-inline: 12px;
  border-color: #b9c9d6;
  border-radius: 4px;
  background: #fff;
}
:deep(.ant-input) {
  color: #23394c;
  background: #fff;
}
:deep(.ant-input::placeholder) {
  color: #798b9a;
}
:deep(.ant-input-affix-wrapper:hover),
:deep(.ant-input-affix-wrapper-focused) {
  border-color: #07558d;
}
:deep(.ant-input-affix-wrapper-focused) {
  box-shadow: 0 0 0 3px rgb(7 85 141 / 12%);
}
:deep(.ant-input-prefix),
:deep(.ant-input-password-icon) {
  color: #677f92;
}
:deep(.ant-input-prefix) {
  margin-right: 10px;
}
.submit-button {
  height: 44px;
  border-color: #07558d;
  border-radius: 4px;
  color: #fff;
  background: #07558d;
  font-weight: 500;
  box-shadow: none;
}
.submit-button:not(:disabled):hover {
  border-color: #096ba7;
  background: #096ba7;
}
.submit-button:focus-visible {
  outline: 3px solid #07558d;
  outline-offset: 3px;
}
</style>
