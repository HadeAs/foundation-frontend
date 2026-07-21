<script setup lang="ts">
defineOptions({ name: 'MenuManagementView' })

import {
  AppstoreOutlined,
} from '@ant-design/icons-vue'
import {
  Button as AButton,
  Form as AForm,
  FormItem as AFormItem,
  Input as AInput,
  InputNumber as AInputNumber,
  Modal as AModal,
  Popconfirm as APopconfirm,
  RadioButton as ARadioButton,
  RadioGroup as ARadioGroup,
  Select as ASelect,
  Switch as ASwitch,
  Tag as ATag,
  Textarea as ATextarea,
  TreeSelect as ATreeSelect,
  message,
  type FormInstance,
  type FormProps,
  type TableColumnsType,
} from 'ant-design-vue'
import { computed, nextTick, reactive, ref, watch } from 'vue'

import {
  createMenu,
  deleteMenu,
  listMenus,
  updateMenu,
  type MenuRequest,
  type SysMenu,
} from '@/api/menu'
import { getErrorMessage } from '@/api/http'
import ResizableTable from '@/components/common/ResizableTable.vue'
import { useUnsavedChanges } from '@/composables/use-unsaved-changes'
import { menuIconNames, resolveMenuIcon } from '@/components/layout/menu-icons'
import { buildMenuTree, type MenuNode } from '@/router/dynamic'
import { createLatestRequest } from '@/utils/latest-request'

type MenuForm = MenuRequest & { menuId?: number }
type ParentOption = { value: number; title: string; children?: ParentOption[] }
type TableMenu = Omit<MenuNode, 'children'> & { children?: TableMenu[] }

const keyword = ref('')
const records = ref<SysMenu[]>([])
const loading = ref(false)
const runLatestLoad = createLatestRequest(loading)
const expandedKeys = ref<number[]>([])
const modalOpen = ref(false)
const submitting = ref(false)
const deletingId = ref<number>()
const editingId = ref<number>()
const formRef = ref<FormInstance>()

const columns: TableColumnsType = [
  { title: '菜单名称', dataIndex: 'menuName', key: 'menuName', width: 150 },
  { title: '类型', dataIndex: 'menuType', key: 'menuType', width: 58, align: 'center' },
  { title: '当前路径', dataIndex: 'path', key: 'path', width: 110 },
  { title: '组件目录', dataIndex: 'component', key: 'component', width: 150 },
  { title: '排序', dataIndex: 'sortNo', key: 'sortNo', width: 56, align: 'center' },
  { title: '显示', dataIndex: 'visible', key: 'visible', width: 58, align: 'center' },
  { title: '状态', dataIndex: 'status', key: 'status', width: 58, align: 'center' },
  { title: '操作', key: 'action', width: 165, align: 'center' },
]

function defaultForm(parentId?: number): MenuForm {
  return {
    menuId: undefined,
    parentId,
    menuName: '',
    menuType: 'MENU',
    path: undefined,
    component: undefined,
    permission: undefined,
    icon: 'AppstoreOutlined',
    sortNo: 0,
    visible: true,
    status: 1,
    remark: undefined,
    syncParentRoleAssignments: undefined,
  }
}

const form = reactive<MenuForm>(defaultForm())
const { requestClose: requestFormClose } = useUnsavedChanges(form, modalOpen)
function toTableRows(nodes: MenuNode[]): TableMenu[] {
  return nodes.map(({ children, ...node }) => ({
    ...node,
    children: children.length ? toTableRows(children) : undefined,
  }))
}

function collectExpandableMenuIds(nodes: TableMenu[]): number[] {
  return nodes.flatMap((node) => [
    ...(node.menuId === undefined || !node.children?.length ? [] : [node.menuId]),
    ...collectExpandableMenuIds(node.children || []),
  ])
}

const treeRows = computed(() => toTableRows(buildMenuTree(records.value, false, false)))
const expandableIds = computed(() => collectExpandableMenuIds(treeRows.value))
const allExpanded = computed(() =>
  expandableIds.value.length > 0 && expandableIds.value.every((id) => expandedKeys.value.includes(id)),
)
const parentTree = computed(() => buildMenuTree(records.value, false, false))
const modalTitle = computed(() => editingId.value ? '编辑菜单' : '新增菜单')
const iconOptions = menuIconNames.map((name) => ({ label: name, value: name }))

function toParentOptions(nodes: MenuNode[]): ParentOption[] {
  return nodes.flatMap((node) => {
    if (node.menuType !== 'DIR' || node.menuId === undefined || node.menuId === editingId.value) {
      return []
    }
    const children = toParentOptions(node.children)
    return [{
      value: node.menuId,
      title: node.menuName || '未命名目录',
      children: children.length ? children : undefined,
    }]
  })
}

const parentOptions = computed(() => toParentOptions(parentTree.value))

async function validatePath(_: unknown, value?: string) {
  if (form.menuType !== 'MENU' && !value) return
  if (!value) throw new Error('请输入当前路径')
  if (value.includes('..') || value.startsWith('//') || /^https?:/i.test(value)) {
    throw new Error('当前路径格式不正确')
  }
}

async function validateComponent(_: unknown, value?: string) {
  if (form.menuType !== 'MENU' && !value) return
  if (!value) throw new Error('请输入组件目录')
  if (!value.startsWith('/') || value.includes('..') || value.endsWith('.vue')) {
    throw new Error('组件目录应为 /system/user 格式')
  }
}

const rules: FormProps['rules'] = {
  menuName: [
    { required: true, message: '请输入菜单名称', trigger: 'blur' },
    { max: 50, message: '菜单名称不能超过 50 个字符', trigger: 'blur' },
  ],
  menuType: [{ required: true, message: '请选择菜单类型', trigger: 'change' }],
  path: [{ validator: validatePath, trigger: 'blur' }],
  component: [{ validator: validateComponent, trigger: 'blur' }],
}

watch(
  () => form.menuType,
  (type) => {
    if (type === 'DIR') {
      form.component = undefined
      form.permission = undefined
    }
  },
)

async function load() {
  try {
    const result = await runLatestLoad(() => listMenus(keyword.value))
    if (!result) return
    records.value = result
    expandedKeys.value = expandableIds.value
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

function openCreate(parent?: SysMenu) {
  editingId.value = undefined
  resetForm(parent?.menuType === 'DIR' ? parent.menuId : undefined)
  modalOpen.value = true
}

function openEdit(record: SysMenu) {
  if (record.menuId === undefined) return
  editingId.value = record.menuId
  Object.assign(form, defaultForm(), record, { menuId: record.menuId })
  modalOpen.value = true
  nextTick(() => formRef.value?.clearValidate())
}

function clean(value?: string) {
  return value?.trim() || undefined
}

function toRequest(): MenuRequest {
  const isPage = form.menuType === 'MENU'
  return {
    parentId: form.parentId ?? 0,
    menuName: form.menuName.trim(),
    menuType: form.menuType,
    path: clean(form.path),
    component: isPage ? clean(form.component) : undefined,
    permission: isPage ? clean(form.permission) : undefined,
    icon: clean(form.icon),
    sortNo: form.sortNo ?? 0,
    visible: form.visible ?? true,
    status: form.status ?? 1,
    remark: clean(form.remark),
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
    const request = toRequest()
    if (editingId.value !== undefined) {
      await updateMenu(editingId.value, request)
      message.success('菜单已更新')
    } else {
      await createMenu(request)
      message.success('菜单已新增')
    }
    modalOpen.value = false
    await load()
  } catch (error) {
    message.error(getErrorMessage(error))
  } finally {
    submitting.value = false
  }
}

async function remove(record: SysMenu) {
  if (record.menuId === undefined) return
  deletingId.value = record.menuId
  try {
    await deleteMenu(record.menuId)
    message.success('菜单已删除')
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
          placeholder="请输入菜单名称、路由或权限标识"
          @press-enter="load"
        />
      </div>
      <div class="query-actions">
        <a-button type="primary" :loading="loading" @click="load">
          查询
        </a-button>
        <a-button :disabled="loading" @click="resetQuery">重置</a-button>
        <a-button :disabled="loading" @click="load">刷新</a-button>
      </div>
    </section>

    <section class="table-panel">
      <header class="table-toolbar">
        <div class="table-title">
          <h1>菜单结构</h1>
          <a-button type="primary" :disabled="!expandableIds.length" @click="toggleAllRows">
            {{ allExpanded ? '全部收起' : '全部展开' }}
          </a-button>
        </div>
        <a-button type="primary" @click="openCreate()">
          新增菜单
        </a-button>
      </header>

      <ResizableTable
        v-model:expanded-row-keys="expandedKeys"
        class="menu-table"
        row-key="menuId"
        size="middle"
        table-layout="fixed"
        :columns="columns"
        :data-source="treeRows"
        :loading="loading"
        :pagination="false"
      >
        <template #bodyCell="{ column, record }">
          <template v-if="column.key === 'menuName'">
            <div class="menu-name">
              <component :is="resolveMenuIcon(record.icon)" />
              <span>{{ record.menuName || '未命名菜单' }}</span>
            </div>
          </template>
          <template v-else-if="column.key === 'menuType'">
            <a-tag :color="record.menuType === 'DIR' ? 'cyan' : 'blue'">
              {{ record.menuType === 'DIR' ? '目录' : '菜单' }}
            </a-tag>
          </template>
          <template v-else-if="column.key === 'path'">
            <code v-if="record.path" class="path-text">{{ record.path }}</code>
            <span v-else class="empty-value">—</span>
          </template>
          <template v-else-if="column.key === 'component'">
            <code v-if="record.component" class="path-text">{{ record.component }}</code>
            <span v-else class="empty-value">—</span>
          </template>
          <template v-else-if="column.key === 'visible'">
            <a-tag :color="record.visible === false ? 'default' : 'success'">
              {{ record.visible === false ? '隐藏' : '可见' }}
            </a-tag>
          </template>
          <template v-else-if="column.key === 'status'">
            <span class="status-dot" :class="{ disabled: record.status !== 1 }"></span>
            {{ record.status === 1 ? '启用' : '禁用' }}
          </template>
          <template v-else-if="column.key === 'action'">
            <div class="row-actions">
              <a-button v-if="record.menuType === 'DIR'" type="link" size="small" @click="openCreate(record)">
                新增下级
              </a-button>
              <a-button type="link" size="small" @click="openEdit(record)">
                编辑
              </a-button>
              <a-popconfirm
                title="确认删除该菜单？"
                description="存在子菜单时后端将拒绝删除。"
                ok-text="删除"
                cancel-text="取消"
                @confirm="remove(record)"
              >
                <a-button type="link" danger size="small" :loading="deletingId === record.menuId">
                  删除
                </a-button>
              </a-popconfirm>
            </div>
          </template>
        </template>
        <template #emptyText>
          <div class="empty-table"><AppstoreOutlined /><span>暂无符合条件的菜单</span></div>
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
      <a-form ref="formRef" class="menu-form" layout="vertical" :model="form" :rules="rules">
          <div class="form-grid">
            <a-form-item label="菜单类型" name="menuType">
              <a-radio-group v-model:value="form.menuType" button-style="solid">
                <a-radio-button value="DIR">目录</a-radio-button>
                <a-radio-button value="MENU">菜单</a-radio-button>
              </a-radio-group>
            </a-form-item>
            <a-form-item label="上级目录" name="parentId">
              <a-tree-select
                v-model:value="form.parentId"
                allow-clear
                tree-default-expand-all
                placeholder="不选择则为顶级菜单"
                :tree-data="parentOptions"
              />
            </a-form-item>
            <a-form-item label="菜单名称" name="menuName">
              <a-input v-model:value="form.menuName" :maxlength="50" placeholder="请输入中文菜单名称" />
            </a-form-item>
            <a-form-item label="菜单图标" name="icon">
              <a-select
                v-model:value="form.icon"
                allow-clear
                show-search
                option-filter-prop="label"
                placeholder="搜索 Ant Design 图标"
                :options="iconOptions"
              >
                <template #option="option">
                  <span class="icon-option"><component :is="resolveMenuIcon(option.value)" />{{ option.label }}</span>
                </template>
              </a-select>
            </a-form-item>
            <a-form-item label="当前路径" name="path">
              <a-input v-model:value="form.path" placeholder="例如 user；完整路由将拼接上级路径" />
            </a-form-item>
            <template v-if="form.menuType === 'MENU'">
              <a-form-item label="组件目录" name="component">
                <a-input v-model:value="form.component" placeholder="例如 /system/user" />
              </a-form-item>
              <a-form-item label="权限标识" name="permission">
                <a-input v-model:value="form.permission" placeholder="可选，例如 system:user:view" />
              </a-form-item>
            </template>
            <a-form-item label="排序号" name="sortNo">
              <a-input-number v-model:value="form.sortNo" :min="0" :max="9999" :precision="0" />
            </a-form-item>
            <a-form-item label="显示状态" name="visible">
              <div class="switch-field">
                <a-switch v-model:checked="form.visible" />
                <span>{{ form.visible ? '菜单可见' : '菜单隐藏' }}</span>
              </div>
            </a-form-item>
            <a-form-item label="启用状态" name="status">
              <div class="switch-field">
                <a-switch v-model:checked="form.status" :checked-value="1" :un-checked-value="0" />
                <span>{{ form.status === 1 ? '已启用' : '已禁用' }}</span>
              </div>
            </a-form-item>
            <a-form-item class="full-field" label="备注" name="remark">
              <a-textarea v-model:value="form.remark" :rows="2" :maxlength="200" placeholder="请输入备注信息" />
            </a-form-item>
          </div>
      </a-form>
    </a-modal>
  </main>
</template>

<style scoped>
.query-field { width: min(520px, 58%); }
.menu-table :deep(.ant-table) { color: var(--shell-ink); background: var(--shell-panel); }
.menu-table :deep(.ant-table-thead > tr > th) { padding-block: 9px; color: var(--shell-muted); font-size: 13px; font-weight: 600; background: var(--shell-hover); }
.menu-table :deep(.ant-table-tbody > tr > td) { padding-block: 8px; }
.menu-table :deep(.ant-table-tbody > tr:hover > td) { background: color-mix(in srgb, var(--brand) 7%, var(--shell-panel)); }
.menu-name { display: flex; min-width: 0; align-items: center; gap: 8px; font-weight: 500; }
.menu-name :deep(.anticon) { flex: none; color: var(--brand); font-size: 17px; }
.menu-name span, .path-text { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.path-text { display: block; color: var(--shell-muted); font-family: 'SFMono-Regular', Consolas, monospace; font-size: 12px; }
.empty-value { color: color-mix(in srgb, var(--shell-muted) 55%, transparent); }
.status-dot { display: inline-block; width: 7px; height: 7px; margin-right: 5px; border-radius: 50%; background: #28a87d; }
.status-dot.disabled { background: #9ba8a8; }
.empty-table { display: flex; min-height: 180px; align-items: center; justify-content: center; flex-direction: column; gap: 10px; color: var(--shell-muted); }
.empty-table :deep(.anticon) { font-size: 30px; }
.menu-form { padding-top: 8px; }
.form-grid { display: grid; column-gap: 18px; grid-template-columns: repeat(2, minmax(0, 1fr)); }
.form-grid :deep(.ant-form-item) { margin-bottom: 14px; }
.form-grid :deep(.ant-input-number) { width: 100%; }
.full-field { grid-column: 1 / -1; }
.switch-field { display: flex; min-height: 34px; align-items: center; gap: 9px; color: var(--shell-muted); }
.icon-option { display: inline-flex; align-items: center; gap: 9px; }
</style>
