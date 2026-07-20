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
import { resolveMenuIcon } from '@/components/layout/menu-icons'
import { buildMenuTree, type MenuNode } from '@/router/dynamic'
import { useAuthStore } from '@/stores/auth'
import { createLatestRequest } from '@/utils/latest-request'

import { buildDonutGradient, buildMetricGroups, buildToneSegments } from './dashboard-charts'

const router = useRouter()
const auth = useAuthStore()
const overview = ref<DashboardOverview | null>(null)
const loading = ref(true)
const runLatestLoad = createLatestRequest(loading)
const errorMessage = ref('')

const metrics = computed(() => overview.value?.metrics || [])
const primaryMetrics = computed(() => metrics.value.slice(0, 4))
const metricGroups = computed(() => buildMetricGroups(metrics.value))
const toneSegments = computed(() => buildToneSegments(metrics.value))
const donutStyle = computed(() => ({ background: buildDonutGradient(toneSegments.value) }))
const migrations = computed(() => [
  overview.value?.migrationVersions?.foundation,
  overview.value?.migrationVersions?.business,
].filter(Boolean))
const migrationMax = computed(() => Math.max(1, ...migrations.value.map((track) => track?.appliedCount || 0)))

function flattenMenus(nodes: MenuNode[]): MenuNode[] {
  return nodes.flatMap((node) => [node, ...flattenMenus(node.children)])
}

const quickMenus = computed(() =>
  flattenMenus(buildMenuTree(auth.user?.menus || []))
    .filter((menu) => menu.menuType === 'MENU' && menu.fullPath !== '/dashboard')
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

function migrationWidth(count?: number) {
  return `${(count || 0) / migrationMax.value * 100}%`
}

async function load() {
  errorMessage.value = ''
  try {
    const result = await runLatestLoad(getDashboardOverview)
    if (!result) return
    overview.value = result
  } catch (error) {
    errorMessage.value = getErrorMessage(error)
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

    <a-skeleton v-if="loading && !overview" class="dashboard-skeleton" active :paragraph="{ rows: 12 }" />

    <template v-else-if="overview">
      <section class="metric-grid" aria-label="核心指标">
        <article
          v-for="(metric, index) in primaryMetrics"
          :key="metric.key || index"
          class="metric-card"
          :class="`tone-${tone(metric)}`"
        >
          <div class="metric-top">
            <span>{{ String(index + 1).padStart(2, '0') }}</span>
            <i></i>
            <small>{{ metric.group || '实时快照' }}</small>
          </div>
          <strong>{{ displayMetric(metric) }}</strong>
          <p>{{ metric.name || metric.key || '未命名指标' }}</p>
          <div class="metric-line"><span></span></div>
        </article>
      </section>

      <section class="dashboard-grid">
        <article class="panel chart-panel">
          <header class="panel-head">
            <div><h2>指标分布</h2><p>按运行领域统计当前快照指标</p></div>
            <strong>{{ metrics.length }}<small>项</small></strong>
          </header>
          <div v-if="metricGroups.length" class="group-chart">
            <div v-for="group in metricGroups" :key="group.key" class="group-row">
              <div class="group-label"><span>{{ group.label }}</span><b>{{ group.count }} 项</b></div>
              <div class="group-track"><i :style="{ width: `${group.ratio}%` }"></i></div>
              <small>{{ Math.round(group.ratio) }}%</small>
            </div>
          </div>
          <a-empty v-else :image="AEmpty.PRESENTED_IMAGE_SIMPLE" description="暂无指标数据" />
          <footer class="chart-footer">
            <span><i></i>当前数据来自系统实时概览接口</span>
            <b>{{ metricGroups.length }} 个运行领域</b>
          </footer>
        </article>

        <article class="panel quick-panel">
          <header class="panel-head compact-head">
            <div><h2>快捷入口</h2><p>常用管理功能</p></div>
          </header>
          <div v-if="quickMenus.length" class="quick-list">
            <button v-for="menu in quickMenus" :key="menu.menuId" type="button" @click="router.push(menu.fullPath!)">
              <component :is="resolveMenuIcon(menu.icon)" />
              <span>{{ menu.menuName }}</span>
              <ArrowRightOutlined class="quick-arrow" />
            </button>
          </div>
          <a-empty v-else :image="AEmpty.PRESENTED_IMAGE_SIMPLE" description="当前角色暂无其他菜单" />
        </article>

        <article class="panel tone-panel">
          <header class="panel-head compact-head">
            <div><h2>状态构成</h2><p>指标状态分布</p></div>
          </header>
          <div class="tone-content">
            <div class="donut" :style="donutStyle" role="img" aria-label="指标状态构成环图">
              <div><strong>{{ metrics.length }}</strong><span>指标</span></div>
            </div>
            <ul>
              <li v-for="segment in toneSegments" :key="segment.key">
                <i :style="{ background: segment.color }"></i>
                <span>{{ segment.label }}</span>
                <b>{{ segment.count }}</b>
              </li>
            </ul>
          </div>
        </article>

        <article class="panel migration-panel">
          <header class="panel-head compact-head">
            <div><h2>环境版本</h2><p>数据库迁移状态</p></div>
            <ClockCircleOutlined />
          </header>
          <div class="migration-list">
            <div v-for="track in migrations" :key="track?.name" class="migration-item">
              <div class="migration-title">
                <strong>{{ track?.name || '环境' }}</strong>
                <a-tag :color="track?.available ? 'success' : 'default'">{{ track?.available ? '可用' : '不可用' }}</a-tag>
              </div>
              <div class="migration-version"><b>{{ track?.latestVersion || '--' }}</b><span>{{ track?.appliedCount || 0 }} 个迁移</span></div>
              <div class="migration-track"><i :style="{ width: migrationWidth(track?.appliedCount) }"></i></div>
              <p>{{ track?.latestDescription || track?.message || '暂无版本说明' }}</p>
            </div>
          </div>
        </article>

        <article class="panel alerts-panel">
          <header class="panel-head compact-head">
            <div><h2>系统提醒</h2><p>需要关注的运行信息</p></div>
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
.dashboard-page { display: grid; width: 100%; min-width: 0; max-width: 100%; height: 100%; min-height: 0; padding: 8px 10px 10px; overflow: hidden; color: var(--shell-ink); grid-template-rows: auto minmax(0, 1fr); }
.dashboard-alert { margin-bottom: 8px; }
.dashboard-skeleton { padding: 10px; background: var(--shell-panel); }
.metric-grid { display: grid; margin-bottom: 8px; gap: 8px; grid-column: 1; grid-row: 1; grid-template-columns: repeat(4, minmax(0, 1fr)); }
.metric-card { position: relative; min-height: 108px; padding: 11px 14px 10px; overflow: hidden; border: 1px solid var(--shell-border); background: var(--shell-panel); transition: border-color .18s ease, transform .18s ease; }
.metric-card:hover { border-color: color-mix(in srgb, var(--metric-color, var(--brand)) 48%, var(--shell-border)); transform: translateY(-1px); }
.metric-card::after { position: absolute; top: -27px; right: -27px; width: 80px; height: 80px; border: 1px solid var(--metric-color, var(--brand)); opacity: .1; transform: rotate(45deg); content: ''; }
.metric-top { display: flex; align-items: center; gap: 9px; color: var(--shell-muted); }
.metric-top span { color: var(--metric-color, var(--brand)); font-size: 11px; font-weight: 700; }
.metric-top i { height: 1px; flex: 1; background: var(--shell-border); }
.metric-top small { max-width: 42%; overflow: hidden; font-size: 10px; text-overflow: ellipsis; white-space: nowrap; }
.metric-card > strong { display: block; margin-top: 7px; overflow: hidden; color: var(--shell-ink); font-size: clamp(21px, 2vw, 28px); font-weight: 600; font-variant-numeric: tabular-nums; letter-spacing: -.035em; text-overflow: ellipsis; white-space: nowrap; }
.metric-card > p { margin: 0 0 7px; color: var(--shell-muted); font-size: 13px; }
.metric-line { height: 2px; overflow: hidden; background: var(--shell-border); }
.metric-line span { display: block; width: 62%; height: 100%; background: var(--metric-color, var(--brand)); }
.tone-success { --metric-color: #28a87d; }
.tone-warning { --metric-color: #d9962f; }
.tone-danger { --metric-color: #cf5f54; }
.tone-info { --metric-color: #5b82bd; }
.dashboard-grid { display: grid; min-height: 0; gap: 8px; grid-column: 1; grid-row: 2; grid-template-columns: 1.25fr 1fr 1fr; grid-template-rows: repeat(2, minmax(0, 1fr)); }
.panel { min-width: 0; min-height: 0; padding: 12px; overflow: hidden; border: 1px solid var(--shell-border); background: var(--shell-panel); }
.panel-head { display: flex; align-items: flex-start; justify-content: space-between; margin-bottom: 12px; padding-bottom: 10px; border-bottom: 1px solid var(--shell-border); }
.panel-head h2 { margin: 0; color: var(--shell-ink); font-size: 17px; font-weight: 600; }
.panel-head p { margin: 2px 0 0; color: var(--shell-muted); font-size: 11px; }
.panel-head > strong { color: var(--brand); font-size: 24px; line-height: 1; }
.panel-head > strong small { margin-left: 2px; color: var(--shell-muted); font-size: 11px; font-weight: 400; }
.compact-head { margin-bottom: 9px; padding-bottom: 8px; }
.chart-panel { display: flex; grid-row: 1 / span 2; flex-direction: column; }
.group-chart { min-height: 0; padding: 4px 2px; overflow: auto; flex: 1; }
.group-row { display: grid; align-items: center; gap: 10px; margin-bottom: 15px; grid-template-columns: minmax(92px, .65fr) minmax(100px, 1.35fr) 34px; }
.group-label { display: flex; min-width: 0; align-items: baseline; justify-content: space-between; gap: 6px; }
.group-label span { overflow: hidden; font-size: 13px; font-weight: 600; text-overflow: ellipsis; white-space: nowrap; }
.group-label b { flex: none; color: var(--shell-muted); font-size: 10px; font-weight: 400; }
.group-track { height: 14px; padding: 3px; background: var(--shell-hover); }
.group-track i { display: block; min-width: 3px; height: 100%; background: linear-gradient(90deg, color-mix(in srgb, var(--brand) 62%, transparent), var(--brand)); }
.group-row > small { color: var(--brand); font-size: 11px; font-variant-numeric: tabular-nums; text-align: right; }
.chart-footer { display: flex; align-items: center; justify-content: space-between; padding-top: 9px; color: var(--shell-muted); font-size: 10px; border-top: 1px solid var(--shell-border); }
.chart-footer span { display: flex; align-items: center; gap: 6px; }
.chart-footer span i { width: 6px; height: 6px; background: var(--brand); }
.chart-footer b { color: var(--shell-ink); font-weight: 500; }
.quick-list { display: grid; gap: 6px; grid-template-columns: repeat(2, minmax(0, 1fr)); }
.quick-list button { display: grid; min-width: 0; min-height: 43px; align-items: center; padding: 0 10px; color: var(--shell-ink); font-size: 13px; border: 1px solid var(--shell-border); background: transparent; cursor: pointer; grid-template-columns: 20px minmax(0, 1fr) 16px; text-align: left; }
.quick-list button:hover { color: var(--brand); border-color: color-mix(in srgb, var(--brand) 58%, var(--shell-border)); background: var(--shell-hover); }
.quick-list button :deep(.anticon) { color: var(--brand); font-size: 15px; }
.quick-list button span { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.quick-list .quick-arrow { color: var(--shell-muted); font-size: 12px; }
.tone-content { display: flex; height: calc(100% - 54px); min-height: 100px; align-items: center; justify-content: space-evenly; gap: 16px; }
.donut { position: relative; width: 104px; height: 104px; flex: none; border-radius: 50%; }
.donut::after { position: absolute; inset: 17px; border-radius: 50%; background: var(--shell-panel); content: ''; }
.donut > div { position: absolute; z-index: 1; inset: 0; display: flex; align-items: center; justify-content: center; flex-direction: column; }
.donut strong { font-size: 24px; font-variant-numeric: tabular-nums; line-height: 1; }
.donut span { margin-top: 4px; color: var(--shell-muted); font-size: 10px; }
.tone-content ul { display: grid; min-width: 90px; margin: 0; padding: 0; gap: 7px; list-style: none; }
.tone-content li { display: grid; align-items: center; gap: 7px; color: var(--shell-muted); font-size: 11px; grid-template-columns: 7px minmax(44px, 1fr) auto; }
.tone-content li i { width: 7px; height: 7px; }
.tone-content li b { color: var(--shell-ink); font-variant-numeric: tabular-nums; }
.migration-list { display: grid; gap: 10px; }
.migration-item { min-width: 0; }
.migration-title, .migration-version { display: flex; align-items: center; justify-content: space-between; gap: 8px; }
.migration-title strong { overflow: hidden; font-size: 12px; text-overflow: ellipsis; white-space: nowrap; }
.migration-version b { color: var(--brand); font-size: 17px; }
.migration-version span { color: var(--shell-muted); font-size: 10px; }
.migration-track { height: 3px; margin: 3px 0; overflow: hidden; background: var(--shell-border); }
.migration-track i { display: block; min-width: 2px; height: 100%; background: var(--brand); }
.migration-item p { margin: 0; overflow: hidden; color: var(--shell-muted); font-size: 10px; text-overflow: ellipsis; white-space: nowrap; }
.alerts-panel { display: flex; flex-direction: column; }
.alerts-panel ul { display: grid; min-height: 0; margin: 0; padding: 0; overflow: auto; gap: 6px; list-style: none; }
.alerts-panel li { display: flex; align-items: flex-start; gap: 7px; padding: 7px 9px; color: var(--shell-muted); font-size: 11px; line-height: 1.4; background: var(--shell-hover); }
.alerts-panel li :deep(.anticon) { margin-top: 1px; color: #d9962f; font-size: 14px; }
.all-clear { display: flex; min-height: 0; align-items: center; justify-content: center; flex: 1; flex-direction: column; color: #31a77e; }
.all-clear :deep(.anticon) { margin-bottom: 7px; font-size: 26px; }
.all-clear strong { color: var(--shell-ink); font-size: 12px; }
.all-clear span { margin-top: 3px; color: var(--shell-muted); font-size: 10px; }
@media (prefers-reduced-motion: reduce) { .metric-card { transition: none; } }
</style>
