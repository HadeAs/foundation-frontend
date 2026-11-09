<script setup lang="ts">
defineOptions({ name: 'LongTokenManagementView' })
import {
  Alert as AAlert,
  Button as AButton,
  Input as AInput,
  Modal as AModal,
  Select as ASelect,
  Tag as ATag,
  message,
  type TableColumnsType,
} from 'ant-design-vue'
import {
  computed,
  onActivated,
  onBeforeUnmount,
  onDeactivated,
  onMounted,
  reactive,
  ref,
} from 'vue'
import { getErrorMessage } from '@/api/http'
import {
  canAuthorizeToken,
  canRevokeToken,
  getLongTokenScopes,
  isLongTokenConflict,
  isLongTokenOutcomeUnknown,
  pageLongTokens,
  revokeLongToken,
  type LongTokenCreated,
  type LongTokenMetadata,
  type LongTokenScope,
} from '@/api/long-token'
import ResizableTable from '@/components/common/ResizableTable.vue'
import DataState from '@/components/business/basic-data/DataState.vue'
import LongTokenEditor from '@/components/system/long-token/LongTokenEditor.vue'
import LongTokenSecret from '@/components/system/long-token/LongTokenSecret.vue'
import { useTablePagination } from '@/composables/use-table-pagination'
import { formatDateTime } from '@/utils/date'

const scopes = ref<LongTokenScope[]>([]),
  scopeCode = ref(''),
  scopesLoading = ref(false),
  scopeError = ref('')
const filters = reactive({ keyword: '', enabled: undefined as 'true' | 'false' | undefined })
const applied = ref({ keyword: '', enabled: undefined as boolean | undefined })
const rows = ref<LongTokenMetadata[]>([]),
  loading = ref(false),
  error = ref('')
const { currentPage, pageSize, total, pagination, handleTableChange } = useTablePagination(load)
const scope = computed(() => scopes.value.find((item) => item.scopeCode === scopeCode.value))
const scopeOptions = computed(() =>
  scopes.value.map((item) => ({ label: item.name, value: item.scopeCode })),
)
const editorOpen = ref(false),
  editing = ref<LongTokenMetadata>(),
  secret = ref('')
const revokeTarget = ref<LongTokenMetadata>(),
  revoking = ref(false),
  revokeError = ref(''),
  revokeBlocked = ref(false)
let epoch = 0,
  scopeEpoch = 0,
  mutationEpoch = 0,
  activated = false
const columns: TableColumnsType = [
  { title: 'Token 名称', key: 'name', dataIndex: 'name', width: 220, ellipsis: true },
  { title: '接入范围', key: 'scopeName', dataIndex: 'scopeName', width: 180 },
  { title: '状态', key: 'enabled', width: 100 },
  { title: '授权接口', key: 'apiCodes', width: 120 },
  { title: '创建时间', key: 'createdTime', width: 180 },
  { title: '停用时间', key: 'revokedTime', width: 180 },
  { title: '操作', key: 'action', width: 165, fixed: 'right' },
]
async function loadScopes() {
  const request = ++scopeEpoch
  scopesLoading.value = true
  scopeError.value = ''
  try {
    const result = await getLongTokenScopes()
    if (request !== scopeEpoch) return
    scopes.value = result
    if (!result.some((item) => item.scopeCode === scopeCode.value))
      scopeCode.value = result[0]?.scopeCode || ''
    currentPage.value = 1
    await load()
  } catch (cause) {
    if (request === scopeEpoch) {
      scopeError.value = getErrorMessage(cause)
      rows.value = []
      total.value = 0
    }
  } finally {
    if (request === scopeEpoch) scopesLoading.value = false
  }
}
async function load() {
  const request = ++epoch
  rows.value = []
  error.value = ''
  if (!scopeCode.value) {
    total.value = 0
    loading.value = false
    return
  }
  loading.value = true
  try {
    const result = await pageLongTokens({
      scopeCode: scopeCode.value,
      page: currentPage.value,
      size: pageSize.value,
      ...applied.value,
    })
    if (request !== epoch) return
    rows.value = result.records
    total.value = result.total
    const last = Math.max(1, Math.ceil(result.total / pageSize.value))
    if (!result.records.length && currentPage.value > last) {
      currentPage.value = last
      void load()
    }
  } catch (cause) {
    if (request === epoch) {
      error.value = getErrorMessage(cause)
      total.value = 0
    }
  } finally {
    if (request === epoch) loading.value = false
  }
}
function query() {
  applied.value = {
    keyword: filters.keyword.trim(),
    enabled: filters.enabled === undefined ? undefined : filters.enabled === 'true',
  }
  currentPage.value = 1
  void load()
}
function reset() {
  filters.keyword = ''
  filters.enabled = undefined
  query()
}
function changeScope() {
  editorOpen.value = false
  currentPage.value = 1
  query()
}
function openCreate() {
  if (!scope.value) return
  editing.value = undefined
  editorOpen.value = true
}
function openAuthorization(row: LongTokenMetadata) {
  if (!canAuthorizeToken(row)) return
  editing.value = { ...row, apiCodes: [...row.apiCodes!] }
  editorOpen.value = true
}
function created(value: LongTokenCreated) {
  secret.value = value.token
  void load()
}
function openRevoke(row: LongTokenMetadata) {
  if (!canRevokeToken(row)) return
  revokeTarget.value = { ...row }
  revokeError.value = ''
  revokeBlocked.value = false
}
async function revoke() {
  if (revoking.value || revokeBlocked.value || !revokeTarget.value) return
  const request = ++mutationEpoch
  revoking.value = true
  revokeError.value = ''
  try {
    await revokeLongToken(revokeTarget.value)
    if (request !== mutationEpoch) return
    message.success('Token 已停用')
    revokeTarget.value = undefined
    await load()
  } catch (cause) {
    if (request !== mutationEpoch) return
    revokeError.value = getErrorMessage(cause)
    revokeBlocked.value = isLongTokenConflict(cause) || isLongTokenOutcomeUnknown(cause)
  } finally {
    if (request === mutationEpoch) revoking.value = false
  }
}
function leave() {
  epoch++
  scopeEpoch++
  mutationEpoch++
  revoking.value = false
  loading.value = false
  scopesLoading.value = false
  secret.value = ''
  editorOpen.value = false
  editing.value = undefined
  revokeTarget.value = undefined
}
onMounted(loadScopes)
onActivated(() => {
  if (activated) void loadScopes()
  activated = true
})
onDeactivated(leave)
onBeforeUnmount(leave)
</script>
<template>
  <main class="management-page">
    <section class="query-panel">
      <div class="token-filters">
        <a-select
          v-model:value="scopeCode"
          aria-label="接入范围"
          placeholder="请选择接入范围"
          :options="scopeOptions"
          :loading="scopesLoading"
          :disabled="scopesLoading || !!scopeError"
          @change="changeScope"
        />
        <a-input
          v-model:value="filters.keyword"
          aria-label="Token 名称"
          :maxlength="128"
          allow-clear
          placeholder="请输入 Token 名称关键词"
          @press-enter="query"
        />
        <a-select
          v-model:value="filters.enabled"
          aria-label="Token 状态"
          allow-clear
          placeholder="全部状态"
          :options="[
            { label: '启用', value: 'true' },
            { label: '已停用', value: 'false' },
          ]"
        />
      </div>
      <div class="query-actions">
        <a-button type="primary" :disabled="!scope || scopesLoading" @click="query">查询</a-button
        ><a-button :disabled="!scope || scopesLoading" @click="reset">重置</a-button
        ><a-button
          :disabled="loading || scopesLoading"
          @click="scopeError || !scope ? loadScopes() : load()"
          >刷新</a-button
        >
      </div>
    </section>
    <section class="table-panel">
      <header class="table-toolbar">
        <h1>长期 Token</h1>
        <a-button
          type="primary"
          :disabled="!scope || scopesLoading || !!scopeError"
          @click="openCreate"
          >创建 Token</a-button
        >
      </header>
      <ResizableTable
        :columns="columns"
        :data-source="rows"
        :row-key="(row: LongTokenMetadata) => `${row.scopeCode}:${row.tokenId}`"
        size="middle"
        :pagination="loading || scopesLoading || error || scopeError || !scope ? false : pagination"
        @change="handleTableChange"
      >
        <template #bodyCell="{ column, record }">
          <template v-if="column.key === 'scopeName'">{{
            record.scopeName || scope?.name || record.scopeCode
          }}</template>
          <template v-else-if="column.key === 'enabled'"
            ><a-tag :color="record.enabled === true ? 'green' : undefined">{{
              record.enabled === true ? '启用' : record.enabled === false ? '已停用' : '未知'
            }}</a-tag></template
          >
          <template v-else-if="column.key === 'apiCodes'">{{
            Array.isArray(record.apiCodes) ? `${record.apiCodes.length} 个` : '未知'
          }}</template>
          <template v-else-if="column.key === 'createdTime' || column.key === 'revokedTime'">{{
            formatDateTime(record[column.key])
          }}</template>
          <template v-else-if="column.key === 'action'"
            ><div class="row-actions">
              <span
                :title="
                  !canAuthorizeToken(record) ? '已停用或授权版本缺失，请刷新后核对' : undefined
                "
                ><a-button
                  type="link"
                  size="small"
                  :disabled="!canAuthorizeToken(record)"
                  @click="openAuthorization(record)"
                  >接口授权</a-button
                ></span
              >
              <span :title="!canRevokeToken(record) ? '已停用或版本缺失，请刷新后核对' : undefined"
                ><a-button
                  type="link"
                  size="small"
                  danger
                  :disabled="!canRevokeToken(record)"
                  @click="openRevoke(record)"
                  >停用</a-button
                ></span
              >
            </div></template
          >
        </template>
        <template #emptyText
          ><DataState
            :loading="loading || scopesLoading"
            :error="scopeError || error"
            :empty-text="scopes.length ? '暂无符合条件的 Token' : '暂无可用接入范围'"
            @retry="scopeError ? loadScopes() : load()"
        /></template>
      </ResizableTable>
    </section>
    <LongTokenEditor
      v-if="editorOpen && scope"
      :scope="scope"
      :record="editing"
      @close="editorOpen = false"
      @created="created"
      @saved="load"
    />
    <LongTokenSecret v-if="secret" :token="secret" @close="secret = ''" />
    <a-modal
      :open="!!revokeTarget"
      title="停用 Token"
      :width="460"
      :mask-closable="false"
      :closable="!revoking"
      :keyboard="!revoking"
      :confirm-loading="revoking"
      :ok-button-props="{ danger: true, disabled: revokeBlocked }"
      :cancel-button-props="{ disabled: revoking }"
      ok-text="确认停用"
      cancel-text="取消"
      @ok="revoke"
      @cancel="!revoking && (revokeTarget = undefined)"
    >
      <p>
        是否确认停用 Token：{{
          revokeTarget?.name
        }}？停用后将无法继续调用接口，本页面不提供重新启用。
      </p>
      <a-alert
        v-if="revokeError"
        type="error"
        show-icon
        :message="revokeError"
        :description="revokeBlocked ? '请关闭弹窗并刷新列表，核对最新状态后再操作。' : undefined"
      />
    </a-modal>
  </main>
</template>
<style scoped>
.token-filters {
  display: grid;
  grid-template-columns: 220px minmax(220px, 1fr) 150px;
  gap: 8px;
  width: min(780px, 70%);
}
</style>
