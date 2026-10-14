<script setup lang="ts">
import { Button as AButton, Modal as AModal, Tabs as ATabs, TabPane as ATabPane } from 'ant-design-vue'
import { computed, ref } from 'vue'
import { lineRelations, locationRelations, objects, recordLabel, type DataRecord, type ObjectType } from '@/business/basic-data/schema'
import type { ContainerManagement } from '@/business/basic-data/container-capabilities'
import BasicDataGrid from './BasicDataGrid.vue'
const props = defineProps<{ type: ObjectType }>()
const relationTabs = computed(() => props.type === 'line' ? lineRelations : locationRelations)
const owner = ref<DataRecord>()
const tab = ref<ObjectType>('locationLine')
const kind = ref<ContainerManagement>('slot')
const childOpen = ref(false)
function manage(record: DataRecord, action: ContainerManagement = 'slot') { tab.value = relationTabs.value[0]!; kind.value = action; childOpen.value = false; owner.value = record }
function close() { if (!childOpen.value) owner.value = undefined }
</script>
<template>
  <div class="basic-data-root">
    <BasicDataGrid :type="type" @manage="manage" />
    <AModal :open="!!owner" :title="`${type === 'location' || type === 'line' ? '关联配置' : kind === 'slot' ? '装载位管理' : '治具箱适用订单'} · ${owner ? recordLabel(type, owner) : ''}`" :width="1040" :mask-closable="false" :closable="!childOpen" :keyboard="!childOpen" @cancel="close">
      <template v-if="owner">
        <ATabs v-if="type === 'location' || type === 'line'" v-model:active-key="tab" destroy-inactive-tab-pane>
          <ATabPane v-for="item in relationTabs" :key="item" :tab="objects[item].label" :disabled="childOpen"><BasicDataGrid v-if="tab === item" :key="`${item}:${owner.id}`" :type="item" :owner-id="owner.id" embedded @child-open="childOpen = $event" /></ATabPane>
        </ATabs>
        <BasicDataGrid v-else :key="`${kind}:${owner.id}`" :type="kind" :owner-id="owner.id" embedded @child-open="childOpen = $event" />
      </template>
      <template #footer><AButton :disabled="childOpen" @click="close">关闭</AButton></template>
    </AModal>
  </div>
</template>
<style scoped>
.basic-data-root { height: 100%; min-height: 0; width: 100%; overflow: hidden; }
</style>
