import { Link } from 'react-router-dom'
import { useAuth } from '@/contexts/auth'
import { Footer } from '@/components/Footer'
import {
  TrendingUp, BarChart3, PieChart, LineChart,
  DollarSign, Users, Home,
  ArrowRight, CheckCircle, Sparkles,
  Zap, Compass
} from 'lucide-react'
import { useState, useEffect } from 'react'
import { BRAND } from '@/constants'

const AnimatedCounter = ({ end, duration = 2000, prefix = '', suffix = '', decimals = 0 }: {
  end: number;
  duration?: number;
  prefix?: string;
  suffix?: string;
  decimals?: number;
}) => {
  const [count, setCount] = useState(0)

  useEffect(() => {
    let startTime: number
    let animationFrame: number

    const animate = (timestamp: number) => {
      if (!startTime) startTime = timestamp
      const progress = Math.min((timestamp - startTime) / duration, 1)

      setCount(progress * end)

      if (progress < 1) {
        animationFrame = requestAnimationFrame(animate)
      }
    }

    animationFrame = requestAnimationFrame(animate)
    return () => cancelAnimationFrame(animationFrame)
  }, [end, duration])

  return <span>{prefix}{count.toFixed(decimals)}{suffix}</span>
}

export const Landing = () => {
  const { state } = useAuth()
  const isAuthenticated = state.status === 'authenticated'
  const [yearlyBilling, setYearlyBilling] = useState(true)

  return (
    <div className="min-h-screen flex flex-col bg-gradient-to-b from-slate-50 via-white to-slate-50">
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
            Seamlessly connects with OwnerRez
          </div>

          <h1 className="text-6xl md:text-7xl font-bold mb-6 bg-gradient-to-r from-gray-900 via-blue-800 to-blue-600 bg-clip-text text-transparent">
            Pull Back the Curtain
            <br />
            <span className="text-5xl md:text-6xl">on Your Rental Revenue</span>
          </h1>

          <p className="text-xl text-gray-600 mb-12 max-w-2xl mx-auto">
            Stop exporting CSVs. Start making decisions. A functional analytics tool built specifically for OwnerRez users.
          </p>

          {!isAuthenticated && (
            <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
              <Link to="/signup" className={`group px-8 py-4 ${BRAND.buttonGradient} text-white rounded-full text-lg font-medium hover:shadow-xl transition-all transform hover:scale-105 flex items-center`}>
                Start Your $1 Trial
                <ArrowRight className="w-5 h-5 ml-2 group-hover:translate-x-1 transition-transform" />
              </Link>
              <span className="text-gray-500">Full access for 30 days</span>
            </div>
          )}

          <div className="mt-20">
            <p className="text-center text-sm text-gray-500 mb-4 uppercase tracking-wider">Example Dashboard Metrics</p>
            <div className="grid grid-cols-3 gap-8 max-w-3xl mx-auto">
              <div className="bg-white rounded-2xl p-6 shadow-lg border border-gray-200 text-center">
                <div className="flex justify-center mb-3">
                  <TrendingUp className="w-10 h-10 text-green-500" />
                </div>
                <div className="text-3xl font-bold text-gray-900">
                  <AnimatedCounter end={87} suffix="%" />
                </div>
                <p className="text-sm text-gray-600 mt-2">Occupancy Rate</p>
              </div>
              <div className="bg-white rounded-2xl p-6 shadow-lg border border-gray-200 text-center">
                <div className="flex justify-center mb-3">
                  <DollarSign className="w-10 h-10 text-blue-500" />
                </div>
                <div className="text-3xl font-bold text-gray-900">
                  $<AnimatedCounter end={912} />
                </div>
                <p className="text-sm text-gray-600 mt-2">Avg Nightly Rate</p>
              </div>
              <div className="bg-white rounded-2xl p-6 shadow-lg border border-gray-200 text-center">
                <div className="flex justify-center mb-3">
                  <Users className="w-10 h-10 text-purple-500" />
                </div>
                <div className="text-3xl font-bold text-gray-900">
                  <AnimatedCounter end={247} suffix="" />
                </div>
                <p className="text-sm text-gray-600 mt-2">Happy Guests</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="py-24 px-6 max-w-7xl mx-auto">
        <div className="text-center mb-16">
          <h2 className="text-4xl font-bold mb-4">The Missing Piece for OwnerRez Users</h2>
          <p className="text-xl text-gray-600">OwnerRez excels at operations. We add the analytics layer you need.</p>
        </div>

        <div className="grid md:grid-cols-2 gap-12">
          <div className="relative">
            <div className="absolute -inset-4 bg-gradient-to-r from-gray-200 to-gray-300 rounded-2xl blur opacity-25" />
            <div className="relative bg-white rounded-2xl p-8 border border-gray-200">
              <h3 className="text-xl font-semibold mb-6 text-gray-500">OwnerRez Alone</h3>
              <div className="space-y-4">
                <div className="flex items-center text-gray-400">
                  <div className="w-2 h-2 bg-gray-400 rounded-full mr-3" />
                  <span>Great at operations, limited analytics</span>
                </div>
                <div className="flex items-center text-gray-400">
                  <div className="w-2 h-2 bg-gray-400 rounded-full mr-3" />
                  <span>Exporting CSVs for tax calculations</span>
                </div>
                <div className="flex items-center text-gray-400">
                  <div className="w-2 h-2 bg-gray-400 rounded-full mr-3" />
                  <span>No cross-property comparisons</span>
                </div>
                <div className="flex items-center text-gray-400">
                  <div className="w-2 h-2 bg-gray-400 rounded-full mr-3" />
                  <span>Basic reporting without visualizations</span>
                </div>
              </div>
            </div>
          </div>

          <div className="relative">
            <div className="absolute -inset-4 bg-gradient-to-r from-blue-400 to-purple-400 rounded-2xl blur opacity-25" />
            <div className="relative bg-gradient-to-br from-blue-50 to-purple-50 rounded-2xl p-8 border border-blue-200">
              <h3 className="text-xl font-semibold mb-6 text-blue-600">OwnerRez + Baileys</h3>
              <div className="space-y-4">
                <div className="flex items-center text-gray-700">
                  <CheckCircle className="w-5 h-5 text-green-500 mr-3" />
                  <span className="font-medium">Your OwnerRez data finally actionable</span>
                </div>
                <div className="flex items-center text-gray-700">
                  <CheckCircle className="w-5 h-5 text-green-500 mr-3" />
                  <span className="font-medium">Tax calculations that save hours</span>
                </div>
                <div className="flex items-center text-gray-700">
                  <CheckCircle className="w-5 h-5 text-green-500 mr-3" />
                  <span className="font-medium">Spot underperforming properties instantly</span>
                </div>
                <div className="flex items-center text-gray-700">
                  <CheckCircle className="w-5 h-5 text-green-500 mr-3" />
                  <span className="font-medium">Make data-driven pricing decisions</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="py-20 bg-white">
        <div className="max-w-5xl mx-auto px-6">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold mb-4">How Baileys Works With OwnerRez</h2>
            <p className="text-lg text-gray-600">A perfect partnership: Operations + Analytics</p>
          </div>

          <div className="grid md:grid-cols-2 gap-12">
            <div>
              <h3 className="text-xl font-semibold mb-6 text-blue-600 flex items-center">
                <Home className="w-6 h-6 mr-2" />
                OwnerRez Handles
              </h3>
              <ul className="space-y-3">
                <li className="flex items-start">
                  <div className="w-2 h-2 bg-blue-500 rounded-full mr-3 mt-2" />
                  <span>Booking management & calendar sync</span>
                </li>
                <li className="flex items-start">
                  <div className="w-2 h-2 bg-blue-500 rounded-full mr-3 mt-2" />
                  <span>Guest communications & check-in</span>
                </li>
                <li className="flex items-start">
                  <div className="w-2 h-2 bg-blue-500 rounded-full mr-3 mt-2" />
                  <span>Channel distribution (Airbnb, VRBO)</span>
                </li>
                <li className="flex items-start">
                  <div className="w-2 h-2 bg-blue-500 rounded-full mr-3 mt-2" />
                  <span>Payment processing & security deposits</span>
                </li>
                <li className="flex items-start">
                  <div className="w-2 h-2 bg-blue-500 rounded-full mr-3 mt-2" />
                  <span>Housekeeping & maintenance scheduling</span>
                </li>
              </ul>
            </div>

            <div>
              <h3 className="text-xl font-semibold mb-6 text-green-600 flex items-center">
                <CheckCircle className="w-6 h-6 mr-2" />
                Baileys Adds
              </h3>
              <ul className="space-y-3">
                <li className="flex items-start">
                  <div className="w-2 h-2 bg-green-500 rounded-full mr-3 mt-2" />
                  <span>Revenue & expense analysis that shows real profitability</span>
                </li>
                <li className="flex items-start">
                  <div className="w-2 h-2 bg-green-500 rounded-full mr-3 mt-2" />
                  <span>Tax calculations that save hours every quarter</span>
                </li>
                <li className="flex items-start">
                  <div className="w-2 h-2 bg-green-500 rounded-full mr-3 mt-2" />
                  <span>Property comparisons to identify winners and losers</span>
                </li>
                <li className="flex items-start">
                  <div className="w-2 h-2 bg-green-500 rounded-full mr-3 mt-2" />
                  <span>Occupancy patterns to optimize pricing</span>
                </li>
                <li className="flex items-start">
                  <div className="w-2 h-2 bg-green-500 rounded-full mr-3 mt-2" />
                  <span>Guest analytics to improve retention</span>
                </li>
              </ul>
            </div>
          </div>

          <div className="mt-12 p-6 bg-blue-50 rounded-xl text-center">
            <p className="text-gray-700">
              <span className="font-semibold">5-minute setup:</span> Connect your OwnerRez account and start seeing insights immediately
            </p>
          </div>
        </div>
      </section>


      <section className="py-24 bg-gradient-to-b from-white to-blue-50">
        <div className="max-w-7xl mx-auto px-6">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-bold mb-4">Analytics That Actually Help You Make Money</h2>
            <p className="text-xl text-gray-600">Functional tools that turn your OwnerRez data into actionable decisions</p>
          </div>

          <div className="grid md:grid-cols-3 gap-8">

            <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100 hover:shadow-md transition-shadow">
              <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl flex items-center justify-center mb-5">
                <BarChart3 className="w-7 h-7 text-white" />
              </div>
              <h3 className="text-lg font-semibold text-gray-900 mb-2">Revenue & P&L</h3>
              <p className="text-gray-600 text-sm">Track income, expenses, and profitability across all your properties in real-time</p>
            </div>

            <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100 hover:shadow-md transition-shadow">
              <div className="w-12 h-12 bg-gradient-to-br from-green-500 to-green-600 rounded-xl flex items-center justify-center mb-5">
                <DollarSign className="w-7 h-7 text-white" />
              </div>
              <h3 className="text-lg font-semibold text-gray-900 mb-2">Tax Tracking</h3>
              <p className="text-gray-600 text-sm">Calculate taxes automatically and generate reports for easy filing</p>
            </div>

            <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100 hover:shadow-md transition-shadow">
              <div className="w-12 h-12 bg-gradient-to-br from-purple-500 to-purple-600 rounded-xl flex items-center justify-center mb-5">
                <Users className="w-7 h-7 text-white" />
              </div>
              <h3 className="text-lg font-semibold text-gray-900 mb-2">Guest Analytics</h3>
              <p className="text-gray-600 text-sm">Understand your guests with repeat visitor tracking and spending analysis</p>
            </div>

            <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100 hover:shadow-md transition-shadow">
              <div className="w-12 h-12 bg-gradient-to-br from-orange-500 to-orange-600 rounded-xl flex items-center justify-center mb-5">
                <Home className="w-7 h-7 text-white" />
              </div>
              <h3 className="text-lg font-semibold text-gray-900 mb-2">Property Metrics</h3>
              <p className="text-gray-600 text-sm">Compare performance across properties to identify your best performers</p>
            </div>

            <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100 hover:shadow-md transition-shadow">
              <div className="w-12 h-12 bg-gradient-to-br from-teal-500 to-teal-600 rounded-xl flex items-center justify-center mb-5">
                <LineChart className="w-7 h-7 text-white" />
              </div>
              <h3 className="text-lg font-semibold text-gray-900 mb-2">Occupancy Trends</h3>
              <p className="text-gray-600 text-sm">Visualize booking patterns and identify opportunities to increase occupancy</p>
            </div>

            <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100 hover:shadow-md transition-shadow">
              <div className="w-12 h-12 bg-gradient-to-br from-pink-500 to-pink-600 rounded-xl flex items-center justify-center mb-5">
                <PieChart className="w-7 h-7 text-white" />
              </div>
              <h3 className="text-lg font-semibold text-gray-900 mb-2">Platform Breakdown</h3>
              <p className="text-gray-600 text-sm">See which booking channels drive the most revenue for your business</p>
            </div>
          </div>
        </div>
      </section>


      <section className="py-24 bg-gradient-to-r from-blue-600 to-purple-600 text-white">
        <div className="max-w-7xl mx-auto px-6">
          <div className="text-center mb-12">
            <h2 className="text-4xl font-bold mb-4">Built for Property Managers Who Want Results</h2>
            <p className="text-xl opacity-90 mb-3">The missing analytics layer for OwnerRez</p>
            <p className="text-base opacity-75">Built for property managers with 10-100+ properties</p>
          </div>

          <div className="grid md:grid-cols-4 gap-8 text-center">
            <div>
              <div className="text-5xl font-bold mb-2">
                <AnimatedCounter end={24} suffix="/7" />
              </div>
              <p className="text-lg opacity-90">Real-time Sync</p>
            </div>
            <div>
              <div className="text-5xl font-bold mb-2">
                <AnimatedCounter end={30} suffix="+" />
              </div>
              <p className="text-lg opacity-90">Properties Tracked</p>
            </div>
            <div>
              <div className="text-5xl font-bold mb-2">
                <AnimatedCounter end={5} />
              </div>
              <p className="text-lg opacity-90">Core Dashboards</p>
            </div>
            <div>
              <div className="text-5xl font-bold mb-2">
                <AnimatedCounter end={3} />
              </div>
              <p className="text-lg opacity-90">Minute Setup</p>
            </div>
          </div>
        </div>
      </section>


      <section className="py-24 px-6 bg-gradient-to-b from-white to-gray-50">
        <div className="max-w-6xl mx-auto text-center">
          <h2 className="text-4xl font-bold mb-4">Simple, Transparent Pricing</h2>
          <p className="text-xl text-gray-600 mb-4">Start for just $1. No hidden fees, cancel anytime.</p>


          <div className="flex justify-center items-center gap-4 mb-12">
            <span className={`font-medium ${!yearlyBilling ? 'text-gray-900' : 'text-gray-500'}`}>Monthly</span>
            <button
              onClick={() => setYearlyBilling(!yearlyBilling)}
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


          <div className="max-w-md mx-auto mb-8">
            <div className="bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-xl p-4 shadow-lg">
              <div className="flex items-center justify-center gap-3">
                <div className="text-3xl font-bold">$1</div>
                <div className="text-left">
                  <div className="font-semibold">First Month Trial</div>
                  <div className="text-sm opacity-90">Full access. Cancel anytime.</div>
                </div>
              </div>
            </div>
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
                  {!yearlyBilling && <p className="text-sm text-gray-400">$240 billed monthly</p>}
                </div>
                <div className="space-y-3 mb-8 text-left">
                  <div className="flex items-start">
                    <CheckCircle className="w-4 h-4 text-green-500 mr-2 mt-0.5 flex-shrink-0" />
                    <span className="text-sm">Full analytics dashboard</span>
                  </div>
                  <div className="flex items-start">
                    <CheckCircle className="w-4 h-4 text-green-500 mr-2 mt-0.5 flex-shrink-0" />
                    <span className="text-sm">Real-time OwnerRez sync</span>
                  </div>
                  <div className="flex items-start">
                    <CheckCircle className="w-4 h-4 text-green-500 mr-2 mt-0.5 flex-shrink-0" />
                    <span className="text-sm">Financial & occupancy insights</span>
                  </div>
                  <div className="flex items-start">
                    <CheckCircle className="w-4 h-4 text-green-500 mr-2 mt-0.5 flex-shrink-0" />
                    <span className="text-sm">Guest history & analytics</span>
                  </div>
                  <div className="flex items-start">
                    <CheckCircle className="w-4 h-4 text-green-500 mr-2 mt-0.5 flex-shrink-0" />
                    <span className="text-sm">Advanced tax tracking</span>
                  </div>
                  <div className="flex items-start">
                    <CheckCircle className="w-4 h-4 text-green-500 mr-2 mt-0.5 flex-shrink-0" />
                    <span className="text-sm">Custom reports & exports</span>
                  </div>
                  <div className="flex items-start">
                    <CheckCircle className="w-4 h-4 text-green-500 mr-2 mt-0.5 flex-shrink-0" />
                    <span className="text-sm">Season analysis</span>
                  </div>
                  <div className="flex items-start">
                    <CheckCircle className="w-4 h-4 text-green-500 mr-2 mt-0.5 flex-shrink-0" />
                    <span className="text-sm">Email support</span>
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
            <p className="text-sm text-gray-500">$1 for your first month, then {yearlyBilling ? '$192/year' : '$20/month'}. Cancel anytime.</p>
          </div>
        </div>
      </section>

      <section className="py-24 bg-gradient-to-r from-blue-600 to-purple-600 text-white text-center">
        <div className="max-w-4xl mx-auto px-6">
          <h2 className="text-4xl font-bold mb-4">Ready to See the Full Picture?</h2>
          <p className="text-xl mb-8 opacity-90">
            Turn your OwnerRez data into actionable insights. Start with just $1.
          </p>
          {!isAuthenticated && (
            <Link to="/signup" className="inline-flex items-center px-8 py-4 bg-white text-blue-600 rounded-full text-lg font-bold hover:shadow-xl transition-all transform hover:scale-105">
              Start Your $1 Trial
              <ArrowRight className="w-5 h-5 ml-2" />
            </Link>
          )}
        </div>
      </section>

      <Footer />

    </div>
  )
}
