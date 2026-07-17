<script setup lang="ts">
defineOptions({ name: 'CodeRuleManagementView' })

import {
  Button as AButton,
  Form as AForm,
  FormItem as AFormItem,
  Input as AInput,
  InputNumber as AInputNumber,
  Modal as AModal,
  Popconfirm as APopconfirm,
  Select as ASelect,
  Switch as ASwitch,
  Tag as ATag,
  Textarea as ATextarea,
  Modal,
  message,
  type FormInstance,
  type FormProps,
  type TableColumnsType,
  type TablePaginationConfig,
  type TableProps,
} from 'ant-design-vue'
import { computed, nextTick, reactive, ref } from 'vue'

import {
  batchDeleteCodeRules,
  createCodeRule,
  deleteCodeRule,
  generateNextCode,
  pageCodeRules,
  previewCode,
  updateCodeRule,
  type CodePreviewResponse,
  type CodeRuleRequest,
  type SysCodeRule,
} from '@/api/code-rule'
import { getErrorMessage } from '@/api/http'
import ResizableTable from '@/components/common/ResizableTable.vue'
import { formatDateTime } from '@/utils/date'

type CodeRuleForm = {
  ruleCode: string
  ruleName: string
  prefix?: string
  datePattern?: string
  separator?: string
  sequenceLength: number
  sequenceStart: number
  sequenceStep: number
  resetScope: string
  status: number
  remark?: string
}

const statusOptions = [
  { label: '启用', value: 1 },
  { label: '停用', value: 0 },
]
const resetOptions = [
  { label: '不重置', value: 'NONE' },
  { label: '每天', value: 'DAILY' },
  { label: '每月', value: 'MONTHLY' },
  { label: '每年', value: 'YEARLY' },
]
const resetLabels: Record<string, string> = Object.fromEntries(
  resetOptions.map((item) => [item.value, item.label]),
)

const keyword = ref('')
const status = ref<number>()
const records = ref<SysCodeRule[]>([])
const loading = ref(false)
const currentPage = ref(1)
const pageSize = ref(20)
const total = ref(0)
const selectedIds = ref<number[]>([])
const modalOpen = ref(false)
const submitting = ref(false)
const editingId = ref<number>()
const deletingId = ref<number>()
const formRef = ref<FormInstance>()
const resultOpen = ref(false)
const resultLoadingCode = ref<string>()
const resultMode = ref<'preview' | 'next'>('preview')
const codeResult = ref<CodePreviewResponse>()

const columns: TableColumnsType = [
  { title: '规则名称', dataIndex: 'ruleName', key: 'ruleName', width: 155 },
  { title: '规则编码', dataIndex: 'ruleCode', key: 'ruleCode', width: 175 },
  { title: '编码格式', key: 'format', width: 270 },
  { title: '重置周期', dataIndex: 'resetScope', key: 'resetScope', width: 100, align: 'center' },
  { title: '起始值', dataIndex: 'sequenceStart', key: 'sequenceStart', width: 90, align: 'right' },
  { title: '步长', dataIndex: 'sequenceStep', key: 'sequenceStep', width: 72, align: 'right' },
  { title: '状态', dataIndex: 'status', key: 'status', width: 86, align: 'center' },
  { title: '更新时间', dataIndex: 'updatedTime', key: 'updatedTime', width: 155 },
  { title: '操作', key: 'action', width: 205, align: 'center' },
]

function defaultForm(): CodeRuleForm {
  return {
    ruleCode: '',
    ruleName: '',
    prefix: undefined,
    datePattern: 'yyyyMMdd',
    separator: '',
    sequenceLength: 4,
    sequenceStart: 1,
    sequenceStep: 1,
    resetScope: 'DAILY',
    status: 1,
    remark: undefined,
  }
}

const form = reactive<CodeRuleForm>(defaultForm())
const modalTitle = computed(() => editingId.value === undefined ? '新增编码规则' : '编辑编码规则')
const resultTitle = computed(() => resultMode.value === 'preview' ? '编码预览' : '取号结果')
const pagination = computed<TablePaginationConfig>(() => ({
  current: currentPage.value,
  pageSize: pageSize.value,
  total: total.value,
  showSizeChanger: true,
  pageSizeOptions: ['10', '20', '50', '100'],
  showTotal: (count) => `共 ${count} 条`,
}))
const rowSelection = computed<TableProps<SysCodeRule>['rowSelection']>(() => ({
  selectedRowKeys: selectedIds.value,
  fixed: true,
  columnWidth: 48,
  onChange: (keys) => { selectedIds.value = keys.map(Number) },
}))
const rules: FormProps['rules'] = {
  ruleCode: [
    { required: true, message: '请输入规则编码', trigger: 'blur' },
    { pattern: /^[A-Za-z][A-Za-z0-9_-]*$/, message: '规则编码须以字母开头，仅支持字母、数字、下划线和短横线', trigger: 'blur' },
  ],
  ruleName: [{ required: true, message: '请输入规则名称', trigger: 'blur' }],
  sequenceLength: [{ required: true, message: '请输入流水号位数', trigger: 'change' }],
  sequenceStart: [{ required: true, message: '请输入起始值', trigger: 'change' }],
  sequenceStep: [{ required: true, message: '请输入步长', trigger: 'change' }],
  resetScope: [{ required: true, message: '请选择重置周期', trigger: 'change' }],
}

function clean(value?: string) {
  return value?.trim() || undefined
}

function toRequest(): CodeRuleRequest {
  return {
    ruleCode: form.ruleCode.trim(),
    ruleName: form.ruleName.trim(),
    prefix: clean(form.prefix),
    datePattern: clean(form.datePattern),
    separator: form.separator?.trim() || undefined,
    sequenceLength: form.sequenceLength,
    sequenceStart: form.sequenceStart,
    sequenceStep: form.sequenceStep,
    resetScope: form.resetScope,
    status: form.status,
    remark: clean(form.remark),
  }
}

function formatExpression(record: SysCodeRule) {
  const separator = record.codeSeparator || ''
  const parts = [record.prefix, record.datePattern, `{流水号:${record.sequenceLength || 1}位}`].filter(Boolean)
  return parts.join(separator)
}

async function load() {
  loading.value = true
  selectedIds.value = []
  try {
    const result = await pageCodeRules(currentPage.value, pageSize.value, keyword.value, status.value)
    records.value = result.records || []
    total.value = Number(result.total || 0)
    currentPage.value = Number(result.current || currentPage.value)
    pageSize.value = Number(result.size || pageSize.value)
  } catch {
    records.value = []
    total.value = 0
    message.error('编码规则数据获取失败，请稍后重试')
  } finally {
    loading.value = false
  }
}

async function search() {
  currentPage.value = 1
  await load()
}

async function resetQuery() {
  keyword.value = ''
  status.value = undefined
  currentPage.value = 1
  await load()
}

function handleTableChange(next: TablePaginationConfig) {
  const nextSize = next.pageSize || pageSize.value
  currentPage.value = nextSize === pageSize.value ? next.current || 1 : 1
  pageSize.value = nextSize
  void load()
}

function resetForm() {
  Object.assign(form, defaultForm())
  nextTick(() => formRef.value?.clearValidate())
}

function openCreate() {
  editingId.value = undefined
  resetForm()
  modalOpen.value = true
}

function openEdit(record: SysCodeRule) {
  if (record.ruleId === undefined) return
  editingId.value = record.ruleId
  Object.assign(form, defaultForm(), {
    ruleCode: record.ruleCode || '',
    ruleName: record.ruleName || '',
    prefix: record.prefix,
    datePattern: record.datePattern,
    separator: record.codeSeparator,
    sequenceLength: record.sequenceLength ?? 4,
    sequenceStart: record.sequenceStart ?? 1,
    sequenceStep: record.sequenceStep ?? 1,
    resetScope: record.resetScope || 'NONE',
    status: record.status === 0 ? 0 : 1,
    remark: record.remark,
  })
  modalOpen.value = true
  nextTick(() => formRef.value?.clearValidate())
}

async function submit() {
  try {
    await formRef.value?.validate()
  } catch {
    return
  }
  submitting.value = true
  try {
    if (editingId.value === undefined) {
      await createCodeRule(toRequest())
      message.success('编码规则已新增')
    } else {
      await updateCodeRule(editingId.value, toRequest())
      message.success('编码规则已更新')
    }
    modalOpen.value = false
    await load()
  } catch (error) {
    message.error(getErrorMessage(error))
  } finally {
    submitting.value = false
  }
}

async function remove(record: SysCodeRule) {
  if (record.ruleId === undefined) return
  deletingId.value = record.ruleId
  try {
    await deleteCodeRule(record.ruleId)
    if (records.value.length === 1 && currentPage.value > 1) currentPage.value -= 1
    message.success('编码规则已删除')
    await load()
  } catch (error) {
    message.error(getErrorMessage(error))
  } finally {
    deletingId.value = undefined
  }
}

function removeSelected() {
  Modal.confirm({
    title: `确认删除选中的 ${selectedIds.value.length} 条编码规则？`,
    content: '删除后依赖这些规则的取号业务将无法继续使用。',
    okText: '删除',
    cancelText: '取消',
    onOk: async () => {
      try {
        await batchDeleteCodeRules(selectedIds.value)
        selectedIds.value = []
        message.success('编码规则已批量删除')
        await load()
      } catch (error) {
        message.error(getErrorMessage(error))
        throw error
      }
    },
  })
}

async function runPreview(record: SysCodeRule) {
  if (!record.ruleCode) return
  resultLoadingCode.value = `preview:${record.ruleCode}`
  try {
    resultMode.value = 'preview'
    codeResult.value = await previewCode(record.ruleCode)
    resultOpen.value = true
  } catch (error) {
    message.error(getErrorMessage(error))
  } finally {
    resultLoadingCode.value = undefined
  }
}

function takeNext(record: SysCodeRule) {
  if (!record.ruleCode) return
  Modal.confirm({
    title: `确认按“${record.ruleName || record.ruleCode}”取下一个编码？`,
    content: '该操作会推进服务端流水号，不能通过关闭弹窗撤销。',
    okText: '确认取号',
    cancelText: '取消',
    onOk: async () => {
      resultLoadingCode.value = `next:${record.ruleCode}`
      try {
        resultMode.value = 'next'
        codeResult.value = await generateNextCode(record.ruleCode!)
        resultOpen.value = true
      } catch (error) {
        message.error(getErrorMessage(error))
        throw error
      } finally {
        resultLoadingCode.value = undefined
      }
    },
  })
}

load()
</script>

<template>
  <main class="management-page">
    <section class="query-panel">
      <div class="query-fields">
        <a-input
          v-model:value="keyword"
          allow-clear
          placeholder="请输入规则名称或规则编码"
          @press-enter="search"
        />
        <a-select v-model:value="status" allow-clear placeholder="全部状态" :options="statusOptions" />
      </div>
      <div class="query-actions">
        <a-button type="primary" :loading="loading" @click="search">查询</a-button>
        <a-button class="secondary-action" :disabled="loading" @click="resetQuery">重置</a-button>
        <a-button class="secondary-action" :disabled="loading" @click="load">刷新</a-button>
      </div>
    </section>

    <section class="table-panel">
      <header class="table-toolbar">
        <h1>编码规则</h1>
        <div class="toolbar-actions">
          <a-button v-if="selectedIds.length" danger class="secondary-action" @click="removeSelected">
            批量删除（{{ selectedIds.length }}）
          </a-button>
          <a-button type="primary" @click="openCreate">新增规则</a-button>
        </div>
      </header>

      <ResizableTable
        class="code-rule-table"
        row-key="ruleId"
        size="middle"
        table-layout="fixed"
        :columns="columns"
        :data-source="records"
        :loading="loading"
        :pagination="pagination"
        :row-selection="rowSelection"
        @change="handleTableChange"
      >
        <template #bodyCell="{ column, record }">
          <template v-if="column.key === 'ruleName'">
            <strong>{{ record.ruleName || '—' }}</strong>
          </template>
          <template v-else-if="column.key === 'ruleCode'">
            <code class="rule-code">{{ record.ruleCode || '—' }}</code>
          </template>
          <template v-else-if="column.key === 'format'">
            <code class="format-code" :title="formatExpression(record)">{{ formatExpression(record) }}</code>
          </template>
          <template v-else-if="column.key === 'resetScope'">
            <a-tag>{{ resetLabels[record.resetScope] || record.resetScope || '不重置' }}</a-tag>
          </template>
          <template v-else-if="column.key === 'status'">
            <span class="status-cell" :class="{ disabled: record.status === 0 }">
              <i />{{ record.status === 0 ? '停用' : '启用' }}
            </span>
          </template>
          <template v-else-if="column.key === 'updatedTime'">
            <span class="cell-text">{{ formatDateTime(record.updatedTime) }}</span>
          </template>
          <template v-else-if="column.key === 'action'">
            <div class="row-actions">
              <a-button
                type="link"
                size="small"
                :loading="resultLoadingCode === `preview:${record.ruleCode}`"
                @click="runPreview(record)"
              >预览</a-button>
              <a-button
                type="link"
                size="small"
                :disabled="record.status === 0"
                :loading="resultLoadingCode === `next:${record.ruleCode}`"
                @click="takeNext(record)"
              >取号</a-button>
              <a-button type="link" size="small" @click="openEdit(record)">编辑</a-button>
              <a-popconfirm
                title="确认删除该编码规则？"
                description="删除后依赖该规则的取号业务将无法继续使用。"
                ok-text="删除"
                cancel-text="取消"
                @confirm="remove(record)"
              >
                <a-button type="link" danger size="small" :loading="deletingId === record.ruleId">删除</a-button>
              </a-popconfirm>
            </div>
          </template>
        </template>
        <template #emptyText><div class="empty-table">暂无符合条件的编码规则</div></template>
      </ResizableTable>
    </section>

    <a-modal
      v-model:open="modalOpen"
      :title="modalTitle"
      :width="820"
      :confirm-loading="submitting"
      :mask-closable="false"
      ok-text="保存"
      cancel-text="取消"
      @ok="submit"
    >
      <a-form ref="formRef" class="rule-form" layout="vertical" :model="form" :rules="rules">
        <div class="form-grid">
          <a-form-item label="规则名称" name="ruleName">
            <a-input v-model:value="form.ruleName" :maxlength="128" placeholder="请输入规则名称" />
          </a-form-item>
          <a-form-item label="规则编码" name="ruleCode">
            <a-input
              v-model:value="form.ruleCode"
              :disabled="editingId !== undefined"
              :maxlength="64"
              placeholder="例如 ORDER_NO"
            />
          </a-form-item>
          <a-form-item label="固定前缀" name="prefix">
            <a-input v-model:value="form.prefix" :maxlength="32" placeholder="例如 ORD" />
          </a-form-item>
          <a-form-item label="日期格式" name="datePattern">
            <a-input v-model:value="form.datePattern" :maxlength="32" placeholder="例如 yyyyMMdd" />
          </a-form-item>
          <a-form-item label="分隔符" name="separator">
            <a-input v-model:value="form.separator" :maxlength="8" placeholder="例如 -" />
          </a-form-item>
          <a-form-item label="重置周期" name="resetScope">
            <a-select v-model:value="form.resetScope" :options="resetOptions" />
          </a-form-item>
          <a-form-item label="流水号位数" name="sequenceLength">
            <a-input-number v-model:value="form.sequenceLength" :min="1" :max="16" :precision="0" />
          </a-form-item>
          <a-form-item label="起始值" name="sequenceStart">
            <a-input-number v-model:value="form.sequenceStart" :min="0" :precision="0" />
          </a-form-item>
          <a-form-item label="递增步长" name="sequenceStep">
            <a-input-number v-model:value="form.sequenceStep" :min="1" :precision="0" />
          </a-form-item>
          <a-form-item label="启用状态" name="status">
            <div class="switch-field">
              <a-switch v-model:checked="form.status" :checked-value="1" :un-checked-value="0" />
              <span>{{ form.status === 1 ? '已启用' : '已停用' }}</span>
            </div>
          </a-form-item>
          <a-form-item class="full-field" label="备注" name="remark">
            <a-textarea v-model:value="form.remark" :rows="3" :maxlength="255" placeholder="请输入备注信息" />
          </a-form-item>
        </div>
      </a-form>
    </a-modal>

    <a-modal v-model:open="resultOpen" :title="resultTitle" :width="520" :footer="null">
      <div class="result-panel">
        <span>生成编码</span>
        <code>{{ codeResult?.code || '—' }}</code>
        <dl>
          <div><dt>规则编码</dt><dd>{{ codeResult?.ruleCode || '—' }}</dd></div>
          <div><dt>序列键</dt><dd>{{ codeResult?.sequenceKey || '—' }}</dd></div>
          <div><dt>流水值</dt><dd>{{ codeResult?.nextValue ?? '—' }}</dd></div>
        </dl>
      </div>
    </a-modal>
  </main>
</template>

<style scoped>
.query-panel { display: flex; align-items: center; justify-content: space-between; gap: 18px; padding: 11px 13px; border: 1px solid var(--shell-border); background: var(--shell-panel); }
.query-fields { display: grid; width: min(660px, 64%); grid-template-columns: minmax(280px, 1fr) 140px; gap: 8px; }
.query-actions, .toolbar-actions { display: flex; gap: 7px; }
.query-actions :deep(.ant-btn) { min-width: 58px; }
.secondary-action { color: var(--shell-ink); background: var(--shell-hover); }
.secondary-action:hover { color: var(--brand) !important; background: color-mix(in srgb, var(--brand) 11%, var(--shell-panel)) !important; }
.table-panel { margin-top: 8px; border: 1px solid var(--shell-border); background: var(--shell-panel); }
.table-toolbar { display: flex; min-height: 58px; align-items: center; justify-content: space-between; padding: 9px 13px; border-bottom: 1px solid var(--shell-border); }
.table-toolbar h1 { margin: 0; color: var(--shell-ink); font-size: 18px; font-weight: 600; }
.code-rule-table :deep(.ant-table) { color: var(--shell-ink); background: var(--shell-panel); }
.code-rule-table :deep(.ant-table-thead > tr > th) { padding-block: 9px; color: var(--shell-muted); font-size: 13px; font-weight: 600; background: var(--shell-hover); }
.code-rule-table :deep(.ant-table-tbody > tr > td) { padding-block: 8px; }
.code-rule-table :deep(.ant-table-tbody > tr:hover > td) { background: color-mix(in srgb, var(--brand) 7%, var(--shell-panel)); }
.code-rule-table :deep(.ant-pagination) { margin: 13px; }
.rule-code, .format-code { color: var(--brand-deep); font-family: 'SFMono-Regular', Consolas, monospace; font-size: 13px; }
.format-code { display: block; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.cell-text { color: var(--shell-muted); white-space: nowrap; }
.status-cell { display: inline-flex; align-items: center; gap: 6px; }
.status-cell i { width: 7px; height: 7px; border-radius: 50%; background: #26aa80; }
.status-cell.disabled i { background: #a8b0b0; }
.row-actions { display: flex; align-items: center; justify-content: center; white-space: nowrap; }
.row-actions :deep(.ant-btn) { padding-inline: 4px; }
.empty-table { display: flex; min-height: 180px; align-items: center; justify-content: center; color: var(--shell-muted); }
.rule-form { padding-top: 8px; }
.form-grid { display: grid; column-gap: 18px; grid-template-columns: repeat(2, minmax(0, 1fr)); }
.form-grid :deep(.ant-form-item) { margin-bottom: 14px; }
.form-grid :deep(.ant-input-number) { width: 100%; }
.full-field { grid-column: 1 / -1; }
.switch-field { display: flex; min-height: 34px; align-items: center; gap: 9px; color: var(--shell-muted); }
.result-panel { padding: 12px 4px 4px; }
.result-panel > span { color: var(--shell-muted); font-size: 13px; }
.result-panel > code { display: block; margin-top: 8px; padding: 16px; overflow-wrap: anywhere; color: var(--brand-deep); background: var(--shell-hover); font-family: 'SFMono-Regular', Consolas, monospace; font-size: 22px; font-weight: 600; }
.result-panel dl { display: grid; margin: 16px 0 0; grid-template-columns: repeat(3, minmax(0, 1fr)); }
.result-panel dl div { padding-inline: 12px; border-right: 1px solid var(--shell-border); }
.result-panel dl div:first-child { padding-left: 0; }
.result-panel dl div:last-child { border-right: 0; }
.result-panel dt { color: var(--shell-muted); font-size: 12px; }
.result-panel dd { margin: 5px 0 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
</style>
