<script setup lang="ts">
import { Table as ATable, type TableColumnsType, type TableProps } from 'ant-design-vue'
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
  minColumnWidth?: number
  scroll?: TableProps['scroll']
}>(), {
  minColumnWidth: 56,
})

const widths = ref<Record<string, number>>({})
const host = ref<HTMLElement>()
const bodyHeight = ref<number>()
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

watch(() => props.columns, (columns) => syncWidths(columns), { immediate: true, deep: true })

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
      fixed: column.fixed ?? (actionColumn ? 'right' : undefined),
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

const resizableColumns = computed(() => makeResizable(props.columns))
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
.resizable-table-host { min-width: 0; min-height: 0; overflow: hidden; }
.resizable-table { height: 100%; }
</style>
