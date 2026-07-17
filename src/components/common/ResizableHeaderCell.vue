<script setup lang="ts">
import { onBeforeUnmount } from 'vue'

defineOptions({ inheritAttrs: false })

const props = withDefaults(defineProps<{
  width?: number
  minWidth?: number
  resizable?: boolean
  onColumnResize?: (width: number) => void
}>(), {
  minWidth: 56,
  resizable: true,
})

let startX = 0
let startWidth = 0
let dragging = false

function nextWidth(width: number) {
  return Math.max(props.minWidth, Math.round(width))
}

function handlePointerMove(event: PointerEvent) {
  if (!dragging) return
  props.onColumnResize?.(nextWidth(startWidth + event.clientX - startX))
}

function stopDragging() {
  if (!dragging) return
  dragging = false
  window.removeEventListener('pointermove', handlePointerMove)
  window.removeEventListener('pointerup', stopDragging)
  window.removeEventListener('pointercancel', stopDragging)
  document.body.style.removeProperty('cursor')
  document.body.style.removeProperty('user-select')
}

function startDragging(event: PointerEvent) {
  if (!props.width || !props.resizable) return
  event.preventDefault()
  event.stopPropagation()
  startX = event.clientX
  startWidth = props.width
  dragging = true
  document.body.style.cursor = 'col-resize'
  document.body.style.userSelect = 'none'
  window.addEventListener('pointermove', handlePointerMove)
  window.addEventListener('pointerup', stopDragging)
  window.addEventListener('pointercancel', stopDragging)
}

function handleKeydown(event: KeyboardEvent) {
  if (!props.width || !props.resizable) return
  if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return
  event.preventDefault()
  event.stopPropagation()
  props.onColumnResize?.(nextWidth(props.width + (event.key === 'ArrowRight' ? 10 : -10)))
}

onBeforeUnmount(stopDragging)
</script>

<template>
  <th v-bind="$attrs" class="resizable-header-cell">
    <slot />
    <span
      v-if="width && resizable"
      class="column-resize-handle"
      role="separator"
      tabindex="0"
      aria-label="调整列宽"
      aria-orientation="vertical"
      @pointerdown="startDragging"
      @keydown="handleKeydown"
    />
  </th>
</template>

<style scoped>
.resizable-header-cell { position: relative; }
.column-resize-handle {
  position: absolute;
  z-index: 2;
  top: 0;
  right: 0;
  bottom: 0;
  width: 8px;
  cursor: col-resize;
  touch-action: none;
}
.column-resize-handle::after {
  position: absolute;
  top: 22%;
  right: 0;
  bottom: 22%;
  width: 2px;
  background: transparent;
  content: '';
  transition: background-color 0.15s ease;
}
.column-resize-handle:hover::after,
.column-resize-handle:focus-visible::after {
  background: var(--brand);
}
.column-resize-handle:focus-visible { outline: none; }
</style>
