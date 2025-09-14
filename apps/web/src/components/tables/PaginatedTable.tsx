import React from 'react'
import { ChevronUp, ChevronDown, ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight, Search, Download, RefreshCw, BarChart3 } from 'lucide-react'
import { LoadingState } from '@/components/LoadingState'

interface Column<T> {
  key: keyof T | string
  header: string
  width?: number
  render?: (item: T, index: number) => React.ReactNode
  sortable?: boolean
}

interface PaginatedTableProps<T> {
  data: T[]
  columns: Column<T>[]
  onRowClick?: (item: T, index: number) => void
  sortBy?: string
  sortOrder?: 'asc' | 'desc'
  onSort?: (column: string) => void
  getRowId?: (item: T) => string
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
}

export function PaginatedTable<T extends Record<string, any>>({
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
  loading = false
}: PaginatedTableProps<T>) {
  const [searchTerm, setSearchTerm] = React.useState('')
  const [currentPage, setCurrentPage] = React.useState(1)

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
      return column.key.split('.').reduce((obj, key) => obj?.[key], item as any)
    }
    return item[column.key]
  }

  if (loading && data.length === 0) {
    return <LoadingState message="Loading data..." />
  }

  return (
    <div className="space-y-4">
      {(enableSearch || enableExport || enableRefresh) && (
        <div className="flex items-center justify-between bg-white p-4 rounded-lg shadow-sm">
          <div className="flex items-center space-x-4">
            {enableSearch && (
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  type="text"
                  placeholder="Search..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10 pr-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            )}
          </div>

          <div className="flex items-center space-x-2">
            {enableRefresh && (
              <button
                onClick={onRefresh}
                className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                title="Refresh"
              >
                <RefreshCw className="w-4 h-4" />
              </button>
            )}
            {enableExport && (
              <button
                onClick={onExport}
                className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                title="Export"
              >
                <Download className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>
      )}

      {!loading && paginatedData.length === 0 ? (
        <div className="flex flex-col items-center justify-center h-64 text-gray-500 border rounded-lg bg-white">
          <BarChart3 className="w-12 h-12 text-gray-300 mb-4" />
          <div className="text-lg font-medium">{emptyMessage}</div>
          {enableSearch && searchTerm && (
            <div className="mt-2 text-sm">No results found for "{searchTerm}"</div>
          )}
        </div>
      ) : (
        <>
          <div className="border rounded-lg overflow-hidden bg-white shadow-sm">
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
                  {paginatedData.map((item, index) => {
                    const actualIndex = (currentPage - 1) * pageSize + index
                    const rowId = getRowId ? getRowId(item) : actualIndex.toString()
                    const customClassName = rowClassName ? rowClassName(item, actualIndex) : ''

                    return (
                      <tr
                        key={rowId}
                        className={`hover:bg-gray-50 transition-all ${
                          onRowClick ? 'cursor-pointer' : ''
                        } ${customClassName}`}
                        onClick={() => onRowClick?.(item, actualIndex)}
                      >
                        {showRowNumbers && (
                          <td className="px-4 py-3 text-sm text-gray-500">
                            {actualIndex + 1}
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

          {totalPages > 1 && (
            <div className="flex items-center justify-between bg-white p-4 rounded-lg shadow-sm">
              <div className="text-sm text-gray-600">
                Showing {((currentPage - 1) * pageSize) + 1} to {Math.min(currentPage * pageSize, filteredData.length)} of {filteredData.length} results
              </div>

              <div className="flex items-center space-x-2">
                <button
                  onClick={() => setCurrentPage(1)}
                  disabled={currentPage === 1}
                  className="p-2 hover:bg-gray-100 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <ChevronsLeft className="w-4 h-4" />
                </button>
                <button
                  onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                  disabled={currentPage === 1}
                  className="p-2 hover:bg-gray-100 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>

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
                      <button
                        key={i}
                        onClick={() => setCurrentPage(pageNum)}
                        className={`px-3 py-1 rounded ${
                          currentPage === pageNum
                            ? 'bg-blue-600 text-white'
                            : 'hover:bg-gray-100'
                        }`}
                      >
                        {pageNum}
                      </button>
                    )
                  })}
                </div>

                <button
                  onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                  disabled={currentPage === totalPages}
                  className="p-2 hover:bg-gray-100 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
                <button
                  onClick={() => setCurrentPage(totalPages)}
                  disabled={currentPage === totalPages}
                  className="p-2 hover:bg-gray-100 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <ChevronsRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}