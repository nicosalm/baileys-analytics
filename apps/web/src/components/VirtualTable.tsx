import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import { ChevronUp, ChevronDown, ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight, Loader2, Search, Download, RefreshCw } from 'lucide-react'

// Types
interface Column<T> {
  key: keyof T | string
  header: string
  width?: number
  render?: (item: T, index: number) => React.ReactNode
  sortable?: boolean
  filterable?: boolean
}

interface VirtualTableProps<T> {
  data: T[]
  columns: Column<T>[]
  rowHeight?: number
  height?: number
  onRowClick?: (item: T, index: number) => void
  loading?: boolean
  loadMore?: () => void
  hasMore?: boolean
  sortBy?: string
  sortOrder?: 'asc' | 'desc'
  onSort?: (column: string) => void
  getRowId?: (item: T) => string
  emptyMessage?: string
  enablePagination?: boolean
  pageSize?: number
  enableSearch?: boolean
  searchKeys?: (keyof T)[]
  enableExport?: boolean
  onExport?: () => void
  enableRefresh?: boolean
  onRefresh?: () => void
  rowClassName?: (item: T, index: number) => string
  showRowNumbers?: boolean
  selectable?: boolean
  selectedRows?: Set<string>
  onSelectionChange?: (selected: Set<string>) => void
}

// Main Virtual Table Component
export function VirtualTable<T extends Record<string, any>>({
  data,
  columns,
  rowHeight = 48,
  height = 600,
  onRowClick,
  loading = false,
  loadMore,
  hasMore = false,
  sortBy,
  sortOrder = 'asc',
  onSort,
  getRowId,
  emptyMessage = 'No data available',
  enablePagination = false,
  pageSize = 50,
  enableSearch = false,
  searchKeys = [],
  enableExport = false,
  onExport,
  enableRefresh = false,
  onRefresh,
  rowClassName,
  showRowNumbers = false,
  selectable = false,
  selectedRows = new Set(),
  onSelectionChange
}: VirtualTableProps<T>) {
  // State management
  const [scrollTop, setScrollTop] = useState(0)
  const [isLoadingMore, setIsLoadingMore] = useState(false)
  const [searchTerm, setSearchTerm] = useState('')
  const [currentPage, setCurrentPage] = useState(1)
  const [localSelectedRows, setLocalSelectedRows] = useState<Set<string>>(selectedRows)

  // Refs
  const containerRef = useRef<HTMLDivElement>(null)
  const headerRef = useRef<HTMLDivElement>(null)
  const scrollTimeout = useRef<NodeJS.Timeout>()
  const loadMoreTimeout = useRef<NodeJS.Timeout>()

  // Calculate total table width
  const tableWidth = useMemo(() => {
    let width = 0
    if (selectable) width += 50
    if (showRowNumbers) width += 60
    columns.forEach(col => {
      width += col.width || 200 // Default column width if not specified
    })
    return width
  }, [columns, selectable, showRowNumbers])

  // Calculate filtered data based on search
  const filteredData = useMemo(() => {
    if (!enableSearch || !searchTerm) return data

    return data.filter(item => {
      const searchLower = searchTerm.toLowerCase()

      // Search in specified keys or all string/number values
      if (searchKeys.length > 0) {
        return searchKeys.some(key => {
          const value = item[key]
          return value && value.toString().toLowerCase().includes(searchLower)
        })
      }

      // Search in all string/number fields
      return Object.values(item).some(value => {
        if (value && (typeof value === 'string' || typeof value === 'number')) {
          return value.toString().toLowerCase().includes(searchLower)
        }
        return false
      })
    })
  }, [data, searchTerm, enableSearch, searchKeys])

  // Calculate paginated or full data
  const displayData = useMemo(() => {
    if (enablePagination) {
      const start = (currentPage - 1) * pageSize
      return filteredData.slice(start, start + pageSize)
    }
    return filteredData
  }, [filteredData, enablePagination, currentPage, pageSize])

  // Virtual scrolling calculations
  const totalHeight = displayData.length * rowHeight
  const viewportHeight = height
  const startIndex = Math.floor(scrollTop / rowHeight)
  const endIndex = Math.min(
    Math.ceil((scrollTop + viewportHeight) / rowHeight) + 1,
    displayData.length
  )
  const visibleItems = displayData.slice(startIndex, endIndex)
  const offsetY = startIndex * rowHeight

  // Pagination calculations
  const totalPages = enablePagination ? Math.ceil(filteredData.length / pageSize) : 1

  // Handle scroll with debouncing and header sync
  const handleScroll = useCallback((e: React.UIEvent<HTMLDivElement>) => {
    const target = e.target as HTMLDivElement
    setScrollTop(target.scrollTop)

    // Sync header horizontal scroll
    if (headerRef.current) {
      headerRef.current.scrollLeft = target.scrollLeft
    }

    // Clear existing timeout
    if (scrollTimeout.current) {
      clearTimeout(scrollTimeout.current)
    }

    // Debounce infinite scroll loading
    if (!enablePagination && loadMore && hasMore) {
      scrollTimeout.current = setTimeout(() => {
        // Check if we're near the bottom
        if (
          !isLoadingMore &&
          target.scrollTop + target.clientHeight >= target.scrollHeight - 100
        ) {
          setIsLoadingMore(true)

          // Simulate async loading
          loadMoreTimeout.current = setTimeout(() => {
            loadMore()
            setIsLoadingMore(false)
          }, 100)
        }
      }, 150)
    }
  }, [loadMore, hasMore, isLoadingMore, enablePagination])

  // Reset loading state when data changes
  useEffect(() => {
    setIsLoadingMore(false)
  }, [displayData.length])

  // Clean up timeouts on unmount
  useEffect(() => {
    return () => {
      if (scrollTimeout.current) clearTimeout(scrollTimeout.current)
      if (loadMoreTimeout.current) clearTimeout(loadMoreTimeout.current)
    }
  }, [])

  // Handle sort
  const handleSort = (column: string) => {
    if (onSort && columns.find(c => c.key === column)?.sortable) {
      onSort(column)
    }
  }

  // Handle selection
  const handleSelectAll = () => {
    if (!selectable || !onSelectionChange) return

    const allSelected = displayData.every(item => {
      const id = getRowId ? getRowId(item) : displayData.indexOf(item).toString()
      return localSelectedRows.has(id)
    })

    const newSelection = new Set(localSelectedRows)

    displayData.forEach(item => {
      const id = getRowId ? getRowId(item) : displayData.indexOf(item).toString()
      if (allSelected) {
        newSelection.delete(id)
      } else {
        newSelection.add(id)
      }
    })

    setLocalSelectedRows(newSelection)
    onSelectionChange(newSelection)
  }

  const handleSelectRow = (item: T, index: number) => {
    if (!selectable || !onSelectionChange) return

    const id = getRowId ? getRowId(item) : index.toString()
    const newSelection = new Set(localSelectedRows)

    if (newSelection.has(id)) {
      newSelection.delete(id)
    } else {
      newSelection.add(id)
    }

    setLocalSelectedRows(newSelection)
    onSelectionChange(newSelection)
  }

  // Get cell value helper
  const getCellValue = (item: T, column: Column<T>) => {
    if (column.render) {
      return column.render(item, displayData.indexOf(item))
    }
    if (typeof column.key === 'string' && column.key.includes('.')) {
      // Handle nested properties
      return column.key.split('.').reduce((obj, key) => obj?.[key], item as any)
    }
    return item[column.key]
  }

  // Reset page when search changes
  useEffect(() => {
    setCurrentPage(1)
  }, [searchTerm])

  // Loading state
  if (loading && data.length === 0) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
      </div>
    )
  }

  // Empty state
  if (!loading && displayData.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-64 text-gray-500">
        <div className="text-6xl mb-4">📊</div>
        <div className="text-lg font-medium">{emptyMessage}</div>
        {enableSearch && searchTerm && (
          <div className="mt-2 text-sm">No results found for "{searchTerm}"</div>
        )}
      </div>
    )
  }

  const allSelected = displayData.length > 0 && displayData.every(item => {
    const id = getRowId ? getRowId(item) : displayData.indexOf(item).toString()
    return localSelectedRows.has(id)
  })

  const someSelected = displayData.some(item => {
    const id = getRowId ? getRowId(item) : displayData.indexOf(item).toString()
    return localSelectedRows.has(id)
  })

  return (
    <div className="space-y-4">
      {/* CSS for hiding header scrollbar */}
      <style>
        {`
          .scrollbar-hide::-webkit-scrollbar {
            display: none;
          }
          .scrollbar-hide {
            -ms-overflow-style: none;
            scrollbar-width: none;
          }
        `}
      </style>

      {/* Toolbar */}
      {(enableSearch || enableExport || enableRefresh) && (
        <div className="flex items-center justify-between bg-white p-4 rounded-lg shadow">
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
            {localSelectedRows.size > 0 && (
              <div className="text-sm text-gray-600">
                {localSelectedRows.size} selected
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

      {/* Main Table with horizontal scroll */}
      <div className="border rounded-lg overflow-hidden bg-white shadow">
        {/* Header with horizontal scroll sync */}
        <div
          ref={headerRef}
          className="bg-gray-50 border-b sticky top-0 z-10 overflow-x-auto overflow-y-hidden scrollbar-hide"
          style={{
            scrollbarWidth: 'none',
            msOverflowStyle: 'none'
          }}
        >
          <div className="flex" style={{ width: tableWidth }}>
            {selectable && (
              <div className="px-4 py-3 border-r bg-gray-50 flex-shrink-0" style={{ width: 50 }}>
                <input
                  type="checkbox"
                  checked={allSelected}
                  ref={input => {
                    if (input) {
                      input.indeterminate = !allSelected && someSelected
                    }
                  }}
                  onChange={handleSelectAll}
                  className="cursor-pointer"
                />
              </div>
            )}
            {showRowNumbers && (
              <div className="px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider border-r flex-shrink-0" style={{ width: 60 }}>
                #
              </div>
            )}
            {columns.map((column) => (
              <div
                key={String(column.key)}
                className={`px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider flex-shrink-0 ${
                  column.sortable ? 'cursor-pointer hover:bg-gray-100' : ''
                }`}
                style={{ width: column.width || 200 }}
                onClick={() => column.sortable && handleSort(String(column.key))}
              >
                <div className="flex items-center justify-between">
                  <span className="truncate">{column.header}</span>
                  {column.sortable && sortBy === column.key && (
                    <span className="ml-2 flex-shrink-0">
                      {sortOrder === 'asc' ? (
                        <ChevronUp className="w-4 h-4" />
                      ) : (
                        <ChevronDown className="w-4 h-4" />
                      )}
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Virtual scrolling container with horizontal scroll */}
        <div
          ref={containerRef}
          className="overflow-auto"
          style={{ height }}
          onScroll={handleScroll}
        >
          {/* Total height placeholder with fixed width */}
          <div style={{ height: totalHeight, width: tableWidth, position: 'relative' }}>
            {/* Visible rows */}
            <div
              style={{
                position: 'absolute',
                top: offsetY,
                left: 0,
                width: tableWidth
              }}
            >
              {visibleItems.map((item, index) => {
                const actualIndex = startIndex + index
                const rowId = getRowId ? getRowId(item) : actualIndex.toString()
                const isSelected = localSelectedRows.has(rowId)
                const customClassName = rowClassName ? rowClassName(item, actualIndex) : ''

                return (
                  <div
                    key={rowId}
                    className={`flex border-b hover:bg-gray-50 transition-colors ${
                      onRowClick ? 'cursor-pointer' : ''
                    } ${isSelected ? 'bg-blue-50' : ''} ${customClassName}`}
                    style={{ height: rowHeight, width: tableWidth }}
                    onClick={() => onRowClick?.(item, actualIndex)}
                  >
                    {selectable && (
                      <div
                        className="px-4 flex items-center border-r flex-shrink-0"
                        style={{ width: 50 }}
                        onClick={(e) => {
                          e.stopPropagation()
                          handleSelectRow(item, actualIndex)
                        }}
                      >
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => {}}
                          className="cursor-pointer"
                        />
                      </div>
                    )}
                    {showRowNumbers && (
                      <div className="px-4 text-sm text-gray-500 flex items-center border-r flex-shrink-0" style={{ width: 60 }}>
                        {actualIndex + 1}
                      </div>
                    )}
                    {columns.map((column) => (
                      <div
                        key={`${rowId}-${String(column.key)}`}
                        className="px-4 py-2 text-sm text-gray-900 flex items-center overflow-hidden flex-shrink-0"
                        style={{ width: column.width || 200 }}
                      >
                        <div className="w-full">
                          {getCellValue(item, column)}
                        </div>
                      </div>
                    ))}
                  </div>
                )
              })}
            </div>
          </div>

          {/* Loading more indicator */}
          {!enablePagination && isLoadingMore && (
            <div className="flex items-center justify-center py-4 border-t bg-gray-50" style={{ width: tableWidth }}>
              <Loader2 className="w-5 h-5 animate-spin text-blue-600 mr-2" />
              <span className="text-sm text-gray-600">Loading more...</span>
            </div>
          )}
        </div>
      </div>

      {/* Pagination */}
      {enablePagination && totalPages > 1 && (
        <div className="flex items-center justify-between bg-white p-4 rounded-lg shadow">
          <div className="text-sm text-gray-600">
            Showing {((currentPage - 1) * pageSize) + 1} to {Math.min(currentPage * pageSize, filteredData.length)} of {filteredData.length} results
          </div>

          <div className="flex items-center space-x-2">
            <button
              onClick={() => setCurrentPage(1)}
              disabled={currentPage === 1}
              className="p-2 hover:bg-gray-100 rounded disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <ChevronsLeft className="w-4 h-4" />
            </button>
            <button
              onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
              disabled={currentPage === 1}
              className="p-2 hover:bg-gray-100 rounded disabled:opacity-50 disabled:cursor-not-allowed"
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
              className="p-2 hover:bg-gray-100 rounded disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
            <button
              onClick={() => setCurrentPage(totalPages)}
              disabled={currentPage === totalPages}
              className="p-2 hover:bg-gray-100 rounded disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <ChevronsRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
