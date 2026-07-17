<script setup lang="ts">
import { Button as AButton, Result as AResult } from 'ant-design-vue'
import { useRouter } from 'vue-router'

const router = useRouter()
</script>

<template>
  <main class="error-page">
    <a-result status="403" title="没有可访问的菜单" sub-title="请联系管理员为当前角色分配菜单权限。">
      <template #extra><a-button type="primary" @click="router.push('/')">重新检查</a-button></template>
    </a-result>
  </main>
</template>

<style scoped>
.error-page { display: grid; min-height: 100vh; place-items: center; background: #f2f5f5; }
</style>
