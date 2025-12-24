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
  const { state, logout } = useAuth()
  const isAuthenticated = state.status === 'authenticated'
  const [yearlyBilling, setYearlyBilling] = useState(true)

  return (
    <div className="min-h-screen flex flex-col">
      <nav className="absolute top-0 left-0 right-0 z-50 p-4 md:p-6">
        <div className="max-w-7xl mx-auto flex justify-between items-center">
          <div className="flex items-center">
            <div className={`w-8 h-8 md:w-10 md:h-10 ${BRAND.logoGradient} rounded-xl flex items-center justify-center shadow-sm`}>
              <Compass className="w-5 h-5 md:w-6 md:h-6 text-white" />
            </div>
            <h1 className="text-lg md:text-2xl font-semibold text-gray-900 ml-2 md:ml-3">{BRAND.name}</h1>
          </div>
          <div className="flex items-center gap-2 md:gap-3">
            {isAuthenticated ? (
              <>
                <button
                  onClick={() => logout()}
                  className="hidden sm:block px-4 md:px-5 py-2 md:py-2.5 text-gray-700 hover:text-gray-900 font-medium transition-all hover:bg-gray-100/70 rounded-lg text-sm md:text-base"
                >
                  Logout
                </button>
                <Link to="/dashboard/overview" className={`px-4 md:px-5 py-2 md:py-2.5 ${BRAND.buttonGradient} text-white rounded-lg hover:shadow-lg transition-all hover:scale-[1.02] font-medium text-sm md:text-base`}>
                  Dashboard
                </Link>
              </>
            ) : (
              <>
                <Link to="/login" className="hidden sm:block px-4 md:px-5 py-2 md:py-2.5 text-gray-700 hover:text-gray-900 font-medium transition-all hover:bg-gray-100/70 rounded-lg text-sm md:text-base">
                  Login
                </Link>
                <Link to="/signup" className={`px-4 md:px-5 py-2 md:py-2.5 ${BRAND.buttonGradient} text-white rounded-lg hover:shadow-lg transition-all hover:scale-[1.02] font-medium text-sm md:text-base`}>
                  Get Started
                </Link>
              </>
            )}
          </div>
        </div>
      </nav>

      <section className="relative min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 via-white to-blue-50">

        <div className="relative max-w-7xl mx-auto px-4 md:px-6 py-24 md:py-32 text-center">
          <div className="mb-6 md:mb-8 inline-flex items-center px-3 md:px-4 py-1.5 md:py-2 bg-blue-100 text-blue-700 rounded-full text-xs md:text-sm font-medium">
            <Sparkles className="w-3 h-3 md:w-4 md:h-4 mr-1.5 md:mr-2" />
            Connects to OwnerRez
          </div>

          <h1 className="text-3xl sm:text-4xl md:text-6xl lg:text-7xl font-bold mb-4 md:mb-6 bg-gradient-to-r from-gray-900 via-blue-800 to-blue-600 bg-clip-text text-transparent">
            Analytics for OwnerRez
          </h1>

          <p className="text-base md:text-xl text-gray-600 mb-6 md:mb-8 max-w-2xl mx-auto px-2">
            The analytics layer built for OwnerRez. See revenue, occupancy, and guest metrics across all your properties.
          </p>

          {!isAuthenticated && (
            <div className="flex flex-col sm:flex-row gap-3 md:gap-4 justify-center items-center mb-4">
              <Link to="/signup" className={`group px-6 md:px-8 py-3 md:py-4 ${BRAND.buttonGradient} text-white rounded-lg text-base md:text-lg font-medium hover:shadow-lg transition-all flex items-center`}>
                Start Your $1 Trial
                <ArrowRight className="w-4 h-4 md:w-5 md:h-5 ml-2 group-hover:translate-x-1 transition-transform" />
              </Link>
              <span className="text-sm md:text-base text-gray-500">30 days full access for $1</span>
            </div>
          )}

          <p className="text-xs md:text-sm text-gray-500 max-w-xl mx-auto px-2">
            After trial: $20/month. Cancel in 1 click anytime, no questions asked.
          </p>

          <div className="mt-12 md:mt-20">
            <p className="text-center text-xs md:text-sm text-gray-500 mb-4 md:mb-6 uppercase tracking-wider">See Your Data In Minutes</p>
            <div className="max-w-5xl mx-auto px-2">
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
                  <div className="absolute inset-0 bg-gradient-to-br from-blue-50 via-white to-blue-50 flex items-center justify-center">
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

      <section className="py-12 md:py-20 bg-white">
        <div className="max-w-6xl mx-auto px-4 md:px-6">
          <div className="text-center mb-10 md:mb-16">
            <h2 className="text-2xl md:text-4xl font-bold mb-4">Built for Real Work</h2>
          </div>

          <div className="grid sm:grid-cols-2 md:grid-cols-3 gap-4 md:gap-8">
            <div className="bg-gray-50 rounded-xl p-4 md:p-6 border border-gray-200 shadow-sm">
              <div className="text-sm font-medium text-blue-600 mb-2 md:mb-3">Track Platform Fees</div>
              <p className="text-gray-700 text-xs md:text-sm">
                Log platform fees by property and month. See tax obligations from your bookings. Export clean reports for your accountant.
              </p>
            </div>

            <div className="bg-gray-50 rounded-xl p-4 md:p-6 border border-gray-200 shadow-sm">
              <div className="text-sm font-medium text-green-600 mb-2 md:mb-3">Compare Properties</div>
              <p className="text-gray-700 text-xs md:text-sm">
                See which properties actually make money after expenses. Sort by occupancy, revenue, or profit. Find your winners and losers.
              </p>
            </div>

            <div className="bg-gray-50 rounded-xl p-4 md:p-6 border border-gray-200 shadow-sm sm:col-span-2 md:col-span-1">
              <div className="text-sm font-medium text-purple-600 mb-2 md:mb-3">Track Patterns</div>
              <p className="text-gray-700 text-xs md:text-sm">
                See when you're booked and when you're empty. Compare this year to last year. Identify repeat guests and platform performance.
              </p>
            </div>
          </div>
        </div>
      </section>

      <section className="py-12 md:py-20 bg-gray-50">
        <div className="max-w-5xl mx-auto px-4 md:px-6">
          <div className="bg-gradient-to-r from-blue-50 to-blue-100 rounded-xl p-5 md:p-8 border border-blue-200">
            <h4 className="text-center font-semibold text-gray-900 mb-4 md:mb-6 text-sm md:text-base">Get Started in 3 Steps (Under 5 Minutes)</h4>
            <div className="grid grid-cols-3 gap-3 md:gap-6 text-center">
              <div>
                <div className="w-10 h-10 md:w-12 md:h-12 bg-blue-600 text-white rounded-full flex items-center justify-center mx-auto mb-2 md:mb-3 font-bold text-sm md:text-base">1</div>
                <p className="font-medium text-gray-900 mb-0.5 md:mb-1 text-xs md:text-base">Connect OwnerRez</p>
                <p className="text-xs md:text-sm text-gray-600">OAuth takes 30 seconds</p>
              </div>
              <div>
                <div className="w-10 h-10 md:w-12 md:h-12 bg-blue-600 text-white rounded-full flex items-center justify-center mx-auto mb-2 md:mb-3 font-bold text-sm md:text-base">2</div>
                <p className="font-medium text-gray-900 mb-0.5 md:mb-1 text-xs md:text-base">Data Syncs</p>
                <p className="text-xs md:text-sm text-gray-600">3 years in ~2 min</p>
              </div>
              <div>
                <div className="w-10 h-10 md:w-12 md:h-12 bg-blue-600 text-white rounded-full flex items-center justify-center mx-auto mb-2 md:mb-3 font-bold text-sm md:text-base">3</div>
                <p className="font-medium text-gray-900 mb-0.5 md:mb-1 text-xs md:text-base">See Insights</p>
                <p className="text-xs md:text-sm text-gray-600">Dashboards ready</p>
              </div>
            </div>
          </div>
        </div>
      </section>


      <section className="py-16 md:py-24 bg-white">
        <div className="max-w-7xl mx-auto px-4 md:px-6">
          <div className="text-center mb-10 md:mb-16">
            <h2 className="text-2xl md:text-4xl font-bold mb-4">Six Dashboards</h2>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-3 gap-3 md:gap-8">

            <div className="bg-gray-50 rounded-xl md:rounded-2xl p-4 md:p-6 shadow-sm border border-gray-200 hover:shadow-md transition-shadow">
              <div className="w-10 h-10 md:w-12 md:h-12 bg-gradient-to-br from-blue-500 to-blue-600 rounded-lg md:rounded-xl flex items-center justify-center mb-3 md:mb-5">
                <BarChart3 className="w-5 h-5 md:w-7 md:h-7 text-white" />
              </div>
              <h3 className="text-sm md:text-lg font-semibold text-gray-900 mb-1 md:mb-2">Revenue & P&L</h3>
              <p className="text-gray-600 text-xs md:text-sm hidden md:block">Compare this month to last month. See which properties make money after expenses.</p>
            </div>

            <div className="bg-gray-50 rounded-xl md:rounded-2xl p-4 md:p-6 shadow-sm border border-gray-200 hover:shadow-md transition-shadow">
              <div className="w-10 h-10 md:w-12 md:h-12 bg-gradient-to-br from-green-500 to-green-600 rounded-lg md:rounded-xl flex items-center justify-center mb-3 md:mb-5">
                <DollarSign className="w-5 h-5 md:w-7 md:h-7 text-white" />
              </div>
              <h3 className="text-sm md:text-lg font-semibold text-gray-900 mb-1 md:mb-2">Platform Fees</h3>
              <p className="text-gray-600 text-xs md:text-sm hidden md:block">Track service fees and see which platforms remit taxes on your behalf.</p>
            </div>

            <div className="bg-gray-50 rounded-xl md:rounded-2xl p-4 md:p-6 shadow-sm border border-gray-200 hover:shadow-md transition-shadow">
              <div className="w-10 h-10 md:w-12 md:h-12 bg-gradient-to-br from-purple-500 to-purple-600 rounded-lg md:rounded-xl flex items-center justify-center mb-3 md:mb-5">
                <Users className="w-5 h-5 md:w-7 md:h-7 text-white" />
              </div>
              <h3 className="text-sm md:text-lg font-semibold text-gray-900 mb-1 md:mb-2">Guest Analytics</h3>
              <p className="text-gray-600 text-xs md:text-sm hidden md:block">See who your repeat guests are. Track average spend per guest.</p>
            </div>

            <div className="bg-gray-50 rounded-xl md:rounded-2xl p-4 md:p-6 shadow-sm border border-gray-200 hover:shadow-md transition-shadow">
              <div className="w-10 h-10 md:w-12 md:h-12 bg-gradient-to-br from-orange-500 to-orange-600 rounded-lg md:rounded-xl flex items-center justify-center mb-3 md:mb-5">
                <Home className="w-5 h-5 md:w-7 md:h-7 text-white" />
              </div>
              <h3 className="text-sm md:text-lg font-semibold text-gray-900 mb-1 md:mb-2">Property Compare</h3>
              <p className="text-gray-600 text-xs md:text-sm hidden md:block">Sort properties by revenue, occupancy, or nightly rate.</p>
            </div>

            <div className="bg-gray-50 rounded-xl md:rounded-2xl p-4 md:p-6 shadow-sm border border-gray-200 hover:shadow-md transition-shadow">
              <div className="w-10 h-10 md:w-12 md:h-12 bg-gradient-to-br from-teal-500 to-teal-600 rounded-lg md:rounded-xl flex items-center justify-center mb-3 md:mb-5">
                <LineChart className="w-5 h-5 md:w-7 md:h-7 text-white" />
              </div>
              <h3 className="text-sm md:text-lg font-semibold text-gray-900 mb-1 md:mb-2">Occupancy</h3>
              <p className="text-gray-600 text-xs md:text-sm hidden md:block">See booking gaps. Compare this year to last year.</p>
            </div>

            <div className="bg-gray-50 rounded-xl md:rounded-2xl p-4 md:p-6 shadow-sm border border-gray-200 hover:shadow-md transition-shadow">
              <div className="w-10 h-10 md:w-12 md:h-12 bg-gradient-to-br from-pink-500 to-pink-600 rounded-lg md:rounded-xl flex items-center justify-center mb-3 md:mb-5">
                <PieChart className="w-5 h-5 md:w-7 md:h-7 text-white" />
              </div>
              <h3 className="text-sm md:text-lg font-semibold text-gray-900 mb-1 md:mb-2">Reports</h3>
              <p className="text-gray-600 text-xs md:text-sm hidden md:block">Generate 6 PDF reports. Export data for taxes.</p>
            </div>
          </div>
        </div>
      </section>

      <section className="py-16 md:py-24 px-4 md:px-6 bg-gray-50">
        <div className="max-w-6xl mx-auto text-center">
          <h2 className="text-2xl md:text-4xl font-bold mb-3 md:mb-4">Pricing</h2>
          <p className="text-base md:text-xl text-gray-600 mb-4">One plan. $1 trial, then $20/month or $192/year.</p>

          <div className="flex justify-center items-center gap-3 md:gap-4 mb-8 md:mb-12">
            <span className={`text-sm md:text-base font-medium ${!yearlyBilling ? 'text-gray-900' : 'text-gray-500'}`}>Monthly</span>
            <button
              onClick={() => setYearlyBilling(!yearlyBilling)}
              aria-label="Toggle between monthly and yearly billing"
              className="relative inline-flex h-6 w-11 items-center rounded-full bg-gray-200 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
            >
              <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${yearlyBilling ? 'translate-x-6' : 'translate-x-1'}`} />
            </button>
            <span className={`text-sm md:text-base font-medium ${yearlyBilling ? 'text-gray-900' : 'text-gray-500'}`}>
              Yearly
              <span className="ml-1 md:ml-1.5 inline-flex items-center px-1.5 md:px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                Save 20%
              </span>
            </span>
          </div>

          <div className="max-w-lg mx-auto">
            <div className="relative">
              <div className="absolute -inset-1 bg-gradient-to-r from-blue-400 to-blue-500 rounded-2xl blur opacity-25" />
              <div className="relative bg-white rounded-2xl shadow-xl p-6 md:p-10 border-2 border-blue-500">
                <div className="absolute -top-3 left-1/2 transform -translate-x-1/2">
                  <div className="inline-flex items-center px-2 md:px-3 py-1 bg-blue-100 text-blue-700 rounded-full text-xs font-medium">
                    <Zap className="w-3 h-3 mr-1" />
                    SINGLE PLAN
                  </div>
                </div>
                <div className="text-center mb-4 md:mb-6">
                  <h3 className="text-xl md:text-2xl font-semibold mb-3 md:mb-4">Baileys Analytics</h3>
                  <div className="text-3xl md:text-5xl font-bold mb-2">
                    ${yearlyBilling ? '16' : '20'}<span className="text-lg md:text-2xl text-gray-500 font-normal">/mo</span>
                  </div>
                  <p className="text-sm md:text-base text-gray-600 mb-2">Complete vacation rental analytics</p>
                  {yearlyBilling && <p className="text-xs md:text-sm text-green-600 font-medium">$192/year (save $48)</p>}
                  {!yearlyBilling && <p className="text-xs md:text-sm text-gray-400">Billed monthly</p>}
                </div>
                <div className="space-y-2 md:space-y-3 mb-6 md:mb-8 text-left">
                  <div className="flex items-start">
                    <CheckCircle className="w-4 h-4 text-green-500 mr-2 mt-0.5 flex-shrink-0" />
                    <span className="text-xs md:text-sm">6 specialized dashboards</span>
                  </div>
                  <div className="flex items-start">
                    <CheckCircle className="w-4 h-4 text-green-500 mr-2 mt-0.5 flex-shrink-0" />
                    <span className="text-xs md:text-sm">3 years of booking history</span>
                  </div>
                  <div className="flex items-start">
                    <CheckCircle className="w-4 h-4 text-green-500 mr-2 mt-0.5 flex-shrink-0" />
                    <span className="text-xs md:text-sm">Platform fee tracking for taxes</span>
                  </div>
                  <div className="flex items-start">
                    <CheckCircle className="w-4 h-4 text-green-500 mr-2 mt-0.5 flex-shrink-0" />
                    <span className="text-xs md:text-sm">Cross-property comparison</span>
                  </div>
                  <div className="flex items-start">
                    <CheckCircle className="w-4 h-4 text-green-500 mr-2 mt-0.5 flex-shrink-0" />
                    <span className="text-xs md:text-sm">Automatic OwnerRez sync</span>
                  </div>
                </div>
                <Link to="/signup" className={`block w-full py-3 md:py-4 text-base md:text-lg ${BRAND.buttonGradient} text-white rounded-lg hover:shadow-lg transition-all font-semibold text-center`}>
                  Start $1 Trial
                </Link>
              </div>
            </div>
          </div>

          <div className="text-center mt-6 md:mt-8 space-y-1 md:space-y-2">
            <p className="text-xs md:text-sm text-gray-500">{yearlyBilling ? 'Billed annually' : 'Save 20% with annual billing'}</p>
            <p className="text-xs md:text-sm text-gray-500">$1 for your first 30 days, then {yearlyBilling ? '$192/year' : '$20/month'}. Cancel anytime.</p>
          </div>
        </div>
      </section>

      <Footer />

    </div>
  )
}
