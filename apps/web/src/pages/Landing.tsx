import { Link } from 'react-router-dom'
import { useAuth } from '@/contexts/auth'
import { Footer } from '@/components/Footer'
import { 
  TrendingUp, BarChart3, PieChart, LineChart, 
  DollarSign, Users, Home,
  ArrowRight, CheckCircle, Sparkles,
  Zap, Shield, Clock, ChevronRight, Compass
} from 'lucide-react'
import { useState, useEffect } from 'react'
import { BRAND } from '@/constants'

// Animated counter component
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
  const [yearlyBilling, setYearlyBilling] = useState(true) // Default to yearly for better value perception

  return (
    <div className="min-h-screen flex flex-col bg-gradient-to-b from-slate-50 via-white to-slate-50">
      {/* Navigation */}
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
                  Join Early Access
                </Link>
              </>
            )}
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="relative min-h-screen flex items-center justify-center overflow-hidden">
        {/* Animated background gradient */}
        <div className="absolute inset-0 bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50 opacity-70" />
        
        {/* Floating shapes for visual interest */}
        <div className="absolute top-20 left-10 w-72 h-72 bg-blue-300 rounded-full mix-blend-multiply filter blur-xl opacity-20 animate-blob" />
        <div className="absolute top-40 right-10 w-72 h-72 bg-purple-300 rounded-full mix-blend-multiply filter blur-xl opacity-20 animate-blob animation-delay-2000" />
        <div className="absolute -bottom-8 left-20 w-72 h-72 bg-pink-300 rounded-full mix-blend-multiply filter blur-xl opacity-20 animate-blob animation-delay-4000" />
        
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
            Stop guessing. Start knowing. Advanced analytics dashboard that transforms your OwnerRez data into actionable insights.
          </p>
          
          {!isAuthenticated && (
            <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
              <Link to="/signup" className={`group px-8 py-4 ${BRAND.buttonGradient} text-white rounded-full text-lg font-medium hover:shadow-xl transition-all transform hover:scale-105 flex items-center`}>
                Join Early Access Waitlist
                <ArrowRight className="w-5 h-5 ml-2 group-hover:translate-x-1 transition-transform" />
              </Link>
              <span className="text-gray-500">Be first to know when we launch</span>
            </div>
          )}
          
          {/* Example metrics that could be yours */}
          <div className="mt-20 grid grid-cols-3 gap-8 max-w-3xl mx-auto">
            <div className="bg-white/80 backdrop-blur-sm rounded-2xl p-6 shadow-xl border border-white/20 text-center">
              <div className="flex justify-center mb-3">
                <TrendingUp className="w-10 h-10 text-green-500" />
              </div>
              <div className="text-3xl font-bold text-gray-900">
                <AnimatedCounter end={87} suffix="%" />
              </div>
              <p className="text-sm text-gray-600 mt-2">Occupancy Rate</p>
            </div>
            <div className="bg-white/80 backdrop-blur-sm rounded-2xl p-6 shadow-xl border border-white/20 text-center">
              <div className="flex justify-center mb-3">
                <DollarSign className="w-10 h-10 text-blue-500" />
              </div>
              <div className="text-3xl font-bold text-gray-900">
                $<AnimatedCounter end={912} />
              </div>
              <p className="text-sm text-gray-600 mt-2">Avg Nightly Rate</p>
            </div>
            <div className="bg-white/80 backdrop-blur-sm rounded-2xl p-6 shadow-xl border border-white/20 text-center">
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
      </section>

      {/* $1 Trial Highlight */}
      <section className="py-16 px-6 bg-gradient-to-r from-blue-600 to-purple-600">
        <div className="max-w-4xl mx-auto text-center text-white">
          <div className="inline-flex items-center justify-center px-6 py-3 bg-white/20 backdrop-blur rounded-full mb-6">
            <span className="text-5xl font-bold mr-3">$1</span>
            <div className="text-left">
              <div className="text-sm opacity-90">First Month</div>
              <div className="font-semibold">Full Access Trial</div>
            </div>
          </div>
          <h3 className="text-2xl font-bold mb-4">No Risk. No Commitment. Just $1.</h3>
          <p className="text-lg opacity-90 mb-6">
            Get complete access to all features for 30 days. Cancel anytime with one click.
          </p>
          <div className="flex justify-center gap-8 text-sm">
            <div className="flex items-center">
              <CheckCircle className="w-5 h-5 mr-2" />
              <span>Instant setup</span>
            </div>
            <div className="flex items-center">
              <CheckCircle className="w-5 h-5 mr-2" />
              <span>All features included</span>
            </div>
            <div className="flex items-center">
              <CheckCircle className="w-5 h-5 mr-2" />
              <span>Cancel anytime</span>
            </div>
          </div>
        </div>
      </section>

      {/* Problem/Solution Visual */}
      <section className="py-24 px-6 max-w-7xl mx-auto">
        <div className="text-center mb-16">
          <h2 className="text-4xl font-bold mb-4">Before & After Baileys</h2>
          <p className="text-xl text-gray-600">See the difference clarity makes</p>
        </div>
        
        <div className="grid md:grid-cols-2 gap-12">
          {/* Before */}
          <div className="relative">
            <div className="absolute -inset-4 bg-gradient-to-r from-gray-200 to-gray-300 rounded-2xl blur opacity-25" />
            <div className="relative bg-white rounded-2xl p-8 border border-gray-200">
              <h3 className="text-xl font-semibold mb-6 text-gray-500">Without Baileys</h3>
              <div className="space-y-4">
                <div className="flex items-center text-gray-400">
                  <div className="w-2 h-2 bg-gray-400 rounded-full mr-3" />
                  <span>Scattered spreadsheets everywhere</span>
                </div>
                <div className="flex items-center text-gray-400">
                  <div className="w-2 h-2 bg-gray-400 rounded-full mr-3" />
                  <span>Hours calculating taxes manually</span>
                </div>
                <div className="flex items-center text-gray-400">
                  <div className="w-2 h-2 bg-gray-400 rounded-full mr-3" />
                  <span>No idea which properties perform best</span>
                </div>
                <div className="flex items-center text-gray-400">
                  <div className="w-2 h-2 bg-gray-400 rounded-full mr-3" />
                  <span>Guessing at seasonal trends</span>
                </div>
              </div>
            </div>
          </div>
          
          {/* After */}
          <div className="relative">
            <div className="absolute -inset-4 bg-gradient-to-r from-blue-400 to-purple-400 rounded-2xl blur opacity-25" />
            <div className="relative bg-gradient-to-br from-blue-50 to-purple-50 rounded-2xl p-8 border border-blue-200">
              <h3 className="text-xl font-semibold mb-6 text-blue-600">With Baileys</h3>
              <div className="space-y-4">
                <div className="flex items-center text-gray-700">
                  <CheckCircle className="w-5 h-5 text-green-500 mr-3" />
                  <span className="font-medium">All data in one beautiful dashboard</span>
                </div>
                <div className="flex items-center text-gray-700">
                  <CheckCircle className="w-5 h-5 text-green-500 mr-3" />
                  <span className="font-medium">Automated tax calculations & reports</span>
                </div>
                <div className="flex items-center text-gray-700">
                  <CheckCircle className="w-5 h-5 text-green-500 mr-3" />
                  <span className="font-medium">Instant property performance metrics</span>
                </div>
                <div className="flex items-center text-gray-700">
                  <CheckCircle className="w-5 h-5 text-green-500 mr-3" />
                  <span className="font-medium">Clear seasonal performance trends</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* What We Do / Don't Do Section */}
      <section className="py-20 bg-white">
        <div className="max-w-5xl mx-auto px-6">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold mb-4">Focus on What Matters: Analytics</h2>
            <p className="text-lg text-gray-600">We supercharge your OwnerRez data with powerful insights</p>
          </div>
          
          <div className="grid md:grid-cols-2 gap-12">
            {/* What Baileys Does */}
            <div>
              <h3 className="text-xl font-semibold mb-6 text-green-600 flex items-center">
                <CheckCircle className="w-6 h-6 mr-2" />
                What Baileys Does
              </h3>
              <ul className="space-y-3">
                <li className="flex items-start">
                  <div className="w-2 h-2 bg-green-500 rounded-full mr-3 mt-2" />
                  <span>Analyze revenue, expenses & profitability across all properties</span>
                </li>
                <li className="flex items-start">
                  <div className="w-2 h-2 bg-green-500 rounded-full mr-3 mt-2" />
                  <span>Track occupancy trends & identify booking gaps</span>
                </li>
                <li className="flex items-start">
                  <div className="w-2 h-2 bg-green-500 rounded-full mr-3 mt-2" />
                  <span>Calculate taxes by jurisdiction automatically</span>
                </li>
                <li className="flex items-start">
                  <div className="w-2 h-2 bg-green-500 rounded-full mr-3 mt-2" />
                  <span>Compare property & channel performance</span>
                </li>
                <li className="flex items-start">
                  <div className="w-2 h-2 bg-green-500 rounded-full mr-3 mt-2" />
                  <span>Generate professional reports & insights</span>
                </li>
              </ul>
            </div>
            
            {/* What OwnerRez Handles */}
            <div>
              <h3 className="text-xl font-semibold mb-6 text-blue-600 flex items-center">
                <Home className="w-6 h-6 mr-2" />
                What OwnerRez Handles
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
          </div>
          
          <div className="mt-12 p-6 bg-blue-50 rounded-xl text-center">
            <p className="text-gray-700">
              <span className="font-semibold">Perfect Partnership:</span> OwnerRez handles operations, Baileys delivers the insights you need to grow.
            </p>
          </div>
        </div>
      </section>

      {/* Visual Feature Grid */}
      <section className="py-24 bg-gradient-to-b from-white to-blue-50">
        <div className="max-w-7xl mx-auto px-6">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-bold mb-4">Analytics That Drive Decisions</h2>
            <p className="text-xl text-gray-600">Deep insights from your OwnerRez data, beautifully visualized</p>
          </div>
          
          <div className="grid md:grid-cols-3 gap-8">
            {/* Financial Dashboard */}
            <div className="group relative overflow-hidden bg-white rounded-2xl p-8 shadow-lg hover:shadow-2xl transition-all hover:-translate-y-1">
              <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-br from-blue-100 to-blue-200 rounded-full -mr-16 -mt-16 opacity-50" />
              <BarChart3 className="w-12 h-12 text-blue-600 mb-4" />
              <h3 className="text-xl font-bold mb-2">Financial Analytics</h3>
              <p className="text-gray-600 mb-4">Visualize P&L, revenue trends, and cash flow patterns</p>
              <div className="flex items-center text-blue-600 font-medium group-hover:translate-x-2 transition-transform">
                Explore metrics <ChevronRight className="w-4 h-4 ml-1" />
              </div>
            </div>
            
            {/* Tax Center */}
            <div className="group relative overflow-hidden bg-white rounded-2xl p-8 shadow-lg hover:shadow-2xl transition-all hover:-translate-y-1">
              <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-br from-green-100 to-green-200 rounded-full -mr-16 -mt-16 opacity-50" />
              <DollarSign className="w-12 h-12 text-green-600 mb-4" />
              <h3 className="text-xl font-bold mb-2">Tax Calculations</h3>
              <p className="text-gray-600 mb-4">Automated tax breakdowns & jurisdiction reports</p>
              <div className="flex items-center text-green-600 font-medium group-hover:translate-x-2 transition-transform">
                Save hours <ChevronRight className="w-4 h-4 ml-1" />
              </div>
            </div>
            
            {/* Guest Analytics */}
            <div className="group relative overflow-hidden bg-white rounded-2xl p-8 shadow-lg hover:shadow-2xl transition-all hover:-translate-y-1">
              <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-br from-purple-100 to-purple-200 rounded-full -mr-16 -mt-16 opacity-50" />
              <Users className="w-12 h-12 text-purple-600 mb-4" />
              <h3 className="text-xl font-bold mb-2">Guest Insights</h3>
              <p className="text-gray-600 mb-4">Analyze guest patterns, repeat rates & spending</p>
              <div className="flex items-center text-purple-600 font-medium group-hover:translate-x-2 transition-transform">
                Boost retention <ChevronRight className="w-4 h-4 ml-1" />
              </div>
            </div>
            
            {/* Property Performance */}
            <div className="group relative overflow-hidden bg-white rounded-2xl p-8 shadow-lg hover:shadow-2xl transition-all hover:-translate-y-1">
              <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-br from-orange-100 to-orange-200 rounded-full -mr-16 -mt-16 opacity-50" />
              <Home className="w-12 h-12 text-orange-600 mb-4" />
              <h3 className="text-xl font-bold mb-2">Property Performance</h3>
              <p className="text-gray-600 mb-4">Compare metrics & identify top performers</p>
              <div className="flex items-center text-orange-600 font-medium group-hover:translate-x-2 transition-transform">
                Maximize ROI <ChevronRight className="w-4 h-4 ml-1" />
              </div>
            </div>
            
            {/* Seasonal Trends */}
            <div className="group relative overflow-hidden bg-white rounded-2xl p-8 shadow-lg hover:shadow-2xl transition-all hover:-translate-y-1">
              <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-br from-teal-100 to-teal-200 rounded-full -mr-16 -mt-16 opacity-50" />
              <LineChart className="w-12 h-12 text-teal-600 mb-4" />
              <h3 className="text-xl font-bold mb-2">Occupancy Analytics</h3>
              <p className="text-gray-600 mb-4">Spot trends, gaps & seasonal patterns</p>
              <div className="flex items-center text-teal-600 font-medium group-hover:translate-x-2 transition-transform">
                Fill more nights <ChevronRight className="w-4 h-4 ml-1" />
              </div>
            </div>
            
            {/* Platform Breakdown */}
            <div className="group relative overflow-hidden bg-white rounded-2xl p-8 shadow-lg hover:shadow-2xl transition-all hover:-translate-y-1">
              <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-br from-pink-100 to-pink-200 rounded-full -mr-16 -mt-16 opacity-50" />
              <PieChart className="w-12 h-12 text-pink-600 mb-4" />
              <h3 className="text-xl font-bold mb-2">Channel Performance</h3>
              <p className="text-gray-600 mb-4">Compare Airbnb, VRBO & direct revenue</p>
              <div className="flex items-center text-pink-600 font-medium group-hover:translate-x-2 transition-transform">
                Optimize channels <ChevronRight className="w-4 h-4 ml-1" />
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Why Choose Baileys */}
      <section className="py-24 bg-gradient-to-r from-blue-600 to-purple-600 text-white">
        <div className="max-w-7xl mx-auto px-6">
          <div className="text-center mb-12">
            <h2 className="text-4xl font-bold mb-4">Built for Data-Driven Property Managers</h2>
            <p className="text-xl opacity-90">Analytics that OwnerRez doesn't provide</p>
          </div>
          
          <div className="grid md:grid-cols-4 gap-8 text-center">
            <div>
              <div className="text-5xl font-bold mb-2">
                <AnimatedCounter end={100} suffix="%" />
              </div>
              <p className="text-lg opacity-90">OwnerRez Sync</p>
            </div>
            <div>
              <div className="text-5xl font-bold mb-2">
                <AnimatedCounter end={50} suffix="+" />
              </div>
              <p className="text-lg opacity-90">Data Points Tracked</p>
            </div>
            <div>
              <div className="text-5xl font-bold mb-2">
                <AnimatedCounter end={10} suffix="+" />
              </div>
              <p className="text-lg opacity-90">Dashboard Views</p>
            </div>
            <div>
              <div className="text-5xl font-bold mb-2">
                <AnimatedCounter end={5} />
              </div>
              <p className="text-lg opacity-90">Min Setup Time</p>
            </div>
          </div>
        </div>
      </section>

      {/* Tiered Pricing */}
      <section className="py-24 px-6 bg-gradient-to-b from-white to-gray-50">
        <div className="max-w-6xl mx-auto text-center">
          <h2 className="text-4xl font-bold mb-4">Simple, Transparent Pricing</h2>
          <p className="text-xl text-gray-600 mb-4">Start for just $1. No hidden fees, cancel anytime.</p>
          
          {/* Pricing Toggle */}
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
          
          {/* $1 Trial Badge */}
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
          
          <div className="grid md:grid-cols-3 gap-8">
            {/* Starter */}
            <div className="relative bg-white rounded-2xl shadow-lg p-8 border border-gray-200">
              <h3 className="text-lg font-semibold mb-4">Starter</h3>
              <div className="text-4xl font-bold mb-2">
                ${yearlyBilling ? '16' : '19'}<span className="text-lg text-gray-500 font-normal">/mo</span>
              </div>
              <p className="text-gray-600 mb-2">1-3 properties</p>
              {yearlyBilling && <p className="text-sm text-green-600 mb-4">$192/year (save $36)</p>}
              {!yearlyBilling && <p className="text-sm text-gray-400 mb-4">$228 billed monthly</p>}
              <div className="space-y-3 mb-8 text-left">
                <div className="flex items-start">
                  <CheckCircle className="w-4 h-4 text-green-500 mr-2 mt-0.5 flex-shrink-0" />
                  <span className="text-sm">Core analytics dashboard</span>
                </div>
                <div className="flex items-start">
                  <CheckCircle className="w-4 h-4 text-green-500 mr-2 mt-0.5 flex-shrink-0" />
                  <span className="text-sm">Real-time sync</span>
                </div>
                <div className="flex items-start">
                  <CheckCircle className="w-4 h-4 text-green-500 mr-2 mt-0.5 flex-shrink-0" />
                  <span className="text-sm">Monthly & yearly views</span>
                </div>
                <div className="flex items-start">
                  <CheckCircle className="w-4 h-4 text-green-500 mr-2 mt-0.5 flex-shrink-0" />
                  <span className="text-sm">Email support</span>
                </div>
              </div>
              <Link to="/signup" className="block w-full py-3 bg-gray-100 text-gray-700 rounded-full hover:bg-gray-200 transition-colors font-medium">
                Start $1 Trial
              </Link>
            </div>
            
            {/* Professional */}
            <div className="relative">
              <div className="absolute -inset-1 bg-gradient-to-r from-blue-400 to-purple-400 rounded-2xl blur opacity-25" />
              <div className="relative bg-white rounded-2xl shadow-xl p-8 border-2 border-blue-500">
                <div className="inline-flex items-center px-3 py-1 bg-blue-100 text-blue-700 rounded-full text-xs font-medium mb-4">
                  <Zap className="w-3 h-3 mr-1" />
                  MOST POPULAR
                </div>
                <h3 className="text-lg font-semibold mb-4">Professional</h3>
                <div className="text-4xl font-bold mb-2">
                  ${yearlyBilling ? '39' : '49'}<span className="text-lg text-gray-500 font-normal">/mo</span>
                </div>
                <p className="text-gray-600 mb-2">4-15 properties</p>
                {yearlyBilling && <p className="text-sm text-green-600 mb-4">$468/year (save $120)</p>}
                {!yearlyBilling && <p className="text-sm text-gray-400 mb-4">$588 billed monthly</p>}
                <div className="space-y-3 mb-8 text-left">
                  <div className="flex items-start">
                    <CheckCircle className="w-4 h-4 text-green-500 mr-2 mt-0.5 flex-shrink-0" />
                    <span className="text-sm font-medium">Everything in Starter</span>
                  </div>
                  <div className="flex items-start">
                    <CheckCircle className="w-4 h-4 text-green-500 mr-2 mt-0.5 flex-shrink-0" />
                    <span className="text-sm">Advanced tax tracking & reports</span>
                  </div>
                  <div className="flex items-start">
                    <CheckCircle className="w-4 h-4 text-green-500 mr-2 mt-0.5 flex-shrink-0" />
                    <span className="text-sm">Guest history & analytics</span>
                  </div>
                  <div className="flex items-start">
                    <CheckCircle className="w-4 h-4 text-green-500 mr-2 mt-0.5 flex-shrink-0" />
                    <span className="text-sm">Occupancy gap detection</span>
                  </div>
                  <div className="flex items-start">
                    <CheckCircle className="w-4 h-4 text-green-500 mr-2 mt-0.5 flex-shrink-0" />
                    <span className="text-sm">Priority support</span>
                  </div>
                </div>
                <Link to="/signup" className={`block w-full py-3 ${BRAND.buttonGradient} text-white rounded-full hover:shadow-lg transition-all transform hover:scale-105 font-medium`}>
                  Start $1 Trial
                </Link>
              </div>
            </div>
            
            {/* Scale */}
            <div className="relative bg-white rounded-2xl shadow-lg p-8 border border-gray-200">
              <h3 className="text-lg font-semibold mb-4">Scale</h3>
              <div className="text-4xl font-bold mb-2">
                ${yearlyBilling ? '79' : '99'}<span className="text-lg text-gray-500 font-normal">+/mo</span>
              </div>
              <p className="text-gray-600 mb-2">16+ properties</p>
              {yearlyBilling && <p className="text-sm text-green-600 mb-4">Starting at $948/year</p>}
              {!yearlyBilling && <p className="text-sm text-gray-400 mb-4">Custom pricing available</p>}
              <div className="space-y-3 mb-8 text-left">
                <div className="flex items-start">
                  <CheckCircle className="w-4 h-4 text-green-500 mr-2 mt-0.5 flex-shrink-0" />
                  <span className="text-sm font-medium">Everything in Pro</span>
                </div>
                <div className="flex items-start">
                  <CheckCircle className="w-4 h-4 text-green-500 mr-2 mt-0.5 flex-shrink-0" />
                  <span className="text-sm">Custom integrations</span>
                </div>
                <div className="flex items-start">
                  <CheckCircle className="w-4 h-4 text-green-500 mr-2 mt-0.5 flex-shrink-0" />
                  <span className="text-sm">White-label options</span>
                </div>
                <div className="flex items-start">
                  <CheckCircle className="w-4 h-4 text-green-500 mr-2 mt-0.5 flex-shrink-0" />
                  <span className="text-sm">Dedicated account manager</span>
                </div>
                <div className="flex items-start">
                  <CheckCircle className="w-4 h-4 text-green-500 mr-2 mt-0.5 flex-shrink-0" />
                  <span className="text-sm">SLA & phone support</span>
                </div>
              </div>
              <Link to="/signup" className="block w-full py-3 bg-gray-900 text-white rounded-full hover:bg-gray-800 transition-colors font-medium text-center">
                Start $1 Trial
              </Link>
            </div>
          </div>
          
          <div className="text-center mt-8 space-y-2">
            <p className="text-sm text-gray-500">{yearlyBilling ? 'Prices shown are billed annually' : 'Save 20% with annual billing'}</p>
            <p className="text-sm text-gray-500">All plans start with $1 first month. Cancel anytime.</p>
          </div>
        </div>
      </section>

      {/* Security Badge */}
      <section className="py-12 bg-gray-50">
        <div className="max-w-4xl mx-auto px-6 flex justify-center items-center space-x-8 text-gray-600">
          <div className="flex items-center">
            <Shield className="w-5 h-5 mr-2" />
            <span>Bank-level security</span>
          </div>
          <div className="flex items-center">
            <Clock className="w-5 h-5 mr-2" />
            <span>Real-time updates</span>
          </div>
          <div className="flex items-center">
            <Zap className="w-5 h-5 mr-2" />
            <span>Lightning fast</span>
          </div>
        </div>
      </section>

      {/* Final CTA */}
      <section className="py-24 bg-gradient-to-r from-blue-600 to-purple-600 text-white text-center">
        <div className="max-w-4xl mx-auto px-6">
          <h2 className="text-4xl font-bold mb-4">Ready to See the Full Picture?</h2>
          <p className="text-xl mb-8 opacity-90">
            Turn your OwnerRez data into actionable insights. Start with just $1.
          </p>
          {!isAuthenticated && (
            <Link to="/signup" className="inline-flex items-center px-8 py-4 bg-white text-blue-600 rounded-full text-lg font-bold hover:shadow-xl transition-all transform hover:scale-105">
              Request Early Access
              <ArrowRight className="w-5 h-5 ml-2" />
            </Link>
          )}
        </div>
      </section>

      <Footer />
      
      <style>{`
        @keyframes blob {
          0% { transform: translate(0px, 0px) scale(1); }
          33% { transform: translate(30px, -50px) scale(1.1); }
          66% { transform: translate(-20px, 20px) scale(0.9); }
          100% { transform: translate(0px, 0px) scale(1); }
        }
        .animate-blob {
          animation: blob 7s infinite;
        }
        .animation-delay-2000 {
          animation-delay: 2s;
        }
        .animation-delay-4000 {
          animation-delay: 4s;
        }
      `}</style>
    </div>
  )
}