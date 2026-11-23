import { FileText, AlertTriangle } from 'lucide-react'
import { formatCurrency, formatPercentage, format, parseDate } from '@baileys/utils'
import { StateWrapper } from '@/components/StateWrapper'
import { TAX_COLORS } from '@/components/charts/TaxTrendChart'

interface TaxSummary {
  totalRent?: number
  totalTax?: number
  platformRemitted?: number
  ownerRemitted?: number
  effectiveRate?: number
}

interface TaxRemittanceWidgetProps {
  taxData: { summary: TaxSummary } | null | undefined
  periodStart: string
  periodEnd: string
}

export const TaxRemittanceWidget = ({ taxData, periodStart, periodEnd }: TaxRemittanceWidgetProps) => {
  const totals = taxData
    ? {
        revenue: taxData.summary.totalRent || 0,
        totalTax: taxData.summary.totalTax || 0,
        platformRemitted: taxData.summary.platformRemitted || 0,
        ownerRemitted: taxData.summary.ownerRemitted || 0,
        pending: 0,
        overdue: 0,
      }
    : {
        revenue: 0,
        totalTax: 0,
        platformRemitted: 0,
        ownerRemitted: 0,
        pending: 0,
        overdue: 0,
      }

  // prefer backend-computed rate (uses taxable base when is_taxable data is available)
  const effectiveRate = taxData?.summary?.effectiveRate ?? (totals.revenue > 0 ? (totals.totalTax / totals.revenue) * 100 : 0)

  const platformPercentage = totals.totalTax > 0 ? (totals.platformRemitted / totals.totalTax) * 100 : 0

  return (
    <div className="bg-card rounded-lg shadow-sm border">
      {/* Header — always visible */}
      <div className="p-4 border-b">
        <div className="flex justify-between items-start">
          <div>
            <h3 className="font-semibold text-foreground flex items-center">
              <FileText className="w-4 h-4 mr-2" />
              Tax Remittance Summary
            </h3>
            <p className="text-sm text-muted-foreground mt-1">
              {format(parseDate(periodStart), 'MMM d')} - {format(parseDate(periodEnd), 'MMM d, yyyy')}
            </p>
          </div>
          {totals.overdue > 0 && (
            <span className="px-2 py-1 bg-danger-subtle text-danger-fg text-xs font-medium rounded-sm">{totals.overdue} Overdue</span>
          )}
        </div>
      </div>
      <StateWrapper empty={!taxData || totals.totalTax === 0} emptyMessage="No tax data available for this period" minHeight={200}>
        {/* Main Content */}
        <div className="p-4 space-y-4">
          {/* Total Tax Breakdown */}
          <div className="space-y-3">
            <div className="flex justify-between items-center">
              <span className="text-sm text-muted-foreground">Revenue</span>
              <span className="font-medium">{formatCurrency(totals.revenue)}</span>
            </div>

            <div className="flex justify-between items-center">
              <span className="text-sm text-muted-foreground">Tax due</span>
              <span className="font-semibold text-lg">{formatCurrency(totals.totalTax)}</span>
            </div>

            <div className="flex justify-between items-center text-xs text-muted-foreground">
              <span>Effective rate</span>
              <span>{formatPercentage(effectiveRate)}</span>
            </div>
          </div>

          <div className="border-t pt-4 space-y-3">
            <div className="flex h-2 overflow-hidden rounded-full bg-muted" aria-hidden>
              <span style={{ width: `${100 - platformPercentage}%`, backgroundColor: TAX_COLORS.owner }} />
              <span style={{ width: `${platformPercentage}%`, backgroundColor: TAX_COLORS.platform }} />
            </div>
            {[
              { label: 'You remit', amount: totals.ownerRemitted, share: 100 - platformPercentage, color: TAX_COLORS.owner },
              { label: 'Platforms remit', amount: totals.platformRemitted, share: platformPercentage, color: TAX_COLORS.platform },
            ].map(({ label, amount, share, color }) => (
              <div key={label} className="flex items-center justify-between text-sm">
                <span className="flex items-center gap-2 text-muted-foreground">
                  <span className="w-2.5 h-2.5 rounded-sm" style={{ backgroundColor: color }} aria-hidden />
                  {label}
                </span>
                <span className="tabular-nums">
                  <span className="font-semibold">{formatCurrency(amount)}</span>
                  <span className="ml-2 text-xs text-muted-foreground">{formatPercentage(share)}</span>
                </span>
              </div>
            ))}
          </div>

          {/* Status Indicators */}
          {(totals.pending > 0 || totals.overdue > 0) && (
            <div className="border-t pt-4">
              <div className="flex items-center justify-between">
                {totals.pending > 0 && (
                  <div className="flex items-center text-sm">
                    <div className="w-2 h-2 bg-warning rounded-full mr-2" />
                    <span className="text-muted-foreground">
                      {totals.pending} pending filing{totals.pending > 1 ? 's' : ''}
                    </span>
                  </div>
                )}
                {totals.overdue > 0 && (
                  <div className="flex items-center text-sm">
                    <AlertTriangle className="w-4 h-4 text-danger mr-1" />
                    <span className="text-danger-fg font-medium">{totals.overdue} overdue</span>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </StateWrapper>
    </div>
  )
}
