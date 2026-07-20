<script setup lang="ts">
defineOptions({ name: 'DepartmentManagementView' })

import { ApartmentOutlined } from '@ant-design/icons-vue'
import {
  Button as AButton,
  Form as AForm,
  FormItem as AFormItem,
  Input as AInput,
  InputNumber as AInputNumber,
  Modal as AModal,
  Popconfirm as APopconfirm,
  Spin as ASpin,
  Switch as ASwitch,
  Textarea as ATextarea,
  TreeSelect as ATreeSelect,
  message,
  type FormInstance,
  type FormProps,
  type TableColumnsType,
} from 'ant-design-vue'
import { computed, nextTick, reactive, ref } from 'vue'

import {
  createDept,
  deleteDept,
  getDept,
  listDeptTree,
  updateDept,
  type DeptRequest,
  type SysDept,
} from '@/api/dept'
import { getErrorMessage } from '@/api/http'
import ResizableTable from '@/components/common/ResizableTable.vue'
import { useUnsavedChanges } from '@/composables/use-unsaved-changes'
import { createLatestRequest } from '@/utils/latest-request'

import { collectExpandableDeptIds, normalizeDeptTree, toDeptOptions, type DeptNode } from './tree'

type DeptForm = DeptRequest & { deptId?: number }

const keyword = ref('')
const records = ref<DeptNode[]>([])
const candidateTree = ref<DeptNode[]>([])
const loading = ref(false)
const runLatestLoad = createLatestRequest(loading)
const expandedKeys = ref<number[]>([])
const modalOpen = ref(false)
const modalLoading = ref(false)
const submitting = ref(false)
const deletingId = ref<number>()
const editingId = ref<number>()
const formRef = ref<FormInstance>()

const columns: TableColumnsType = [
  { title: '部门名称', dataIndex: 'deptName', key: 'deptName', width: 145 },
  { title: '部门编码', dataIndex: 'deptCode', key: 'deptCode', width: 85 },
  { title: '负责人', dataIndex: 'leader', key: 'leader', width: 70 },
  { title: '联系电话', dataIndex: 'phone', key: 'phone', width: 95 },
  { title: '邮箱', dataIndex: 'email', key: 'email', width: 110 },
  { title: '排序', dataIndex: 'sortNo', key: 'sortNo', width: 56, align: 'center' },
  { title: '状态', dataIndex: 'status', key: 'status', width: 60, align: 'center' },
  { title: '操作', key: 'action', width: 160, align: 'center' },
]

function defaultForm(parentId?: number): DeptForm {
  return {
    deptId: undefined,
    parentId,
    deptCode: '',
    deptName: '',
    leader: undefined,
    phone: undefined,
    email: undefined,
    sortNo: 0,
    status: 1,
    remark: undefined,
  }
}

const form = reactive<DeptForm>(defaultForm())
const { markClean: markFormClean, requestClose: requestFormClose } = useUnsavedChanges(form, modalOpen)
const modalTitle = computed(() => editingId.value === undefined ? '新增部门' : '编辑部门')
const parentOptions = computed(() => toDeptOptions(candidateTree.value, editingId.value))
const expandableIds = computed(() => collectExpandableDeptIds(records.value))
const allExpanded = computed(() =>
  expandableIds.value.length > 0 && expandableIds.value.every((id) => expandedKeys.value.includes(id)),
)

const rules: FormProps['rules'] = {
  deptCode: [
    { required: true, message: '请输入部门编码', trigger: 'blur' },
    { max: 64, message: '部门编码不能超过 64 个字符', trigger: 'blur' },
  ],
  deptName: [
    { required: true, message: '请输入部门名称', trigger: 'blur' },
    { max: 128, message: '部门名称不能超过 128 个字符', trigger: 'blur' },
  ],
  email: [{ type: 'email', message: '请输入有效的邮箱地址', trigger: 'blur' }],
}

async function load() {
  try {
    const result = await runLatestLoad(() => listDeptTree(keyword.value))
    if (!result) return
    records.value = normalizeDeptTree(result)
    expandedKeys.value = collectExpandableDeptIds(records.value)
  } catch {
    message.error('数据获取失败，请稍后重试')
  }
}

function toggleAllRows() {
  expandedKeys.value = allExpanded.value ? [] : expandableIds.value
}

async function resetQuery() {
  keyword.value = ''
  await load()
}

function resetForm(parentId?: number) {
  Object.assign(form, defaultForm(parentId))
  nextTick(() => formRef.value?.clearValidate())
}

async function refreshModalData(deptId?: number) {
  modalLoading.value = true
  try {
    const [tree, detail] = await Promise.all([
      listDeptTree(),
      deptId === undefined ? Promise.resolve(undefined) : getDept(deptId),
    ])
    candidateTree.value = normalizeDeptTree(tree)
    if (detail) {
      Object.assign(form, defaultForm(), detail, { deptId })
      markFormClean()
    }
  } catch {
    message.error('部门数据获取失败，请稍后重试')
  } finally {
    modalLoading.value = false
  }
}

function openCreate(parent?: SysDept) {
  editingId.value = undefined
  candidateTree.value = records.value
  resetForm(parent?.deptId)
  modalOpen.value = true
  void refreshModalData()
}

function openEdit(record: SysDept) {
  if (record.deptId === undefined) return
  editingId.value = record.deptId
  candidateTree.value = records.value
  Object.assign(form, defaultForm(), record, { deptId: record.deptId })
  modalOpen.value = true
  nextTick(() => formRef.value?.clearValidate())
  void refreshModalData(record.deptId)
}

function clean(value?: string) {
  return value?.trim() || undefined
}

function toRequest(): DeptRequest {
  return {
    parentId: form.parentId ?? 0,
    deptCode: form.deptCode.trim(),
    deptName: form.deptName.trim(),
    leader: clean(form.leader),
    phone: clean(form.phone),
    email: clean(form.email),
    sortNo: form.sortNo ?? 0,
    status: form.status ?? 1,
    remark: clean(form.remark),
  }
}

async function submit() {
  if (modalLoading.value) return
  try {
    await formRef.value?.validate()
  } catch {
    return
  }

  submitting.value = true
  try {
    const request = toRequest()
    if (editingId.value === undefined) {
      await createDept(request)
      message.success('部门已新增')
    } else {
      await updateDept(editingId.value, request)
      message.success('部门已更新')
    }
    modalOpen.value = false
    await load()
  } catch (error) {
    message.error(getErrorMessage(error))
  } finally {
    submitting.value = false
  }
}

async function remove(record: SysDept) {
  if (record.deptId === undefined) return
  deletingId.value = record.deptId
  try {
    await deleteDept(record.deptId)
    message.success('部门已删除')
    await load()
  } catch (error) {
    message.error(getErrorMessage(error))
  } finally {
    deletingId.value = undefined
  }
}

load()
</script>

<template>
  <main class="management-page">
    <section class="query-panel">
      <div class="query-field">
        <a-input
          v-model:value="keyword"
          allow-clear
          placeholder="请输入部门名称、编码或负责人"
          @press-enter="load"
        />
      </div>
      <div class="query-actions">
        <a-button type="primary" :loading="loading" @click="load">查询</a-button>
        <a-button class="secondary-action" :disabled="loading" @click="resetQuery">重置</a-button>
        <a-button class="secondary-action" :disabled="loading" @click="load">刷新</a-button>
      </div>
    </section>

    <section class="table-panel">
      <header class="table-toolbar">
        <div class="table-title">
          <h1>组织架构</h1>
          <a-button type="primary" :disabled="!expandableIds.length" @click="toggleAllRows">
            {{ allExpanded ? '全部收起' : '全部展开' }}
          </a-button>
        </div>
        <a-button type="primary" @click="openCreate()">新增部门</a-button>
      </header>

      <ResizableTable
        v-model:expanded-row-keys="expandedKeys"
        class="dept-table"
        row-key="deptId"
        size="middle"
        table-layout="fixed"
        :columns="columns"
        :data-source="records"
        :loading="loading"
        :pagination="false"
      >
        <template #bodyCell="{ column, record }">
          <template v-if="column.key === 'deptName'">
            <div class="dept-name"><span>{{ record.deptName || '未命名部门' }}</span></div>
          </template>
          <template v-else-if="['deptCode', 'leader', 'phone', 'email'].includes(String(column.key))">
            <span v-if="record[column.key]" class="cell-text">{{ record[column.key] }}</span>
            <span v-else class="empty-value">—</span>
          </template>
          <template v-else-if="column.key === 'status'">
            <span class="status-dot" :class="{ disabled: record.status !== 1 }"></span>
            {{ record.status === 1 ? '启用' : '禁用' }}
          </template>
          <template v-else-if="column.key === 'action'">
            <div class="row-actions">
              <a-button type="link" size="small" @click="openCreate(record)">新增下级</a-button>
              <a-button type="link" size="small" @click="openEdit(record)">编辑</a-button>
              <a-popconfirm
                title="确认删除该部门？"
                description="存在子部门或关联用户时，后端将拒绝删除。"
                ok-text="删除"
                cancel-text="取消"
                @confirm="remove(record)"
              >
                <a-button type="link" danger size="small" :loading="deletingId === record.deptId">删除</a-button>
              </a-popconfirm>
            </div>
          </template>
        </template>
        <template #emptyText>
          <div class="empty-table"><ApartmentOutlined /><span>暂无符合条件的部门</span></div>
        </template>
      </ResizableTable>
    </section>

    <a-modal
      :open="modalOpen"
      :title="modalTitle"
      :width="800"
      :confirm-loading="submitting"
      :mask-closable="false"
      ok-text="保存"
      cancel-text="取消"
      @ok="submit"
      @cancel="requestFormClose"
    >
      <a-spin :spinning="modalLoading">
        <a-form ref="formRef" class="dept-form" layout="vertical" :model="form" :rules="rules">
          <div class="form-grid">
            <a-form-item label="上级部门" name="parentId">
              <a-tree-select
                v-model:value="form.parentId"
                allow-clear
                tree-default-expand-all
                placeholder="不选择则为顶级部门"
                :tree-data="parentOptions"
              />
            </a-form-item>
            <a-form-item label="部门编码" name="deptCode">
              <a-input v-model:value="form.deptCode" :maxlength="64" placeholder="请输入部门编码" />
            </a-form-item>
            <a-form-item label="部门名称" name="deptName">
              <a-input v-model:value="form.deptName" :maxlength="128" placeholder="请输入部门名称" />
            </a-form-item>
            <a-form-item label="负责人" name="leader">
              <a-input v-model:value="form.leader" :maxlength="64" placeholder="请输入负责人姓名" />
            </a-form-item>
            <a-form-item label="联系电话" name="phone">
              <a-input v-model:value="form.phone" :maxlength="32" placeholder="请输入联系电话" />
            </a-form-item>
            <a-form-item label="邮箱" name="email">
              <a-input v-model:value="form.email" :maxlength="128" placeholder="请输入邮箱地址" />
            </a-form-item>
            <a-form-item label="排序号" name="sortNo">
              <a-input-number v-model:value="form.sortNo" :min="0" :max="9999" :precision="0" />
            </a-form-item>
            <a-form-item label="启用状态" name="status">
              <div class="switch-field">
                <a-switch v-model:checked="form.status" :checked-value="1" :un-checked-value="0" />
                <span>{{ form.status === 1 ? '已启用' : '已禁用' }}</span>
              </div>
            </a-form-item>
            <a-form-item class="full-field" label="备注" name="remark">
              <a-textarea v-model:value="form.remark" :rows="3" :maxlength="255" placeholder="请输入备注信息" />
            </a-form-item>
          </div>
        </a-form>
      </a-spin>
    </a-modal>
  </main>
</template>

<style scoped>
.query-field { width: min(520px, 58%); }
.table-title { display: flex; align-items: center; gap: 7px; }
.dept-table :deep(.ant-table) { color: var(--shell-ink); background: var(--shell-panel); }
.dept-table :deep(.ant-table-thead > tr > th) { padding-block: 9px; color: var(--shell-muted); font-size: 13px; font-weight: 600; background: var(--shell-hover); }
.dept-table :deep(.ant-table-tbody > tr > td) { padding-block: 8px; }
.dept-table :deep(.ant-table-tbody > tr:hover > td) { background: color-mix(in srgb, var(--brand) 7%, var(--shell-panel)); }
.dept-name { display: flex; min-width: 0; align-items: center; gap: 8px; font-weight: 500; }
.dept-name span, .cell-text { display: block; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.cell-text { color: var(--shell-muted); }
.empty-value { color: color-mix(in srgb, var(--shell-muted) 55%, transparent); }
.status-dot { display: inline-block; width: 7px; height: 7px; margin-right: 5px; border-radius: 50%; background: #28a87d; }
.status-dot.disabled { background: #9ba8a8; }
.empty-table { display: flex; min-height: 180px; align-items: center; justify-content: center; flex-direction: column; gap: 10px; color: var(--shell-muted); }
.empty-table :deep(.anticon) { font-size: 30px; }
.dept-form { padding-top: 8px; }
.form-grid { display: grid; column-gap: 18px; grid-template-columns: repeat(2, minmax(0, 1fr)); }
.form-grid :deep(.ant-form-item) { margin-bottom: 14px; }
.form-grid :deep(.ant-input-number) { width: 100%; }
.full-field { grid-column: 1 / -1; }
.switch-field { display: flex; min-height: 34px; align-items: center; gap: 9px; color: var(--shell-muted); }
</style>
