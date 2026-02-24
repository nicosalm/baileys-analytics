import React from 'react'
import { ChevronUp, ChevronDown, Search, BarChart3 } from 'lucide-react'
import { LoadingState } from '@/components/LoadingState'
import { Input } from '@/components/ui/input'

interface Column<T> {
  key: keyof T | string
  header: string
  width?: number
  render?: (item: T, index: number) => React.ReactNode
  sortable?: boolean
}

interface SimpleTableProps<T> {
  data: T[]
  columns: Column<T>[]
  onRowClick?: (item: T, index: number) => void
  sortBy?: string
  sortOrder?: 'asc' | 'desc'
  onSort?: (column: string) => void
  getRowId?: (item: T) => string
  emptyMessage?: string
  enableSearch?: boolean
  searchKeys?: (keyof T)[]
  rowClassName?: (item: T, index: number) => string
  showRowNumbers?: boolean
  loading?: boolean
}

export function SimpleTable<T extends Record<string, any>>({
  data,
  columns,
  onRowClick,
  sortBy,
  sortOrder = 'asc',
  onSort,
  getRowId,
  emptyMessage = 'No data available',
  enableSearch = false,
  searchKeys = [],
  rowClassName,
  showRowNumbers = false,
  loading = false
}: SimpleTableProps<T>) {
  const [searchTerm, setSearchTerm] = React.useState('')

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
      return column.key.split('.').reduce((obj, key) => obj?.[key], item as any)
    }
    return item[column.key]
  }

  if (loading && data.length === 0) {
    return <LoadingState message="Loading data..." />
  }

  if (!loading && filteredData.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-64 text-gray-500">
        <BarChart3 className="w-12 h-12 text-gray-300 mb-4" />
        <div className="text-lg font-medium">{emptyMessage}</div>
        {enableSearch && searchTerm && (
          <div className="mt-2 text-sm">No results found for "{searchTerm}"</div>
        )}
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {enableSearch && (
        <div className="flex items-center bg-white p-4 rounded-lg shadow-sm border border-gray-200">
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
        </div>
      )}

      <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                {showRowNumbers && (
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-16">
                    #
                  </th>
                )}
                {columns.map((column) => (
                  <th
                    key={String(column.key)}
                    className={`px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider ${
                      column.sortable ? 'cursor-pointer hover:bg-gray-100' : ''
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
            <tbody className="bg-white divide-y divide-gray-200">
              {filteredData.map((item, index) => {
                const rowId = getRowId ? getRowId(item) : index.toString()
                const customClassName = rowClassName ? rowClassName(item, index) : ''

                return (
                  <tr
                    key={rowId}
                    className={`hover:bg-gray-50 transition-all ${
                      onRowClick ? 'cursor-pointer' : ''
                    } ${customClassName}`}
                    onClick={() => onRowClick?.(item, index)}
                  >
                    {showRowNumbers && (
                      <td className="px-4 py-3 text-sm text-gray-500">
                        {index + 1}
                      </td>
                    )}
                    {columns.map((column) => (
                      <td
                        key={`${rowId}-${String(column.key)}`}
                        className="px-4 py-3 text-sm text-gray-900"
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
    </div>
  )
}