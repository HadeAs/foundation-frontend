<script setup lang="ts">
import { ExclamationCircleOutlined, InboxOutlined, LoadingOutlined } from '@ant-design/icons-vue'
import { Button as AButton, theme } from 'ant-design-vue'
defineProps<{ loading?: boolean; error?: string; emptyText?: string }>()
defineEmits<{ retry: [] }>()
const { token } = theme.useToken()
</script>
<template>
  <div class="data-state" role="status" :style="{ color: loading ? token.colorInfo : error ? token.colorError : token.colorTextSecondary }">
    <LoadingOutlined v-if="loading" spin />
    <ExclamationCircleOutlined v-else-if="error" />
    <InboxOutlined v-else />
    <strong>{{ loading ? '加载中' : error ? '加载失败' : emptyText || '暂无数据' }}</strong>
    <span v-if="error">{{ error }}</span>
    <AButton v-if="error && !loading" size="small" @click="$emit('retry')">重新加载</AButton>
  </div>
</template>
<style scoped>
.data-state { display: flex; min-height: 160px; padding: 24px; align-items: center; justify-content: center; flex-direction: column; gap: 8px; }
.data-state > .anticon { font-size: 28px; }
.data-state > span:not(.anticon) { max-width: 600px; white-space: normal; }
@media (prefers-reduced-motion: reduce) { .data-state :deep(.anticon-spin) { animation: none; } }
</style>
