import type { TableColumnsType } from 'ant-design-vue'

type TableColumn = TableColumnsType[number]

export function isActionColumn(column: TableColumn) {
  const dataIndex = 'dataIndex' in column
    ? Array.isArray(column.dataIndex) ? column.dataIndex.join('.') : column.dataIndex
    : undefined
  return column.key === 'action' || dataIndex === 'action' || column.title === '操作'
}

export function getTableScrollWidth(columns: TableColumnsType, fallbackWidth = 56): number {
  return columns.reduce((total, column) => {
    if ('children' in column && column.children?.length) {
      return total + getTableScrollWidth(column.children, fallbackWidth)
    }
    return total + (typeof column.width === 'number' ? column.width : fallbackWidth)
  }, 0)
}
