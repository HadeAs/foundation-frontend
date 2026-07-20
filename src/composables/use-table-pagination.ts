import type { TablePaginationConfig } from 'ant-design-vue'
import { computed, ref } from 'vue'

export function useTablePagination(load: () => void | Promise<void>, defaultSize = 20) {
  const currentPage = ref(1)
  const pageSize = ref(defaultSize)
  const total = ref(0)
  const pagination = computed<TablePaginationConfig>(() => ({
    current: currentPage.value,
    pageSize: pageSize.value,
    total: total.value,
    showSizeChanger: true,
    pageSizeOptions: ['10', '20', '50', '100'],
    showTotal: (count) => `共 ${count} 条`,
  }))

  function handleTableChange(next: TablePaginationConfig) {
    const nextSize = next.pageSize || pageSize.value
    currentPage.value = nextSize === pageSize.value ? next.current || 1 : 1
    pageSize.value = nextSize
    void load()
  }

  return { currentPage, pageSize, total, pagination, handleTableChange }
}
