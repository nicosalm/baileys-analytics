import { FileText, TrendingUp, AlertTriangle, CheckCircle } from 'lucide-react'
import { formatCurrency, formatPercentage } from '@baileys/utils'
import { useTaxRemittance } from '@/hooks/use-api'
import { StateWrapper } from '@/components/StateWrapper'
import { format, parseISO } from 'date-fns'

interface TaxRemittanceWidgetProps {
  propertyId?: string
  periodStart: string
  periodEnd: string
}

export const TaxRemittanceWidget = ({ 
  propertyId, 
  periodStart, 
  periodEnd 
}: TaxRemittanceWidgetProps) => {
  const { data: remittances, error, isLoading } = useTaxRemittance(propertyId, periodStart, periodEnd)
  
  const remittanceData = Array.isArray(remittances) ? remittances : []
  
  const totals = remittanceData.reduce(
    (acc: any, rem: any) => ({
      revenue: acc.revenue + rem.totalRevenue,
      platformFees: acc.platformFees + rem.totalPlatformFees,
      totalTax: acc.totalTax + rem.totalTaxDue,
      platformRemitted: acc.platformRemitted + rem.platformRemitted,
      ownerRemitted: acc.ownerRemitted + rem.ownerRemitted,
      pending: rem.filingStatus === 'pending' ? acc.pending + 1 : acc.pending,
      overdue: rem.filingStatus === 'overdue' ? acc.overdue + 1 : acc.overdue
    }),
    { 
      revenue: 0, 
      platformFees: 0, 
      totalTax: 0, 
      platformRemitted: 0, 
      ownerRemitted: 0,
      pending: 0,
      overdue: 0
    }
  ) || { 
    revenue: 0, 
    platformFees: 0, 
    totalTax: 0, 
    platformRemitted: 0, 
    ownerRemitted: 0,
    pending: 0,
    overdue: 0
  }
  
  const effectiveRate = totals.revenue > 0 
    ? (totals.totalTax / (totals.revenue + totals.platformFees)) * 100
    : 0
  
  const platformPercentage = totals.totalTax > 0
    ? (totals.platformRemitted / totals.totalTax) * 100
    : 0
  
  return (
    <StateWrapper
      loading={isLoading}
      error={error}
      empty={remittanceData.length === 0}
      emptyMessage="No tax remittance data available"
      minHeight={200}
    >
      <div className="bg-white rounded-lg shadow-sm border border-gray-200">
        {/* Header */}
        <div className="p-4 border-b border-gray-200">
          <div className="flex justify-between items-start">
            <div>
              <h3 className="font-semibold text-gray-900 flex items-center">
                <FileText className="w-4 h-4 mr-2" />
                Tax Remittance Summary
              </h3>
              <p className="text-sm text-gray-600 mt-1">
                {format(parseISO(periodStart), 'MMM d')} - {format(parseISO(periodEnd), 'MMM d, yyyy')}
              </p>
            </div>
            {totals.overdue > 0 && (
              <span className="px-2 py-1 bg-red-100 text-red-700 text-xs font-medium rounded-sm">
                {totals.overdue} Overdue
              </span>
            )}
          </div>
        </div>
        
        {/* Main Content */}
        <div className="p-4 space-y-4">
          {/* Total Tax Breakdown */}
          <div className="space-y-3">
            <div className="flex justify-between items-center">
              <span className="text-sm text-gray-600">Total Revenue + Fees</span>
              <span className="font-medium">
                {formatCurrency(totals.revenue + totals.platformFees)}
              </span>
            </div>
            
            <div className="flex justify-between items-center">
              <span className="text-sm text-gray-600">Total Tax Due</span>
              <span className="font-semibold text-lg">
                {formatCurrency(totals.totalTax)}
              </span>
            </div>
            
            <div className="flex justify-between items-center text-xs text-gray-500">
              <span>Effective Rate</span>
              <span>{formatPercentage(effectiveRate)}</span>
            </div>
          </div>
          
          {/* Remittance Split */}
          <div className="border-t pt-4">
            <h4 className="text-sm font-medium text-gray-700 mb-3">Remittance Responsibility</h4>
            
            <div className="space-y-2">
              {/* Platform Remitted */}
              <div className="p-3 bg-green-50 rounded-sm border border-green-200">
                <div className="flex justify-between items-center">
                  <div className="flex items-center">
                    <CheckCircle className="w-4 h-4 text-green-600 mr-2" />
                    <div>
                      <p className="text-sm font-medium text-green-900">Platform Remitted</p>
                      <p className="text-xs text-green-700">Paid directly by platforms</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="font-semibold text-green-900">
                      {formatCurrency(totals.platformRemitted)}
                    </p>
                    <p className="text-xs text-green-700">
                      {formatPercentage(platformPercentage)} of total
                    </p>
                  </div>
                </div>
              </div>
              
              {/* Owner Remitted */}
              <div className="p-3 bg-blue-50 rounded-sm border border-blue-200">
                <div className="flex justify-between items-center">
                  <div className="flex items-center">
                    <TrendingUp className="w-4 h-4 text-blue-600 mr-2" />
                    <div>
                      <p className="text-sm font-medium text-blue-900">You Owe</p>
                      <p className="text-xs text-blue-700">Your responsibility to remit</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="font-semibold text-blue-900 text-lg">
                      {formatCurrency(totals.ownerRemitted)}
                    </p>
                    <p className="text-xs text-blue-700">
                      {formatPercentage(100 - platformPercentage)} of total
                    </p>
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
                    <div className="w-2 h-2 bg-yellow-400 rounded-full mr-2" />
                    <span className="text-gray-600">
                      {totals.pending} pending filing{totals.pending > 1 ? 's' : ''}
                    </span>
                  </div>
                )}
                {totals.overdue > 0 && (
                  <div className="flex items-center text-sm">
                    <AlertTriangle className="w-4 h-4 text-red-500 mr-1" />
                    <span className="text-red-600 font-medium">
                      {totals.overdue} overdue
                    </span>
                  </div>
                )}
              </div>
            </div>
          )}
          
          {/* Action Button */}
          <div className="border-t pt-4">
            <button className="w-full px-4 py-2 bg-gray-100 text-gray-700 text-sm font-medium rounded-sm hover:bg-gray-200 transition-colors">
              View Detailed Report →
            </button>
          </div>
        </div>
      </div>
    </StateWrapper>
  )
}