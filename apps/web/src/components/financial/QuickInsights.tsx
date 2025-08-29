import React, { useMemo } from 'react'
import { StateWrapper } from '@/components/StateWrapper'
import { 
  TrendingUp, TrendingDown, AlertCircle, CheckCircle,
  Lightbulb, Target, DollarSign, Calendar
} from 'lucide-react'
import { formatCurrency, formatPercentage } from '@/utils/formatters'

interface InsightCard {
  type: 'success' | 'warning' | 'info' | 'tip'
  icon: React.ElementType
  title: string
  description: string
  action?: {
    label: string
    onClick: () => void
  }
}

interface QuickInsightsProps {
  data: any
  loading: boolean
  onPropertyClick?: (propertyId: string) => void
  onPeriodClick?: (period: string) => void
  comparisonMode?: 'none' | 'previous-period' | 'previous-year'
}

export const QuickInsights: React.FC<QuickInsightsProps> = ({
  data,
  loading,
  onPropertyClick,
  onPeriodClick
}) => {
  const insights = useMemo(() => {
    if (!data || !data.metrics) return []
    
    const { metrics, byProperty, byMonth, platforms, previousPeriod } = data
    const insights: InsightCard[] = []
    
    // Safe access to revenue data
    const grossRevenue = metrics?.revenue?.gross || 0
    const netRevenue = metrics?.revenue?.net || 0
    
    // Revenue insights
    const revenueGrowth = previousPeriod?.revenue?.gross && grossRevenue
      ? ((grossRevenue - previousPeriod.revenue.gross) / previousPeriod.revenue.gross) * 100
      : 0
    
    if (revenueGrowth > 10) {
      insights.push({
        type: 'success',
        icon: TrendingUp,
        title: 'Strong Revenue Growth',
        description: `Revenue is up ${formatPercentage(revenueGrowth, 1)} compared to the previous period. Keep up the great work!`
      })
    } else if (revenueGrowth < -10) {
      insights.push({
        type: 'warning',
        icon: TrendingDown,
        title: 'Revenue Decline',
        description: `Revenue is down ${formatPercentage(Math.abs(revenueGrowth), 1)} compared to the previous period. Consider adjusting pricing or marketing strategies.`
      })
    }
    
    // Profit margin insights
    const profitMargin = grossRevenue > 0
      ? (netRevenue / grossRevenue) * 100
      : 0
    
    if (profitMargin < 60) {
      insights.push({
        type: 'warning',
        icon: AlertCircle,
        title: 'Low Profit Margin',
        description: `Your profit margin is ${formatPercentage(profitMargin, 1)}. Review platform fees and consider increasing direct bookings.`
      })
    } else if (profitMargin > 80) {
      insights.push({
        type: 'success',
        icon: CheckCircle,
        title: 'Excellent Profit Margin',
        description: `You're keeping ${formatPercentage(profitMargin, 1)} of revenue. Your cost management is outstanding!`
      })
    }
    
    // Platform diversity insights
    const platformCount = platforms?.length || 0
    const directBookingPercentage = platforms?.find((p: any) => p.platform === 'Direct')?.percentage || 0
    
    if (directBookingPercentage > 30) {
      insights.push({
        type: 'success',
        icon: DollarSign,
        title: 'Strong Direct Bookings',
        description: `${formatPercentage(directBookingPercentage, 1)} of revenue comes from direct bookings, saving on platform fees.`
      })
    } else if (platformCount === 1) {
      insights.push({
        type: 'tip',
        icon: Lightbulb,
        title: 'Diversify Revenue Sources',
        description: 'Consider listing on multiple platforms to reduce dependency and increase bookings.'
      })
    }
    
    // Seasonal insights
    if (byMonth && byMonth.length >= 3) {
      const monthlyRevenues = byMonth.map((m: any) => m.revenue || 0)
      const avgRevenue = monthlyRevenues.length > 0 
        ? monthlyRevenues.reduce((sum: number, val: number) => sum + val, 0) / monthlyRevenues.length
        : 0
      const bestMonth = byMonth.reduce((best: any, current: any) => 
        (current.revenue || 0) > (best.revenue || 0) ? current : best
      )
      const worstMonth = byMonth.reduce((worst: any, current: any) => 
        (current.revenue || 0) < (worst.revenue || 0) ? current : worst
      )
      
      if (bestMonth.revenue > avgRevenue * 1.5) {
        insights.push({
          type: 'info',
          icon: Calendar,
          title: 'Peak Season Performance',
          description: `${bestMonth.month} was your best month with ${formatCurrency(bestMonth.revenue)} in revenue.`,
          action: {
            label: 'View Details',
            onClick: () => onPeriodClick?.(bestMonth.month)
          }
        })
      }
      
      if (worstMonth.revenue < avgRevenue * 0.5) {
        insights.push({
          type: 'tip',
          icon: Target,
          title: 'Opportunity for Growth',
          description: `${worstMonth.month} had low performance. Consider seasonal promotions or rate adjustments.`,
          action: {
            label: 'Analyze',
            onClick: () => onPeriodClick?.(worstMonth.month)
          }
        })
      }
    }
    
    // Property performance insights
    if (byProperty && byProperty.length > 1) {
      const propertyRevenues = byProperty.map((p: any) => p.revenue || 0)
      const avgPropertyRevenue = propertyRevenues.length > 0
        ? propertyRevenues.reduce((sum: number, val: number) => sum + val, 0) / propertyRevenues.length
        : 0
      const underperformers = byProperty.filter((p: any) => 
        (p.revenue || 0) < avgPropertyRevenue * 0.5
      )
      
      if (underperformers.length > 0) {
        insights.push({
          type: 'warning',
          icon: AlertCircle,
          title: `${underperformers.length} Underperforming Properties`,
          description: 'Some properties are significantly below average. Review pricing and occupancy strategies.',
          action: {
            label: 'View Properties',
            onClick: () => onPropertyClick?.(underperformers[0].propertyId)
          }
        })
      }
    }
    
    return insights
  }, [data, onPropertyClick, onPeriodClick])
  
  if (loading) {
    return (
      <StateWrapper
        loading={loading}
        loadingMessage="Generating insights..."
        minHeight={300}
      >
        <div />
      </StateWrapper>
    )
  }
  
  if (insights.length === 0) {
    return (
      <div className="text-center py-12 text-gray-500">
        <Lightbulb className="w-12 h-12 mx-auto mb-4 text-gray-400" />
        <p>No specific insights available for this period.</p>
        <p className="text-sm mt-2">Try selecting a longer date range for more data.</p>
      </div>
    )
  }
  
  return (
    <div className="space-y-4">
      {insights.map((insight, index) => {
        const Icon = insight.icon
        const bgColor = {
          success: 'bg-green-50 border-green-200',
          warning: 'bg-yellow-50 border-yellow-200',
          info: 'bg-blue-50 border-blue-200',
          tip: 'bg-purple-50 border-purple-200'
        }[insight.type]
        
        const iconColor = {
          success: 'text-green-600',
          warning: 'text-yellow-600',
          info: 'text-blue-600',
          tip: 'text-purple-600'
        }[insight.type]
        
        return (
          <div key={index} className={`rounded-lg p-4 border ${bgColor}`}>
            <div className="flex items-start">
              <Icon className={`w-5 h-5 ${iconColor} mr-3 mt-0.5 flex-shrink-0`} />
              <div className="flex-1">
                <h4 className="font-semibold text-gray-900">{insight.title}</h4>
                <p className="text-sm text-gray-600 mt-1">{insight.description}</p>
                {insight.action && (
                  <button
                    onClick={insight.action.onClick}
                    className="text-sm text-blue-600 hover:underline mt-2"
                  >
                    {insight.action.label} →
                  </button>
                )}
              </div>
            </div>
          </div>
        )
      })}
    </div>
  )
}