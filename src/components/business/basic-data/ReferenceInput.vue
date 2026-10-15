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
    <div class="reference-control">
      <button type="button" class="reference-open" :disabled="disabled" :aria-label="label" @click="open = true">
        <span class="reference-label" :class="{ placeholder: value == null }">{{ text || placeholder || `请选择${label}` }}{{ failed ? '（加载失败）' : '' }}</span>
      </button>
      <button type="button" class="reference-action" :disabled="disabled" :aria-label="value != null && !disabled ? `清除${label}` : `选择${label}`" @click="value != null && !disabled ? emit('update:value', undefined) : open = true">
        <CloseOutlined v-if="value != null && !disabled" /><SearchOutlined v-else />
      </button>
    </div>
    <AButton v-if="failed" type="link" size="small" @click="resolve">重试</AButton>
    <ReferencePicker v-if="open" :type="target" :selected-id="value ?? undefined" :area-id="areaId" :vehicle-id="vehicleId" :container-kind="containerKind" @select="select" @close="open = false" />
  </div>
</template>
<style scoped>
.reference-input { display: flex; align-items: center; min-width: 0; width: 100%; }
.reference-control { display: flex; flex: 1; min-width: 0; height: 34px; border: 1px solid var(--shell-border); border-radius: 6px; background: var(--shell-panel); }
.reference-open { display: flex; align-items: center; flex: 1; min-width: 0; height: 100%; padding: 4px 0 4px 11px; color: var(--shell-ink); border: 0; background: transparent; cursor: pointer; font: inherit; text-align: left; }
.reference-label { min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.reference-action { flex: 0 0 34px; width: 34px; height: 100%; padding: 0; display: grid; place-items: center; color: var(--shell-muted); border: 0; background: transparent; cursor: pointer; }
.reference-open:disabled, .reference-action:disabled { opacity: .6; cursor: not-allowed; }
.reference-open:focus-visible, .reference-action:focus-visible { outline: 2px solid var(--brand); outline-offset: -2px; }
.reference-open .placeholder { color: var(--shell-muted); }
</style>
