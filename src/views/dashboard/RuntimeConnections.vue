<script setup lang="ts">
import {
  Alert as AAlert,
  Button as AButton,
  Empty as AEmpty,
  Spin as ASpin,
  Tag as ATag,
} from 'ant-design-vue'
import axios from 'axios'
import dayjs from 'dayjs'
import { computed, onActivated, onDeactivated, onMounted, onUnmounted, ref } from 'vue'

import { getRuntimeConnections, type RuntimeConnectionsOverview } from '@/api/dashboard'
import { getErrorMessage } from '@/api/http'
import { connectionState } from './runtime-connections'

const snapshot = ref<RuntimeConnectionsOverview | null>(null)
const loading = ref(false)
const error = ref('')
const now = ref(Date.now())
let receivedAt = Date.now()
let active = false
let generation = 0
let controller: AbortController | undefined
let pollTimer: ReturnType<typeof setTimeout> | undefined
let clockTimer: ReturnType<typeof setInterval> | undefined
const intervalSeconds = computed(() => {
  const seconds = snapshot.value?.refreshAfterSeconds
  return seconds && Number.isFinite(seconds) && seconds > 0 ? seconds : 15
})
const groups = computed(() => {
  const serverNow =
    Date.parse(snapshot.value?.generatedAt || '') + Math.max(0, now.value - receivedAt)
  const items = snapshot.value?.items || []
  const sections = [
    { key: 'FOUNDATION', label: '基础服务' },
    { key: 'INTEGRATION', label: '外部集成' },
  ]
  if (items.some((item) => !item.group)) sections.push({ key: '', label: '未分组' })
  return sections.map((group) => ({
    ...group,
    items: items
      .filter((item) => (item.group ?? '') === group.key)
      .sort((a, b) => (a.id ?? '').localeCompare(b.id ?? ''))
      .map((item) => ({
        ...item,
        display: connectionState(item, serverNow, Boolean(error.value)),
      })),
  }))
})

function time(value?: string | null) {
  return value && dayjs(value).isValid() ? dayjs(value).format('YYYY-MM-DD HH:mm:ss') : '—'
}

async function refresh() {
  if (!active || document.hidden || loading.value) return
  clearTimeout(pollTimer)
  const requestGeneration = generation
  controller = new AbortController()
  loading.value = true
  let retry = true
  try {
    const result = await getRuntimeConnections(controller.signal)
    if (requestGeneration !== generation) return
    snapshot.value = result
    receivedAt = Date.now()
    now.value = receivedAt
    error.value = ''
  } catch (cause) {
    if (requestGeneration !== generation || axios.isCancel(cause)) return
    const status = axios.isAxiosError(cause) ? cause.response?.status : undefined
    error.value = status === 403 ? '访问被拒绝，连接状态未知' : getErrorMessage(cause)
    retry = status !== 401
  } finally {
    if (requestGeneration === generation) {
      loading.value = false
      if (active && !document.hidden && retry) {
        pollTimer = setTimeout(refresh, intervalSeconds.value * 1000)
      }
    }
  }
}

function pause() {
  generation++
  clearTimeout(pollTimer)
  clearInterval(clockTimer)
  controller?.abort()
  loading.value = false
}

function resume() {
  if (!active || document.hidden) return
  pause()
  now.value = Date.now()
  clockTimer = setInterval(() => {
    now.value = Date.now()
  }, 1000)
  void refresh()
}

function activate() {
  if (active) return
  active = true
  resume()
}

function visibilityChanged() {
  if (document.hidden) pause()
  else resume()
}

onMounted(() => {
  document.addEventListener('visibilitychange', visibilityChanged)
  activate()
})
onActivated(activate)
onDeactivated(() => {
  active = false
  pause()
})
onUnmounted(() => {
  active = false
  pause()
  document.removeEventListener('visibilitychange', visibilityChanged)
})
</script>

<template>
  <section class="connections-panel" aria-label="运行连接状态">
    <header class="connections-head">
      <h2>运行连接状态</h2>
      <div>
        <span v-if="snapshot"
          >缓存时间 {{ time(snapshot.generatedAt) }} · {{ intervalSeconds }} 秒刷新</span
        >
        <a-button size="small" :loading="loading" @click="refresh">刷新</a-button>
      </div>
    </header>
    <a-alert v-if="error" type="error" show-icon :message="error" role="alert" />
    <div class="connections-body" :aria-busy="loading">
      <div v-if="loading && !snapshot" class="connections-loading"><a-spin /> 正在读取连接状态</div>
      <a-empty
        v-else-if="!snapshot?.items?.length"
        :image="AEmpty.PRESENTED_IMAGE_SIMPLE"
        :description="error ? '连接状态未知，请重试' : '暂无连接状态'"
      />
      <template v-else>
        <section v-for="group in groups" :key="group.key" class="connection-group">
          <h3>{{ group.label }}</h3>
          <p v-if="!group.items.length" class="muted">暂无连接项</p>
          <ul v-else>
            <li v-for="item in group.items" :key="item.id" class="connection-item">
              <div class="connection-title">
                <strong>{{ item.name || item.id || '—' }}</strong>
                <a-tag :color="item.display.color">{{ item.display.label }}</a-tag>
              </div>
              <p v-if="item.display.reason" class="muted">{{ item.display.reason }}</p>
              <p>{{ item.message || '—' }}</p>
              <details>
                <summary>检查详情</summary>
                <dl>
                  <dt>连接类型</dt>
                  <dd>{{ item.kind || '—' }}</dd>
                  <dt>最近检查</dt>
                  <dd>{{ time(item.checkedAt) }}</dd>
                  <dt>最近成功</dt>
                  <dd>{{ time(item.lastSuccessAt) }}</dd>
                  <dt>检查耗时</dt>
                  <dd>{{ item.durationMillis == null ? '—' : `${item.durationMillis} ms` }}</dd>
                  <dt>连续失败</dt>
                  <dd>{{ item.consecutiveFailures ?? '—' }}</dd>
                  <dt>最近通信</dt>
                  <dd>{{ time(item.lastCommunicationAt) }}</dd>
                  <dt>通信结果</dt>
                  <dd>
                    {{
                      item.lastCommunicationStatus === 'SUCCESS'
                        ? '成功'
                        : item.lastCommunicationStatus === 'FAILURE'
                          ? '失败'
                          : '—'
                    }}
                  </dd>
                </dl>
              </details>
            </li>
          </ul>
        </section>
      </template>
    </div>
  </section>
</template>

<style scoped>
.connections-panel {
  display: flex;
  min-width: 0;
  min-height: 0;
  flex-direction: column;
  padding: 12px;
  border: 1px solid var(--shell-border);
  background: var(--shell-panel);
}
.connections-head,
.connections-head > div,
.connection-title {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}
.connections-head {
  flex: none;
  margin-bottom: 8px;
}
h2 {
  margin: 0;
  color: var(--shell-ink);
  font-size: 17px;
}
.connections-head span,
.muted,
dt {
  color: var(--shell-muted);
  font-size: 12px;
}
.connections-body {
  display: flex;
  min-height: 0;
  overflow: auto;
  gap: 16px;
  flex: 1;
}
.connection-group {
  min-width: 0;
  flex: 1;
}
h3 {
  margin: 8px 0;
  font-size: 13px;
  color: var(--shell-muted);
}
ul {
  margin: 0;
  padding: 0;
  list-style: none;
}
.connection-item {
  padding: 8px 0;
  border-top: 1px solid var(--shell-border);
  font-size: 13px;
  overflow-wrap: anywhere;
}
.connection-title strong {
  min-width: 0;
}
.connection-title :deep(.ant-tag) {
  margin: 0;
  flex: none;
}
p {
  margin: 4px 0;
}
summary {
  cursor: pointer;
  color: var(--brand);
}
summary:focus-visible {
  outline: 2px solid var(--brand);
  outline-offset: 2px;
}
dl {
  display: grid;
  grid-template-columns: 80px minmax(0, 1fr);
  gap: 4px 8px;
  margin: 8px 0 0;
}
dd {
  margin: 0;
  font-variant-numeric: tabular-nums;
}
.connections-loading {
  margin: auto;
  color: var(--brand);
}
</style>
