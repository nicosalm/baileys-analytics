import { FileText, TrendingUp, AlertTriangle, CheckCircle } from 'lucide-react'
import { formatCurrency, formatPercentage } from '@baileys/utils'
import { useFinancial } from '@/hooks/use-api'
import { StateWrapper } from '@/components/StateWrapper'
import { format, parseISO } from 'date-fns'

interface TaxRemittanceWidgetProps {
  propertyId?: string
  periodStart: string
  periodEnd: string
}

export const TaxRemittanceWidget = ({ 
  periodStart, 
  periodEnd 
}: TaxRemittanceWidgetProps) => {
  // Use financial data to get calculated tax information
  const { data: financialData, error, isLoading } = useFinancial(periodStart, periodEnd)
  
  // Extract tax data from financial response
  const taxData = financialData?.tax
  
  const totals = taxData ? {
    revenue: taxData.summary.totalRent || 0,
    platformFees: 0, // Will be calculated from platform fee entries if needed
    totalTax: taxData.summary.totalTax || 0,
    platformRemitted: taxData.summary.platformRemitted || 0,
    ownerRemitted: taxData.summary.ownerRemitted || 0,
    pending: 0, // No filing status in calculated data
    overdue: 0  // No filing status in calculated data
  } : { 
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
      empty={!taxData || totals.totalTax === 0}
      emptyMessage="No tax data available for this period"
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
        </div>
      </div>
    </StateWrapper>
  )
}