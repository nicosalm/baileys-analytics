import React from 'react'
import { ChevronUp, ChevronDown, ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight, Search, Download, RefreshCw, MoreHorizontal } from 'lucide-react'
import { LoadingState } from '@/components/LoadingState'
import { Checkbox } from '@/components/ui/checkbox'
import { EmptyQuadrants } from '@/components/EmptyQuadrants'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from '@/components/ui/dropdown-menu'

interface Column<T> {
  key: keyof T | string
  header: string
  width?: number
  render?: (item: T, index: number) => React.ReactNode
  sortable?: boolean
}

interface SelectableTableProps<T> {
  data: T[]
  columns: Column<T>[]
  onRowClick?: (item: T, index: number) => void
  sortBy?: string
  sortOrder?: 'asc' | 'desc'
  onSort?: (column: string) => void
  getRowId: (item: T) => string
  emptyMessage?: string
  pageSize?: number
  enableSearch?: boolean
  searchKeys?: (keyof T)[]
  enableExport?: boolean
  onExport?: () => void
  enableRefresh?: boolean
  onRefresh?: () => void
  rowClassName?: (item: T, index: number) => string
  showRowNumbers?: boolean
  loading?: boolean
  onBulkAction?: (action: string, selectedIds: Set<string>) => void
  bulkActions?: Array<{ label: string; action: string; icon?: React.ReactNode }>
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function SelectableTable<T extends Record<string, any>>({
  data,
  columns,
  onRowClick,
  sortBy,
  sortOrder = 'asc',
  onSort,
  getRowId,
  emptyMessage = 'No data available',
  pageSize = 50,
  enableSearch = false,
  searchKeys = [],
  enableExport = false,
  onExport,
  enableRefresh = false,
  onRefresh,
  rowClassName,
  showRowNumbers = false,
  loading = false,
  onBulkAction,
  bulkActions = []
}: SelectableTableProps<T>) {
  const [searchTerm, setSearchTerm] = React.useState('')
  const [currentPage, setCurrentPage] = React.useState(1)
  const [selectedRows, setSelectedRows] = React.useState<Set<string>>(new Set())

  const filteredData = React.useMemo(() => {
    if (!enableSearch || !searchTerm) return data

    return data.filter(item => {
      const searchLower = searchTerm.toLowerCase()

      if (searchKeys.length > 0) {
        return searchKeys.some(key => {
          const value = item[key]
          return value && value.toString().toLowerCase().includes(searchLower)
        })
      }

      return Object.values(item).some(value => {
        if (value && (typeof value === 'string' || typeof value === 'number')) {
          return value.toString().toLowerCase().includes(searchLower)
        }
        return false
      })
    })
  }, [data, searchTerm, enableSearch, searchKeys])

  const paginatedData = React.useMemo(() => {
    const start = (currentPage - 1) * pageSize
    return filteredData.slice(start, start + pageSize)
  }, [filteredData, currentPage, pageSize])

  const totalPages = Math.ceil(filteredData.length / pageSize)

  React.useEffect(() => {
    setCurrentPage(1)
  }, [searchTerm])

  const handleSort = (column: string) => {
    if (onSort && columns.find(c => c.key === column)?.sortable) {
      onSort(column)
    }
  }

  const getCellValue = (item: T, column: Column<T>) => {
    if (column.render) {
      return column.render(item, data.indexOf(item))
    }
    if (typeof column.key === 'string' && column.key.includes('.')) {
      return column.key.split('.').reduce<unknown>((obj, key) => (obj as Record<string, unknown>)?.[key], item) as React.ReactNode
    }
    return item[column.key]
  }

  const handleSelectAll = () => {
    const allSelected = paginatedData.every(item => selectedRows.has(getRowId(item)))
    const newSelection = new Set(selectedRows)

    paginatedData.forEach(item => {
      const id = getRowId(item)
      if (allSelected) {
        newSelection.delete(id)
      } else {
        newSelection.add(id)
      }
    })

    setSelectedRows(newSelection)
  }

  const handleSelectRow = (item: T) => {
    const id = getRowId(item)
    const newSelection = new Set(selectedRows)

    if (newSelection.has(id)) {
      newSelection.delete(id)
    } else {
      newSelection.add(id)
    }

    setSelectedRows(newSelection)
  }

  const handleBulkAction = (action: string) => {
    if (onBulkAction) {
      onBulkAction(action, selectedRows)
      setSelectedRows(new Set())
    }
  }

  const allSelected = paginatedData.length > 0 && paginatedData.every(item => selectedRows.has(getRowId(item)))
  const someSelected = paginatedData.some(item => selectedRows.has(getRowId(item)))

  if (loading && data.length === 0) {
    return <LoadingState message="Loading data..." />
  }

  if (!loading && paginatedData.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-64 text-muted-foreground">
        <EmptyQuadrants className="w-12 h-12 mb-2" />
        <p className="text-sm font-medium text-muted-foreground">{emptyMessage}</p>
        {enableSearch && searchTerm && (
          <div className="mt-2 text-sm">No results found for "{searchTerm}"</div>
        )}
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between bg-card p-4 rounded-lg shadow-sm">
        <div className="flex items-center space-x-4">
          {enableSearch && (
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                type="text"
                placeholder="Search..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
          )}
          {selectedRows.size > 0 && (
            <>
              <div className="text-sm text-muted-foreground">
                {selectedRows.size} selected
              </div>
              {bulkActions.length > 0 && (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button>
                      Actions
                      <MoreHorizontal className="w-4 h-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="start">
                    {bulkActions.map((action) => (
                      <DropdownMenuItem
                        key={action.action}
                        onClick={() => handleBulkAction(action.action)}
                      >
                        {action.icon}
                        <span>{action.label}</span>
                      </DropdownMenuItem>
                    ))}
                  </DropdownMenuContent>
                </DropdownMenu>
              )}
            </>
          )}
        </div>

        <div className="flex items-center space-x-2">
          {enableRefresh && (
            <Button
              variant="ghost"
              size="icon"
              onClick={onRefresh}
              title="Refresh"
            >
              <RefreshCw className="w-4 h-4" />
            </Button>
          )}
          {enableExport && (
            <Button
              variant="ghost"
              size="icon"
              onClick={onExport}
              title="Export"
            >
              <Download className="w-4 h-4" />
            </Button>
          )}
        </div>
      </div>

      <div className="border rounded-lg overflow-hidden bg-card shadow-sm">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-border">
            <thead className="bg-muted/50">
              <tr>
                <th className="px-4 py-3 w-12">
                  <Checkbox
                    checked={allSelected ? true : someSelected ? 'indeterminate' : false}
                    onCheckedChange={handleSelectAll}
                  />
                </th>
                {showRowNumbers && (
                  <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider w-16">
                    #
                  </th>
                )}
                {columns.map((column) => (
                  <th
                    key={String(column.key)}
                    className={`px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider ${
                      column.sortable ? 'cursor-pointer hover:bg-muted' : ''
                    }`}
                    style={{ width: column.width }}
                    onClick={() => column.sortable && handleSort(String(column.key))}
                  >
                    <div className="flex items-center justify-between">
                      <span>{column.header}</span>
                      {column.sortable && sortBy === column.key && (
                        <span className="ml-2">
                          {sortOrder === 'asc' ? (
                            <ChevronUp className="w-4 h-4" />
                          ) : (
                            <ChevronDown className="w-4 h-4" />
                          )}
                        </span>
                      )}
                    </div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="bg-card divide-y divide-border">
              {paginatedData.map((item, index) => {
                const actualIndex = (currentPage - 1) * pageSize + index
                const rowId = getRowId(item)
                const isSelected = selectedRows.has(rowId)
                const customClassName = rowClassName ? rowClassName(item, actualIndex) : ''

                return (
                  <tr
                    key={rowId}
                    className={`hover:bg-muted/50 transition-all ${
                      onRowClick ? 'cursor-pointer' : ''
                    } ${isSelected ? 'bg-primary/10' : ''} ${customClassName}`}
                    onClick={() => onRowClick?.(item, actualIndex)}
                  >
                    <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                      <Checkbox
                        checked={isSelected}
                        onCheckedChange={() => handleSelectRow(item)}
                      />
                    </td>
                    {showRowNumbers && (
                      <td className="px-4 py-3 text-sm text-muted-foreground">
                        {actualIndex + 1}
                      </td>
                    )}
                    {columns.map((column) => (
                      <td
                        key={`${rowId}-${String(column.key)}`}
                        className="px-4 py-3 text-sm text-foreground"
                        style={{ width: column.width }}
                      >
                        {getCellValue(item, column)}
                      </td>
                    ))}
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>

      {totalPages > 1 && (
        <div className="flex items-center justify-between bg-card p-4 rounded-lg shadow-sm">
          <div className="text-sm text-muted-foreground">
            Showing {((currentPage - 1) * pageSize) + 1} to {Math.min(currentPage * pageSize, filteredData.length)} of {filteredData.length} results
          </div>

          <div className="flex items-center space-x-2">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setCurrentPage(1)}
              disabled={currentPage === 1}
            >
              <ChevronsLeft className="w-4 h-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
              disabled={currentPage === 1}
            >
              <ChevronLeft className="w-4 h-4" />
            </Button>

            <div className="flex items-center space-x-1">
              {[...Array(Math.min(5, totalPages))].map((_, i) => {
                let pageNum: number
                if (totalPages <= 5) {
                  pageNum = i + 1
                } else if (currentPage <= 3) {
                  pageNum = i + 1
                } else if (currentPage >= totalPages - 2) {
                  pageNum = totalPages - 4 + i
                } else {
                  pageNum = currentPage - 2 + i
                }

                return (
                  <Button
                    key={i}
                    variant={currentPage === pageNum ? 'default' : 'ghost'}
                    size="sm"
                    onClick={() => setCurrentPage(pageNum)}
                  >
                    {pageNum}
                  </Button>
                )
              })}
            </div>

            <Button
              variant="ghost"
              size="icon"
              onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
              disabled={currentPage === totalPages}
            >
              <ChevronRight className="w-4 h-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setCurrentPage(totalPages)}
              disabled={currentPage === totalPages}
            >
              <ChevronsRight className="w-4 h-4" />
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}