<script setup lang="ts">
import {
  Alert as AAlert,
  Button as AButton,
  Form as AForm,
  FormItem as AFormItem,
  Input as AInput,
  InputPassword as AInputPassword,
  Modal as AModal,
  Spin as ASpin,
  Switch as ASwitch,
  message,
  type FormInstance,
  type FormProps,
} from 'ant-design-vue'
import { onBeforeUnmount, reactive, ref, watch } from 'vue'

import { getErrorMessage } from '@/api/http'
import {
  getJdbcConfig,
  isJdbcConflict,
  saveJdbcConfig,
  type JdbcConfig,
  type JdbcProfile,
} from '@/api/jdbc-config'
import { useUnsavedChanges } from '@/composables/use-unsaved-changes'

const props = defineProps<{ profile: JdbcProfile }>()
const emit = defineEmits<{ close: []; saved: [] }>()
const open = ref(true)
const loading = ref(false)
const saving = ref(false)
const loadError = ref('')
const saveError = ref('')
const conflict = ref(false)
const config = ref<JdbcConfig>()
const formRef = ref<FormInstance>()
const form = reactive({
  enabled: false,
  jdbcUrl: '',
  username: '',
  driverClassName: '',
  password: '',
})
const { markClean, requestClose } = useUnsavedChanges(form, open)
markClean()
let disposed = false

const rules: FormProps['rules'] = {
  jdbcUrl: [{ required: true, whitespace: true, message: '请输入 JDBC URL' }, { max: 500 }],
  username: [{ required: true, whitespace: true, message: '请输入用户名' }, { max: 128 }],
  driverClassName: [{ required: true, whitespace: true, message: '请输入驱动类名' }, { max: 128 }],
  password: [
    {
      validator: async () => {
        if (!config.value?.configured && !form.password) throw new Error('首次保存请输入密码')
        if (form.password.length > 128) throw new Error('密码最多 128 个字符')
      },
    },
  ],
}

watch(open, (visible) => {
  if (!visible) {
    form.password = ''
    emit('close')
  }
})
onBeforeUnmount(() => {
  disposed = true
  form.password = ''
})

async function load() {
  if (loading.value || saving.value) return
  loading.value = true
  loadError.value = ''
  try {
    const result = await getJdbcConfig(props.profile)
    if (disposed) return
    config.value = result
    Object.assign(form, {
      enabled: result.enabled ?? false,
      jdbcUrl: result.jdbcUrl ?? '',
      username: result.username ?? '',
      driverClassName: result.driverClassName ?? '',
      password: '',
    })
    conflict.value = false
    saveError.value = ''
    markClean()
  } catch (error) {
    if (!disposed) loadError.value = getErrorMessage(error)
  } finally {
    if (!disposed) loading.value = false
  }
}

function reload() {
  AModal.confirm({
    title: '重新加载连接配置？',
    content: '当前未保存的修改将被丢弃。',
    okText: '重新加载',
    cancelText: '继续编辑',
    onOk: load,
  })
}

function close() {
  if (!saving.value) requestClose()
}

async function save() {
  if (saving.value || loading.value || loadError.value || conflict.value || !config.value) return
  saving.value = true
  try {
    try {
      await formRef.value?.validate()
    } catch {
      return
    }
    saveError.value = ''
    await saveJdbcConfig(props.profile, {
      enabled: form.enabled,
      jdbcUrl: form.jdbcUrl.trim(),
      username: form.username.trim(),
      driverClassName: form.driverClassName.trim(),
      ...(form.password !== '' ? { password: form.password } : {}),
      ...(config.value.configured ? { version: config.value.version } : {}),
    })
    if (disposed) return
    form.password = ''
    markClean()
    message.success(`${props.profile} 连接配置已保存`)
    emit('saved')
    open.value = false
  } catch (error) {
    if (!disposed) {
      saveError.value = getErrorMessage(error)
      conflict.value = isJdbcConflict(error)
    }
  } finally {
    if (!disposed) saving.value = false
  }
}

void load()
</script>

<template>
  <a-modal
    :open="open"
    :title="`${profile} 连接配置`"
    :width="680"
    :mask-closable="false"
    :closable="!saving"
    :keyboard="!saving"
    @cancel="close"
  >
    <div v-if="loading" class="jdbc-loading"><a-spin tip="正在加载连接配置" /></div>
    <a-alert v-else-if="loadError" type="error" show-icon :message="loadError">
      <template #action><a-button size="small" @click="load">重试</a-button></template>
    </a-alert>
    <a-form
      v-else-if="config"
      ref="formRef"
      layout="vertical"
      :model="form"
      :rules="rules"
      :disabled="saving"
      class="jdbc-form"
    >
      <a-alert v-if="saveError" type="error" show-icon :message="saveError" class="jdbc-error">
        <template v-if="conflict" #action
          ><a-button size="small" @click="reload">重新加载</a-button></template
        >
      </a-alert>
      <a-form-item label="启用状态"
        ><a-switch
          v-model:checked="form.enabled"
          checked-children="启用"
          un-checked-children="停用"
      /></a-form-item>
      <a-form-item label="JDBC URL" name="jdbcUrl"
        ><a-input v-model:value="form.jdbcUrl" :maxlength="500" autocomplete="off"
      /></a-form-item>
      <div class="jdbc-grid">
        <a-form-item label="用户名" name="username"
          ><a-input v-model:value="form.username" :maxlength="128" autocomplete="off"
        /></a-form-item>
        <a-form-item name="password" :required="!config.configured">
          <template #label
            >密码<span v-if="config.configured" class="password-state"
              >（{{ config.passwordSet ? '已设置' : '未设置' }}）</span
            ></template
          >
          <a-input-password
            v-model:value="form.password"
            :maxlength="128"
            autocomplete="new-password"
            :placeholder="config.configured ? '留空保留原密码' : '请输入密码'"
          />
        </a-form-item>
      </div>
      <a-form-item label="驱动类名" name="driverClassName"
        ><a-input v-model:value="form.driverClassName" :maxlength="128" autocomplete="off"
      /></a-form-item>
      <p class="jdbc-note">保存仅更新配置，不验证远端连接。</p>
    </a-form>
    <template #footer>
      <a-button :disabled="saving" @click="close">取消</a-button>
      <a-button
        type="primary"
        :loading="saving"
        :disabled="loading || !!loadError || conflict || !config"
        @click="save"
        >保存</a-button
      >
    </template>
  </a-modal>
</template>

<style scoped>
.jdbc-loading {
  display: grid;
  place-items: center;
  min-height: 180px;
}
.jdbc-form {
  padding-top: 8px;
}
.jdbc-form :deep(.ant-form-item) {
  margin-bottom: 12px;
}
.jdbc-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 16px;
}
.jdbc-error {
  margin-bottom: 12px;
}
.jdbc-note,
.password-state {
  color: var(--shell-muted);
  font-size: 12px;
}
.jdbc-note {
  margin: 0;
}
@media (max-width: 600px) {
  .jdbc-grid {
    grid-template-columns: 1fr;
    gap: 0;
  }
}
</style>
