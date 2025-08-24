import { useState, useCallback, useMemo } from 'react'
import {
  SortConfig,
  sortData,
  filterData,
  paginateData,
  toggleRowSelection,
  toggleAllRowsSelection,
  getNextSortState
} from '@/utils/table-helpers'

export interface UseTableStateConfig<T> {
  initialPageSize?: number
  initialSort?: SortConfig<T>
  searchKeys?: Array<keyof T>
}

export interface UseTableStateReturn<T> {
  // State
  sort: SortConfig<T> | null
  filter: string
  page: number
  pageSize: number
  selectedRows: Set<string>
  
  // Processed data
  processedData: T[]
  paginatedData: T[]
  totalPages: number
  hasNextPage: boolean
  hasPrevPage: boolean
  
  // Actions
  setSort: (key: keyof T) => void
  setFilter: (value: string) => void
  setPage: (page: number) => void
  setPageSize: (size: number) => void
  selectRow: (id: string) => void
  selectAllRows: () => void
  clearSelection: () => void
  resetTable: () => void
}

export function useTableState<T extends { id: string }>(
  data: T[],
  config: UseTableStateConfig<T> = {}
): UseTableStateReturn<T> {
  const {
    initialPageSize = 10,
    initialSort = null,
    searchKeys = []
  } = config
  
  // State
  const [sort, setSort] = useState<SortConfig<T> | null>(initialSort)
  const [filter, setFilter] = useState('')
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(initialPageSize)
  const [selectedRows, setSelectedRows] = useState<Set<string>>(new Set())
  
  // Process data
  const processedData = useMemo(() => {
    let result = [...data]
    
    // Apply filter
    if (filter && searchKeys.length > 0) {
      result = filterData(result, filter, searchKeys)
    }
    
    // Apply sort
    if (sort) {
      result = sortData(result, sort.key, sort.direction)
    }
    
    return result
  }, [data, filter, searchKeys, sort])
  
  // Paginate data
  const paginationResult = useMemo(() => {
    return paginateData(processedData, page, pageSize)
  }, [processedData, page, pageSize])
  
  // Actions
  const handleSetSort = useCallback((key: keyof T) => {
    setSort(current => getNextSortState(current, key))
    setPage(1) // Reset to first page when sorting changes
  }, [])
  
  const handleSetFilter = useCallback((value: string) => {
    setFilter(value)
    setPage(1) // Reset to first page when filter changes
  }, [])
  
  const handleSetPage = useCallback((newPage: number) => {
    setPage(Math.max(1, Math.min(newPage, paginationResult.totalPages)))
  }, [paginationResult.totalPages])
  
  const handleSetPageSize = useCallback((size: number) => {
    setPageSize(size)
    setPage(1) // Reset to first page when page size changes
  }, [])
  
  const handleSelectRow = useCallback((id: string) => {
    setSelectedRows(current => toggleRowSelection(current, id))
  }, [])
  
  const handleSelectAllRows = useCallback(() => {
    setSelectedRows(current => toggleAllRowsSelection(paginationResult.data, current))
  }, [paginationResult.data])
  
  const handleClearSelection = useCallback(() => {
    setSelectedRows(new Set())
  }, [])
  
  const handleResetTable = useCallback(() => {
    setSort(initialSort)
    setFilter('')
    setPage(1)
    setPageSize(initialPageSize)
    setSelectedRows(new Set())
  }, [initialSort, initialPageSize])
  
  return {
    // State
    sort,
    filter,
    page,
    pageSize,
    selectedRows,
    
    // Processed data
    processedData,
    paginatedData: paginationResult.data,
    totalPages: paginationResult.totalPages,
    hasNextPage: paginationResult.hasNext,
    hasPrevPage: paginationResult.hasPrev,
    
    // Actions
    setSort: handleSetSort,
    setFilter: handleSetFilter,
    setPage: handleSetPage,
    setPageSize: handleSetPageSize,
    selectRow: handleSelectRow,
    selectAllRows: handleSelectAllRows,
    clearSelection: handleClearSelection,
    resetTable: handleResetTable
  }
}