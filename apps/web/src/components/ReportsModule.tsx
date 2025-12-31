import { useState } from 'react'
import {
  FileText,
  Play, TrendingUp, Users,
  AlertCircle, Home, DollarSign,
  BarChart3, Building2, PieChart, Zap
} from 'lucide-react'
import { useToast } from '@/contexts/toast'
import { useAuth } from '@/contexts/auth'
import { useReportTemplates } from '@/hooks/use-api'
import { LoadingState } from '@/components/LoadingState'
import { authenticatedFetch } from '@/lib/api'
import { DCTZReportCard, DCTZ_ENABLED_TENANTS } from '@/components/dctz'

const REPORT_CATEGORIES = {
  operational: {
    label: 'Operational',
    icon: Home,
    color: 'blue',
    description: 'Daily operations and logistics'
  },
  financial: {
    label: 'Financial',
    icon: DollarSign,
    color: 'green',
    description: 'Revenue, P&L, and financial metrics'
  },
  analytics: {
    label: 'Analytics',
    icon: BarChart3,
    color: 'purple',
    description: 'Performance insights and trends'
  },
  custom: {
    label: 'Custom',
    icon: FileText,
    color: 'gray',
    description: 'Your custom report templates'
  }
}

// Quick Reports that mirror OwnerRez reports
const QUICK_REPORTS = [
  {
    id: 'daily-ops',
    name: 'Daily Operations Digest',
    description: 'Today\'s arrivals and departures',
    icon: Zap,
    category: 'operational',
    config: {
      modules: ['arrivals', 'departures'],
      dateRange: 'today',
      format: 'pdf'
    }
  },
  {
    id: 'property-performance',
    name: 'Property Performance',
    description: 'Revenue, occupancy, and booking gaps by property',
    icon: Building2,
    category: 'analytics',
    config: {
      modules: ['properties', 'occupancy', 'revenue_by_property'],
      dateRange: 'last30days',
      format: 'pdf'
    }
  },
  {
    id: 'financial-summary',
    name: 'Financial Summary',
    description: 'Revenue, platform fees, and monthly trends',
    icon: TrendingUp,
    category: 'financial',
    config: {
      modules: ['pl', 'revenue', 'expenses', 'trends'],
      dateRange: 'lastMonth',
      format: 'pdf'
    }
  },
  {
    id: 'tax-report',
    name: 'Tax Report',
    description: 'Tax collected, owner vs platform remittance',
    icon: FileText,
    category: 'financial',
    config: {
      modules: ['tax', 'jurisdictions', 'tax_breakdown'],
      dateRange: 'lastQuarter',
      format: 'pdf'
    }
  },
  {
    id: 'channel-analysis',
    name: 'Channel Analysis',
    description: 'Performance by booking source',
    icon: PieChart,
    category: 'analytics',
    config: {
      modules: ['channels', 'revenue_by_channel'],
      dateRange: 'last90days',
      format: 'pdf'
    }
  },
  {
    id: 'guest-analytics',
    name: 'Guest Analytics',
    description: 'Repeat visitor rates and top guests by revenue',
    icon: Users,
    category: 'analytics',
    config: {
      modules: ['guests', 'repeat_rate'],
      dateRange: 'last90days',
      format: 'pdf'
    }
  }
]

const getDateRangeLabel = (dateRange: string): string => {
  const today = new Date()

  switch (dateRange) {
    case 'today':
      return today.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
    case 'last7days':
      const last7 = new Date(today)
      last7.setDate(today.getDate() - 7)
      return `${last7.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} - ${today.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`
    case 'last30days':
      const last30 = new Date(today)
      last30.setDate(today.getDate() - 30)
      return `Last 30 Days`
    case 'lastMonth':
      const lastMonth = new Date(today.getFullYear(), today.getMonth() - 1, 1)
      return lastMonth.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
    case 'last90days':
      return 'Last 90 Days'
    case 'lastQuarter':
      const quarter = Math.floor(today.getMonth() / 3)
      const quarterStart = new Date(today.getFullYear(), (quarter - 1) * 3, 1)
      const quarterMonth = quarterStart.toLocaleDateString('en-US', { month: 'short' })
      const quarterEndMonth = new Date(today.getFullYear(), quarter * 3 - 1, 1).toLocaleDateString('en-US', { month: 'short' })
      return `Q${quarter} ${today.getFullYear()} (${quarterMonth} - ${quarterEndMonth})`
    case 'lastYear':
      return (today.getFullYear() - 1).toString()
    default:
      return dateRange
  }
}

const QuickReportCard = ({ report }: { report: typeof QUICK_REPORTS[0] }) => {
  const { addToast } = useToast()
  const [isGenerating, setIsGenerating] = useState(false)

  const category = REPORT_CATEGORIES[report.category as keyof typeof REPORT_CATEGORIES]
  const Icon = report.icon
  const dateRangeLabel = getDateRangeLabel(report.config.dateRange)

  const handleQuickGenerate = async () => {
    setIsGenerating(true)
    try {
      // Use authenticatedFetch which includes the Supabase auth token
      const response = await authenticatedFetch('/reports/quick-generate', {
        method: 'POST',
        body: JSON.stringify(report.config)
      })

      if (!response.ok) {
        throw new Error('Failed to generate report')
      }

      const blob = await response.blob()
      const url = URL.createObjectURL(blob)

      const link = document.createElement('a')
      link.href = url
      link.download = `${report.name.replace(/\s+/g, '_')}_${new Date().toISOString().split('T')[0]}.pdf`
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)

      URL.revokeObjectURL(url)

      addToast('success', 'Report downloaded successfully')
    } catch (error) {
      addToast('error', error instanceof Error ? error.message : 'Failed to generate report')
    } finally {
      setIsGenerating(false)
    }
  }

  return (
    <div className="h-full bg-white rounded-lg border border-gray-200 hover:bg-gray-50/50 transition-colors p-4 flex flex-col">
      <div className="flex items-start justify-between mb-3 flex-1">
        <div className="flex items-start gap-3 flex-1">
          <div className={`p-2 rounded-lg ${
            category.color === 'blue' ? 'bg-blue-50' :
            category.color === 'green' ? 'bg-green-50' :
            category.color === 'purple' ? 'bg-purple-50' :
            'bg-gray-50'
          }`}>
            <Icon className={`w-4 h-4 ${
              category.color === 'blue' ? 'text-blue-600' :
              category.color === 'green' ? 'text-green-600' :
              category.color === 'purple' ? 'text-purple-600' :
              'text-gray-600'
            }`} />
          </div>
          <div className="flex-1">
            <h4 className="text-sm font-semibold text-gray-900">{report.name}</h4>
            <p className="text-xs text-gray-500 mt-0.5">{report.description}</p>
            <p className="text-xs text-gray-400 mt-1 font-medium">{dateRangeLabel}</p>
          </div>
        </div>
      </div>

      <button
        onClick={handleQuickGenerate}
        disabled={isGenerating}
        className="w-full flex items-center justify-center px-3 py-1.5 text-xs font-medium bg-white text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50 mt-auto cursor-pointer"
      >
        {isGenerating ? (
          <LoadingState size="sm" inline message="Generating..." />
        ) : (
          <>
            <Play className="w-3 h-3 mr-1.5" />
            Generate
          </>
        )}
      </button>
    </div>
  )
}

export const ReportsModule = () => {
  const { state } = useAuth()
  const { error } = useReportTemplates()

  const tenantId = state.status === 'authenticated' ? state.user.tenantId : null
  const hasDCTZAccess = tenantId ? DCTZ_ENABLED_TENANTS.includes(tenantId) : false


  if (error) {
    return (
      <div className="flex flex-col items-center justify-center h-64">
        <AlertCircle className="w-12 h-12 text-red-500 mb-4" />
        <p className="text-gray-600">Failed to load reports</p>
        <p className="text-sm text-gray-500 mt-2">{error.message}</p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold text-gray-900">Reports Center</h2>
            <p className="text-gray-600 text-sm mt-1">
              Generate professional PDF reports with detailed analytics
            </p>
          </div>
          <div className="flex items-center gap-3">
            <div className="text-right">
              <div className="text-xs text-gray-500">Available Reports</div>
              <div className="text-lg font-bold text-blue-600">
                {QUICK_REPORTS.length + (hasDCTZAccess ? 1 : 0)}
              </div>
            </div>
            <div className="text-right">
              <div className="text-xs text-gray-500">Format</div>
              <div className="text-lg font-bold text-gray-900">
                PDF
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="space-y-6">
        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-4">
          <DCTZReportCard hasDCTZAccess={hasDCTZAccess} />
          {QUICK_REPORTS.map(report => (
            <QuickReportCard key={report.id} report={report} />
          ))}
        </div>
      </div>
    </div>
  )
}
