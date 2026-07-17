<script setup lang="ts">
defineOptions({ name: 'UserManagementView' })

import { UserOutlined } from '@ant-design/icons-vue'
import {
  Button as AButton,
  Form as AForm,
  FormItem as AFormItem,
  Input as AInput,
  InputPassword as AInputPassword,
  Modal as AModal,
  Popconfirm as APopconfirm,
  Select as ASelect,
  Spin as ASpin,
  Switch as ASwitch,
  Textarea as ATextarea,
  TreeSelect as ATreeSelect,
  message,
  type FormInstance,
  type FormProps,
  type TableColumnsType,
  type TablePaginationConfig,
} from 'ant-design-vue'
import { computed, nextTick, reactive, ref } from 'vue'

import { listDeptTree } from '@/api/dept'
import { getErrorMessage } from '@/api/http'
import { pageRoles, type SysRole } from '@/api/role'
import {
  createUser,
  deleteUser,
  pageUsers,
  resetUserPassword,
  updateUser,
  type SysUser,
  type UserRequest,
} from '@/api/user'
import ResizableTable from '@/components/common/ResizableTable.vue'
import { formatDateTime } from '@/utils/date'

import {
  normalizeDeptTree,
  toDeptOptions,
  type DeptNode,
} from '../dept/tree'
import { getUserDepartmentText, getUserRoleIds, getUserRoleText } from './relations'

type UserForm = UserRequest & { userId?: number }
type PasswordForm = { newPassword: string; confirmPassword: string }

const keyword = ref('')
const records = ref<SysUser[]>([])
const loading = ref(false)
const currentPage = ref(1)
const pageSize = ref(20)
const total = ref(0)
const deptTree = ref<DeptNode[]>([])
const roles = ref<SysRole[]>([])
const modalOpen = ref(false)
const modalLoading = ref(false)
const submitting = ref(false)
const editingId = ref<number>()
const deletingId = ref<number>()
const statusUpdatingId = ref<number>()
const formRef = ref<FormInstance>()
const passwordOpen = ref(false)
const passwordSubmitting = ref(false)
const passwordUser = ref<SysUser>()
const passwordFormRef = ref<FormInstance>()

const columns: TableColumnsType = [
  { title: '用户姓名', dataIndex: 'realName', key: 'realName', width: 120 },
  { title: '登录账号', dataIndex: 'username', key: 'username', width: 125 },
  { title: '所属部门', dataIndex: 'deptId', key: 'deptId', width: 125 },
  { title: '用户角色', key: 'roles', width: 180 },
  { title: '联系电话', dataIndex: 'phone', key: 'phone', width: 120 },
  { title: '状态', dataIndex: 'status', key: 'status', width: 85, align: 'center' },
  { title: '最后登录', dataIndex: 'lastLoginTime', key: 'lastLoginTime', width: 155 },
  { title: '操作', key: 'action', width: 200, align: 'center' },
]

function defaultForm(): UserForm {
  return {
    userId: undefined,
    username: '',
    password: undefined,
    realName: '',
    email: undefined,
    phone: undefined,
    status: 1,
    remark: undefined,
    deptId: undefined,
    roleIds: [],
  }
}

const form = reactive<UserForm>(defaultForm())
const passwordForm = reactive<PasswordForm>({ newPassword: '', confirmPassword: '' })
const modalTitle = computed(() => editingId.value === undefined ? '新增用户' : '编辑用户')
const passwordTitle = computed(() => passwordUser.value?.username
  ? `重置密码 · ${passwordUser.value.username}`
  : '重置密码')
const deptOptions = computed(() => toDeptOptions(deptTree.value))
const roleOptions = computed(() => roles.value.flatMap((role) => role.roleId === undefined ? [] : [{
  label: `${role.roleName || role.roleCode || '未命名角色'}${role.status === 1 ? '' : '（已禁用）'}`,
  value: role.roleId,
  disabled: role.status !== 1,
}]))
const pagination = computed<TablePaginationConfig>(() => ({
  current: currentPage.value,
  pageSize: pageSize.value,
  total: total.value,
  showSizeChanger: true,
  pageSizeOptions: ['10', '20', '50', '100'],
  showTotal: (count) => `共 ${count} 条`,
}))

const rules: FormProps['rules'] = {
  username: [
    { required: true, message: '请输入登录账号', trigger: 'blur' },
    { max: 64, message: '登录账号不能超过 64 个字符', trigger: 'blur' },
  ],
  realName: [
    { required: true, message: '请输入用户姓名', trigger: 'blur' },
    { max: 64, message: '用户姓名不能超过 64 个字符', trigger: 'blur' },
  ],
  password: [{
    validator: async (_rule, value?: string) => {
      if (editingId.value !== undefined && !value) return
      if (!value) throw new Error('请输入初始密码')
      if (value.length < 8 || value.length > 72) throw new Error('密码长度必须为 8 至 72 位')
    },
    trigger: 'blur',
  }],
  email: [{ type: 'email', message: '请输入有效的邮箱地址', trigger: 'blur' }],
}

const passwordRules: FormProps['rules'] = {
  newPassword: [
    { required: true, message: '请输入新密码', trigger: 'blur' },
    { min: 8, max: 72, message: '密码长度必须为 8 至 72 位', trigger: 'blur' },
  ],
  confirmPassword: [{
    validator: async (_rule, value?: string) => {
      if (!value) throw new Error('请再次输入新密码')
      if (value !== passwordForm.newPassword) throw new Error('两次输入的新密码不一致')
    },
    trigger: 'blur',
  }],
}

async function load() {
  loading.value = true
  try {
    const result = await pageUsers(currentPage.value, pageSize.value, keyword.value)
    records.value = result.records || []
    total.value = Number(result.total || 0)
    currentPage.value = Number(result.current || currentPage.value)
    pageSize.value = Number(result.size || pageSize.value)
  } catch (error) {
    records.value = []
    total.value = 0
    message.error(getErrorMessage(error))
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

async function refreshCandidates() {
  modalLoading.value = true
  try {
    const [depts, rolePage] = await Promise.all([
      listDeptTree(),
      pageRoles(1, 1000),
    ])
    deptTree.value = normalizeDeptTree(depts)
    roles.value = rolePage.records || []
  } catch {
    message.error('用户关联数据获取失败，请稍后重试')
  } finally {
    modalLoading.value = false
  }
}

function openCreate() {
  editingId.value = undefined
  resetForm()
  modalOpen.value = true
  void refreshCandidates()
}

function openEdit(record: SysUser) {
  if (record.userId === undefined) return
  editingId.value = record.userId
  Object.assign(form, defaultForm(), toRequest(record), { userId: record.userId, password: undefined })
  modalOpen.value = true
  nextTick(() => formRef.value?.clearValidate())
  void refreshCandidates()
}

function clean(value?: string) {
  return value?.trim() || undefined
}

function toRequest(source: UserForm | SysUser, status = source.status): UserRequest {
  return {
    username: source.username?.trim() || '',
    realName: source.realName?.trim() || '',
    password: 'password' in source ? clean(source.password) : undefined,
    email: clean(source.email),
    phone: clean(source.phone),
    status: status ?? 1,
    remark: clean(source.remark),
    deptId: source.deptId,
    roleIds: 'roles' in source ? getUserRoleIds(source) : source.roleIds,
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
    if (editingId.value === undefined) {
      await createUser(toRequest(form))
      message.success('用户已新增')
    } else {
      await updateUser(editingId.value, toRequest(form))
      message.success('用户已更新')
    }
    modalOpen.value = false
    await load()
  } catch (error) {
    message.error(getErrorMessage(error))
  } finally {
    submitting.value = false
  }
}

async function changeStatus(record: SysUser, checked: boolean) {
  if (record.userId === undefined) return
  statusUpdatingId.value = record.userId
  try {
    const nextStatus = checked ? 1 : 0
    await updateUser(record.userId, toRequest(record, nextStatus))
    record.status = nextStatus
    message.success(checked ? '用户已启用' : '用户已禁用')
  } catch (error) {
    message.error(getErrorMessage(error))
  } finally {
    statusUpdatingId.value = undefined
  }
}

async function remove(record: SysUser) {
  if (record.userId === undefined) return
  deletingId.value = record.userId
  try {
    await deleteUser(record.userId)
    if (records.value.length === 1 && currentPage.value > 1) currentPage.value -= 1
    message.success('用户已删除')
    await load()
  } catch (error) {
    message.error(getErrorMessage(error))
  } finally {
    deletingId.value = undefined
  }
}

function openPasswordReset(record: SysUser) {
  if (record.userId === undefined) return
  passwordUser.value = record
  Object.assign(passwordForm, { newPassword: '', confirmPassword: '' })
  passwordOpen.value = true
  nextTick(() => passwordFormRef.value?.clearValidate())
}

async function submitPasswordReset() {
  const userId = passwordUser.value?.userId
  if (userId === undefined) return
  try {
    await passwordFormRef.value?.validate()
  } catch {
    return
  }

  passwordSubmitting.value = true
  try {
    await resetUserPassword(userId, passwordForm.newPassword)
    message.success('密码已重置')
    passwordOpen.value = false
  } catch (error) {
    message.error(getErrorMessage(error))
  } finally {
    passwordSubmitting.value = false
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
          placeholder="请输入用户姓名、登录账号、手机或邮箱"
          @press-enter="search"
        />
      </div>
      <div class="query-actions">
        <a-button type="primary" :loading="loading" @click="search">查询</a-button>
        <a-button class="secondary-action" :disabled="loading" @click="resetQuery">重置</a-button>
        <a-button class="secondary-action" :disabled="loading" @click="load">刷新</a-button>
      </div>
    </section>

    <section class="table-panel">
      <header class="table-toolbar">
        <h1>用户列表</h1>
        <a-button type="primary" @click="openCreate">新增用户</a-button>
      </header>

      <ResizableTable
        class="user-table"
        row-key="userId"
        size="middle"
        table-layout="fixed"
        :columns="columns"
        :data-source="records"
        :loading="loading"
        :pagination="pagination"
        @change="handleTableChange"
      >
        <template #bodyCell="{ column, record }">
          <template v-if="column.key === 'realName'">
            <strong class="user-name">{{ record.realName || '未命名用户' }}</strong>
          </template>
          <template v-else-if="column.key === 'username'">
            <code class="username">{{ record.username || '—' }}</code>
          </template>
          <template v-else-if="column.key === 'deptId'">
            <span v-if="getUserDepartmentText(record)" class="cell-text" :title="record.department?.deptCode">
              {{ getUserDepartmentText(record) }}
            </span>
            <span v-else class="empty-value">未分配</span>
          </template>
          <template v-else-if="column.key === 'roles'">
            <span v-if="getUserRoleText(record)" class="cell-text" :title="getUserRoleText(record)">
              {{ getUserRoleText(record) }}
            </span>
            <span v-else class="empty-value">未分配</span>
          </template>
          <template v-else-if="column.key === 'phone'">
            <span v-if="record[column.key]" class="cell-text">{{ record[column.key] }}</span>
            <span v-else class="empty-value">—</span>
          </template>
          <template v-else-if="column.key === 'status'">
            <a-switch
              :checked="record.status === 1"
              :loading="statusUpdatingId === record.userId"
              checked-children="启用"
              un-checked-children="禁用"
              @change="(checked) => changeStatus(record, Boolean(checked))"
            />
          </template>
          <template v-else-if="column.key === 'lastLoginTime'">
            <span class="cell-text">{{ formatDateTime(record.lastLoginTime) }}</span>
          </template>
          <template v-else-if="column.key === 'action'">
            <div class="row-actions">
              <a-button type="link" size="small" @click="openEdit(record)">编辑</a-button>
              <a-button type="link" size="small" @click="openPasswordReset(record)">重置密码</a-button>
              <a-popconfirm
                title="确认删除该用户？"
                description="删除后该用户将无法登录，且无法恢复。"
                ok-text="删除"
                cancel-text="取消"
                @confirm="remove(record)"
              >
                <a-button type="link" danger size="small" :loading="deletingId === record.userId">删除</a-button>
              </a-popconfirm>
            </div>
          </template>
        </template>
        <template #emptyText>
          <div class="empty-table"><UserOutlined /><span>暂无符合条件的用户</span></div>
        </template>
      </ResizableTable>
    </section>

    <a-modal
      v-model:open="modalOpen"
      :title="modalTitle"
      :width="860"
      :confirm-loading="submitting"
      :mask-closable="false"
      ok-text="保存"
      cancel-text="取消"
      @ok="submit"
    >
      <a-spin :spinning="modalLoading">
        <a-form ref="formRef" class="user-form" layout="vertical" :model="form" :rules="rules">
          <div class="form-grid">
            <a-form-item label="登录账号" name="username">
              <a-input v-model:value="form.username" :maxlength="64" autocomplete="username" placeholder="请输入登录账号" />
            </a-form-item>
            <a-form-item label="用户姓名" name="realName">
              <a-input v-model:value="form.realName" :maxlength="64" placeholder="请输入用户姓名" />
            </a-form-item>
            <a-form-item label="初始密码" name="password" extra="8 至 72 位">
              <a-input-password
                v-model:value="form.password"
                autocomplete="new-password"
                :disabled="editingId !== undefined"
                placeholder="请输入初始密码"
              />
            </a-form-item>
            <a-form-item label="所属部门" name="deptId">
              <a-tree-select
                v-model:value="form.deptId"
                allow-clear
                show-search
                tree-default-expand-all
                tree-node-filter-prop="title"
                placeholder="请选择所属部门"
                :tree-data="deptOptions"
              />
            </a-form-item>
            <a-form-item label="联系电话" name="phone">
              <a-input v-model:value="form.phone" :maxlength="32" placeholder="请输入联系电话" />
            </a-form-item>
            <a-form-item label="邮箱" name="email">
              <a-input v-model:value="form.email" :maxlength="128" placeholder="请输入邮箱地址" />
            </a-form-item>
            <div class="form-pair full-field">
              <a-form-item label="用户角色" name="roleIds">
                <a-select
                  v-model:value="form.roleIds"
                  mode="multiple"
                  allow-clear
                  show-search
                  option-filter-prop="label"
                  placeholder="请选择用户角色"
                  :options="roleOptions"
                />
              </a-form-item>
              <a-form-item label="启用状态" name="status">
                <div class="switch-field">
                  <a-switch
                    :checked="form.status === 1"
                    @change="(checked) => form.status = Boolean(checked) ? 1 : 0"
                  />
                  <span>{{ form.status === 1 ? '已启用' : '已禁用' }}</span>
                </div>
              </a-form-item>
            </div>
            <a-form-item class="full-field" label="备注" name="remark">
              <a-textarea v-model:value="form.remark" :rows="3" :maxlength="255" placeholder="请输入备注信息" />
            </a-form-item>
          </div>
        </a-form>
      </a-spin>
    </a-modal>

    <a-modal
      v-model:open="passwordOpen"
      :title="passwordTitle"
      :width="520"
      :confirm-loading="passwordSubmitting"
      :mask-closable="false"
      ok-text="确认重置"
      cancel-text="取消"
      @ok="submitPasswordReset"
    >
      <a-form ref="passwordFormRef" class="password-form" layout="vertical" :model="passwordForm" :rules="passwordRules">
        <input type="text" :value="passwordUser?.username" autocomplete="username" hidden>
        <a-form-item label="新密码" name="newPassword" extra="8 至 72 位">
          <a-input-password v-model:value="passwordForm.newPassword" autocomplete="new-password" placeholder="请输入新密码" />
        </a-form-item>
        <a-form-item label="确认新密码" name="confirmPassword">
          <a-input-password v-model:value="passwordForm.confirmPassword" autocomplete="new-password" placeholder="请再次输入新密码" />
        </a-form-item>
      </a-form>
    </a-modal>
  </main>
</template>

<style scoped>
.query-panel { display: flex; align-items: center; justify-content: space-between; gap: 18px; padding: 11px 13px; border: 1px solid var(--shell-border); background: var(--shell-panel); }
.query-field { width: min(520px, 58%); }
.query-actions { display: flex; gap: 7px; }
.query-actions :deep(.ant-btn) { min-width: 58px; }
.secondary-action { color: var(--shell-ink); background: var(--shell-hover); }
.secondary-action:hover { color: var(--brand) !important; background: color-mix(in srgb, var(--brand) 11%, var(--shell-panel)) !important; }
.table-panel { margin-top: 8px; border: 1px solid var(--shell-border); background: var(--shell-panel); }
.table-toolbar { display: flex; min-height: 58px; align-items: center; justify-content: space-between; padding: 9px 13px; border-bottom: 1px solid var(--shell-border); }
.table-toolbar h1 { margin: 0; color: var(--shell-ink); font-size: 18px; font-weight: 600; }
.user-table :deep(.ant-table) { color: var(--shell-ink); background: var(--shell-panel); }
.user-table :deep(.ant-table-thead > tr > th) { padding-block: 9px; color: var(--shell-muted); font-size: 13px; font-weight: 600; background: var(--shell-hover); }
.user-table :deep(.ant-table-tbody > tr > td) { padding-block: 8px; }
.user-table :deep(.ant-table-tbody > tr:hover > td) { background: color-mix(in srgb, var(--brand) 7%, var(--shell-panel)); }
.user-table :deep(.ant-pagination) { margin: 13px; }
.user-name { font-weight: 600; }
.username { color: var(--brand-deep); font-family: 'SFMono-Regular', Consolas, monospace; font-size: 13px; }
.cell-text { display: block; overflow: hidden; color: var(--shell-muted); text-overflow: ellipsis; white-space: nowrap; }
.empty-value { color: color-mix(in srgb, var(--shell-muted) 55%, transparent); }
.row-actions { display: flex; align-items: center; justify-content: center; white-space: nowrap; }
.row-actions :deep(.ant-btn) { padding-inline: 5px; }
.empty-table { display: flex; min-height: 180px; align-items: center; justify-content: center; flex-direction: column; gap: 10px; color: var(--shell-muted); }
.empty-table :deep(.anticon) { font-size: 30px; }
.user-form, .password-form { padding-top: 8px; }
.form-grid { display: grid; column-gap: 18px; grid-template-columns: repeat(2, minmax(0, 1fr)); }
.form-grid :deep(.ant-form-item) { margin-bottom: 14px; }
.full-field { grid-column: 1 / -1; }
.form-pair { display: grid; column-gap: 18px; grid-template-columns: repeat(2, minmax(0, 1fr)); }
.switch-field { display: flex; min-height: 34px; align-items: center; gap: 9px; color: var(--shell-muted); }
.password-form :deep(.ant-form-item:last-child) { margin-bottom: 4px; }
</style>
