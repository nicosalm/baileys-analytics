import { Link } from 'react-router-dom'
import { useAuth } from '@/contexts/auth'
import { Footer } from '@/components/Footer'
import {
  ArrowRight, CheckCircle,
  DollarSign, BarChart2, TrendingUp, Shield, Zap, Lock
} from 'lucide-react'
import { useState, useEffect, useCallback } from 'react'
import { BRAND } from '@/constants'
import { useInView } from '@/hooks'

export const Landing = () => {
  const { state, logout } = useAuth()
  const isAuthenticated = state.status === 'authenticated'
  const [yearlyBilling, setYearlyBilling] = useState(true)
  const [scrolled, setScrolled] = useState(false)

  const features = useInView()
  const howItWorks = useInView()
  const pricing = useInView()

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 20)
    window.addEventListener('scroll', handleScroll)
    return () => window.removeEventListener('scroll', handleScroll)
  }, [])

  const handleLogout = useCallback(() => logout(), [logout])
  const handleToggleBilling = useCallback(() => setYearlyBilling(prev => !prev), [])

  return (
    <div className="min-h-screen flex flex-col">
      {/* nav */}
      <nav className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
        scrolled ? 'bg-white/90 backdrop-blur-md shadow-sm' : 'bg-transparent'
      }`}>
        <div className="max-w-6xl mx-auto px-4 md:px-6 py-4">
          <div className="flex justify-between items-center">
            <div className="flex items-center">
              <img src="/baileysanalytics.svg" alt={BRAND.name} className="w-9 h-9" />
              <span className="text-xl font-semibold text-gray-900 ml-3">{BRAND.name}</span>
            </div>
            <div className="flex items-center gap-3">
              {isAuthenticated ? (
                <>
                  <button
                    onClick={handleLogout}
                    className="hidden sm:block px-4 py-2 text-gray-600 hover:text-gray-900 font-medium transition-colors text-sm cursor-pointer"
                  >
                    Logout
                  </button>
                  <Link to="/dashboard/overview" className={`px-4 py-2 ${BRAND.buttonGradient} text-white rounded-lg hover:opacity-90 transition-opacity font-medium text-sm`}>
                    Dashboard
                  </Link>
                </>
              ) : (
                <>
                  <Link to="/login" className="hidden sm:block px-4 py-2 text-gray-600 hover:text-gray-900 font-medium transition-colors text-sm">
                    Log in
                  </Link>
                  <Link to="/signup" className={`px-4 py-2 ${BRAND.buttonGradient} text-white rounded-lg hover:opacity-90 transition-opacity font-medium text-sm`}>
                    Start Trial
                  </Link>
                </>
              )}
            </div>
          </div>
        </div>
      </nav>

      {/* hero */}
      <section className="relative min-h-screen flex items-center justify-center bg-gradient-to-b from-gray-50 to-white pt-20">
        <div className="max-w-5xl mx-auto px-4 md:px-6 py-24 md:py-32 text-center">
          <div className="flex items-center justify-center gap-1 mb-6">
            <span className="text-sm font-medium text-gray-500">Built for</span>
            <img src="/logos/ownerrez-wide.png" alt="OwnerRez" className="h-5" />
            <span className="text-sm font-medium text-gray-500">users</span>
          </div>

          <h1 className="text-4xl sm:text-5xl md:text-6xl font-bold text-gray-900 mb-6 tracking-tight">
            Analytics for OwnerRez
          </h1>

          <p className="text-lg md:text-xl text-gray-600 mb-8 max-w-2xl mx-auto">
            Pull in booking data from OwnerRez. See revenue and occupancy breakdowns in minutes.
          </p>

          {!isAuthenticated && (
            <div className="flex flex-col sm:flex-row gap-4 justify-center items-center mb-6">
              <Link to="/signup" className={`group px-6 py-3 ${BRAND.buttonGradient} text-white rounded-lg font-medium hover:opacity-90 transition-opacity flex items-center`}>
                Start Your $1 Trial
                <ArrowRight className="w-4 h-4 ml-2 group-hover:translate-x-0.5 transition-transform" />
              </Link>
            </div>
          )}

          <p className="text-sm text-gray-500">
            30 days for $1, then $20/month. Cancel anytime.
          </p>

          {/* video demo */}
          <div className="mt-16 md:mt-24">
            <div className="relative max-w-4xl mx-auto">
              <div className="absolute -inset-4 bg-gradient-to-r from-blue-100 to-blue-50 rounded-3xl blur-2xl opacity-60" />
              <div className="relative bg-white rounded-2xl shadow-2xl overflow-hidden ring-1 ring-gray-200">
                <video
                  autoPlay
                  loop
                  muted
                  playsInline
                  className="w-full h-full object-cover"
                >
                  <source src="/demo.mp4" type="video/mp4" />
                  <div className="aspect-video bg-gray-100 flex items-center justify-center">
                    <p className="text-gray-500">Dashboard preview</p>
                  </div>
                </video>
              </div>
            </div>

            {/* trust strip */}
            <div className="flex flex-wrap justify-center gap-6 md:gap-10 mt-10 text-sm text-gray-500">
              <div className="flex items-center gap-2">
                <Shield className="w-4 h-4 text-gray-400" />
                <span>Secure OAuth</span>
              </div>
              <div className="flex items-center gap-2">
                <Lock className="w-4 h-4 text-gray-400" />
                <span>Data encrypted</span>
              </div>
              <div className="flex items-center gap-2">
                <Zap className="w-4 h-4 text-gray-400" />
                <span>Cancel anytime</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* features */}
      <section className="py-24 md:py-32 bg-white">
        <div
          ref={features.ref}
          className={`max-w-5xl mx-auto px-4 md:px-6 transition-all duration-700 ${
            features.isInView ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'
          }`}
        >
          <div className="text-center mb-12 md:mb-16">
            <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-3">What you'll see</h2>
            <p className="text-gray-600 max-w-xl mx-auto">Clear answers to the questions that actually matter for your business.</p>
          </div>

          <div className="grid md:grid-cols-3 gap-6 md:gap-8">
            <div className="bg-gray-50 rounded-2xl p-6 md:p-8 border border-gray-100 hover-lift">
              <div className="w-10 h-10 bg-blue-100 rounded-xl flex items-center justify-center mb-5">
                <DollarSign className="w-5 h-5 text-blue-600" />
              </div>
              <h3 className="text-lg font-semibold text-gray-900 mb-2">See where your money goes</h3>
              <p className="text-gray-600 text-sm leading-relaxed">
                Track platform fees, cleaning costs, and taxes by property. Know your real margins, not just gross revenue.
              </p>
            </div>

            <div className={`bg-gray-50 rounded-2xl p-6 md:p-8 border border-gray-100 hover-lift transition-all duration-700 ${
              features.isInView ? 'opacity-100 translate-y-0 delay-100' : 'opacity-0 translate-y-8'
            }`} style={{ transitionDelay: features.isInView ? '100ms' : '0ms' }}>
              <div className="w-10 h-10 bg-blue-100 rounded-xl flex items-center justify-center mb-5">
                <BarChart2 className="w-5 h-5 text-blue-600" />
              </div>
              <h3 className="text-lg font-semibold text-gray-900 mb-2">Compare properties side by side</h3>
              <p className="text-gray-600 text-sm leading-relaxed">
                Sort by occupancy, revenue, or profit. Find your best performers and the ones dragging down your portfolio.
              </p>
            </div>

            <div className={`bg-gray-50 rounded-2xl p-6 md:p-8 border border-gray-100 hover-lift transition-all duration-700 ${
              features.isInView ? 'opacity-100 translate-y-0 delay-200' : 'opacity-0 translate-y-8'
            }`} style={{ transitionDelay: features.isInView ? '200ms' : '0ms' }}>
              <div className="w-10 h-10 bg-blue-100 rounded-xl flex items-center justify-center mb-5">
                <TrendingUp className="w-5 h-5 text-blue-600" />
              </div>
              <h3 className="text-lg font-semibold text-gray-900 mb-2">Spot trends before they cost you</h3>
              <p className="text-gray-600 text-sm leading-relaxed">
                See seasonal patterns, repeat guest rates, and year-over-year comparisons. Make pricing decisions with real data.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* how it works */}
      <section className="py-20 md:py-28 bg-gray-50">
        <div
          ref={howItWorks.ref}
          className={`max-w-4xl mx-auto px-4 md:px-6 transition-all duration-700 ${
            howItWorks.isInView ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'
          }`}
        >
          <div className="text-center mb-10 md:mb-14">
            <h2 className="text-2xl md:text-3xl font-bold text-gray-900 mb-2">Up and running in 5 minutes</h2>
            <p className="text-gray-600">No spreadsheets. No manual entry. Just connect and go.</p>
          </div>

          <div className="grid md:grid-cols-3 gap-8 md:gap-6">
            <div className="text-center md:text-left">
              <div className="w-10 h-10 bg-blue-600 text-white rounded-full flex items-center justify-center text-sm font-bold mx-auto md:mx-0 mb-4">1</div>
              <h3 className="font-semibold text-gray-900 mb-1">Connect OwnerRez</h3>
              <p className="text-sm text-gray-600">Click, authorize, done. We use OAuth so we never see your password.</p>
            </div>

            <div className="text-center md:text-left">
              <div className="w-10 h-10 bg-blue-600 text-white rounded-full flex items-center justify-center text-sm font-bold mx-auto md:mx-0 mb-4">2</div>
              <h3 className="font-semibold text-gray-900 mb-1">Data syncs automatically</h3>
              <p className="text-sm text-gray-600">We pull 3 years of bookings, properties, and guests. Takes about 2 minutes.</p>
            </div>

            <div className="text-center md:text-left">
              <div className="w-10 h-10 bg-blue-600 text-white rounded-full flex items-center justify-center text-sm font-bold mx-auto md:mx-0 mb-4">3</div>
              <h3 className="font-semibold text-gray-900 mb-1">Start exploring</h3>
              <p className="text-sm text-gray-600">Your dashboards are ready. Filter by date, property, or tag. Export reports anytime.</p>
            </div>
          </div>
        </div>
      </section>

      {/* pricing */}
      <section className="py-24 md:py-32 bg-white">
        <div
          ref={pricing.ref}
          className={`max-w-5xl mx-auto px-4 md:px-6 transition-all duration-700 ${
            pricing.isInView ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'
          }`}
        >
          <div className="text-center mb-10">
            <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-3">One plan, one price</h2>
            <p className="text-gray-600">Everything you need. No tiers, no upsells.</p>
          </div>

          <div className="flex justify-center items-center gap-4 mb-10">
            <span className={`text-sm font-medium ${!yearlyBilling ? 'text-gray-900' : 'text-gray-500'}`}>Monthly</span>
            <button
              onClick={handleToggleBilling}
              aria-label="Toggle billing cycle"
              className="relative inline-flex h-6 w-11 items-center rounded-full bg-gray-200 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 cursor-pointer"
            >
              <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${yearlyBilling ? 'translate-x-6' : 'translate-x-1'}`} />
            </button>
            <span className={`text-sm font-medium ${yearlyBilling ? 'text-gray-900' : 'text-gray-500'}`}>
              Yearly
              <span className="ml-1.5 inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-700">
                Save 20%
              </span>
            </span>
          </div>

          <div className="max-w-md mx-auto">
            <div className="bg-white rounded-2xl border-2 border-blue-500 p-8 md:p-10">
              <div className="text-center mb-6">
                <div className="text-4xl md:text-5xl font-bold text-gray-900 mb-1">
                  ${yearlyBilling ? '16' : '20'}<span className="text-xl text-gray-500 font-normal">/mo</span>
                </div>
                {yearlyBilling && <p className="text-sm text-green-600">$192/year, save $48</p>}
                {!yearlyBilling && <p className="text-sm text-gray-500">Billed monthly</p>}
              </div>

              <div className="space-y-3 mb-8">
                <div className="flex items-center">
                  <CheckCircle className="w-4 h-4 text-green-500 mr-3 flex-shrink-0" />
                  <span className="text-sm text-gray-700">Full OwnerRez sync (3 years of data)</span>
                </div>
                <div className="flex items-center">
                  <CheckCircle className="w-4 h-4 text-green-500 mr-3 flex-shrink-0" />
                  <span className="text-sm text-gray-700">6 dashboards with filtering</span>
                </div>
                <div className="flex items-center">
                  <CheckCircle className="w-4 h-4 text-green-500 mr-3 flex-shrink-0" />
                  <span className="text-sm text-gray-700">Exportable PDF reports</span>
                </div>
                <div className="flex items-center">
                  <CheckCircle className="w-4 h-4 text-green-500 mr-3 flex-shrink-0" />
                  <span className="text-sm text-gray-700">Cancel anytime</span>
                </div>
              </div>

              <Link to="/signup" className={`block w-full py-3 text-center ${BRAND.buttonGradient} text-white rounded-lg hover:opacity-90 transition-opacity font-medium`}>
                Start $1 Trial
              </Link>

              <p className="text-center text-xs text-gray-500 mt-4">
                $1 for 30 days, then {yearlyBilling ? '$192/year' : '$20/month'}
              </p>
            </div>
          </div>

          {/* closing cta */}
          <div className="text-center mt-16 md:mt-24">
            <h3 className="text-2xl md:text-3xl font-bold text-gray-900 mb-4">Ready to see your real numbers?</h3>
            {!isAuthenticated && (
              <Link to="/signup" className={`inline-flex items-center px-6 py-3 ${BRAND.buttonGradient} text-white rounded-lg font-medium hover:opacity-90 transition-opacity`}>
                Get Started
                <ArrowRight className="w-4 h-4 ml-2" />
              </Link>
            )}
          </div>
        </div>
      </section>

      <Footer />
    </div>
  )
}
