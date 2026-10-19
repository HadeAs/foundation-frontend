<script setup lang="ts">
import {
  Alert as AAlert,
  Button as AButton,
  Form as AForm,
  FormItem as AFormItem,
  Input as AInput,
  InputNumber as AInputNumber,
  Modal as AModal,
  Select as ASelect,
  Switch as ASwitch,
} from 'ant-design-vue'
import { computed, onBeforeUnmount, reactive, ref, watch } from 'vue'
import {
  getBasicData,
  getBasicDictionaries,
  isVersionConflict,
  saveBasicData,
  type DictionaryItem,
} from '@/api/basic-data'
import { ApiError, getErrorMessage } from '@/api/http'
import {
  buildRequest,
  changeField,
  objects,
  validateDraft,
  visibleFields,
  type DataRecord,
  type Field,
  type FieldValue,
  type ObjectType,
} from '@/business/basic-data/schema'
import { useUnsavedChanges } from '@/composables/use-unsaved-changes'
import { requireContainerCapability } from '@/business/basic-data/container-capabilities'
import { formatDateTime } from '@/utils/date'
import DataState from './DataState.vue'
import ReferenceInput from './ReferenceInput.vue'

const props = defineProps<{ type: ObjectType; id?: number; ownerId?: number; readonly?: boolean }>()
const emit = defineEmits<{ close: []; saved: [] }>()
const config = computed(() => objects[props.type])
const draft = reactive<DataRecord>({})
const original = ref<DataRecord>()
const open = ref(true),
  loading = ref(false),
  saving = ref(false),
  conflict = ref(false)
const error = ref(''),
  loadError = ref(''),
  dictError = ref('')
const errors = ref<Record<string, string>>({})
const dictionaries = ref<Record<string, DictionaryItem[]>>({})
const { requestClose, markClean } = useUnsavedChanges(draft, open)
watch(open, (value) => {
  if (!value) emit('close')
})
let epoch = 0
async function loadDictionaries() {
  dictError.value = ''
  try {
    dictionaries.value = await getBasicDictionaries(props.type)
  } catch (cause) {
    dictError.value = getErrorMessage(cause)
  }
}
async function load() {
  const current = ++epoch
  loading.value = true
  loadError.value = ''
  try {
    const record = props.id === undefined ? undefined : await getBasicData(props.type, props.id)
    if (current !== epoch) return
    if (record && config.value.owner && record[config.value.owner] !== props.ownerId)
      throw new ApiError('记录归属已改变，请关闭并刷新列表')
    for (const key of Object.keys(draft)) delete draft[key]
    Object.assign(draft, record || { enabled: true })
    if (config.value.owner) draft[config.value.owner] = props.ownerId
    original.value = record
    conflict.value = false
    error.value = ''
    errors.value = {}
    markClean()
  } catch (cause) {
    if (current === epoch) loadError.value = getErrorMessage(cause)
  } finally {
    if (current === epoch) loading.value = false
  }
}
const fields = computed(() => visibleFields(props.type, draft))
function options(field: Field) {
  const values = (dictionaries.value[field.dict || ''] || [])
    .filter((item) => item.value !== undefined)
    .map((item) => ({
      value: item.value!,
      label: item.label || item.value!,
      disabled: field.key === 'containerCategory' && item.value === 'VEHICLE',
    }))
  const current = draft[field.key]
  if (typeof current === 'string' && current && !values.some((item) => item.value === current))
    values.push({ value: current, label: `${current}（原值）`, disabled: true })
  return values
}
function update(field: Field, value: FieldValue) {
  changeField(props.type, draft, field.key, value)
  delete errors.value[field.key]
}
function close() {
  if (saving.value) return
  if (props.readonly || loading.value || loadError.value) emit('close')
  else requestClose()
}
function refreshRecord() {
  AModal.confirm({
    title: '重新加载最新数据？',
    content: '当前未保存的输入将被替换。',
    okText: '重新加载',
    cancelText: '保留输入',
    onOk: load,
  })
}
async function save() {
  if (saving.value || loading.value || conflict.value || props.readonly) return
  errors.value = validateDraft(props.type, draft)
  if (Object.keys(errors.value).length) return
  saving.value = true
  error.value = ''
  try {
    if (props.type === 'fixtureOrder' && !props.readonly) {
      if (props.ownerId === undefined) throw new ApiError('缺少所属治具箱')
      await requireContainerCapability(props.ownerId, 'fixtureOrder')
    }
    await saveBasicData(
      props.type,
      buildRequest(props.type, draft, props.ownerId, !!original.value),
      original.value,
    )
    markClean()
    emit('saved')
  } catch (cause) {
    error.value = getErrorMessage(cause)
    conflict.value = isVersionConflict(cause)
  } finally {
    saving.value = false
  }
}
void load()
void loadDictionaries()
onBeforeUnmount(() => {
  epoch++
})
</script>
<template>
  <AModal
    open
    :title="`${readonly ? '查看' : id === undefined ? '新增' : '编辑'}${config.label}`"
    :width="760"
    :mask-closable="false"
    :closable="!saving"
    :keyboard="!saving"
    :body-style="{ maxHeight: '65vh', overflowY: 'auto' }"
    @cancel="close"
  >
    <DataState v-if="loading || loadError" :loading="loading" :error="loadError" @retry="load" />
    <template v-else>
      <AAlert v-if="error" class="editor-alert" type="error" show-icon :message="error"
        ><template v-if="conflict" #action
          ><AButton size="small" @click="refreshRecord">重新加载</AButton></template
        ></AAlert
      >
      <AAlert
        v-if="dictError"
        class="editor-alert"
        type="warning"
        show-icon
        :message="`字典加载失败：${dictError}`"
        ><template #action
          ><AButton size="small" @click="loadDictionaries">重试</AButton></template
        ></AAlert
      >
      <AForm layout="vertical" class="editor-form" :disabled="readonly || saving" @finish="save">
        <AFormItem
          v-for="item in fields"
          :key="item.key"
          :label="item.label"
          :required="!readonly && item.required"
          :class="{ wide: item.kind === 'textarea' }"
          :validate-status="errors[item.key] ? 'error' : undefined"
          :help="errors[item.key]"
        >
          <ReferenceInput
            v-if="item.target"
            :value="draft[item.key] as number | undefined"
            :target="item.target"
            :label="item.label"
            :disabled="
              readonly ||
              saving ||
              item.key === config.owner ||
              (type === 'location' && item.key === 'storageZoneId' && !draft.areaId)
            "
            :area-id="
              type === 'location' && item.key === 'storageZoneId'
                ? (draft.areaId as number | undefined)
                : undefined
            "
            :placeholder="
              type === 'location' && item.key === 'storageZoneId' && !draft.areaId
                ? '请先选择所属区域'
                : undefined
            "
            @update:value="update(item, $event)"
          />
          <ASwitch
            v-else-if="item.kind === 'boolean'"
            :checked="draft[item.key] === true"
            checked-children="启用"
            un-checked-children="停用"
            :aria-label="item.label"
            @update:checked="update(item, $event)"
          />
          <ASelect
            v-else-if="item.kind === 'enum'"
            :value="draft[item.key] as string | undefined"
            :options="options(item)"
            :placeholder="`请选择${item.label}`"
            :aria-label="item.label"
            allow-clear
            :not-found-content="dictError ? '字典加载失败，请重试' : '暂无可用字典项'"
            @update:value="update(item, $event as string | undefined)"
          />
          <AInputNumber
            v-else-if="item.kind === 'integer' || item.kind === 'positive'"
            :value="draft[item.key] as number | undefined"
            :min="item.kind === 'positive' ? 1 : -2147483648"
            :max="2147483647"
            :step="1"
            :aria-label="item.label"
            style="width: 100%"
            @update:value="update(item, $event)"
          />
          <AInput.TextArea
            v-else-if="item.kind === 'textarea'"
            :value="draft[item.key] as string | undefined"
            :maxlength="500"
            :rows="2"
            :aria-label="item.label"
            @update:value="update(item, $event)"
          />
          <AInput
            v-else
            :value="draft[item.key] as string | undefined"
            :maxlength="128"
            :aria-label="item.label"
            :placeholder="`请输入${item.label}`"
            @update:value="update(item, $event)"
          />
        </AFormItem>
        <template v-if="readonly"
          ><AFormItem label="创建时间">{{
            draft.createdTime ? formatDateTime(String(draft.createdTime)) : '—'
          }}</AFormItem
          ><AFormItem label="更新时间">{{
            draft.updatedTime ? formatDateTime(String(draft.updatedTime)) : '—'
          }}</AFormItem></template
        >
      </AForm>
    </template>
    <template #footer
      ><AButton :disabled="saving" @click="close">{{ readonly ? '关闭' : '取消' }}</AButton
      ><AButton
        v-if="!readonly"
        type="primary"
        :loading="saving"
        :disabled="loading || !!loadError || conflict"
        @click="save"
        >保存</AButton
      ></template
    >
  </AModal>
</template>
<style scoped>
.editor-form {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  column-gap: 16px;
}
.editor-form :deep(.ant-form-item) {
  margin-bottom: 12px;
}
.editor-form :deep(.ant-form-item-label) {
  padding-bottom: 5px;
}
.wide {
  grid-column: 1 / -1;
}
.editor-alert {
  margin-bottom: 12px;
}
</style>
