<script setup lang="ts">
import { computed } from 'vue'
import { useRoute } from 'vue-router'

const route = useRoute()
const externalUrl = computed(() => String(route.meta.externalUrl || ''))
</script>

<template>
  <main class="external-page">
    <iframe
      :src="externalUrl"
      :title="String(route.meta.title || '外部页面')"
      referrerpolicy="strict-origin-when-cross-origin"
    ></iframe>
  </main>
</template>

<style scoped>
.external-page { width: 100%; height: 100%; padding: 8px 10px 10px; overflow: hidden; }
.external-page iframe { display: block; width: 100%; height: 100%; border: 1px solid var(--shell-border); background: var(--shell-panel); }
</style>
