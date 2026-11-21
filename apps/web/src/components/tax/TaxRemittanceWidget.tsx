import { FileText, TrendingUp, AlertTriangle, CheckCircle } from 'lucide-react'
import { formatCurrency, formatPercentage, format, parseDate } from '@baileys/utils'
import { StateWrapper } from '@/components/StateWrapper'

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
              <span className="text-sm text-muted-foreground">Total Revenue</span>
              <span className="font-medium">{formatCurrency(totals.revenue)}</span>
            </div>

            <div className="flex justify-between items-center">
              <span className="text-sm text-muted-foreground">Total Tax Due</span>
              <span className="font-semibold text-lg">{formatCurrency(totals.totalTax)}</span>
            </div>

            <div className="flex justify-between items-center text-xs text-muted-foreground">
              <span>Effective Rate</span>
              <span>{formatPercentage(effectiveRate)}</span>
            </div>
          </div>

          {/* Remittance Split */}
          <div className="border-t pt-4">
            <h4 className="text-sm font-medium text-foreground mb-3">Remittance Responsibility</h4>

            <div className="space-y-2">
              {/* Platform Remitted */}
              <div className="p-3 bg-success-subtle rounded-sm border border-success/30">
                <div className="flex justify-between items-center">
                  <div className="flex items-center">
                    <CheckCircle className="w-4 h-4 text-success mr-2" />
                    <div>
                      <p className="text-sm font-medium text-success-fg">Platform Remitted</p>
                      <p className="text-xs text-success-fg">Paid directly by platforms</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="font-semibold text-success-fg">{formatCurrency(totals.platformRemitted)}</p>
                    <p className="text-xs text-success-fg">{formatPercentage(platformPercentage)} of total</p>
                  </div>
                </div>
              </div>

              {/* Owner Remitted */}
              <div className="p-3 bg-info-subtle rounded-sm border border-info/30">
                <div className="flex justify-between items-center">
                  <div className="flex items-center">
                    <TrendingUp className="w-4 h-4 text-info mr-2" />
                    <div>
                      <p className="text-sm font-medium text-info-fg">You Owe</p>
                      <p className="text-xs text-info-fg">Your responsibility to remit</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="font-semibold text-info-fg text-lg">{formatCurrency(totals.ownerRemitted)}</p>
                    <p className="text-xs text-info-fg">{formatPercentage(100 - platformPercentage)} of total</p>
                  </div>
                </div>
              </div>
            </div>
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
                    <span className="text-danger font-medium">{totals.overdue} overdue</span>
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
