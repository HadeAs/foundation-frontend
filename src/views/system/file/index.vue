<script setup lang="ts">
defineOptions({ name: 'FileManagementView' })

import {
  Button as AButton,
  Input as AInput,
  Modal as AModal,
  Popconfirm as APopconfirm,
  Select as ASelect,
  Tag as ATag,
  Textarea as ATextarea,
  Modal,
  message,
  type TableColumnsType,
  type TablePaginationConfig,
  type TableProps,
} from 'ant-design-vue'
import { computed, nextTick, ref } from 'vue'

import {
  batchDeleteFiles,
  deleteFile,
  downloadFile,
  pageFiles,
  uploadFile,
  type SysFile,
} from '@/api/file'
import { getErrorMessage } from '@/api/http'
import ResizableTable from '@/components/common/ResizableTable.vue'
import { formatDateTime } from '@/utils/date'
import { downloadBlob } from '@/utils/download'

import { canDeleteFile, fileGroups, formatFileSize } from './policy'

const maxFileSize = 100 * 1024 * 1024
const uploadGroups = fileGroups.filter((item) => !item.managed)
const groupLabels: Record<string, string> = Object.fromEntries(fileGroups.map((item) => [item.value, item.label]))

const keyword = ref('')
const group = ref<string>()
const records = ref<SysFile[]>([])
const loading = ref(false)
const currentPage = ref(1)
const pageSize = ref(20)
const total = ref(0)
const selectedIds = ref<number[]>([])
const deletingId = ref<number>()
const downloadingId = ref<number>()

const uploadOpen = ref(false)
const selectedFile = ref<File>()
const uploadGroup = ref('default')
const uploadRemark = ref('')
const uploading = ref(false)
const fileInput = ref<HTMLInputElement>()

const columns: TableColumnsType = [
  { title: '文件名称', dataIndex: 'originalName', key: 'originalName', width: 230 },
  { title: '文件分组', dataIndex: 'fileGroup', key: 'fileGroup', width: 110, align: 'center' },
  { title: '内容类型', dataIndex: 'contentType', key: 'contentType', width: 160 },
  { title: '文件大小', dataIndex: 'fileSize', key: 'fileSize', width: 105, align: 'right' },
  { title: '对象路径', dataIndex: 'objectName', key: 'objectName', width: 280 },
  { title: '存储桶', dataIndex: 'bucketName', key: 'bucketName', width: 130 },
  { title: '上传人', dataIndex: 'uploader', key: 'uploader', width: 105 },
  { title: '资产状态', key: 'assetStatus', width: 100, align: 'center' },
  { title: '上传时间', dataIndex: 'createdTime', key: 'createdTime', width: 155 },
  { title: '操作', key: 'action', width: 125, align: 'center' },
]

const pagination = computed<TablePaginationConfig>(() => ({
  current: currentPage.value,
  pageSize: pageSize.value,
  total: total.value,
  showSizeChanger: true,
  pageSizeOptions: ['10', '20', '50', '100'],
  showTotal: (count) => `共 ${count} 条`,
}))
const rowSelection = computed<TableProps<SysFile>['rowSelection']>(() => ({
  selectedRowKeys: selectedIds.value,
  fixed: true,
  columnWidth: 48,
  onChange: (keys) => { selectedIds.value = keys.map(Number) },
  getCheckboxProps: (record) => ({
    disabled: !canDeleteFile(record.fileGroup, record.expiredFlag === true),
  }),
}))

async function load() {
  loading.value = true
  selectedIds.value = []
  try {
    const result = await pageFiles(currentPage.value, pageSize.value, keyword.value, group.value)
    records.value = result.records || []
    total.value = Number(result.total || 0)
    currentPage.value = Number(result.current || currentPage.value)
    pageSize.value = Number(result.size || pageSize.value)
  } catch {
    records.value = []
    total.value = 0
    message.error('文件资产获取失败，请稍后重试')
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
  group.value = undefined
  currentPage.value = 1
  await load()
}

function handleTableChange(next: TablePaginationConfig) {
  const nextSize = next.pageSize || pageSize.value
  currentPage.value = nextSize === pageSize.value ? next.current || 1 : 1
  pageSize.value = nextSize
  void load()
}

function openUpload() {
  selectedFile.value = undefined
  uploadGroup.value = 'default'
  uploadRemark.value = ''
  uploadOpen.value = true
  nextTick(() => {
    if (fileInput.value) fileInput.value.value = ''
  })
}

function selectFile(event: Event) {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  if (!file) return
  if (file.size > maxFileSize) {
    input.value = ''
    selectedFile.value = undefined
    message.error('单文件大小不能超过 100 MB')
    return
  }
  selectedFile.value = file
}

async function submitUpload() {
  if (!selectedFile.value) {
    message.warning('请先选择需要上传的文件')
    return
  }
  if (selectedFile.value.size > maxFileSize) {
    message.error('单文件大小不能超过 100 MB')
    return
  }
  uploading.value = true
  try {
    await uploadFile(selectedFile.value, uploadGroup.value, uploadRemark.value)
    uploadOpen.value = false
    message.success('文件已上传')
    currentPage.value = 1
    await load()
  } catch (error) {
    message.error(getErrorMessage(error))
  } finally {
    uploading.value = false
  }
}

async function download(record: SysFile) {
  if (record.fileId === undefined) return
  downloadingId.value = record.fileId
  try {
    const response = await downloadFile(record.fileId)
    downloadBlob(response.data, record.originalName || `文件-${record.fileId}`)
  } catch (error) {
    message.error(getErrorMessage(error))
  } finally {
    downloadingId.value = undefined
  }
}

async function remove(record: SysFile) {
  if (record.fileId === undefined || !canDeleteFile(record.fileGroup, record.expiredFlag === true)) return
  deletingId.value = record.fileId
  try {
    await deleteFile(record.fileId)
    if (records.value.length === 1 && currentPage.value > 1) currentPage.value -= 1
    message.success('文件资产已删除')
    await load()
  } catch (error) {
    message.error(getErrorMessage(error))
  } finally {
    deletingId.value = undefined
  }
}

function removeSelected() {
  Modal.confirm({
    title: `确认删除选中的 ${selectedIds.value.length} 个文件？`,
    content: '文件内容将从 MinIO 中永久删除，且无法恢复。',
    okText: '删除',
    cancelText: '取消',
    onOk: async () => {
      try {
        await batchDeleteFiles(selectedIds.value)
        selectedIds.value = []
        message.success('文件资产已批量删除')
        await load()
      } catch (error) {
        message.error(getErrorMessage(error))
        throw error
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
        <a-input v-model:value="keyword" allow-clear placeholder="请输入文件名称、对象路径或上传人" @press-enter="search" />
        <a-select v-model:value="group" allow-clear placeholder="全部分组" :options="fileGroups" />
      </div>
      <div class="query-actions">
        <a-button type="primary" :loading="loading" @click="search">查询</a-button>
        <a-button class="secondary-action" :disabled="loading" @click="resetQuery">重置</a-button>
        <a-button class="secondary-action" :disabled="loading" @click="load">刷新</a-button>
      </div>
    </section>

    <section class="table-panel">
      <header class="table-toolbar">
        <div>
          <h1>文件资产</h1>
          <span>文件内容存储于 MinIO</span>
        </div>
        <div class="toolbar-actions">
          <a-button v-if="selectedIds.length" danger class="secondary-action" @click="removeSelected">
            批量删除（{{ selectedIds.length }}）
          </a-button>
          <a-button type="primary" @click="openUpload">上传文件</a-button>
        </div>
      </header>

      <ResizableTable
        class="file-table"
        row-key="fileId"
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
          <template v-if="column.key === 'originalName'">
            <strong class="file-name" :title="record.originalName">{{ record.originalName || '—' }}</strong>
          </template>
          <template v-else-if="column.key === 'fileGroup'">
            <a-tag :color="fileGroups.find((item) => item.value === record.fileGroup)?.managed ? 'blue' : 'cyan'">
              {{ groupLabels[record.fileGroup] || record.fileGroup || '未知' }}
            </a-tag>
          </template>
          <template v-else-if="column.key === 'contentType'">
            <span class="cell-text">{{ record.contentType || '—' }}</span>
          </template>
          <template v-else-if="column.key === 'fileSize'">{{ formatFileSize(record.fileSize) }}</template>
          <template v-else-if="column.key === 'objectName'">
            <code class="object-name" :title="record.objectName">{{ record.objectName || '—' }}</code>
          </template>
          <template v-else-if="column.key === 'bucketName'">
            <span class="cell-text">{{ record.bucketName || '—' }}</span>
          </template>
          <template v-else-if="column.key === 'uploader'">{{ record.uploader || '—' }}</template>
          <template v-else-if="column.key === 'assetStatus'">
            <a-tag v-if="record.expiredFlag" color="orange">已过期</a-tag>
            <a-tag v-else-if="record.archivedFlag">已归档</a-tag>
            <a-tag v-else color="green">有效</a-tag>
          </template>
          <template v-else-if="column.key === 'createdTime'">
            <span class="cell-text">{{ formatDateTime(record.createdTime) }}</span>
          </template>
          <template v-else-if="column.key === 'action'">
            <div class="row-actions">
              <a-button type="link" size="small" :loading="downloadingId === record.fileId" @click="download(record)">下载</a-button>
              <a-popconfirm
                title="确认删除该文件？"
                description="文件内容将从 MinIO 中永久删除。"
                ok-text="删除"
                cancel-text="取消"
                @confirm="remove(record)"
              >
                <a-button
                  type="link"
                  danger
                  size="small"
                  :disabled="!canDeleteFile(record.fileGroup, record.expiredFlag === true)"
                  :loading="deletingId === record.fileId"
                >删除</a-button>
              </a-popconfirm>
            </div>
          </template>
        </template>
        <template #emptyText><div class="empty-table">暂无符合条件的文件资产</div></template>
      </ResizableTable>
    </section>

    <a-modal
      v-model:open="uploadOpen"
      title="上传文件"
      :width="620"
      :confirm-loading="uploading"
      :mask-closable="false"
      ok-text="上传"
      cancel-text="取消"
      @ok="submitUpload"
    >
      <div class="upload-form">
        <label>文件</label>
        <div class="file-picker">
          <a-button class="secondary-action" @click="fileInput?.click()">选择文件</a-button>
          <span :title="selectedFile?.name">{{ selectedFile ? `${selectedFile.name}（${formatFileSize(selectedFile.size)}）` : '未选择文件' }}</span>
          <input ref="fileInput" type="file" hidden @change="selectFile" />
        </div>
        <small>单文件最大 100 MB，不限制文件扩展名。</small>

        <label>文件分组</label>
        <a-select v-model:value="uploadGroup" :options="uploadGroups" />
        <small>手工上传仅允许进入手工上传、文档资料和图片分组。</small>

        <label>备注</label>
        <a-textarea v-model:value="uploadRemark" :rows="3" :maxlength="255" placeholder="请输入备注信息" />
      </div>
    </a-modal>
  </main>
</template>

<style scoped>
.query-panel { display: flex; align-items: center; justify-content: space-between; gap: 18px; padding: 11px 13px; border: 1px solid var(--shell-border); background: var(--shell-panel); }
.query-fields { display: grid; width: min(700px, 66%); grid-template-columns: minmax(300px, 1fr) 150px; gap: 8px; }
.query-actions, .toolbar-actions { display: flex; gap: 7px; }
.query-actions :deep(.ant-btn) { min-width: 58px; }
.secondary-action { color: var(--shell-ink); background: var(--shell-hover); }
.secondary-action:hover { color: var(--brand) !important; background: color-mix(in srgb, var(--brand) 11%, var(--shell-panel)) !important; }
.table-panel { margin-top: 8px; border: 1px solid var(--shell-border); background: var(--shell-panel); }
.table-toolbar { display: flex; min-height: 58px; align-items: center; justify-content: space-between; padding: 8px 13px; border-bottom: 1px solid var(--shell-border); }
.table-toolbar h1 { margin: 0; color: var(--shell-ink); font-size: 18px; font-weight: 600; }
.table-toolbar > div:first-child > span { display: block; margin-top: 2px; color: var(--shell-muted); font-size: 12px; }
.file-table :deep(.ant-table) { color: var(--shell-ink); background: var(--shell-panel); }
.file-table :deep(.ant-table-thead > tr > th) { padding-block: 9px; color: var(--shell-muted); font-size: 13px; font-weight: 600; background: var(--shell-hover); }
.file-table :deep(.ant-table-tbody > tr > td) { padding-block: 8px; }
.file-table :deep(.ant-table-tbody > tr:hover > td) { background: color-mix(in srgb, var(--brand) 7%, var(--shell-panel)); }
.file-table :deep(.ant-pagination) { margin: 13px; }
.file-name, .cell-text, .object-name { display: block; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.cell-text { color: var(--shell-muted); }
.object-name { color: var(--brand-deep); font-family: 'SFMono-Regular', Consolas, monospace; font-size: 13px; }
.row-actions { display: flex; align-items: center; justify-content: center; white-space: nowrap; }
.row-actions :deep(.ant-btn) { padding-inline: 5px; }
.empty-table { display: flex; min-height: 180px; align-items: center; justify-content: center; color: var(--shell-muted); }
.upload-form { display: grid; padding-top: 8px; gap: 8px; }
.upload-form label { margin-top: 7px; color: var(--shell-ink); font-weight: 500; }
.upload-form small { color: var(--shell-muted); }
.file-picker { display: flex; min-width: 0; align-items: center; gap: 10px; }
.file-picker > span { min-width: 0; overflow: hidden; color: var(--shell-muted); text-overflow: ellipsis; white-space: nowrap; }
</style>
