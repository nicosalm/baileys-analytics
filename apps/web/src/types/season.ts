export interface Season {
  id: string
  name: string
  startMonth: number
  startDay: number
  endMonth: number
  endDay: number
  isActive: boolean
  tenantId?: string
  createdAt?: string
  updatedAt?: string
}

export interface SeasonFormData {
  name: string
  startMonth: number
  startDay: number
  endMonth: number
  endDay: number
}