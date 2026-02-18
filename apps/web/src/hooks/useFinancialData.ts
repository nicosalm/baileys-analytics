import { useMemo } from 'react'
import { useFinancial } from './use-api'
import { calculatePercentage, calculateGrowthRate, ensureNumber } from '@baileys/utils'

export interface FinancialMetrics {
  revenue: {
    gross: number
    net: number
    platformFees: number
    taxes: number
  }
  profitability: {
    margin: number
    marginPercent: number
    netIncome: number
  }
  comparison: {
    revenueGrowth: number
    profitGrowth: number
    periodLabel: string
  }
  platforms: Array<{
    name: string
    revenue: number
    percentage: number
  }>
  monthly: Array<{
    month: string
    revenue: number
    profit: number
    taxes: number
  }>
}

export function useFinancialData(
  from?: string,
  to?: string,
  tagIds?: string[],
  comparisonFrom?: string,
  comparisonTo?: string
) {
  const { data, error, isLoading, mutate } = useFinancial(from, to, tagIds, comparisonFrom, comparisonTo)
  
  const metrics = useMemo<FinancialMetrics | null>(() => {
    if (!data || !data.metrics) return null
    
    const { metrics, platforms, previousPeriod, byMonth } = data
    
    // Ensure metrics has required properties
    const grossRevenue = ensureNumber(metrics?.revenue?.gross)
    const netRevenue = ensureNumber(metrics?.revenue?.net)
    const platformFees = ensureNumber(metrics?.costs?.platformFees)
    const taxes = ensureNumber(metrics?.costs?.taxes)
    
    // Calculate profit margin
    const profitMargin = grossRevenue > 0 
      ? ((netRevenue / grossRevenue) * 100)
      : 0
    
    // Calculate growth rates
    const revenueGrowth = previousPeriod?.revenue?.gross 
      ? calculateGrowthRate(grossRevenue, previousPeriod.revenue.gross)
      : 0
    
    const profitGrowth = previousPeriod?.revenue?.net
      ? calculateGrowthRate(netRevenue, previousPeriod.revenue.net)
      : 0
    
    // Transform platform data
    const platformData = platforms?.map((p: any) => ({
      name: p.platform || 'Unassigned',
      revenue: ensureNumber(p.revenue),
      percentage: grossRevenue > 0 ? calculatePercentage(p.revenue, grossRevenue) : 0
    })) || []
    
    // Transform monthly data
    const monthlyData = byMonth?.map((m: any) => ({
      month: m.month,
      revenue: ensureNumber(m.revenue),
      profit: ensureNumber(m.netRevenue),
      taxes: ensureNumber(m.taxes)
    })) || []
    
    return {
      revenue: {
        gross: grossRevenue,
        net: netRevenue,
        platformFees: platformFees,
        taxes: taxes
      },
      profitability: {
        margin: profitMargin,
        marginPercent: profitMargin,
        netIncome: netRevenue
      },
      comparison: {
        revenueGrowth,
        profitGrowth,
        periodLabel: previousPeriod ? 'vs Previous Period' : ''
      },
      platforms: platformData,
      monthly: monthlyData
    }
  }, [data])
  
  return {
    data: metrics,
    rawData: data,
    error,
    isLoading,
    mutate
  }
}