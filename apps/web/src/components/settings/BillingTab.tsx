import { 
  CreditCard, Package, CheckCircle, TrendingUp,
  Calendar, Receipt, Download
} from 'lucide-react'

export const BillingTab = () => {
  return (
    <div className="space-y-6">
      {/* current plan */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <div className="flex items-start justify-between mb-6">
          <div>
            <h2 className="text-xl font-semibold text-gray-900 mb-2">Current Plan</h2>
            <div className="flex items-center gap-3">
              <span className="px-3 py-1 bg-blue-100 text-blue-700 rounded-full text-sm font-medium">
                Free Beta
              </span>
              <span className="text-gray-500 text-sm">
                Enjoy full access during our beta period
              </span>
            </div>
          </div>
          <div className="text-right">
            <p className="text-3xl font-bold text-gray-900">$0</p>
            <p className="text-gray-500 text-sm">per month</p>
          </div>
        </div>
        
        <div className="border-t border-gray-200 pt-6">
          <h3 className="text-sm font-semibold text-gray-900 mb-4">Beta Features Included</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div className="flex items-start gap-2">
              <CheckCircle className="w-5 h-5 text-green-600 mt-0.5" />
              <div>
                <p className="text-sm font-medium text-gray-900">Unlimited Properties</p>
                <p className="text-xs text-gray-500">Sync all your rental properties</p>
              </div>
            </div>
            <div className="flex items-start gap-2">
              <CheckCircle className="w-5 h-5 text-green-600 mt-0.5" />
              <div>
                <p className="text-sm font-medium text-gray-900">Historical Data</p>
                <p className="text-xs text-gray-500">Access up to 2 years of history</p>
              </div>
            </div>
            <div className="flex items-start gap-2">
              <CheckCircle className="w-5 h-5 text-green-600 mt-0.5" />
              <div>
                <p className="text-sm font-medium text-gray-900">All Dashboards</p>
                <p className="text-xs text-gray-500">Full access to analytics</p>
              </div>
            </div>
            <div className="flex items-start gap-2">
              <CheckCircle className="w-5 h-5 text-green-600 mt-0.5" />
              <div>
                <p className="text-sm font-medium text-gray-900">PDF Reports</p>
                <p className="text-xs text-gray-500">Generate professional reports</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* upcoming plans */}
      <div className="bg-gradient-to-r from-blue-50 to-purple-50 rounded-lg border border-blue-200 p-6">
        <div className="flex items-start gap-4">
          <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center flex-shrink-0">
            <TrendingUp className="w-5 h-5 text-blue-600" />
          </div>
          <div>
            <h3 className="text-lg font-semibold text-gray-900 mb-2">Pricing Coming Soon</h3>
            <p className="text-gray-700 text-sm mb-3">
              We're currently in beta and offering free access to all features. 
              Paid plans will be introduced after the beta period ends.
            </p>
            <p className="text-gray-600 text-sm">
              As an early adopter, you'll receive special pricing when we launch our paid plans.
            </p>
          </div>
        </div>
      </div>

      {/* payment method placeholder */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
            <CreditCard className="w-5 h-5" />
            Payment Method
          </h3>
          <div className="bg-gray-50 rounded-lg p-4 text-center">
            <p className="text-gray-500 text-sm">
              No payment method required during beta
            </p>
          </div>
        </div>
        
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
            <Receipt className="w-5 h-5" />
            Billing History
          </h3>
          <div className="bg-gray-50 rounded-lg p-4 text-center">
            <p className="text-gray-500 text-sm">
              No billing history available
            </p>
          </div>
        </div>
      </div>

      {/* usage stats */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Usage This Month</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-gray-50 rounded-lg p-4">
            <div className="flex items-center gap-2 text-gray-600 mb-2">
              <Package className="w-4 h-4" />
              <span className="text-sm font-medium">API Calls</span>
            </div>
            <p className="text-2xl font-bold text-gray-900">--</p>
            <p className="text-xs text-gray-500 mt-1">Unlimited during beta</p>
          </div>
          
          <div className="bg-gray-50 rounded-lg p-4">
            <div className="flex items-center gap-2 text-gray-600 mb-2">
              <Download className="w-4 h-4" />
              <span className="text-sm font-medium">Reports Generated</span>
            </div>
            <p className="text-2xl font-bold text-gray-900">--</p>
            <p className="text-xs text-gray-500 mt-1">Unlimited during beta</p>
          </div>
          
          <div className="bg-gray-50 rounded-lg p-4">
            <div className="flex items-center gap-2 text-gray-600 mb-2">
              <Calendar className="w-4 h-4" />
              <span className="text-sm font-medium">Days Active</span>
            </div>
            <p className="text-2xl font-bold text-gray-900">--</p>
            <p className="text-xs text-gray-500 mt-1">This billing period</p>
          </div>
        </div>
      </div>

      {/* faq section */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Frequently Asked Questions</h3>
        <div className="space-y-4">
          <div>
            <p className="text-sm font-medium text-gray-900 mb-1">When will pricing be introduced?</p>
            <p className="text-sm text-gray-600">
              We plan to introduce pricing after the beta period. All beta users will receive advance notice and special discounts.
            </p>
          </div>
          <div>
            <p className="text-sm font-medium text-gray-900 mb-1">Will I lose access to any features?</p>
            <p className="text-sm text-gray-600">
              During beta, you have access to all features. Future plans will have different feature tiers.
            </p>
          </div>
          <div>
            <p className="text-sm font-medium text-gray-900 mb-1">Can I export my data?</p>
            <p className="text-sm text-gray-600">
              Yes, you can always export your data through our reporting features.
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}