<script setup lang="ts">
defineOptions({ name: 'DashboardView' })

import {
  ArrowRightOutlined,
  CheckCircleFilled,
  ClockCircleOutlined,
  ExclamationCircleFilled,
} from '@ant-design/icons-vue'
import {
  Alert as AAlert,
  Button as AButton,
  Empty as AEmpty,
  Skeleton as ASkeleton,
  Tag as ATag,
} from 'ant-design-vue'
import { computed, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'

import {
  getDashboardOverview,
  type DashboardMetric,
  type DashboardOverview,
} from '@/api/dashboard'
import { getErrorMessage } from '@/api/http'
import { buildMenuTree, type MenuNode } from '@/router/dynamic'
import { useAuthStore } from '@/stores/auth'

const router = useRouter()
const auth = useAuthStore()
const overview = ref<DashboardOverview | null>(null)
const loading = ref(true)
const errorMessage = ref('')

const metrics = computed(() => overview.value?.metrics || [])
const primaryMetrics = computed(() => metrics.value.slice(0, 4))
const migrations = computed(() => [
  overview.value?.migrationVersions?.foundation,
  overview.value?.migrationVersions?.business,
].filter(Boolean))

function flattenMenus(nodes: MenuNode[]): MenuNode[] {
  return nodes.flatMap((node) => [node, ...flattenMenus(node.children)])
}

const quickMenus = computed(() =>
  flattenMenus(buildMenuTree(auth.user?.menus || []))
    .filter((menu) =>
      menu.menuType === 'MENU'
      && menu.fullPath !== '/dashboard',
    )
    .slice(0, 4),
)

function displayMetric(metric: DashboardMetric) {
  if (metric.text) return metric.text
  if (metric.value === undefined) return '--'
  return `${new Intl.NumberFormat('zh-CN', { maximumFractionDigits: 2 }).format(metric.value)}${metric.unit || ''}`
}

function tone(metric: DashboardMetric) {
  return ['success', 'warning', 'danger', 'info'].includes(metric.tone || '')
    ? metric.tone
    : 'primary'
}

async function load() {
  loading.value = true
  errorMessage.value = ''
  try {
    overview.value = await getDashboardOverview()
  } catch (error) {
    errorMessage.value = getErrorMessage(error)
  } finally {
    loading.value = false
  }
}

onMounted(() => load())
</script>

<template>
  <main class="dashboard-page">
    <a-alert
      v-if="errorMessage"
      class="dashboard-alert"
      type="error"
      show-icon
      :message="errorMessage"
    >
      <template #action><a-button size="small" @click="load()">重试</a-button></template>
    </a-alert>

    <a-skeleton v-if="loading && !overview" active :paragraph="{ rows: 12 }" />

    <template v-else-if="overview">
      <section class="metric-grid">
        <article
          v-for="(metric, index) in primaryMetrics"
          :key="metric.key || index"
          class="metric-card"
          :class="`tone-${tone(metric)}`"
        >
          <div class="metric-top">
            <span>{{ String(index + 1).padStart(2, '0') }}</span>
            <i></i>
          </div>
          <strong>{{ displayMetric(metric) }}</strong>
          <p>{{ metric.name || metric.key || '未命名指标' }}</p>
          <div class="metric-line"><span></span></div>
        </article>
      </section>

      <section class="dashboard-grid">
        <article class="panel quick-panel">
          <header class="panel-head">
            <h2>快捷入口</h2>
          </header>
          <div v-if="quickMenus.length" class="quick-list">
            <button v-for="menu in quickMenus" :key="menu.menuId" type="button" @click="router.push(menu.fullPath!)">
              <span>{{ menu.menuName }}</span><ArrowRightOutlined />
            </button>
          </div>
          <a-empty v-else :image="AEmpty.PRESENTED_IMAGE_SIMPLE" description="当前角色暂无其他菜单" />
        </article>

        <article class="panel migration-panel">
          <header class="panel-head">
            <h2>环境版本</h2>
            <ClockCircleOutlined />
          </header>
          <div class="migration-list">
            <div v-for="track in migrations" :key="track?.name" class="migration-item">
              <span class="migration-mark"></span>
              <div class="migration-copy">
                <div><strong>{{ track?.name || '环境' }}</strong><a-tag :color="track?.available ? 'success' : 'default'">{{ track?.available ? '可用' : '不可用' }}</a-tag></div>
                <b>{{ track?.latestVersion || '--' }}</b>
                <p>{{ track?.latestDescription || track?.message || '暂无版本说明' }}</p>
                <small>已应用 {{ track?.appliedCount || 0 }} 个迁移</small>
              </div>
            </div>
          </div>
        </article>

        <article class="panel alerts-panel">
          <header class="panel-head">
            <h2>系统提醒</h2>
            <a-tag :color="overview.alerts?.length ? 'warning' : 'success'">{{ overview.alerts?.length || 0 }}</a-tag>
          </header>
          <ul v-if="overview.alerts?.length">
            <li v-for="alert in overview.alerts" :key="alert"><ExclamationCircleFilled /><span>{{ alert }}</span></li>
          </ul>
          <div v-else class="all-clear"><CheckCircleFilled /><strong>当前无待处理提醒</strong><span>系统各项状态处于预期范围</span></div>
        </article>

      </section>
    </template>
  </main>
</template>

<style scoped>
.dashboard-page { width: 100%; min-width: 0; max-width: 100%; min-height: 100%; padding: 8px 10px 10px; overflow-x: hidden; color: var(--shell-ink); }
.dashboard-alert { margin-bottom: 9px; }
.metric-grid { display: grid; margin-bottom: 9px; gap: 8px; grid-template-columns: repeat(4, minmax(0, 1fr)); }
.metric-card { position: relative; min-height: 108px; padding: 12px 14px 11px; overflow: hidden; border: 1px solid var(--shell-border); background: var(--shell-panel); transition: transform 0.2s ease, border-color 0.2s ease; }
.metric-card:hover { border-color: color-mix(in srgb, var(--brand) 45%, var(--shell-border)); transform: translateY(-2px); }
.metric-card::after { position: absolute; top: -20px; right: -20px; width: 70px; height: 70px; border: 1px solid var(--metric-color, var(--brand)); opacity: 0.09; transform: rotate(45deg); content: ''; }
.metric-top { display: flex; align-items: center; gap: 9px; color: var(--shell-muted); }
.metric-top span { color: var(--metric-color, var(--brand)); font-size: 11px; font-weight: 700; }
.metric-top i { height: 1px; flex: 1; background: var(--shell-border); }
.metric-card > strong { display: block; margin-top: 9px; color: var(--shell-ink); font-size: 28px; font-weight: 600; font-variant-numeric: tabular-nums; letter-spacing: -0.03em; }
.metric-card > p { margin: 0 0 7px; color: var(--shell-muted); font-size: 14px; }
.metric-line { height: 2px; overflow: hidden; background: var(--shell-border); }
.metric-line span { display: block; width: 58%; height: 100%; background: var(--metric-color, var(--brand)); }
.tone-success { --metric-color: #28a87d; }
.tone-warning { --metric-color: #d9962f; }
.tone-danger { --metric-color: #cf5f54; }
.tone-info { --metric-color: #5b82bd; }
.dashboard-grid { display: grid; gap: 8px; grid-template-columns: 1.4fr 1fr 1fr; }
.panel { min-height: 206px; padding: 13px; border: 1px solid var(--shell-border); background: var(--shell-panel); }
.panel-head { display: flex; align-items: flex-start; justify-content: space-between; margin-bottom: 10px; padding-bottom: 9px; border-bottom: 1px solid var(--shell-border); }
.panel-head h2 { margin: 0; color: var(--shell-ink); font-size: 18px; font-weight: 600; }
.migration-list { display: grid; gap: 9px; }
.migration-item { display: flex; gap: 10px; }
.migration-mark { width: 2px; flex: none; background: linear-gradient(var(--brand), transparent); }
.migration-copy { min-width: 0; flex: 1; }
.migration-copy > div { display: flex; align-items: center; justify-content: space-between; }
.migration-copy strong { color: var(--shell-ink); font-size: 14px; }
.migration-copy b { display: block; margin-top: 1px; color: var(--brand); font-size: 18px; }
.migration-copy p { margin: 1px 0; overflow: hidden; color: var(--shell-muted); font-size: 12px; text-overflow: ellipsis; white-space: nowrap; }
.migration-copy small { color: var(--shell-muted); font-size: 11px; }
.alerts-panel ul { display: grid; margin: 0; padding: 0; gap: 7px; list-style: none; }
.alerts-panel li { display: flex; align-items: flex-start; gap: 8px; padding: 8px 10px; color: var(--shell-muted); font-size: 13px; line-height: 1.45; background: var(--shell-hover); }
.alerts-panel li :deep(.anticon) { margin-top: 2px; color: #d9962f; font-size: 16px; }
.all-clear { display: flex; height: 150px; align-items: center; justify-content: center; flex-direction: column; color: #31a77e; }
.all-clear :deep(.anticon) { margin-bottom: 10px; font-size: 30px; }
.all-clear strong { color: var(--shell-ink); font-size: 14px; }
.all-clear span { margin-top: 4px; color: var(--shell-muted); font-size: 12px; }
.quick-list { display: grid; gap: 5px; grid-template-columns: repeat(2, 1fr); }
.quick-list button { display: flex; min-height: 42px; align-items: center; justify-content: space-between; padding: 0 11px; color: var(--shell-ink); font-size: 14px; border: 1px solid var(--shell-border); background: transparent; cursor: pointer; }
.quick-list button:hover { color: var(--brand); border-color: var(--brand); background: var(--shell-hover); }
@media (max-width: 1280px) {
  .dashboard-grid { grid-template-columns: 1.2fr 1fr; }
}
@media (prefers-reduced-motion: reduce) { .metric-card { transition: none; } }
</style>
