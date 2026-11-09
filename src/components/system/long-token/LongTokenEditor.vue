<script setup lang="ts">
import {
  Alert as AAlert,
  Button as AButton,
  Checkbox as ACheckbox,
  Input as AInput,
  Modal as AModal,
  message,
} from 'ant-design-vue'
import { computed, onBeforeUnmount, reactive, ref, watch } from 'vue'
import { getErrorMessage } from '@/api/http'
import {
  authorizeLongToken,
  createLongToken,
  getLongTokenApis,
  isLongTokenConflict,
  isLongTokenOutcomeUnknown,
  type LongTokenApi,
  type LongTokenCreated,
  type LongTokenMetadata,
  type LongTokenScope,
} from '@/api/long-token'
import DataState from '@/components/business/basic-data/DataState.vue'
import { useUnsavedChanges } from '@/composables/use-unsaved-changes'

const props = defineProps<{ scope: LongTokenScope; record?: LongTokenMetadata }>()
const emit = defineEmits<{ close: []; created: [value: LongTokenCreated]; saved: [] }>()
const open = ref(true),
  loading = ref(false),
  saving = ref(false),
  loadError = ref(''),
  saveError = ref(''),
  blocked = ref(false)
const apis = ref<LongTokenApi[]>([]),
  search = ref('')
const form = reactive({
  name: props.record?.name || '',
  apiCodes: [...(props.record?.apiCodes || [])],
})
const { markClean, requestClose } = useUnsavedChanges(form, open)
markClean()
let disposed = false
const groups = computed(() => {
  const result: Record<string, LongTokenApi[]> = {}
  const keyword = search.value.trim().toLowerCase()
  for (const api of apis.value) {
    if (
      !`${api.name} ${api.apiCode} ${api.method} ${api.path} ${api.scopeCode}`
        .toLowerCase()
        .includes(keyword)
    )
      continue
    ;(result[api.scopeCode] ||= []).push(api)
  }
  return result
})
const unavailable = computed(() =>
  form.apiCodes.filter((code) => !apis.value.some((api) => api.apiCode === code)),
)
watch(open, (value) => {
  if (!value) emit('close')
})
onBeforeUnmount(() => {
  disposed = true
})
async function load() {
  if (loading.value) return
  loading.value = true
  loadError.value = ''
  try {
    const result = await getLongTokenApis()
    if (!disposed) apis.value = result
  } catch (error) {
    if (!disposed) loadError.value = getErrorMessage(error)
  } finally {
    if (!disposed) loading.value = false
  }
}
function toggle(code: string, checked: boolean) {
  if (saving.value) return
  form.apiCodes = checked
    ? [...new Set([...form.apiCodes, code])]
    : form.apiCodes.filter((value) => value !== code)
}
function close() {
  if (!saving.value) requestClose()
}
async function save() {
  if (saving.value || loading.value || loadError.value || blocked.value) return
  saveError.value = ''
  if (!props.record && !form.name.trim()) {
    saveError.value = '请输入 Token 名称'
    return
  }
  if (form.name.trim().length > 128) {
    saveError.value = 'Token 名称最多 128 个字符'
    return
  }
  if (form.apiCodes.length > 100) {
    saveError.value = '最多选择 100 个接口'
    return
  }
  if (unavailable.value.length) {
    saveError.value = '请先取消已失效接口的勾选'
    return
  }
  saving.value = true
  try {
    if (props.record) {
      await authorizeLongToken(props.record, form.apiCodes)
      if (disposed) return
      message.success('接口授权已保存')
      emit('saved')
    } else {
      const result = await createLongToken({
        scopeCode: props.scope.scopeCode,
        name: form.name,
        apiCodes: form.apiCodes,
      })
      if (disposed) return
      emit('created', result)
    }
    markClean()
    open.value = false
  } catch (error) {
    if (disposed) return
    blocked.value = isLongTokenConflict(error) || isLongTokenOutcomeUnknown(error)
    saveError.value = isLongTokenOutcomeUnknown(error)
      ? '请求结果未知，请关闭后刷新列表核对，勿重复提交。'
      : getErrorMessage(error)
  } finally {
    if (!disposed) saving.value = false
  }
}
void load()
</script>
<template>
  <a-modal
    :open="open"
    :title="record ? '接口授权' : '创建长期 Token'"
    :width="760"
    :mask-closable="false"
    :closable="!saving"
    :keyboard="!saving"
    @cancel="close"
  >
    <div class="token-context">
      {{ scope.name }}<span v-if="record"> / {{ record.name }}</span>
    </div>
    <label v-if="!record" class="token-name"
      >Token 名称<a-input
        v-model:value="form.name"
        :maxlength="128"
        :disabled="saving"
        placeholder="请输入 Token 名称"
    /></label>
    <DataState v-if="loading || loadError" :loading="loading" :error="loadError" @retry="load" />
    <template v-else>
      <div class="auth-heading">
        <strong>允许调用的接口</strong><span>已选 {{ form.apiCodes.length }} / 100</span>
      </div>
      <a-input
        v-model:value="search"
        allow-clear
        aria-label="筛选接口"
        placeholder="搜索接口名称、代码或路径"
      />
      <div class="api-list">
        <section v-for="(items, group) in groups" :key="group">
          <h3>{{ group }}</h3>
          <a-checkbox
            v-for="api in items"
            :key="api.apiCode"
            :checked="form.apiCodes.includes(api.apiCode)"
            :disabled="
              saving || (!form.apiCodes.includes(api.apiCode) && form.apiCodes.length >= 100)
            "
            @change="toggle(api.apiCode, $event.target.checked)"
          >
            <span>{{ api.name }}</span
            ><small>{{ api.method }} {{ api.path }}</small>
          </a-checkbox>
        </section>
        <p v-if="!Object.keys(groups).length" class="muted">
          {{ apis.length ? '没有匹配的接口' : '暂无可授权接口' }}
        </p>
        <section v-if="unavailable.length">
          <h3>已失效接口（请取消勾选）</h3>
          <a-checkbox
            v-for="code in unavailable"
            :key="code"
            checked
            :disabled="saving"
            @change="toggle(code, false)"
            >{{ code }}</a-checkbox
          >
        </section>
      </div>
      <p class="muted">未选择接口时，此 Token 无接口调用权限。</p>
    </template>
    <a-alert
      v-if="saveError"
      type="error"
      show-icon
      :message="saveError"
      :description="
        blocked ? '请关闭弹窗，刷新后核对最新状态。当前输入已保留，不会自动重发。' : undefined
      "
    />
    <template #footer
      ><a-button :disabled="saving" @click="close">取消</a-button
      ><a-button
        type="primary"
        :loading="saving"
        :disabled="loading || !!loadError || blocked"
        @click="save"
        >{{ record ? '保存授权' : '创建' }}</a-button
      ></template
    >
  </a-modal>
</template>
<style scoped>
.token-context {
  color: var(--shell-muted);
  margin-bottom: 12px;
}
.token-name {
  display: grid;
  gap: 6px;
  margin-bottom: 12px;
}
.auth-heading {
  display: flex;
  justify-content: space-between;
  margin-bottom: 8px;
}
.api-list {
  max-height: 320px;
  overflow: auto;
  border: 1px solid var(--shell-border);
  padding: 0 12px;
  margin-top: 8px;
}
.api-list h3 {
  margin: 10px 0 6px;
  font-size: 13px;
  color: var(--shell-muted);
}
.api-list :deep(.ant-checkbox-wrapper) {
  display: flex;
  margin: 0;
  padding: 7px 0;
  align-items: flex-start;
}
.api-list small {
  display: block;
  color: var(--shell-muted);
  overflow-wrap: anywhere;
}
.muted {
  font-size: 12px;
  color: var(--shell-muted);
  margin: 10px 0;
}
</style>
