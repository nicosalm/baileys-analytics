import { useState } from 'react'
import { useFinancial } from '@/hooks/use-api'
import { formatCurrency, formatPercentage, calculatePercentage } from '@baileys/utils'
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, BarChart, Bar, XAxis, YAxis, CartesianGrid } from 'recharts'
import { DollarSign, Info, Calculator, PiggyBank } from 'lucide-react'
import { Spinner } from '@/components/Spinner'
import { Modal } from '@/components/Modal'
import { useModal } from '@/contexts/modal'
import { useDashboard } from '@/contexts/dashboard'
import { CHART_COLORS } from '@/lib/theme'

interface FinancialSummaryModalProps {
  propertyId?: string
  propertyName?: string
}

export const FinancialSummaryModal = ({ propertyName }: FinancialSummaryModalProps) => {
  const { closeModal } = useModal()
  const { filters } = useDashboard()
  const [viewMode, setViewMode] = useState<'overview' | 'breakdown'>('overview')
  
  const { data, isLoading, error } = useFinancial(
    filters.dateRange.from,
    filters.dateRange.to,
    filters.selectedTags.map(t => t.id)
  )

  if (isLoading) {
    return (
      <Modal
        isOpen={true}
        onClose={closeModal}
        title="Financial Summary"
        subtitle="Loading financial data..."
        size="lg"
      >
        <div className="flex justify-center py-12">
          <Spinner size="lg" />
        </div>
      </Modal>
    )
  }

  if (error || !data) {
    return (
      <Modal
        isOpen={true}
        onClose={closeModal}
        title="Financial Summary"
        subtitle="Unable to load financial data"
        size="lg"
      >
        <div className="text-center py-12">
          <p className="text-gray-600">Something went wrong. Please try again.</p>
        </div>
      </Modal>
    )
  }

  const grossRevenue = data.pl?.metrics?.revenue?.gross || 0
  const netRevenue = data.pl?.metrics?.revenue?.net || 0
  const platformFees = data.pl?.metrics?.revenue?.platformFees || 0
  const cleaningFees = data.pl?.metrics?.revenue?.cleaningFees || 0
  const taxAmount = data.tax?.total || 0
  
  const profitMargin = calculatePercentage(netRevenue, grossRevenue)
  
  const expenseBreakdown = [
    { name: 'Platform Fees', value: platformFees, color: CHART_COLORS[0] },
    { name: 'Cleaning', value: cleaningFees, color: CHART_COLORS[1] },
    { name: 'Taxes', value: taxAmount, color: CHART_COLORS[2] },
    { name: 'Other', value: 0, color: CHART_COLORS[3] }
  ].filter(item => item.value > 0)

  const monthlyData = data.pl?.monthlyTrend?.map((month: any) => ({
    month: new Date(month.month).toLocaleDateString('en-US', { month: 'short' }),
    revenue: month.grossRevenue,
    profit: month.netRevenue,
    margin: calculatePercentage(month.netRevenue, month.grossRevenue)
  })) || []

  return (
    <Modal
      isOpen={true}
      onClose={closeModal}
      title={propertyName ? `${propertyName} Finances` : "Financial Summary"}
      subtitle="Quick financial insights and breakdown"
      size="lg"
    >
      <div className="space-y-6">
        {/* Info Banner */}
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <div className="flex items-start">
            <Info className="w-5 h-5 text-blue-600 mr-2 mt-0.5" />
            <div className="text-sm text-blue-800">
              <strong>Financial Overview:</strong> See your revenue breakdown and profit margins at a glance. 
              This summary shows what you earned vs what you kept after all expenses.
            </div>
          </div>
        </div>

        {/* Key Metrics */}
        <div className="grid grid-cols-3 gap-4">
          <div className="bg-white p-4 rounded-lg border">
            <div className="flex items-center text-sm text-gray-600 mb-1">
              <DollarSign className="w-4 h-4 mr-1" />
              Total Earned
            </div>
            <div className="text-2xl font-bold text-green-600">
              {formatCurrency(grossRevenue)}
            </div>
            <div className="text-xs text-gray-500">Before expenses</div>
          </div>
          
          <div className="bg-white p-4 rounded-lg border">
            <div className="flex items-center text-sm text-gray-600 mb-1">
              <PiggyBank className="w-4 h-4 mr-1" />
              You Kept
            </div>
            <div className="text-2xl font-bold">
              {formatCurrency(netRevenue)}
            </div>
            <div className="text-xs text-gray-500">After all expenses</div>
          </div>
          
          <div className="bg-white p-4 rounded-lg border">
            <div className="flex items-center text-sm text-gray-600 mb-1">
              <Calculator className="w-4 h-4 mr-1" />
              Profit Margin
            </div>
            <div className={`text-2xl font-bold ${profitMargin >= 70 ? 'text-green-600' : profitMargin >= 50 ? 'text-yellow-600' : 'text-red-600'}`}>
              {formatPercentage(profitMargin, 0)}
            </div>
            <div className="text-xs text-gray-500">Of gross revenue</div>
          </div>
        </div>

        {/* Tabs */}
        <div className="border-b">
          <nav className="flex space-x-6">
            <button
              onClick={() => setViewMode('overview')}
              className={`pb-2 border-b-2 transition-colors ${
                viewMode === 'overview'
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-gray-600 hover:text-gray-900'
              }`}
            >
              Expense Breakdown
            </button>
            <button
              onClick={() => setViewMode('breakdown')}
              className={`pb-2 border-b-2 transition-colors ${
                viewMode === 'breakdown'
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-gray-600 hover:text-gray-900'
              }`}
            >
              Monthly Trends
            </button>
          </nav>
        </div>

        {/* Tab Content */}
        {viewMode === 'overview' && (
          <div className="grid md:grid-cols-2 gap-6">
            <div className="bg-white p-4 rounded-lg border">
              <h3 className="text-sm font-semibold text-gray-700 mb-3">Where Your Money Went</h3>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={expenseBreakdown}
                      cx="50%"
                      cy="50%"
                      innerRadius={60}
                      outerRadius={90}
                      paddingAngle={2}
                      dataKey="value"
                    >
                      {expenseBreakdown.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(value: any) => formatCurrency(value)} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div className="mt-4 space-y-2">
                {expenseBreakdown.map((item) => (
                  <div key={item.name} className="flex justify-between text-sm">
                    <div className="flex items-center">
                      <div className="w-3 h-3 rounded-full mr-2" style={{ backgroundColor: item.color }} />
                      <span className="text-gray-600">{item.name}</span>
                    </div>
                    <span className="font-medium">{formatCurrency(item.value)}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="bg-white p-4 rounded-lg border">
              <h3 className="text-sm font-semibold text-gray-700 mb-3">Quick Calculations</h3>
              <div className="space-y-3">
                <div className="flex justify-between py-2 border-b">
                  <span className="text-gray-600">Guest Payments</span>
                  <span className="font-medium">{formatCurrency(grossRevenue)}</span>
                </div>
                <div className="flex justify-between py-2">
                  <span className="text-gray-600">Platform Fees</span>
                  <span className="font-medium text-red-600">-{formatCurrency(platformFees)}</span>
                </div>
                <div className="flex justify-between py-2">
                  <span className="text-gray-600">Cleaning Costs</span>
                  <span className="font-medium text-red-600">-{formatCurrency(cleaningFees)}</span>
                </div>
                <div className="flex justify-between py-2">
                  <span className="text-gray-600">Taxes</span>
                  <span className="font-medium text-red-600">-{formatCurrency(taxAmount)}</span>
                </div>
                <div className="flex justify-between py-2 pt-3 border-t font-semibold">
                  <span>What You Keep</span>
                  <span className="text-green-600">{formatCurrency(netRevenue)}</span>
                </div>
              </div>
            </div>
          </div>
        )}

        {viewMode === 'breakdown' && monthlyData.length > 0 && (
          <div className="bg-white p-4 rounded-lg border">
            <h3 className="text-sm font-semibold text-gray-700 mb-3">Revenue vs Profit Over Time</h3>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={monthlyData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="month" />
                  <YAxis tickFormatter={(value) => `$${(value / 1000).toFixed(0)}k`} />
                  <Tooltip 
                    formatter={(value: any, name: string) => [
                      formatCurrency(value),
                      name === 'revenue' ? 'Total Earned' : 'You Kept'
                    ]}
                  />
                  <Bar dataKey="revenue" fill="#3b82f6" name="revenue" />
                  <Bar dataKey="profit" fill="#10b981" name="profit" />
                </BarChart>
              </ResponsiveContainer>
            </div>
            <div className="mt-4 flex justify-center space-x-6 text-sm">
              <div className="flex items-center">
                <div className="w-3 h-3 bg-blue-500 rounded mr-2" />
                <span className="text-gray-600">Total Earned</span>
              </div>
              <div className="flex items-center">
                <div className="w-3 h-3 bg-green-500 rounded mr-2" />
                <span className="text-gray-600">What You Kept</span>
              </div>
            </div>
          </div>
        )}
      </div>
    </Modal>
  )
}