<script setup lang="ts">
import { ToolOutlined } from '@ant-design/icons-vue'
import { Button as AButton, Result as AResult } from 'ant-design-vue'
import { useRouter } from 'vue-router'

const router = useRouter()
</script>

<template>
  <a-result
    status="warning"
    title="页面尚未配置"
    sub-title="菜单对应的 Vue 组件不存在，请检查菜单中的 component 路径。"
  >
    <template #icon><ToolOutlined /></template>
    <template #extra>
      <a-button type="primary" @click="router.push('/')">返回工作台</a-button>
    </template>
  </a-result>
</template>
