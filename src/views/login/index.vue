<script setup lang="ts">
import {
  ArrowRightOutlined,
  LockOutlined,
  SafetyCertificateOutlined,
  UserOutlined,
} from '@ant-design/icons-vue'
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
const year = new Date().getFullYear()

async function handleSubmit() {
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
    <section class="system-panel" aria-label="平台介绍">
      <div class="grid-layer" aria-hidden="true"></div>
      <header class="brand">
        <span class="brand-mark" aria-hidden="true"><i></i></span>
        <span class="brand-copy">
          <strong>工业系统管理平台</strong>
          <small>统一权限与资源管理</small>
        </span>
      </header>

      <div class="system-story">
        <p class="section-index">安全访问</p>
        <h1>让系统运行<br /><em>清晰可控</em></h1>
        <p class="system-summary">
          统一管理身份、权限与系统资源。每一次访问都有边界，每一项操作都有轨迹。
        </p>

        <div class="capability-strip">
          <div>
            <span>会话</span>
            <strong>JWT 安全会话</strong>
          </div>
          <div>
            <span>权限</span>
            <strong>动态菜单权限</strong>
          </div>
          <div>
            <span>审计</span>
            <strong>全链路可追踪</strong>
          </div>
        </div>
      </div>

      <div class="radar" aria-hidden="true">
        <span class="radar-ring ring-a"></span>
        <span class="radar-ring ring-b"></span>
        <span class="radar-ring ring-c"></span>
        <span class="radar-sweep"></span>
        <span class="radar-core"></span>
        <span class="radar-label label-a">角色</span>
        <span class="radar-label label-b">菜单</span>
        <span class="radar-label label-c">审计</span>
      </div>

      <footer class="system-footer">
        <span class="pulse-dot"></span>
        <span>系统就绪</span>
        <span class="footer-line"></span>
        <span>中国 / {{ year }}</span>
      </footer>
    </section>

    <section class="login-panel">
      <div class="login-box">
        <div class="login-heading">
          <span class="security-icon"><SafetyCertificateOutlined /></span>
          <p>安全登录</p>
          <h2>欢迎回来</h2>
          <span>请输入账号信息以进入管理平台</span>
        </div>

        <a-form
          :model="form"
          layout="vertical"
          autocomplete="on"
          @finish="handleSubmit"
        >
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

          <div class="session-note">
            <span><i></i> 登录状态将在此设备安全保留</span>
          </div>

          <a-button
            class="submit-button"
            type="primary"
            html-type="submit"
            size="large"
            block
            :loading="submitting"
          >
            <span>进入系统</span>
            <ArrowRightOutlined v-if="!submitting" />
          </a-button>
        </a-form>

        <div class="login-meta">
          <span>会话保护</span>
          <span>·</span>
          <span>权限控制</span>
          <span>·</span>
          <span>操作可追踪</span>
        </div>
      </div>

      <footer class="legal">© {{ year }} 工业系统管理平台</footer>
    </section>
  </main>
</template>

<style scoped>
.login-page {
  display: grid;
  min-height: 100vh;
  grid-template-columns: minmax(590px, 1.18fr) minmax(470px, 0.82fr);
  overflow: hidden;
  background: #f4f7f7;
}

.system-panel {
  position: relative;
  min-height: 720px;
  padding: 46px 58px;
  overflow: hidden;
  color: #edf9f8;
  background:
    radial-gradient(circle at 73% 38%, rgba(13, 148, 150, 0.17), transparent 29%),
    linear-gradient(145deg, #102b2c 0%, #071a1b 75%);
}

.system-panel::after {
  position: absolute;
  top: 0;
  right: 0;
  width: 1px;
  height: 100%;
  background: linear-gradient(transparent, rgba(57, 199, 197, 0.7), transparent);
  content: '';
}

.grid-layer {
  position: absolute;
  inset: 0;
  opacity: 0.22;
  background-image:
    linear-gradient(rgba(135, 196, 196, 0.14) 1px, transparent 1px),
    linear-gradient(90deg, rgba(135, 196, 196, 0.14) 1px, transparent 1px);
  background-size: 54px 54px;
  mask-image: linear-gradient(to bottom right, #000 0%, transparent 82%);
}

.brand {
  position: relative;
  z-index: 2;
  display: flex;
  align-items: center;
  gap: 14px;
}

.brand-mark {
  position: relative;
  display: grid;
  width: 36px;
  height: 36px;
  border: 1px solid rgba(83, 221, 219, 0.65);
  place-items: center;
  transform: rotate(45deg);
}

.brand-mark::before,
.brand-mark::after,
.brand-mark i {
  position: absolute;
  background: #35c8c7;
  content: '';
}

.brand-mark::before {
  width: 16px;
  height: 3px;
}

.brand-mark::after {
  width: 3px;
  height: 16px;
}

.brand-mark i {
  width: 7px;
  height: 7px;
  background: #d8ffff;
}

.brand-copy {
  display: flex;
  flex-direction: column;
}

.brand-copy strong {
  font-size: 16px;
  font-weight: 600;
  letter-spacing: 0.08em;
}

.brand-copy small {
  margin-top: 3px;
  color: #6fa2a2;
  font-size: 9px;
  letter-spacing: 0.22em;
}

.system-story {
  position: relative;
  z-index: 2;
  width: min(610px, 79%);
  margin-top: clamp(100px, 17vh, 174px);
}

.section-index {
  margin: 0 0 22px;
  color: #42cfcd;
  font-size: 10px;
  font-weight: 700;
  letter-spacing: 0.25em;
}

.system-story h1 {
  margin: 0;
  font-size: clamp(46px, 4.35vw, 72px);
  font-weight: 520;
  line-height: 1.12;
  letter-spacing: -0.045em;
}

.system-story h1 em {
  color: #3ad0ce;
  font-style: normal;
}

.system-summary {
  max-width: 500px;
  margin: 28px 0 0;
  color: #94b3b3;
  font-size: 15px;
  line-height: 1.9;
}

.capability-strip {
  display: grid;
  margin-top: 52px;
  grid-template-columns: repeat(3, 1fr);
  border-top: 1px solid rgba(94, 154, 154, 0.28);
}

.capability-strip div {
  padding: 18px 18px 0 0;
}

.capability-strip div + div {
  padding-left: 18px;
  border-left: 1px solid rgba(94, 154, 154, 0.22);
}

.capability-strip span,
.capability-strip strong {
  display: block;
}

.capability-strip span {
  margin-bottom: 7px;
  color: #3ac3c1;
  font-size: 9px;
  letter-spacing: 0.18em;
}

.capability-strip strong {
  color: #c5d8d8;
  font-size: 12px;
  font-weight: 500;
}

.radar {
  position: absolute;
  z-index: 1;
  right: -105px;
  bottom: -90px;
  width: 450px;
  height: 450px;
  opacity: 0.62;
}

.radar-ring,
.radar-sweep {
  position: absolute;
  border: 1px solid rgba(52, 194, 192, 0.29);
  border-radius: 50%;
}

.ring-a { inset: 0; }
.ring-b { inset: 62px; }
.ring-c { inset: 132px; }

.radar-sweep {
  inset: 0;
  border-color: transparent;
  background: conic-gradient(from 5deg, rgba(53, 200, 199, 0.2), transparent 22%);
  animation: sweep 9s linear infinite;
}

.radar-core {
  position: absolute;
  top: 50%;
  left: 50%;
  width: 10px;
  height: 10px;
  background: #55e2df;
  box-shadow: 0 0 28px #35c8c7;
  transform: translate(-50%, -50%) rotate(45deg);
}

.radar-label {
  position: absolute;
  color: #4eb9b8;
  font-size: 8px;
  letter-spacing: 0.16em;
}

.label-a { top: 79px; left: 186px; }
.label-b { top: 216px; left: 70px; }
.label-c { top: 292px; left: 300px; }

.system-footer {
  position: absolute;
  z-index: 2;
  right: 58px;
  bottom: 38px;
  left: 58px;
  display: flex;
  align-items: center;
  gap: 10px;
  color: #597e7e;
  font-size: 8px;
  font-weight: 700;
  letter-spacing: 0.2em;
}

.pulse-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: #36d0a2;
  box-shadow: 0 0 0 5px rgba(54, 208, 162, 0.09);
  animation: pulse 2s ease-out infinite;
}

.footer-line {
  height: 1px;
  flex: 1;
  background: rgba(88, 130, 130, 0.24);
}

.login-panel {
  position: relative;
  display: grid;
  min-height: 720px;
  padding: 64px 72px;
  place-items: center;
  background:
    linear-gradient(90deg, rgba(16, 53, 53, 0.035) 1px, transparent 1px),
    #f6f8f8;
  background-size: 92px 100%;
}

.login-box {
  width: min(100%, 410px);
  transform: translateY(-8px);
  animation: enter 0.65s cubic-bezier(0.2, 0.75, 0.25, 1) both;
}

.login-heading {
  margin-bottom: 34px;
}

.security-icon {
  display: grid;
  width: 42px;
  height: 42px;
  margin-bottom: 24px;
  color: #0d9496;
  font-size: 21px;
  border: 1px solid #b9d9d9;
  background: #eaf5f4;
  place-items: center;
}

.login-heading p {
  margin: 0 0 7px;
  color: #0d9496;
  font-size: 9px;
  font-weight: 700;
  letter-spacing: 0.22em;
}

.login-heading h2 {
  margin: 0 0 10px;
  color: #152a2a;
  font-size: 34px;
  font-weight: 600;
  letter-spacing: -0.035em;
}

.login-heading > span:last-child {
  color: #6d7d7d;
  font-size: 14px;
}

:deep(.ant-form-item) {
  margin-bottom: 22px;
}

:deep(.ant-form-item-label > label) {
  color: #415353;
  font-size: 12px;
  font-weight: 600;
}

:deep(.ant-input-affix-wrapper) {
  height: 50px;
  padding-inline: 15px;
  border-color: #cad7d7;
  border-radius: 4px;
  background: rgba(255, 255, 255, 0.76);
  box-shadow: none;
}

:deep(.ant-input-affix-wrapper:hover),
:deep(.ant-input-affix-wrapper-focused) {
  border-color: #0d9496;
  box-shadow: 0 0 0 3px rgba(13, 148, 150, 0.09);
}

:deep(.ant-input-prefix) {
  margin-right: 11px;
  color: #7b8f8f;
}

.session-note {
  display: flex;
  justify-content: flex-end;
  margin: -6px 0 24px;
  color: #768787;
  font-size: 11px;
}

.session-note i {
  display: inline-block;
  width: 5px;
  height: 5px;
  margin: 0 6px 1px 0;
  border-radius: 50%;
  background: #0d9496;
}

.submit-button {
  display: flex;
  height: 52px;
  align-items: center;
  justify-content: space-between;
  padding-inline: 21px;
  border-radius: 4px;
  font-weight: 600;
  letter-spacing: 0.08em;
  box-shadow: 0 12px 25px rgba(13, 148, 150, 0.18);
}

.login-meta {
  display: flex;
  justify-content: center;
  gap: 9px;
  margin-top: 28px;
  color: #9ba7a7;
  font-size: 8px;
  font-weight: 700;
  letter-spacing: 0.14em;
}

.legal {
  position: absolute;
  bottom: 30px;
  color: #98a5a5;
  font-size: 10px;
  letter-spacing: 0.08em;
}

@keyframes sweep {
  to { transform: rotate(360deg); }
}

@keyframes pulse {
  70%, 100% { box-shadow: 0 0 0 10px rgba(54, 208, 162, 0); }
}

@keyframes enter {
  from { opacity: 0; transform: translateY(14px); }
  to { opacity: 1; transform: translateY(-8px); }
}

@media (prefers-reduced-motion: reduce) {
  .radar-sweep,
  .pulse-dot,
  .login-box {
    animation: none;
  }
}

@media (max-height: 760px) {
  .system-story { margin-top: 76px; }
  .capability-strip { margin-top: 32px; }
}
</style>
