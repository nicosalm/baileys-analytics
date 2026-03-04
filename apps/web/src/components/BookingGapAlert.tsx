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
      <div className="bg-card rounded-lg border border-border p-6 animate-pulse shadow-sm">
        <div className="h-5 bg-muted rounded w-1/3 mb-3"></div>
        <div className="h-4 bg-muted/50 rounded w-1/2"></div>
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
          bg: 'bg-danger-subtle',
          border: 'border-danger/30',
          text: 'text-danger-fg',
          icon: 'text-danger',
          badge: 'bg-danger-subtle text-danger-fg'
        }
      case 'warning':
        return {
          bg: 'bg-warning-subtle',
          border: 'border-warning/30',
          text: 'text-warning-fg',
          icon: 'text-warning',
          badge: 'bg-warning-subtle text-warning-fg'
        }
      case 'info':
        return {
          bg: 'bg-info-subtle',
          border: 'border-info/30',
          text: 'text-info-fg',
          icon: 'text-info',
          badge: 'bg-info-subtle text-info-fg'
        }
    }
  }

  const alertSeverity = criticalGaps > 0 ? 'critical' : urgentGaps > 0 ? 'warning' : 'info'
  const alertStyles = getSeverityStyles(alertSeverity)

  return (
    <div className="bg-card p-6 rounded-lg shadow-sm border border-border">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-bold">Booking Gaps</h3>
        <div className="flex items-center gap-3">
          {urgentGaps > 0 && (
            <span className={`px-2 py-0.5 text-xs font-medium rounded-full ${alertStyles.badge}`}>
              {urgentGaps} Urgent
            </span>
          )}
          <span className="text-xs text-muted-foreground">
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
                  <p className="text-xs text-muted-foreground">
                    {formatDateDisplay(gap.gapStart)} - {formatDateDisplay(gap.gapEnd)}
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
                <div className="text-xs text-muted-foreground shrink-0 ml-2">
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