export type SortDirection = 'asc' | 'desc'

export interface SortConfig<T> {
  key: keyof T
  direction: SortDirection
}

export interface PaginationConfig {
  page: number
  pageSize: number
  total: number
}

export interface TableState<T> {
  sort: SortConfig<T> | null
  filter: string
  pagination: PaginationConfig
  selectedRows: Set<string>
}

export const sortData = <T>(
  data: T[],
  key: keyof T,
  direction: SortDirection = 'asc'
): T[] => {
  return [...data].sort((a, b) => {
    const aVal = a[key]
    const bVal = b[key]
    
    if (aVal == null && bVal == null) return 0
    if (aVal == null) return direction === 'asc' ? -1 : 1
    if (bVal == null) return direction === 'asc' ? 1 : -1
    
    let comparison = 0
    if (typeof aVal === 'string' && typeof bVal === 'string') {
      comparison = aVal.localeCompare(bVal)
    } else if (typeof aVal === 'number' && typeof bVal === 'number') {
      comparison = aVal - bVal
    } else {
      comparison = String(aVal).localeCompare(String(bVal))
    }
    
    return direction === 'asc' ? comparison : -comparison
  })
}

export const multiSort = <T>(
  data: T[],
  sortConfigs: Array<SortConfig<T>>
): T[] => {
  if (sortConfigs.length === 0) return data
  
  return [...data].sort((a, b) => {
    for (const { key, direction } of sortConfigs) {
      const aVal = a[key]
      const bVal = b[key]
      
      if (aVal == null && bVal == null) continue
      if (aVal == null) return direction === 'asc' ? -1 : 1
      if (bVal == null) return direction === 'asc' ? 1 : -1
      
      let comparison = 0
      if (typeof aVal === 'string' && typeof bVal === 'string') {
        comparison = aVal.localeCompare(bVal)
      } else if (typeof aVal === 'number' && typeof bVal === 'number') {
        comparison = aVal - bVal
      } else {
        comparison = String(aVal).localeCompare(String(bVal))
      }
      
      if (comparison !== 0) {
        return direction === 'asc' ? comparison : -comparison
      }
    }
    return 0
  })
}

export const filterData = <T>(
  data: T[],
  searchTerm: string,
  searchKeys: Array<keyof T>
): T[] => {
  if (!searchTerm.trim()) return data
  
  const lowerSearch = searchTerm.toLowerCase()
  
  return data.filter(item => {
    return searchKeys.some(key => {
      const value = item[key]
      if (value == null) return false
      return String(value).toLowerCase().includes(lowerSearch)
    })
  })
}

export const paginateData = <T>(
  data: T[],
  page: number,
  pageSize: number
): { data: T[]; totalPages: number; hasNext: boolean; hasPrev: boolean } => {
  const start = (page - 1) * pageSize
  const end = start + pageSize
  const paginatedData = data.slice(start, end)
  const totalPages = Math.ceil(data.length / pageSize)
  
  return {
    data: paginatedData,
    totalPages,
    hasNext: page < totalPages,
    hasPrev: page > 1
  }
}

export const getPageNumbers = (
  currentPage: number,
  totalPages: number,
  maxVisible = 5
): number[] => {
  if (totalPages <= maxVisible) {
    return Array.from({ length: totalPages }, (_, i) => i + 1)
  }
  
  const half = Math.floor(maxVisible / 2)
  let start = Math.max(1, currentPage - half)
  const end = Math.min(totalPages, start + maxVisible - 1)
  
  if (end - start + 1 < maxVisible) {
    start = Math.max(1, end - maxVisible + 1)
  }
  
  return Array.from({ length: end - start + 1 }, (_, i) => start + i)
}

export const toggleSortDirection = (current: SortDirection): SortDirection => {
  return current === 'asc' ? 'desc' : 'asc'
}

export const getNextSortState = <T>(
  currentSort: SortConfig<T> | null,
  key: keyof T
): SortConfig<T> | null => {
  if (!currentSort || currentSort.key !== key) {
    return { key, direction: 'asc' }
  }
  
  if (currentSort.direction === 'asc') {
    return { key, direction: 'desc' }
  }
  
  return null
}

export interface ColumnStats {
  sum: number
  avg: number
  min: number
  max: number
  count: number
}

export const calculateColumnStats = <T>(
  data: T[],
  key: keyof T
): ColumnStats => {
  const values = data
    .map(item => item[key])
    .filter(val => typeof val === 'number' && !isNaN(val as number)) as number[]
  
  if (values.length === 0) {
    return { sum: 0, avg: 0, min: 0, max: 0, count: 0 }
  }
  
  const sum = values.reduce((acc, val) => acc + val, 0)
  
  return {
    sum,
    avg: sum / values.length,
    min: Math.min(...values),
    max: Math.max(...values),
    count: values.length
  }
}

export const groupTableData = <T>(
  data: T[],
  groupKey: keyof T
): Map<any, T[]> => {
  const groups = new Map<any, T[]>()
  
  data.forEach(item => {
    const key = item[groupKey]
    const group = groups.get(key) || []
    group.push(item)
    groups.set(key, group)
  })
  
  return groups
}

export const exportTableToCSV = <T>(
  data: T[],
  columns: Array<{
    key: keyof T
    label: string
    format?: (value: any) => string
  }>,
  filename = 'export.csv'
): void => {
  const headers = columns.map(col => col.label).join(',')
  
  const rows = data.map(row => {
    return columns.map(col => {
      const value = row[col.key]
      const formatted = col.format ? col.format(value) : value
      const stringValue = String(formatted ?? '')
      if (stringValue.includes(',') || stringValue.includes('"')) {
        return `"${stringValue.replace(/"/g, '""')}"`
      }
      return stringValue
    }).join(',')
  })
  
  const csv = [headers, ...rows].join('\n')
  const blob = new Blob([csv], { type: 'text/csv' })
  const url = URL.createObjectURL(blob)
  
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
}

export const getSelectedRows = <T extends { id: string }>(
  data: T[],
  selectedIds: Set<string>
): T[] => {
  return data.filter(item => selectedIds.has(item.id))
}

export const toggleRowSelection = (
  selectedRows: Set<string>,
  rowId: string
): Set<string> => {
  const newSelection = new Set(selectedRows)
  if (newSelection.has(rowId)) {
    newSelection.delete(rowId)
  } else {
    newSelection.add(rowId)
  }
  return newSelection
}

export const toggleAllRowsSelection = <T extends { id: string }>(
  data: T[],
  currentSelection: Set<string>
): Set<string> => {
  const allIds = data.map(item => item.id)
  const allSelected = allIds.every(id => currentSelection.has(id))
  
  if (allSelected) {
    return new Set()
  } else {
    return new Set(allIds)
  }
}

export const calculateTableHeight = (
  rowCount: number,
  rowHeight = 48,
  headerHeight = 56,
  maxHeight = 600
): number => {
  const calculatedHeight = headerHeight + (rowCount * rowHeight)
  return Math.min(calculatedHeight, maxHeight)
}