import { useState } from 'react'
import {
  Calendar, Clock, FileText,
  Play, TrendingUp, Users,
  AlertCircle, Home, DollarSign,
  BarChart3, Zap, Building2, PieChart, Lock,
  Sparkles
} from 'lucide-react'
import { useToast } from '@/contexts/toast'
import { useReportTemplates } from '@/hooks/use-api'
import { LoadingState } from '@/components/LoadingState'

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
    description: 'Today\'s arrivals, departures & action items',
    icon: Zap,
    category: 'operational',
    config: {
      modules: ['arrivals', 'departures', 'turnovers', 'alerts'],
      dateRange: 'today',
      format: 'pdf'
    }
  },
  {
    id: 'property-performance',
    name: 'Property Performance',
    description: 'Detailed metrics by property with comparisons',
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
    description: 'P&L with visual breakdowns and trends',
    icon: TrendingUp,
    category: 'financial',
    config: {
      modules: ['pl', 'revenue', 'expenses', 'trends'],
      dateRange: 'lastMonth',
      format: 'pdf'
    }
  },
  {
    id: 'booking-details',
    name: 'Booking Details',
    description: 'Complete booking list with guest information',
    icon: Calendar,
    category: 'operational',
    config: {
      modules: ['bookings', 'guests', 'payments'],
      dateRange: 'last30days',
      format: 'pdf'
    }
  },
  {
    id: 'tax-report',
    name: 'Tax Report',
    description: 'Tax collected by jurisdiction with details',
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
      modules: ['channels', 'conversion', 'revenue_by_channel'],
      dateRange: 'last90days',
      format: 'pdf'
    }
  },
  {
    id: 'occupancy-trends',
    name: 'Occupancy Trends',
    description: 'Historical occupancy patterns',
    icon: BarChart3,
    category: 'analytics',
    config: {
      modules: ['occupancy', 'trends'],
      dateRange: 'lastYear',
      format: 'pdf'
    }
  },
  {
    id: 'guest-analytics',
    name: 'Guest Analytics',
    description: 'Guest demographics and repeat visitors',
    icon: Users,
    category: 'analytics',
    config: {
      modules: ['guests', 'repeat_rate'],
      dateRange: 'last90days',
      format: 'pdf'
    }
  }
]

const QuickReportCard = ({ report }: { report: typeof QUICK_REPORTS[0] }) => {
  const { addToast } = useToast()
  const [isGenerating, setIsGenerating] = useState(false)

  const category = REPORT_CATEGORIES[report.category as keyof typeof REPORT_CATEGORIES]
  const Icon = report.icon

  const handleQuickGenerate = async () => {
    setIsGenerating(true)
    try {
      const tokenData = localStorage.getItem('baileys_tokens')
      if (!tokenData) {
        throw new Error('Not authenticated')
      }
      const { access: token } = JSON.parse(tokenData)

      const response = await fetch('/api/reports/quick-generate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
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
    <div className="bg-white rounded-lg border border-gray-200 hover:border-blue-300 hover:shadow-md transition-all p-5">
      <div className="flex items-start justify-between mb-4">
        <div className="flex items-start gap-3 flex-1">
          <div className={`p-2.5 rounded-lg ${
            category.color === 'blue' ? 'bg-blue-50' :
            category.color === 'green' ? 'bg-green-50' :
            category.color === 'purple' ? 'bg-purple-50' :
            'bg-gray-50'
          }`}>
            <Icon className={`w-5 h-5 ${
              category.color === 'blue' ? 'text-blue-600' :
              category.color === 'green' ? 'text-green-600' :
              category.color === 'purple' ? 'text-purple-600' :
              'text-gray-600'
            }`} />
          </div>
          <div className="flex-1">
            <h4 className="font-medium text-gray-900 mb-1">{report.name}</h4>
            <p className="text-sm text-gray-600">{report.description}</p>
          </div>
        </div>
      </div>

      <button
        onClick={handleQuickGenerate}
        disabled={isGenerating}
        className="w-full flex items-center justify-center px-4 py-2 text-sm bg-gradient-to-r from-blue-600 to-blue-700 text-white rounded-lg hover:from-blue-700 hover:to-blue-800 transition-all disabled:opacity-50"
      >
        {isGenerating ? (
          <LoadingState size="sm" inline message="Generating..." />
        ) : (
          <>
            <Play className="w-4 h-4 mr-2" />
            Generate Report
          </>
        )}
      </button>
    </div>
  )
}

const ComingSoonOverlay = ({ feature }: { feature: string }) => (
  <div className="relative rounded-lg overflow-hidden">
    <div className="absolute inset-0 bg-gradient-to-br from-gray-900/90 to-gray-800/90 backdrop-blur-sm z-10 flex flex-col items-center justify-center">
      <div className="bg-white/10 backdrop-blur-md rounded-2xl p-8 text-center max-w-sm mx-4">
        <div className="inline-flex p-3 bg-gradient-to-br from-blue-500/20 to-purple-500/20 rounded-full mb-4">
          <Lock className="w-8 h-8 text-white" />
        </div>
        <h3 className="text-2xl font-bold text-white mb-2">Coming Soon</h3>
        <p className="text-gray-200 mb-4">{feature} will be available in a future update</p>
        <div className="flex items-center justify-center gap-2 text-sm text-gray-300">
          <Sparkles className="w-4 h-4" />
          <span>Stay tuned for updates</span>
        </div>
      </div>
    </div>
  </div>
)

export const ReportsModule = () => {
  const { error } = useReportTemplates()
  const [activeTab, setActiveTab] = useState<'quick' | 'templates' | 'scheduled'>('quick')


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
                {QUICK_REPORTS.length}
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

      <div className="border-b">
        <nav className="flex space-x-6">
          <button
            onClick={() => setActiveTab('quick')}
            className={`pb-3 border-b-2 transition-colors flex items-center ${
              activeTab === 'quick'
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-gray-600 hover:text-gray-900'
            }`}
          >
            <Zap className="w-4 h-4 mr-2" />
            Quick Reports
            <span className="ml-2 px-2 py-0.5 text-xs bg-blue-100 text-blue-700 rounded-full">
              {QUICK_REPORTS.length}
            </span>
          </button>
          <button
            disabled
            className="pb-3 border-b-2 border-transparent text-gray-400 cursor-not-allowed flex items-center"
          >
            <FileText className="w-4 h-4 mr-2 opacity-50" />
            <span className="opacity-50">Custom Templates</span>
            <span className="ml-2 px-2 py-0.5 text-xs bg-gray-100 text-gray-400 rounded-full">
              Soon
            </span>
          </button>
          <button
            disabled
            className="pb-3 border-b-2 border-transparent text-gray-400 cursor-not-allowed flex items-center"
          >
            <Clock className="w-4 h-4 mr-2 opacity-50" />
            <span className="opacity-50">Scheduled</span>
            <span className="ml-2 px-2 py-0.5 text-xs bg-gray-100 text-gray-400 rounded-full">
              Soon
            </span>
          </button>
        </nav>
      </div>

      {activeTab === 'quick' && (
        <div className="space-y-6">
          <div className="grid md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {QUICK_REPORTS.map(report => (
              <QuickReportCard key={report.id} report={report} />
            ))}
          </div>
        </div>
      )}

      {activeTab === 'templates' && (
        <ComingSoonOverlay feature="Custom report templates" />
      )}

      {activeTab === 'scheduled' && (
        <ComingSoonOverlay feature="Scheduled report automation" />
      )}
    </div>
  )
}
