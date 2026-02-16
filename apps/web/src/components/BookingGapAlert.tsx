import { AlertTriangle, Calendar, TrendingDown } from 'lucide-react'
import { formatCurrency, formatDateDisplay } from '@baileys/utils'

export interface BookingGap {
  propertyId: string
  propertyName: string
  gapStart: string
  gapEnd: string
  gapDays: number
  daysUntilGap: number
  estimatedRevenueLoss: number
  severity: 'critical' | 'warning' | 'info'
}

interface BookingGapAlertProps {
  gaps: BookingGap[]
  isLoading?: boolean
  maxGapsToShow?: number
  onDismiss?: () => void
}

export const BookingGapAlert = ({
  gaps,
  isLoading = false,
  maxGapsToShow = 3
}: BookingGapAlertProps) => {
  if (!isLoading && gaps.length === 0) {
    return null
  }

  if (isLoading) {
    return (
      <div className="bg-white rounded-lg border border-gray-200 p-6 animate-pulse shadow-sm">
        <div className="h-5 bg-gray-200 rounded w-1/3 mb-3"></div>
        <div className="h-4 bg-gray-100 rounded w-1/2"></div>
      </div>
    )
  }

  // sort gaps by urgency (days until gap) and severity
  const sortedGaps = [...gaps]
    .sort((a, b) => {
      if (a.severity !== b.severity) {
        const severityOrder = { critical: 0, warning: 1, info: 2 }
        return severityOrder[a.severity] - severityOrder[b.severity]
      }
      return a.daysUntilGap - b.daysUntilGap
    })

  const displayGaps = sortedGaps.slice(0, maxGapsToShow)
  const urgentGaps = sortedGaps.filter(g => g.daysUntilGap <= 7).length
  const criticalGaps = sortedGaps.filter(g => g.severity === 'critical').length
  
  const getSeverityStyles = (severity: BookingGap['severity']) => {
    switch (severity) {
      case 'critical': 
        return {
          bg: 'bg-red-50',
          border: 'border-red-200',
          text: 'text-red-700',
          icon: 'text-red-600',
          badge: 'bg-red-100 text-red-700'
        }
      case 'warning': 
        return {
          bg: 'bg-yellow-50',
          border: 'border-yellow-200',
          text: 'text-yellow-700',
          icon: 'text-yellow-600',
          badge: 'bg-yellow-100 text-yellow-700'
        }
      case 'info': 
        return {
          bg: 'bg-blue-50',
          border: 'border-blue-200',
          text: 'text-blue-700',
          icon: 'text-blue-600',
          badge: 'bg-blue-100 text-blue-700'
        }
    }
  }

  const alertSeverity = criticalGaps > 0 ? 'critical' : urgentGaps > 0 ? 'warning' : 'info'
  const alertStyles = getSeverityStyles(alertSeverity)

  return (
    <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-bold">Booking Gaps</h3>
        <div className="flex items-center gap-3">
          {urgentGaps > 0 && (
            <span className={`px-2 py-0.5 text-xs font-medium rounded-full ${alertStyles.badge}`}>
              {urgentGaps} Urgent
            </span>
          )}
          <span className="text-xs text-gray-500">
            {gaps.length} {gaps.length === 1 ? 'gap' : 'gaps'}
          </span>
        </div>
      </div>

      <div className="space-y-3 max-h-80 overflow-y-auto">
        {displayGaps.map((gap) => {
          const styles = getSeverityStyles(gap.severity)
          const icon = gap.severity === 'critical' ? (
            <AlertTriangle className="w-4 h-4" />
          ) : gap.severity === 'warning' ? (
            <TrendingDown className="w-4 h-4" />
          ) : (
            <Calendar className="w-4 h-4" />
          )

          return (
            <div
              key={`${gap.propertyId}-${gap.gapStart}`}
              className="flex items-center justify-between py-2 border-b last:border-0"
            >
              <div className="flex items-center gap-2 flex-1 min-w-0">
                <div className={`shrink-0 ${styles.icon}`}>
                  {icon}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">
                    {gap.propertyName} • {gap.gapDays} {gap.gapDays === 1 ? 'night' : 'nights'}
                  </p>
                  <p className="text-xs text-gray-500">
                    {formatDateDisplay(new Date(gap.gapStart))} - {formatDateDisplay(new Date(gap.gapEnd))}
                    {gap.daysUntilGap <= 0
                      ? ' (Current)'
                      : gap.daysUntilGap === 1
                      ? ' (Tomorrow)'
                      : ` (${gap.daysUntilGap}d)`
                    }
                  </p>
                </div>
              </div>
              {gap.estimatedRevenueLoss > 0 && (
                <div className="text-xs text-gray-500 shrink-0 ml-2">
                  ~{formatCurrency(gap.estimatedRevenueLoss)}
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}