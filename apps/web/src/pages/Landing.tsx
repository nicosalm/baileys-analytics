import { Link } from 'react-router-dom'
import { useAuth } from '@/contexts/auth'
import { Footer } from '@/components/Footer'
import {
  BarChart3, PieChart, LineChart,
  DollarSign, Users, Home,
  ArrowRight, CheckCircle, Sparkles,
  Zap, Compass
} from 'lucide-react'
import { useState } from 'react'
import { BRAND } from '@/constants'

export const Landing = () => {
  const { state } = useAuth()
  const isAuthenticated = state.status === 'authenticated'
  const [yearlyBilling, setYearlyBilling] = useState(true)

  return (
    <div className="min-h-screen flex flex-col">
      <nav className="absolute top-0 left-0 right-0 z-50 p-6">
        <div className="max-w-7xl mx-auto flex justify-between items-center">
          <div className="flex items-center">
            <div className={`w-10 h-10 ${BRAND.logoGradient} rounded-xl flex items-center justify-center shadow-sm`}>
              <Compass className="w-6 h-6 text-white" />
            </div>
            <h1 className="text-2xl font-semibold text-gray-900 ml-3">{BRAND.name}</h1>
          </div>
          <div className="flex items-center gap-3">
            {isAuthenticated ? (
              <Link to="/dashboard/overview" className={`px-5 py-2.5 ${BRAND.buttonGradient} text-white rounded-lg hover:shadow-lg transition-all hover:scale-[1.02] font-medium`}>
                Open Dashboard
              </Link>
            ) : (
              <>
                <Link to="/login" className="px-5 py-2.5 text-gray-700 hover:text-gray-900 font-medium transition-all hover:bg-gray-100/70 rounded-lg">
                  Login
                </Link>
                <Link to="/signup" className={`px-5 py-2.5 ${BRAND.buttonGradient} text-white rounded-lg hover:shadow-lg transition-all hover:scale-[1.02] font-medium`}>
                  Get Started
                </Link>
              </>
            )}
          </div>
        </div>
      </nav>

      <section className="relative min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 via-white to-blue-50">

        <div className="relative max-w-7xl mx-auto px-6 py-32 text-center">
          <div className="mb-8 inline-flex items-center px-4 py-2 bg-blue-100 text-blue-700 rounded-full text-sm font-medium">
            <Sparkles className="w-4 h-4 mr-2" />
            Connects to OwnerRez
          </div>

          <h1 className="text-6xl md:text-7xl font-bold mb-6 bg-gradient-to-r from-gray-900 via-blue-800 to-blue-600 bg-clip-text text-transparent">
            Analytics for OwnerRez
          </h1>

          <p className="text-xl text-gray-600 mb-8 max-w-2xl mx-auto">
            The analytics layer built for OwnerRez. See revenue, occupancy, and guest metrics across all your properties.
          </p>

          {!isAuthenticated && (
            <div className="flex flex-col sm:flex-row gap-4 justify-center items-center mb-4">
              <Link to="/signup" className={`group px-8 py-4 ${BRAND.buttonGradient} text-white rounded-full text-lg font-medium hover:shadow-xl transition-all transform hover:scale-105 flex items-center`}>
                Start Your $1 Trial
                <ArrowRight className="w-5 h-5 ml-2 group-hover:translate-x-1 transition-transform" />
              </Link>
              <span className="text-gray-500">30 days full access for $1</span>
            </div>
          )}

          <p className="text-sm text-gray-500 max-w-xl mx-auto">
            After trial: $20/month. Cancel in 1 click anytime, no questions asked.
          </p>

          <div className="mt-20">
            <p className="text-center text-sm text-gray-500 mb-6 uppercase tracking-wider">See Your Data In Minutes</p>
            <div className="max-w-5xl mx-auto">
              <div className="relative bg-white rounded-2xl shadow-2xl border border-gray-200 overflow-hidden">
                <video
                  autoPlay
                  loop
                  muted
                  playsInline
                  className="w-full h-full object-cover"
                >
                  <source src="/demo.mp4" type="video/mp4" />
                  {/* Fallback for browsers that don't support video */}
                  <div className="absolute inset-0 bg-gradient-to-br from-blue-50 via-white to-purple-50 flex items-center justify-center">
                    <div className="text-center">
                      <BarChart3 className="w-8 h-8 text-blue-600 opacity-60 mx-auto mb-3" />
                      <p className="text-sm font-medium text-gray-600">Your dashboard preview</p>
                    </div>
                  </div>
                </video>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="py-20 bg-white">
        <div className="max-w-6xl mx-auto px-6">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-bold mb-4">What You Can Actually Do With This</h2>
          </div>

          <div className="grid md:grid-cols-3 gap-8">
            <div className="bg-gray-50 rounded-xl p-6 border border-gray-200 shadow-sm">
              <div className="text-sm font-medium text-blue-600 mb-3">Calculate Taxes</div>
              <p className="text-gray-700 text-sm">
                Track Airbnb/VRBO fees automatically. See exactly how much each platform takes from each booking. Export clean reports for your accountant.
              </p>
            </div>

            <div className="bg-gray-50 rounded-xl p-6 border border-gray-200 shadow-sm">
              <div className="text-sm font-medium text-green-600 mb-3">Compare Properties</div>
              <p className="text-gray-700 text-sm">
                See which properties actually make money after expenses. Sort by occupancy, revenue, or profit. Find your winners and losers.
              </p>
            </div>

            <div className="bg-gray-50 rounded-xl p-6 border border-gray-200 shadow-sm">
              <div className="text-sm font-medium text-purple-600 mb-3">Track Patterns</div>
              <p className="text-gray-700 text-sm">
                See when you're booked and when you're empty. Compare this year to last year. Identify repeat guests and platform performance.
              </p>
            </div>
          </div>
        </div>
      </section>

      <section className="py-20 bg-gray-50">
        <div className="max-w-5xl mx-auto px-6">
          <div className="bg-gradient-to-r from-blue-50 to-purple-50 rounded-xl p-8 border border-blue-200">
            <h4 className="text-center font-semibold text-gray-900 mb-6">Get Started in 3 Steps (Under 5 Minutes)</h4>
            <div className="grid md:grid-cols-3 gap-6 text-center">
              <div>
                <div className="w-12 h-12 bg-blue-600 text-white rounded-full flex items-center justify-center mx-auto mb-3 font-bold">1</div>
                <p className="font-medium text-gray-900 mb-1">Connect OwnerRez</p>
                <p className="text-sm text-gray-600">OAuth takes 30 seconds</p>
              </div>
              <div>
                <div className="w-12 h-12 bg-blue-600 text-white rounded-full flex items-center justify-center mx-auto mb-3 font-bold">2</div>
                <p className="font-medium text-gray-900 mb-1">Data Syncs</p>
                <p className="text-sm text-gray-600">3 years of history in ~2 min</p>
              </div>
              <div>
                <div className="w-12 h-12 bg-blue-600 text-white rounded-full flex items-center justify-center mx-auto mb-3 font-bold">3</div>
                <p className="font-medium text-gray-900 mb-1">See Your Insights</p>
                <p className="text-sm text-gray-600">All dashboards instantly ready</p>
              </div>
            </div>
          </div>
        </div>
      </section>


      <section className="py-24 bg-white">
        <div className="max-w-7xl mx-auto px-6">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-bold mb-4">Six Dashboards</h2>
          </div>

          <div className="grid md:grid-cols-3 gap-8">

            <div className="bg-gray-50 rounded-2xl p-6 shadow-sm border border-gray-200 hover:shadow-md transition-shadow">
              <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl flex items-center justify-center mb-5">
                <BarChart3 className="w-7 h-7 text-white" />
              </div>
              <h3 className="text-lg font-semibold text-gray-900 mb-2">Revenue & P&L</h3>
              <p className="text-gray-600 text-sm">Compare this month to last month. See which properties make money after expenses. Export clean P&L for your accountant.</p>
            </div>

            <div className="bg-gray-50 rounded-2xl p-6 shadow-sm border border-gray-200 hover:shadow-md transition-shadow">
              <div className="w-12 h-12 bg-gradient-to-br from-green-500 to-green-600 rounded-xl flex items-center justify-center mb-5">
                <DollarSign className="w-7 h-7 text-white" />
              </div>
              <h3 className="text-lg font-semibold text-gray-900 mb-2">Platform Fees</h3>
              <p className="text-gray-600 text-sm">Track exactly how much Airbnb and VRBO take from each booking. See fees by property and export for taxes.</p>
            </div>

            <div className="bg-gray-50 rounded-2xl p-6 shadow-sm border border-gray-200 hover:shadow-md transition-shadow">
              <div className="w-12 h-12 bg-gradient-to-br from-purple-500 to-purple-600 rounded-xl flex items-center justify-center mb-5">
                <Users className="w-7 h-7 text-white" />
              </div>
              <h3 className="text-lg font-semibold text-gray-900 mb-2">Guest Analytics</h3>
              <p className="text-gray-600 text-sm">See who your repeat guests are. Track average spend per guest. Filter by tag or date range.</p>
            </div>

            <div className="bg-gray-50 rounded-2xl p-6 shadow-sm border border-gray-200 hover:shadow-md transition-shadow">
              <div className="w-12 h-12 bg-gradient-to-br from-orange-500 to-orange-600 rounded-xl flex items-center justify-center mb-5">
                <Home className="w-7 h-7 text-white" />
              </div>
              <h3 className="text-lg font-semibold text-gray-900 mb-2">Property Comparison</h3>
              <p className="text-gray-600 text-sm">Sort all properties by revenue, occupancy, or nightly rate. Scatter plot shows your winners and losers at a glance.</p>
            </div>

            <div className="bg-gray-50 rounded-2xl p-6 shadow-sm border border-gray-200 hover:shadow-md transition-shadow">
              <div className="w-12 h-12 bg-gradient-to-br from-teal-500 to-teal-600 rounded-xl flex items-center justify-center mb-5">
                <LineChart className="w-7 h-7 text-white" />
              </div>
              <h3 className="text-lg font-semibold text-gray-900 mb-2">Occupancy Calendar</h3>
              <p className="text-gray-600 text-sm">See booking gaps across properties. Compare this year to last year. Identify when you need to adjust pricing.</p>
            </div>

            <div className="bg-gray-50 rounded-2xl p-6 shadow-sm border border-gray-200 hover:shadow-md transition-shadow">
              <div className="w-12 h-12 bg-gradient-to-br from-pink-500 to-pink-600 rounded-xl flex items-center justify-center mb-5">
                <PieChart className="w-7 h-7 text-white" />
              </div>
              <h3 className="text-lg font-semibold text-gray-900 mb-2">Reports & Export</h3>
              <p className="text-gray-600 text-sm">Generate custom date range reports. Export to CSV for taxes. See summaries by property, guest, or platform.</p>
            </div>
          </div>
        </div>
      </section>

      <section className="py-24 px-6 bg-gray-50">
        <div className="max-w-6xl mx-auto text-center">
          <h2 className="text-4xl font-bold mb-4">Pricing</h2>
          <p className="text-xl text-gray-600 mb-4">One plan. $1 trial, then $20/month or $192/year.</p>


          <div className="flex justify-center items-center gap-4 mb-12">
            <span className={`font-medium ${!yearlyBilling ? 'text-gray-900' : 'text-gray-500'}`}>Monthly</span>
            <button
              onClick={() => setYearlyBilling(!yearlyBilling)}
              aria-label="Toggle between monthly and yearly billing"
              className="relative inline-flex h-6 w-11 items-center rounded-full bg-gray-200 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
            >
              <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${yearlyBilling ? 'translate-x-6' : 'translate-x-1'}`} />
            </button>
            <span className={`font-medium ${yearlyBilling ? 'text-gray-900' : 'text-gray-500'}`}>
              Yearly
              <span className="ml-1.5 inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                Save 20%
              </span>
            </span>
          </div>

          <div className="max-w-lg mx-auto">
            <div className="relative">
              <div className="absolute -inset-1 bg-gradient-to-r from-blue-400 to-purple-400 rounded-2xl blur opacity-25" />
              <div className="relative bg-white rounded-2xl shadow-xl p-10 border-2 border-blue-500">
                <div className="absolute -top-3 left-1/2 transform -translate-x-1/2">
                  <div className="inline-flex items-center px-3 py-1 bg-blue-100 text-blue-700 rounded-full text-xs font-medium">
                    <Zap className="w-3 h-3 mr-1" />
                    SINGLE PLAN
                  </div>
                </div>
                <div className="text-center mb-6">
                  <h3 className="text-2xl font-semibold mb-4">Baileys Analytics</h3>
                  <div className="text-5xl font-bold mb-2">
                    ${yearlyBilling ? '16' : '20'}<span className="text-2xl text-gray-500 font-normal">/mo</span>
                  </div>
                  <p className="text-gray-600 mb-2">Complete vacation rental analytics</p>
                  {yearlyBilling && <p className="text-sm text-green-600 font-medium">$192/year (save $48)</p>}
                  {!yearlyBilling && <p className="text-sm text-gray-400">Billed monthly</p>}
                </div>
                <div className="space-y-3 mb-8 text-left">
                  <div className="flex items-start">
                    <CheckCircle className="w-4 h-4 text-green-500 mr-2 mt-0.5 flex-shrink-0" />
                    <span className="text-sm">6 specialized dashboards</span>
                  </div>
                  <div className="flex items-start">
                    <CheckCircle className="w-4 h-4 text-green-500 mr-2 mt-0.5 flex-shrink-0" />
                    <span className="text-sm">3 years of booking history</span>
                  </div>
                  <div className="flex items-start">
                    <CheckCircle className="w-4 h-4 text-green-500 mr-2 mt-0.5 flex-shrink-0" />
                    <span className="text-sm">Platform fee tracking for taxes</span>
                  </div>
                  <div className="flex items-start">
                    <CheckCircle className="w-4 h-4 text-green-500 mr-2 mt-0.5 flex-shrink-0" />
                    <span className="text-sm">Cross-property performance comparison</span>
                  </div>
                  <div className="flex items-start">
                    <CheckCircle className="w-4 h-4 text-green-500 mr-2 mt-0.5 flex-shrink-0" />
                    <span className="text-sm">Automatic OwnerRez sync</span>
                  </div>
                </div>
                <Link to="/signup" className={`block w-full py-4 text-lg ${BRAND.buttonGradient} text-white rounded-full hover:shadow-xl transition-all transform hover:scale-105 font-semibold text-center`}>
                  Start $1 Trial
                </Link>
              </div>
            </div>
          </div>

          <div className="text-center mt-8 space-y-2">
            <p className="text-sm text-gray-500">{yearlyBilling ? 'Billed annually' : 'Save 20% with annual billing'}</p>
            <p className="text-sm text-gray-500">$1 for your first 30 days, then {yearlyBilling ? '$192/year' : '$20/month'}. Cancel anytime.</p>
          </div>
        </div>
      </section>

      <Footer />

    </div>
  )
}
