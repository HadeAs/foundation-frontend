<script setup lang="ts">
import { CloseOutlined, SearchOutlined } from '@ant-design/icons-vue'
import { Button as AButton } from 'ant-design-vue'
import { onBeforeUnmount, ref, watch } from 'vue'
import { lookupRecord } from '@/business/basic-data/relations'
import { recordLabel, type ObjectType } from '@/business/basic-data/schema'
import ReferencePicker from './ReferencePicker.vue'

const props = defineProps<{ value?: number | null; target: ObjectType; label: string; disabled?: boolean; areaId?: number; vehicleId?: number; containerKind?: 'box' | 'vehicle'; placeholder?: string }>()
const emit = defineEmits<{ 'update:value': [value: number | undefined] }>()
const open = ref(false)
const text = ref('')
const failed = ref(false)
let epoch = 0
async function resolve() {
  const current = ++epoch
  failed.value = false
  text.value = props.value == null ? '' : `ID ${props.value}`
  if (props.value == null) return
  try {
    const record = await lookupRecord(props.target, props.value)
    if (current === epoch) text.value = recordLabel(props.target, record)
  } catch { if (current === epoch) failed.value = true }
}
watch(() => [props.value, props.target], resolve, { immediate: true })
watch(() => [props.areaId, props.vehicleId, props.containerKind], () => { open.value = false })
onBeforeUnmount(() => { epoch++ })
function select(id: number) { emit('update:value', id); open.value = false }
</script>
<template>
  <div class="reference-input">
    <button type="button" class="reference-open" :disabled="disabled" :aria-label="label" @click="open = true">
      <span :class="{ placeholder: value == null }">{{ text || placeholder || `请选择${label}` }}{{ failed ? '（加载失败）' : '' }}</span><SearchOutlined />
    </button>
    <AButton v-if="value != null && !disabled" type="text" class="reference-clear" :aria-label="`清除${label}`" @click.stop="emit('update:value', undefined)"><CloseOutlined /></AButton>
    <AButton v-if="failed" type="link" size="small" @click="resolve">重试</AButton>
    <ReferencePicker v-if="open" :type="target" :selected-id="value ?? undefined" :area-id="areaId" :vehicle-id="vehicleId" :container-kind="containerKind" @select="select" @close="open = false" />
  </div>
</template>
<style scoped>
.reference-input { display: flex; align-items: center; min-width: 0; width: 100%; position: relative; }
.reference-open { display: flex; align-items: center; justify-content: space-between; gap: 8px; width: 100%; height: 34px; padding: 4px 11px; color: var(--shell-ink); border: 1px solid var(--shell-border); border-radius: 6px; background: var(--shell-panel); cursor: pointer; font: inherit; }
.reference-open span { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.reference-open:disabled { opacity: .6; cursor: not-allowed; }
.reference-open:focus-visible { outline: 2px solid var(--brand); outline-offset: 1px; }
.reference-open .placeholder { color: var(--shell-muted); }
.reference-clear { flex: none; margin-left: 2px; }
</style>
