<script setup lang="ts">
defineOptions({ name: 'RoleManagementView' })

import { SafetyCertificateOutlined } from '@ant-design/icons-vue'
import {
  Button as AButton,
  Form as AForm,
  FormItem as AFormItem,
  Input as AInput,
  Modal as AModal,
  Popconfirm as APopconfirm,
  Spin as ASpin,
  Switch as ASwitch,
  Textarea as ATextarea,
  Tree as ATree,
  message,
  type FormInstance,
  type FormProps,
  type TableColumnsType,
  type TablePaginationConfig,
} from 'ant-design-vue'
import { computed, nextTick, reactive, ref } from 'vue'

import { getErrorMessage } from '@/api/http'
import { listMenus, type SysMenu } from '@/api/menu'
import {
  assignRoleMenus,
  createRole,
  deleteRole,
  getRoleMenuIds,
  pageRoles,
  updateRole,
  type RoleRequest,
  type SysRole,
} from '@/api/role'
import ResizableTable from '@/components/common/ResizableTable.vue'
import { buildMenuTree, type MenuNode } from '@/router/dynamic'
import { formatDateTime } from '@/utils/date'

import { includeAncestorMenuIds } from './permissions'

type RoleForm = RoleRequest & { roleId?: number }
type MenuTreeOption = { key: number; title: string; disableCheckbox?: boolean; children?: MenuTreeOption[] }

const keyword = ref('')
const records = ref<SysRole[]>([])
const loading = ref(false)
const currentPage = ref(1)
const pageSize = ref(20)
const total = ref(0)
const modalOpen = ref(false)
const submitting = ref(false)
const deletingId = ref<number>()
const statusUpdatingId = ref<number>()
const editingId = ref<number>()
const formRef = ref<FormInstance>()
const permissionOpen = ref(false)
const permissionLoading = ref(false)
const permissionSubmitting = ref(false)
const permissionRole = ref<SysRole>()
const menuOptions = ref<MenuTreeOption[]>([])
const checkedMenuIds = ref<number[]>([])
const dashboardMenuId = ref<number>()
const allMenus = ref<SysMenu[]>([])

const columns: TableColumnsType = [
  { title: '角色名称', dataIndex: 'roleName', key: 'roleName', width: 150 },
  { title: '角色编码', dataIndex: 'roleCode', key: 'roleCode', width: 130 },
  { title: '状态', dataIndex: 'status', key: 'status', width: 90, align: 'center' },
  { title: '备注', dataIndex: 'remark', key: 'remark', width: 220 },
  { title: '更新时间', dataIndex: 'updatedTime', key: 'updatedTime', width: 155 },
  { title: '操作', key: 'action', width: 185, align: 'center' },
]

function defaultForm(): RoleForm {
  return {
    roleId: undefined,
    roleCode: '',
    roleName: '',
    status: 1,
    remark: undefined,
  }
}

const form = reactive<RoleForm>(defaultForm())
const modalTitle = computed(() => editingId.value === undefined ? '新增角色' : '编辑角色')
const permissionTitle = computed(() => permissionRole.value?.roleName
  ? `菜单权限 · ${permissionRole.value.roleName}`
  : '菜单权限')
const pagination = computed<TablePaginationConfig>(() => ({
  current: currentPage.value,
  pageSize: pageSize.value,
  total: total.value,
  showSizeChanger: true,
  pageSizeOptions: ['10', '20', '50', '100'],
  showTotal: (count) => `共 ${count} 条`,
}))

const rules: FormProps['rules'] = {
  roleName: [{ required: true, message: '请输入角色名称', trigger: 'blur' }],
  roleCode: [{ required: true, message: '请输入角色编码', trigger: 'blur' }],
}

function toMenuOptions(nodes: MenuNode[]): MenuTreeOption[] {
  return nodes.flatMap((node) => {
    if (node.menuId === undefined) return []
    const children = toMenuOptions(node.children)
    return [{
      key: node.menuId,
      title: node.menuName || '未命名菜单',
      disableCheckbox: node.fullPath === '/dashboard',
      children: children.length ? children : undefined,
    }]
  })
}

async function load() {
  loading.value = true
  try {
    const result = await pageRoles(currentPage.value, pageSize.value, keyword.value)
    records.value = result.records || []
    total.value = Number(result.total || 0)
    currentPage.value = Number(result.current || currentPage.value)
    pageSize.value = Number(result.size || pageSize.value)
  } catch {
    message.error('数据获取失败，请稍后重试')
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

function openCreate() {
  editingId.value = undefined
  resetForm()
  modalOpen.value = true
}

function openEdit(record: SysRole) {
  if (record.roleId === undefined) return
  editingId.value = record.roleId
  Object.assign(form, defaultForm(), record, { roleId: record.roleId })
  modalOpen.value = true
  nextTick(() => formRef.value?.clearValidate())
}

function clean(value?: string) {
  return value?.trim() || undefined
}

function toRequest(source: RoleForm | SysRole, status = source.status): RoleRequest {
  return {
    roleCode: source.roleCode?.trim() || '',
    roleName: source.roleName?.trim() || '',
    status: status ?? 1,
    remark: clean(source.remark),
  }
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
      await createRole(toRequest(form))
      message.success('角色已新增')
    } else {
      await updateRole(editingId.value, toRequest(form))
      message.success('角色已更新')
    }
    modalOpen.value = false
    await load()
  } catch (error) {
    message.error(getErrorMessage(error))
  } finally {
    submitting.value = false
  }
}

async function changeStatus(record: SysRole, checked: boolean) {
  if (record.roleId === undefined) return
  statusUpdatingId.value = record.roleId
  try {
    const nextStatus = checked ? 1 : 0
    await updateRole(record.roleId, toRequest(record, nextStatus))
    record.status = nextStatus
    message.success(checked ? '角色已启用' : '角色已禁用')
  } catch (error) {
    message.error(getErrorMessage(error))
  } finally {
    statusUpdatingId.value = undefined
  }
}

async function remove(record: SysRole) {
  if (record.roleId === undefined) return
  deletingId.value = record.roleId
  try {
    await deleteRole(record.roleId)
    if (records.value.length === 1 && currentPage.value > 1) currentPage.value -= 1
    message.success('角色已删除')
    await load()
  } catch (error) {
    message.error(getErrorMessage(error))
  } finally {
    deletingId.value = undefined
  }
}

async function openPermission(record: SysRole) {
  if (record.roleId === undefined) return
  permissionRole.value = record
  menuOptions.value = []
  checkedMenuIds.value = []
  dashboardMenuId.value = undefined
  allMenus.value = []
  permissionOpen.value = true
  permissionLoading.value = true
  try {
    const [menus, ids] = await Promise.all([listMenus(), getRoleMenuIds(record.roleId)])
    const menuTree = buildMenuTree(menus, false, false)
    allMenus.value = menus
    dashboardMenuId.value = menus.find((menu) => menu.path === '/dashboard' || menu.path === 'dashboard')?.menuId
    menuOptions.value = toMenuOptions(menuTree)
    const selectedIds = dashboardMenuId.value === undefined
      ? ids
      : [...new Set([...ids, dashboardMenuId.value])]
    checkedMenuIds.value = selectedIds.filter((id) =>
      menus.find((menu) => menu.menuId === id)?.menuType !== 'DIR',
    )
  } catch {
    message.error('菜单权限获取失败，请稍后重试')
  } finally {
    permissionLoading.value = false
  }
}

async function savePermission() {
  const roleId = permissionRole.value?.roleId
  if (roleId === undefined || permissionLoading.value) return
  permissionSubmitting.value = true
  try {
    const selectedIds = dashboardMenuId.value === undefined
      ? checkedMenuIds.value
      : [...new Set([...checkedMenuIds.value, dashboardMenuId.value])]
    const menuIds = includeAncestorMenuIds(allMenus.value, selectedIds)
    await assignRoleMenus(roleId, menuIds)
    message.success('菜单权限已保存')
    permissionOpen.value = false
  } catch (error) {
    message.error(getErrorMessage(error))
  } finally {
    permissionSubmitting.value = false
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
          placeholder="请输入角色名称或角色编码"
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
        <h1>角色列表</h1>
        <a-button type="primary" @click="openCreate">新增角色</a-button>
      </header>

      <ResizableTable
        class="role-table"
        row-key="roleId"
        size="middle"
        table-layout="fixed"
        :columns="columns"
        :data-source="records"
        :loading="loading"
        :pagination="pagination"
        @change="handleTableChange"
      >
        <template #bodyCell="{ column, record }">
          <template v-if="column.key === 'roleName'">
            <strong class="role-name">{{ record.roleName || '未命名角色' }}</strong>
          </template>
          <template v-else-if="column.key === 'roleCode'">
            <code class="role-code">{{ record.roleCode || '—' }}</code>
          </template>
          <template v-else-if="column.key === 'status'">
            <a-switch
              :checked="record.status === 1"
              :loading="statusUpdatingId === record.roleId"
              checked-children="启用"
              un-checked-children="禁用"
              @change="(checked) => changeStatus(record, Boolean(checked))"
            />
          </template>
          <template v-else-if="column.key === 'remark'">
            <span v-if="record.remark" class="cell-text">{{ record.remark }}</span>
            <span v-else class="empty-value">—</span>
          </template>
          <template v-else-if="column.key === 'updatedTime'">
            <span class="cell-text">{{ formatDateTime(record.updatedTime) }}</span>
          </template>
          <template v-else-if="column.key === 'action'">
            <div class="row-actions">
              <a-button type="link" size="small" @click="openPermission(record)">菜单权限</a-button>
              <a-button type="link" size="small" @click="openEdit(record)">编辑</a-button>
              <a-popconfirm
                title="确认删除该角色？"
                description="角色已分配给用户时，后端可能拒绝删除。"
                ok-text="删除"
                cancel-text="取消"
                @confirm="remove(record)"
              >
                <a-button type="link" danger size="small" :loading="deletingId === record.roleId">删除</a-button>
              </a-popconfirm>
            </div>
          </template>
        </template>
        <template #emptyText>
          <div class="empty-table"><SafetyCertificateOutlined /><span>暂无符合条件的角色</span></div>
        </template>
      </ResizableTable>
    </section>

    <a-modal
      v-model:open="modalOpen"
      :title="modalTitle"
      :width="720"
      :confirm-loading="submitting"
      :mask-closable="false"
      ok-text="保存"
      cancel-text="取消"
      @ok="submit"
    >
      <a-form ref="formRef" class="role-form" layout="vertical" :model="form" :rules="rules">
        <div class="form-grid">
          <a-form-item label="角色名称" name="roleName">
            <a-input v-model:value="form.roleName" placeholder="请输入角色名称" />
          </a-form-item>
          <a-form-item label="角色编码" name="roleCode">
            <a-input v-model:value="form.roleCode" placeholder="请输入角色编码" />
          </a-form-item>
          <a-form-item label="启用状态" name="status">
            <div class="switch-field">
              <a-switch v-model:checked="form.status" :checked-value="1" :un-checked-value="0" />
              <span>{{ form.status === 1 ? '已启用' : '已禁用' }}</span>
            </div>
          </a-form-item>
          <a-form-item class="full-field" label="备注" name="remark">
            <a-textarea v-model:value="form.remark" :rows="3" placeholder="请输入备注信息" />
          </a-form-item>
        </div>
      </a-form>
    </a-modal>

    <a-modal
      v-model:open="permissionOpen"
      :title="permissionTitle"
      :width="820"
      :confirm-loading="permissionSubmitting"
      :mask-closable="false"
      ok-text="保存"
      cancel-text="取消"
      @ok="savePermission"
    >
      <a-spin :spinning="permissionLoading">
        <div class="permission-intro">配置该角色登录后可访问的菜单页面。</div>
        <div class="permission-tree">
          <a-tree
            v-if="menuOptions.length"
            v-model:checked-keys="checkedMenuIds"
            checkable
            default-expand-all
            :tree-data="menuOptions"
          />
          <div v-else-if="!permissionLoading" class="permission-empty">暂无可配置菜单</div>
        </div>
      </a-spin>
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
.role-table :deep(.ant-table) { color: var(--shell-ink); background: var(--shell-panel); }
.role-table :deep(.ant-table-thead > tr > th) { padding-block: 9px; color: var(--shell-muted); font-size: 13px; font-weight: 600; background: var(--shell-hover); }
.role-table :deep(.ant-table-tbody > tr > td) { padding-block: 8px; }
.role-table :deep(.ant-table-tbody > tr:hover > td) { background: color-mix(in srgb, var(--brand) 7%, var(--shell-panel)); }
.role-table :deep(.ant-pagination) { margin: 13px; }
.role-name { font-weight: 600; }
.role-code { color: var(--brand-deep); font-family: 'SFMono-Regular', Consolas, monospace; font-size: 13px; }
.cell-text { display: block; overflow: hidden; color: var(--shell-muted); text-overflow: ellipsis; white-space: nowrap; }
.empty-value { color: color-mix(in srgb, var(--shell-muted) 55%, transparent); }
.row-actions { display: flex; align-items: center; justify-content: center; white-space: nowrap; }
.row-actions :deep(.ant-btn) { padding-inline: 5px; }
.empty-table { display: flex; min-height: 180px; align-items: center; justify-content: center; flex-direction: column; gap: 10px; color: var(--shell-muted); }
.empty-table :deep(.anticon) { font-size: 30px; }
.role-form { padding-top: 8px; }
.form-grid { display: grid; column-gap: 18px; grid-template-columns: repeat(2, minmax(0, 1fr)); }
.form-grid :deep(.ant-form-item) { margin-bottom: 14px; }
.full-field { grid-column: 1 / -1; }
.switch-field { display: flex; min-height: 34px; align-items: center; gap: 9px; color: var(--shell-muted); }
.permission-intro { margin: 8px 0 12px; color: var(--shell-muted); }
.permission-tree { min-height: 300px; max-height: 440px; overflow: auto; padding: 12px 14px; border: 1px solid var(--shell-border); background: var(--shell-hover); }
.permission-tree :deep(.ant-tree) { color: var(--shell-ink); background: transparent; }
.permission-tree :deep(.ant-tree-treenode) { min-height: 30px; align-items: center; }
.permission-tree :deep(.ant-tree-switcher) { display: flex; flex: 0 0 24px; align-items: center; justify-content: center; }
.permission-tree :deep(.ant-tree-checkbox) { align-self: center; margin-block: 0; }
.permission-tree :deep(.ant-tree-node-content-wrapper) { display: flex; min-height: 30px; align-items: center; }
.permission-empty { display: flex; min-height: 274px; align-items: center; justify-content: center; color: var(--shell-muted); }
</style>
