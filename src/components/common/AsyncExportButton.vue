<script setup lang="ts">
import {
  Alert as AAlert,
  Button as AButton,
  Modal as AModal,
  Progress as AProgress,
  Tag as ATag,
  message,
} from 'ant-design-vue'
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'

import {
  cancelAsyncTask,
  createAsyncTask,
  getAsyncTask,
  type SysAsyncTask,
} from '@/api/async-task'
import { listDictItems, type DictItemResponse } from '@/api/dict'
import { downloadFile } from '@/api/file'
import { getErrorMessage } from '@/api/http'
import { useAuthStore } from '@/stores/auth'
import { buildExportTaskRequest, isTerminalTaskStatus } from '@/utils/async-export'
import { downloadBlob } from '@/utils/download'

const props = defineProps<{
  taskType: string
  taskName: string
  resource: string
  filters: Record<string, unknown>
}>()

const auth = useAuthStore()
const router = useRouter()
const creating = ref(false)
const open = ref(false)
const task = ref<SysAsyncTask>()
const canceling = ref(false)
const downloading = ref(false)
const statusItems = ref<DictItemResponse[]>([])

let pollTimer: number | undefined
let polling = false
let notifiedTaskId: number | undefined

const permissions = computed(() => auth.user?.permissions || [])
const canExport = computed(() => permissions.value.includes('system:async-task:view'))
const canDownload = computed(() => permissions.value.includes('system:file:view'))
const isActive = computed(() => task.value?.status === 'PENDING' || task.value?.status === 'RUNNING')
const statusItem = computed(() => statusItems.value.find((item) => item.value === task.value?.status))
const statusLabel = computed(() => statusItem.value?.label || task.value?.status || '等待创建')
const statusColor = computed(() => ({
  primary: 'processing',
  success: 'success',
  warning: 'warning',
  danger: 'error',
  info: 'default',
}[statusItem.value?.tagType || ''] || 'default'))
const progressStatus = computed(() => {
  if (task.value?.status === 'FAILURE') return 'exception'
  if (task.value?.status === 'SUCCESS') return 'success'
  return 'active'
})

function stopPolling() {
  if (pollTimer !== undefined) window.clearInterval(pollTimer)
  pollTimer = undefined
}

async function pollTask() {
  if (polling || task.value?.taskId === undefined) return
  polling = true
  try {
    task.value = await getAsyncTask(task.value.taskId)
    if (isTerminalTaskStatus(task.value.status)) {
      stopPolling()
      if (notifiedTaskId !== task.value.taskId) {
        notifiedTaskId = task.value.taskId
        if (task.value.status === 'SUCCESS') message.success('导出已完成，可下载结果文件')
        if (task.value.status === 'FAILURE') message.error(task.value.failureReason || '导出任务执行失败')
      }
    }
  } catch (error) {
    stopPolling()
    message.error(`${getErrorMessage(error)}，请前往异步任务中心查看任务状态`)
  } finally {
    polling = false
  }
}

function startPolling() {
  stopPolling()
  if (!isTerminalTaskStatus(task.value?.status)) {
    pollTimer = window.setInterval(pollTask, 3000)
  }
}

async function startExport() {
  if (!canExport.value || creating.value) return
  creating.value = true
  try {
    task.value = await createAsyncTask(buildExportTaskRequest(
      props.taskType,
      props.taskName,
      props.resource,
      props.filters,
    ))
    notifiedTaskId = undefined
    open.value = true
    startPolling()
    message.success('导出任务已创建')
  } catch (error) {
    message.error(getErrorMessage(error))
  } finally {
    creating.value = false
  }
}

async function cancelTask() {
  if (!isActive.value || task.value?.taskId === undefined) return
  canceling.value = true
  try {
    task.value = await cancelAsyncTask(task.value.taskId)
    stopPolling()
    message.success('导出任务已取消')
  } catch (error) {
    message.error(getErrorMessage(error))
  } finally {
    canceling.value = false
  }
}

async function downloadResult() {
  if (!canDownload.value || task.value?.resultFileId === undefined) return
  downloading.value = true
  try {
    const response = await downloadFile(task.value.resultFileId)
    downloadBlob(response.data, task.value.resultFileName || 'export.csv')
  } catch (error) {
    message.error(getErrorMessage(error))
  } finally {
    downloading.value = false
  }
}

async function loadStatusItems() {
  try {
    statusItems.value = await listDictItems('async_task_status')
  } catch {
    statusItems.value = []
  }
}

async function goToTaskCenter() {
  open.value = false
  await router.push('/system/async-task')
}

onMounted(() => void loadStatusItems())
onBeforeUnmount(stopPolling)
</script>

<template>
  <template v-if="canExport">
    <a-button class="export-action" :loading="creating" @click="startExport">导出</a-button>

    <a-modal v-model:open="open" :title="taskName" :width="560" :footer="null">
      <div class="export-status">
        <div class="status-heading">
          <div>
            <span class="status-caption">任务状态</span>
            <a-tag :color="statusColor">{{ statusLabel }}</a-tag>
          </div>
          <strong>{{ task?.progress ?? 0 }}%</strong>
        </div>
        <a-progress :percent="task?.progress ?? 0" :status="progressStatus" :show-info="false" />

        <a-alert
          v-if="task?.status === 'FAILURE'"
          type="error"
          show-icon
          message="导出失败"
          :description="task.failureReason || '后端未返回失败原因'"
        />
        <a-alert
          v-else-if="task?.status === 'SUCCESS' && task.resultFileId === undefined"
          type="warning"
          show-icon
          message="结果文件已过期或不可用"
        />
        <a-alert
          v-else-if="task?.status === 'SUCCESS' && !canDownload"
          type="warning"
          show-icon
          message="导出完成，但当前账号没有结果文件下载权限"
        />
        <p v-else-if="isActive" class="status-note">任务正在后台处理，关闭弹窗不会取消导出。</p>
        <p v-else-if="task?.status === 'CANCELED'" class="status-note">任务已取消，不会生成结果文件。</p>
        <p v-else-if="task?.status === 'SUCCESS'" class="status-note">导出已完成，可以下载结果文件。</p>

        <div class="status-meta">
          <span>任务编号</span><code>{{ task?.taskId ?? '—' }}</code>
          <span>结果文件</span><strong>{{ task?.resultFileName || '—' }}</strong>
        </div>

        <div class="modal-actions">
          <a-button @click="goToTaskCenter">前往异步任务</a-button>
          <a-button @click="open = false">关闭</a-button>
          <a-button v-if="isActive" danger :loading="canceling" @click="cancelTask">取消任务</a-button>
          <a-button
            v-if="task?.status === 'SUCCESS' && task.resultFileId !== undefined && canDownload"
            type="primary"
            :loading="downloading"
            @click="downloadResult"
          >下载文件</a-button>
        </div>
      </div>
    </a-modal>
  </template>
</template>

<style scoped>
.export-action { color: var(--shell-ink); background: var(--shell-hover); }
.export-action:hover { color: var(--brand) !important; background: color-mix(in srgb, var(--brand) 11%, var(--shell-panel)) !important; }
.export-status { padding-top: 8px; }
.status-heading { display: flex; align-items: center; justify-content: space-between; margin-bottom: 5px; }
.status-heading > div { display: flex; align-items: center; gap: 9px; }
.status-heading strong { color: var(--brand-deep); font-size: 20px; font-variant-numeric: tabular-nums; }
.status-caption { color: var(--shell-muted); font-size: 13px; }
.status-note { margin: 13px 0 0; padding: 10px 12px; color: var(--shell-muted); background: var(--shell-hover); }
.status-meta { display: grid; margin-top: 14px; grid-template-columns: 82px minmax(0, 1fr); border-top: 1px solid var(--shell-border); border-left: 1px solid var(--shell-border); }
.status-meta > * { min-width: 0; padding: 9px 11px; overflow-wrap: anywhere; border-right: 1px solid var(--shell-border); border-bottom: 1px solid var(--shell-border); }
.status-meta span { color: var(--shell-muted); background: var(--shell-hover); }
.status-meta code { color: var(--brand-deep); font-family: 'SFMono-Regular', Consolas, monospace; }
.modal-actions { display: flex; justify-content: flex-end; gap: 8px; margin-top: 18px; }
</style>
