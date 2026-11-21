import React from 'react'
import { ChevronDown, ChevronUp, Search } from 'lucide-react'
import { LoadingState } from '@/components/LoadingState'
import { Pagination } from '@/components/Pagination'
import { EmptyQuadrants } from '@/components/EmptyQuadrants'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'
import { tableStyles } from './table-styles'

export interface Column<T> {
  key: keyof T | string
  header: string
  width?: number
  align?: 'left' | 'right'
  render?: (item: T, index: number) => React.ReactNode
  sortable?: boolean
}

interface DataTableProps<T> {
  data: T[]
  columns: Column<T>[]
  onRowClick?: (item: T, index: number) => void
  sortBy?: string
  sortOrder?: 'asc' | 'desc'
  // when set, the parent owns sorting and passes pre-sorted data
  onSort?: (column: string) => void
  getRowId?: (item: T) => string
  emptyMessage?: string
  // omit to render every row
  pageSize?: number
  enableSearch?: boolean
  searchKeys?: (keyof T)[]
  rowClassName?: (item: T, index: number) => string
  showRowNumbers?: boolean
  loading?: boolean
}

const compare = (a: unknown, b: unknown) => {
  if (a == null && b == null) return 0
  if (a == null) return 1
  if (b == null) return -1
  if (typeof a === 'number' && typeof b === 'number') return a - b
  return String(a).localeCompare(String(b))
}

const readPath = <T,>(item: T, key: string): unknown =>
  key.split('.').reduce<unknown>((obj, k) => (obj as Record<string, unknown> | undefined)?.[k], item)

// biome-ignore lint/suspicious/noExplicitAny: rows are arbitrary records keyed by column
export function DataTable<T extends Record<string, any>>({
  data,
  columns,
  onRowClick,
  sortBy,
  sortOrder = 'asc',
  onSort,
  getRowId,
  emptyMessage = 'No data',
  pageSize,
  enableSearch = false,
  searchKeys = [],
  rowClassName,
  showRowNumbers = false,
  loading = false,
}: DataTableProps<T>) {
  const [searchTerm, setSearchTerm] = React.useState('')
  const [page, setPage] = React.useState(1)
  const [internalSort, setInternalSort] = React.useState({ by: sortBy, order: sortOrder })

  const activeSort = onSort ? { by: sortBy, order: sortOrder } : internalSort

  const rows = React.useMemo(() => {
    let result = data
    if (!onSort && activeSort.by) {
      const by = activeSort.by
      result = [...data].sort((a, b) => (activeSort.order === 'desc' ? -1 : 1) * compare(a[by], b[by]))
    }
    if (enableSearch && searchTerm) {
      const needle = searchTerm.toLowerCase()
      result = result.filter((item) => {
        const values = searchKeys.length > 0 ? searchKeys.map((k) => item[k]) : Object.values(item)
        return values.some((v) => (typeof v === 'string' || typeof v === 'number') && String(v).toLowerCase().includes(needle))
      })
    }
    return result
  }, [data, onSort, activeSort.by, activeSort.order, enableSearch, searchTerm, searchKeys])

  const totalPages = pageSize ? Math.ceil(rows.length / pageSize) : 1
  const offset = pageSize ? (page - 1) * pageSize : 0
  const visible = pageSize ? rows.slice(offset, offset + pageSize) : rows

  const handleSort = (column: Column<T>) => {
    if (!column.sortable) return
    const key = String(column.key)
    if (onSort) return onSort(key)
    setInternalSort((prev) => ({ by: key, order: prev.by === key && prev.order === 'desc' ? 'asc' : 'desc' }))
    setPage(1)
  }

  const cellValue = (item: T, column: Column<T>, index: number): React.ReactNode =>
    column.render ? column.render(item, index) : (readPath(item, String(column.key)) as React.ReactNode)

  if (loading && data.length === 0) return <LoadingState message="Loading" />

  return (
    <div className={tableStyles.card}>
      {enableSearch && (
        <div className={tableStyles.toolbar}>
          <div className="relative w-full max-w-xs">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" aria-hidden />
            <Input
              type="search"
              placeholder="Search"
              aria-label="Search rows"
              value={searchTerm}
              onChange={(e) => {
                setSearchTerm(e.target.value)
                setPage(1)
              }}
              className="pl-9 h-9"
            />
          </div>
        </div>
      )}

      {visible.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
          <EmptyQuadrants className="w-10 h-10 mb-2" />
          <p className="text-sm">{searchTerm ? `No rows match "${searchTerm}"` : emptyMessage}</p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className={tableStyles.table}>
            <thead>
              <tr className={tableStyles.headRow}>
                {showRowNumbers && <th className={tableStyles.th}>#</th>}
                {columns.map((column) => {
                  const sorted = activeSort.by === column.key
                  return (
                    <th
                      key={String(column.key)}
                      className={cn(tableStyles.th, column.sortable && tableStyles.sortable, column.align === 'right' && 'text-right')}
                      style={{ width: column.width }}
                      onClick={() => handleSort(column)}
                      aria-sort={sorted ? (activeSort.order === 'asc' ? 'ascending' : 'descending') : undefined}
                    >
                      <span className="inline-flex items-center gap-1">
                        {column.header}
                        {sorted &&
                          (activeSort.order === 'asc' ? (
                            <ChevronUp className="w-3.5 h-3.5" aria-hidden />
                          ) : (
                            <ChevronDown className="w-3.5 h-3.5" aria-hidden />
                          ))}
                      </span>
                    </th>
                  )
                })}
              </tr>
            </thead>
            <tbody>
              {visible.map((item, i) => {
                const index = offset + i
                const rowId = getRowId ? getRowId(item) : String(index)
                return (
                  <tr
                    key={rowId}
                    tabIndex={onRowClick ? 0 : undefined}
                    onClick={() => onRowClick?.(item, index)}
                    onKeyDown={(e) => {
                      if (onRowClick && e.key === 'Enter') onRowClick(item, index)
                    }}
                    className={cn(tableStyles.row, onRowClick && tableStyles.rowInteractive, rowClassName?.(item, index))}
                  >
                    {showRowNumbers && <td className={tableStyles.index}>{index + 1}</td>}
                    {columns.map((column) => (
                      <td
                        key={String(column.key)}
                        className={cn(tableStyles.td, column.align === 'right' && 'text-right tabular-nums')}
                        style={{ width: column.width }}
                      >
                        {cellValue(item, column, index)}
                      </td>
                    ))}
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      {pageSize && totalPages > 1 && (
        <div className="px-4 pb-3">
          <Pagination currentPage={page} totalPages={totalPages} totalItems={rows.length} pageSize={pageSize} onPageChange={setPage} />
        </div>
      )}
    </div>
  )
}
