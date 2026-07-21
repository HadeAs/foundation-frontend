<script setup lang="ts">
import {
  HolderOutlined,
  PushpinOutlined,
  SettingOutlined,
} from '@ant-design/icons-vue'
import {
  Button as AButton,
  Checkbox as ACheckbox,
  Popover as APopover,
  Table as ATable,
  type TableColumnsType,
  type TableProps,
} from 'ant-design-vue'
import {
  computed,
  nextTick,
  onBeforeUnmount,
  onMounted,
  onUpdated,
  ref,
  watch,
} from 'vue'

import ResizableHeaderCell from './ResizableHeaderCell.vue'
import { getTableScrollWidth, isActionColumn } from './table-columns'

defineOptions({ inheritAttrs: false })

const props = withDefaults(defineProps<{
  columns: TableColumnsType
  columnSettings?: boolean
  minColumnWidth?: number
  scroll?: TableProps['scroll']
}>(), {
  columnSettings: true,
  minColumnWidth: 56,
})

type ColumnFixed = 'left' | 'right' | false

const widths = ref<Record<string, number>>({})
const host = ref<HTMLElement>()
const bodyHeight = ref<number>()
const settingsTop = ref(6)
const settingsOpen = ref(false)
const columnOrder = ref<string[]>([])
const hiddenColumnKeys = ref<string[]>([])
const fixedColumns = ref<Record<string, ColumnFixed>>({})
const draftOrder = ref<string[]>([])
const draftHiddenKeys = ref<string[]>([])
const draftFixedColumns = ref<Record<string, ColumnFixed>>({})
const draggingKey = ref<string>()
let resizeObserver: ResizeObserver | undefined

function outerHeight(element: HTMLElement | null) {
  if (!element) return 0
  const style = getComputedStyle(element)
  return element.offsetHeight + Number.parseFloat(style.marginTop) + Number.parseFloat(style.marginBottom)
}

async function measureBodyHeight() {
  await nextTick()
  if (!host.value) return
  const height = host.value.clientHeight
  const header = host.value.querySelector<HTMLElement>('.ant-table-thead')
  const pagination = host.value.querySelector<HTMLElement>('.ant-table-pagination')
  const nextHeight = Math.max(80, Math.floor(height - outerHeight(header) - outerHeight(pagination) - 2))
  if (bodyHeight.value !== nextHeight) bodyHeight.value = nextHeight
  if (header) {
    const hostRect = host.value.getBoundingClientRect()
    const headerRect = header.getBoundingClientRect()
    if (headerRect.height > 0) {
      const nextTop = Math.round(headerRect.top - hostRect.top + (headerRect.height - 28) / 2)
      if (settingsTop.value !== nextTop) settingsTop.value = nextTop
    }
  }
}

onMounted(() => {
  if (!host.value) return
  resizeObserver = new ResizeObserver(() => void measureBodyHeight())
  resizeObserver.observe(host.value)
  void measureBodyHeight()
})
onUpdated(() => void measureBodyHeight())
onBeforeUnmount(() => resizeObserver?.disconnect())

function getColumnKey(column: TableColumnsType[number], index: number, parentKey = '') {
  const rawDataIndex = 'dataIndex' in column ? column.dataIndex : undefined
  const dataIndex = Array.isArray(rawDataIndex) ? rawDataIndex.join('.') : rawDataIndex
  return String(column.key ?? dataIndex ?? `${parentKey}${index}`)
}

function syncWidths(columns: TableColumnsType, parentKey = '') {
  columns.forEach((column, index) => {
    const key = getColumnKey(column, index, parentKey)
    if (typeof column.width === 'number' && widths.value[key] === undefined) {
      widths.value[key] = column.width
    }
    if ('children' in column) syncWidths(column.children, `${key}.`)
  })
}

function syncColumnSettings(columns: TableColumnsType) {
  const keys = columns.map((column, index) => getColumnKey(column, index))
  columnOrder.value = [
    ...columnOrder.value.filter((key) => keys.includes(key)),
    ...keys.filter((key) => !columnOrder.value.includes(key)),
  ]
  hiddenColumnKeys.value = hiddenColumnKeys.value.filter((key) => keys.includes(key))
  fixedColumns.value = Object.fromEntries(
    Object.entries(fixedColumns.value).filter(([key]) => keys.includes(key)),
  )
}

watch(() => props.columns, (columns) => {
  syncWidths(columns)
  syncColumnSettings(columns)
}, { immediate: true, deep: true })

function resizeColumn(key: string, width: number) {
  widths.value = { ...widths.value, [key]: width }
}

function makeResizable(columns: TableColumnsType, parentKey = ''): TableColumnsType {
  return columns.map((column, index) => {
    const key = getColumnKey(column, index, parentKey)
    const actionColumn = isActionColumn(column)
    const baseWidth = column.width ?? (actionColumn ? 140 : undefined)
    const numericWidth = typeof baseWidth === 'number'
    const width = numericWidth ? widths.value[key] ?? baseWidth : baseWidth
    const originalHeaderCell = column.customHeaderCell
    const children = 'children' in column ? makeResizable(column.children, `${key}.`) : undefined

    return {
      ...column,
      width,
      children,
      fixed: column.fixed === false ? undefined : column.fixed ?? (actionColumn ? 'right' : undefined),
      customHeaderCell: (currentColumn) => ({
        ...(originalHeaderCell?.(currentColumn) ?? {}),
        width: numericWidth ? width : undefined,
        minWidth: column.minWidth ?? props.minColumnWidth,
        resizable: numericWidth && column.resizable !== false,
        onColumnResize: (nextWidth: number) => resizeColumn(key, nextWidth),
      }),
    }
  })
}

const columnsByKey = computed(() => new Map(
  props.columns.map((column, index) => [getColumnKey(column, index), column]),
))
const configuredColumns = computed<TableColumnsType>(() => columnOrder.value.flatMap((key) => {
  const column = columnsByKey.value.get(key)
  if (!column || hiddenColumnKeys.value.includes(key)) return []
  return [{
    ...column,
    ...(Object.hasOwn(fixedColumns.value, key) ? { fixed: fixedColumns.value[key] } : {}),
  }]
}))
const resizableColumns = computed(() => makeResizable(configuredColumns.value))
const allColumnsVisible = computed(() =>
  draftOrder.value.length > 0 && draftOrder.value.every((key) => !draftHiddenKeys.value.includes(key)),
)
const someColumnsVisible = computed(() =>
  draftOrder.value.some((key) => !draftHiddenKeys.value.includes(key)),
)

function getColumnLabel(key: string) {
  const title = columnsByKey.value.get(key)?.title
  return typeof title === 'string' || typeof title === 'number' ? String(title) : key
}

function getColumnFixed(key: string): 'left' | 'right' | undefined {
  const configured = Object.hasOwn(draftFixedColumns.value, key)
    ? draftFixedColumns.value[key]
    : columnsByKey.value.get(key)?.fixed
  if (configured === true) return 'left'
  if (configured === 'left' || configured === 'right') return configured
  return isActionColumn(columnsByKey.value.get(key)!) ? 'right' : undefined
}

function handleSettingsOpen(open: boolean) {
  settingsOpen.value = open
  if (!open) return
  draftOrder.value = [...columnOrder.value]
  draftHiddenKeys.value = [...hiddenColumnKeys.value]
  draftFixedColumns.value = { ...fixedColumns.value }
}

function setColumnVisible(key: string, visible: boolean) {
  draftHiddenKeys.value = visible
    ? draftHiddenKeys.value.filter((item) => item !== key)
    : [...new Set([...draftHiddenKeys.value, key])]
}

function setAllColumnsVisible(visible: boolean) {
  draftHiddenKeys.value = visible ? [] : [...draftOrder.value]
}

function toggleColumnFixed(key: string, side: 'left' | 'right') {
  draftFixedColumns.value = {
    ...draftFixedColumns.value,
    [key]: getColumnFixed(key) === side ? false : side,
  }
}

function startColumnDrag(key: string, event: DragEvent) {
  draggingKey.value = key
  if (!event.dataTransfer) return
  event.dataTransfer.effectAllowed = 'move'
  event.dataTransfer.setData('text/plain', key)
}

function dropColumn(targetKey: string) {
  const sourceKey = draggingKey.value
  draggingKey.value = undefined
  if (!sourceKey || sourceKey === targetKey) return
  const nextOrder = draftOrder.value.filter((key) => key !== sourceKey)
  const targetIndex = nextOrder.indexOf(targetKey)
  nextOrder.splice(targetIndex, 0, sourceKey)
  draftOrder.value = nextOrder
}

function resetColumnSettings() {
  draftOrder.value = props.columns.map((column, index) => getColumnKey(column, index))
  draftHiddenKeys.value = []
  draftFixedColumns.value = {}
}

function confirmColumnSettings() {
  columnOrder.value = [...draftOrder.value]
  hiddenColumnKeys.value = [...draftHiddenKeys.value]
  fixedColumns.value = { ...draftFixedColumns.value }
  settingsOpen.value = false
}

const tableScroll = computed<TableProps['scroll']>(() => {
  const scroll = props.scroll || {}
  const width = getTableScrollWidth(resizableColumns.value, props.minColumnWidth)
  return {
    ...scroll,
    x: typeof scroll.x === 'number' ? Math.max(scroll.x, width) : scroll.x ?? width,
    y: scroll.y ?? bodyHeight.value,
  }
})
const tableComponents = { header: { cell: ResizableHeaderCell } }
</script>

<template>
  <div ref="host" class="resizable-table-host" :class="$attrs.class">
    <a-popover
      v-if="columnSettings && columns.length"
      :open="settingsOpen"
      placement="bottomRight"
      trigger="click"
      @open-change="handleSettingsOpen"
    >
      <template #content>
        <div class="column-settings-panel">
          <div class="column-settings-all">
            <a-checkbox
              :checked="allColumnsVisible"
              :indeterminate="someColumnsVisible && !allColumnsVisible"
              @change="setAllColumnsVisible(Boolean($event.target?.checked))"
            >
              全部
            </a-checkbox>
          </div>
          <div class="column-settings-list">
            <div
              v-for="key in draftOrder"
              :key="key"
              class="column-settings-item"
              :class="{ dragging: draggingKey === key }"
              draggable="true"
              @dragend="draggingKey = undefined"
              @dragover.prevent
              @dragstart="startColumnDrag(key, $event)"
              @drop.prevent="dropColumn(key)"
            >
              <a-checkbox
                :checked="!draftHiddenKeys.includes(key)"
                @change="setColumnVisible(key, Boolean($event.target?.checked))"
              />
              <HolderOutlined class="column-drag-handle" />
              <span class="column-settings-label">{{ getColumnLabel(key) }}</span>
              <button
                type="button"
                class="column-pin column-pin-left"
                :class="{ active: getColumnFixed(key) === 'left' }"
                title="固定在左侧"
                @click="toggleColumnFixed(key, 'left')"
              >
                <PushpinOutlined />
              </button>
              <button
                type="button"
                class="column-pin column-pin-right"
                :class="{ active: getColumnFixed(key) === 'right' }"
                title="固定在右侧"
                @click="toggleColumnFixed(key, 'right')"
              >
                <PushpinOutlined />
              </button>
            </div>
          </div>
          <div class="column-settings-footer">
            <a-button type="text" @click="resetColumnSettings">恢复默认</a-button>
            <span class="column-settings-footer-spacer"></span>
            <a-button type="text" @click="settingsOpen = false">取消</a-button>
            <a-button type="text" class="column-settings-confirm" @click="confirmColumnSettings">确认</a-button>
          </div>
        </div>
      </template>
      <button
        type="button"
        class="column-settings-trigger"
        title="列设置"
        aria-label="列设置"
        :style="{ top: `${settingsTop}px` }"
      >
        <SettingOutlined />
      </button>
    </a-popover>
    <a-table
      v-bind="$attrs"
      class="resizable-table"
      :columns="resizableColumns"
      :components="tableComponents"
      :scroll="tableScroll"
    >
      <template v-for="(_, name) in $slots" #[name]="slotData">
        <slot :name="name" v-bind="slotData || {}" />
      </template>
    </a-table>
  </div>
</template>

<style scoped>
.resizable-table-host { position: relative; min-width: 0; min-height: 0; overflow: hidden; }
.resizable-table { height: 100%; }
.resizable-table :deep(.ant-table-thead > tr > th:last-child) { padding-right: 42px; }
.column-settings-trigger {
  position: absolute;
  z-index: 12;
  right: 7px;
  display: inline-grid;
  width: 28px;
  height: 28px;
  padding: 0;
  place-items: center;
  border: 0;
  color: var(--shell-muted);
  background: transparent;
  cursor: pointer;
}
.column-settings-trigger:hover { color: var(--brand); background: color-mix(in srgb, var(--brand) 8%, transparent); }
.column-settings-panel { width: 276px; margin: -12px -16px; color: var(--shell-ink); font-size: 14px; background: var(--shell-panel); }
.column-settings-all { padding: 8px 12px; border-bottom: 1px solid var(--shell-line); font-weight: 600; }
.column-settings-all :deep(.ant-checkbox-wrapper) { color: var(--brand); }
.column-settings-list { max-height: min(360px, 56vh); overflow-y: auto; padding-block: 2px; }
.column-settings-item {
  display: grid;
  min-height: 32px;
  padding: 2px 10px;
  align-items: center;
  gap: 6px;
  grid-template-columns: 18px 14px minmax(0, 1fr) 24px 24px;
  transition: background-color 120ms ease, opacity 120ms ease;
}
.column-settings-item:hover { background: var(--shell-hover); }
.column-settings-item.dragging { opacity: 0.45; }
.column-drag-handle { color: var(--shell-muted); cursor: grab; }
.column-settings-label { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.column-pin {
  display: inline-grid;
  width: 24px;
  height: 24px;
  padding: 0;
  place-items: center;
  border: 0;
  color: var(--shell-muted);
  background: transparent;
  cursor: pointer;
}
.column-pin:hover, .column-pin.active { color: var(--brand); background: color-mix(in srgb, var(--brand) 8%, transparent); }
.column-pin-left :deep(.anticon) { transform: rotate(-45deg); }
.column-pin-right :deep(.anticon) { transform: rotate(45deg); }
.column-settings-footer { display: flex; padding: 3px 5px; align-items: center; border-top: 1px solid var(--shell-line); }
.column-settings-footer :deep(.ant-btn) { height: 28px; padding-inline: 8px; font-size: 13px; }
.column-settings-footer-spacer { flex: 1; }
.column-settings-confirm { color: var(--brand); }
</style>
