import { Link } from 'react-router-dom'
import { useAuth } from '@/contexts/auth'
import { Footer } from '@/components/Footer'
import { 
  TrendingUp, BarChart3, PieChart, LineChart, 
  DollarSign, Users, Home, Calendar,
  ArrowRight, CheckCircle, Sparkles,
  Zap, Shield, Clock, ChevronRight
} from 'lucide-react'
import { useState, useEffect } from 'react'

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

  return (
    <div className="min-h-screen flex flex-col bg-gradient-to-b from-slate-50 via-white to-slate-50">
      {/* Navigation */}
      <nav className="absolute top-0 left-0 right-0 z-50 p-6">
        <div className="max-w-7xl mx-auto flex justify-between items-center">
          <h1 className="text-2xl font-bold text-gray-900">Baileys Analytics</h1>
          <div className="space-x-4">
            {isAuthenticated ? (
              <Link to="/dashboard/overview" className="px-6 py-3 bg-gradient-to-r from-blue-600 to-blue-700 text-white rounded-full hover:shadow-lg transition-all transform hover:scale-105">
                Open Dashboard
              </Link>
            ) : (
              <>
                <Link to="/login" className="px-6 py-3 text-gray-700 hover:text-gray-900 transition-colors">
                  Login
                </Link>
                <Link to="/signup" className="px-6 py-3 bg-gradient-to-r from-blue-600 to-blue-700 text-white rounded-full hover:shadow-lg transition-all transform hover:scale-105">
                  Start Free Trial
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
            Stop guessing. Start knowing. Real-time analytics that transform your property data into actionable insights.
          </p>
          
          {!isAuthenticated && (
            <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
              <Link to="/signup" className="group px-8 py-4 bg-gradient-to-r from-blue-600 to-blue-700 text-white rounded-full text-lg font-medium hover:shadow-xl transition-all transform hover:scale-105 flex items-center">
                Start 14-Day Free Trial
                <ArrowRight className="w-5 h-5 ml-2 group-hover:translate-x-1 transition-transform" />
              </Link>
              <span className="text-gray-500">No credit card required</span>
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
                <AnimatedCounter end={4.7} decimals={1} suffix="" />
                <span className="text-2xl">★</span>
              </div>
              <p className="text-sm text-gray-600 mt-2">Avg Guest Rating</p>
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

      {/* Visual Feature Grid */}
      <section className="py-24 bg-gradient-to-b from-white to-blue-50">
        <div className="max-w-7xl mx-auto px-6">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-bold mb-4">Everything You Need</h2>
            <p className="text-xl text-gray-600">Powerful features, beautifully simple</p>
          </div>
          
          <div className="grid md:grid-cols-3 gap-8">
            {/* Financial Dashboard */}
            <div className="group relative overflow-hidden bg-white rounded-2xl p-8 shadow-lg hover:shadow-2xl transition-all hover:-translate-y-1">
              <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-br from-blue-100 to-blue-200 rounded-full -mr-16 -mt-16 opacity-50" />
              <BarChart3 className="w-12 h-12 text-blue-600 mb-4" />
              <h3 className="text-xl font-bold mb-2">Financial Intelligence</h3>
              <p className="text-gray-600 mb-4">Complete P&L, cash flow, and expense tracking</p>
              <div className="flex items-center text-blue-600 font-medium group-hover:translate-x-2 transition-transform">
                Explore metrics <ChevronRight className="w-4 h-4 ml-1" />
              </div>
            </div>
            
            {/* Tax Center */}
            <div className="group relative overflow-hidden bg-white rounded-2xl p-8 shadow-lg hover:shadow-2xl transition-all hover:-translate-y-1">
              <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-br from-green-100 to-green-200 rounded-full -mr-16 -mt-16 opacity-50" />
              <DollarSign className="w-12 h-12 text-green-600 mb-4" />
              <h3 className="text-xl font-bold mb-2">Tax Automation</h3>
              <p className="text-gray-600 mb-4">Never stress about tax season again</p>
              <div className="flex items-center text-green-600 font-medium group-hover:translate-x-2 transition-transform">
                Save hours <ChevronRight className="w-4 h-4 ml-1" />
              </div>
            </div>
            
            {/* Guest Analytics */}
            <div className="group relative overflow-hidden bg-white rounded-2xl p-8 shadow-lg hover:shadow-2xl transition-all hover:-translate-y-1">
              <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-br from-purple-100 to-purple-200 rounded-full -mr-16 -mt-16 opacity-50" />
              <Users className="w-12 h-12 text-purple-600 mb-4" />
              <h3 className="text-xl font-bold mb-2">Guest Insights</h3>
              <p className="text-gray-600 mb-4">Know your best guests & repeat visitors</p>
              <div className="flex items-center text-purple-600 font-medium group-hover:translate-x-2 transition-transform">
                Boost retention <ChevronRight className="w-4 h-4 ml-1" />
              </div>
            </div>
            
            {/* Property Performance */}
            <div className="group relative overflow-hidden bg-white rounded-2xl p-8 shadow-lg hover:shadow-2xl transition-all hover:-translate-y-1">
              <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-br from-orange-100 to-orange-200 rounded-full -mr-16 -mt-16 opacity-50" />
              <Home className="w-12 h-12 text-orange-600 mb-4" />
              <h3 className="text-xl font-bold mb-2">Property Analytics</h3>
              <p className="text-gray-600 mb-4">Compare & optimize each property</p>
              <div className="flex items-center text-orange-600 font-medium group-hover:translate-x-2 transition-transform">
                Maximize ROI <ChevronRight className="w-4 h-4 ml-1" />
              </div>
            </div>
            
            {/* Seasonal Trends */}
            <div className="group relative overflow-hidden bg-white rounded-2xl p-8 shadow-lg hover:shadow-2xl transition-all hover:-translate-y-1">
              <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-br from-teal-100 to-teal-200 rounded-full -mr-16 -mt-16 opacity-50" />
              <LineChart className="w-12 h-12 text-teal-600 mb-4" />
              <h3 className="text-xl font-bold mb-2">Seasonal Intelligence</h3>
              <p className="text-gray-600 mb-4">Predict peaks & optimize pricing</p>
              <div className="flex items-center text-teal-600 font-medium group-hover:translate-x-2 transition-transform">
                Price smarter <ChevronRight className="w-4 h-4 ml-1" />
              </div>
            </div>
            
            {/* Platform Breakdown */}
            <div className="group relative overflow-hidden bg-white rounded-2xl p-8 shadow-lg hover:shadow-2xl transition-all hover:-translate-y-1">
              <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-br from-pink-100 to-pink-200 rounded-full -mr-16 -mt-16 opacity-50" />
              <PieChart className="w-12 h-12 text-pink-600 mb-4" />
              <h3 className="text-xl font-bold mb-2">Platform Analysis</h3>
              <p className="text-gray-600 mb-4">Airbnb vs VRBO vs Direct bookings</p>
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
            <h2 className="text-4xl font-bold mb-4">Built for Modern Property Managers</h2>
            <p className="text-xl opacity-90">Everything you need, nothing you don't</p>
          </div>
          
          <div className="grid md:grid-cols-4 gap-8 text-center">
            <div>
              <div className="text-5xl font-bold mb-2">
                <AnimatedCounter end={100} suffix="%" />
              </div>
              <p className="text-lg opacity-90">Real-Time Sync</p>
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
              <p className="text-lg opacity-90">Report Types</p>
            </div>
            <div>
              <div className="text-5xl font-bold mb-2">
                <AnimatedCounter end={14} />
              </div>
              <p className="text-lg opacity-90">Day Free Trial</p>
            </div>
          </div>
        </div>
      </section>

      {/* Tiered Pricing */}
      <section className="py-24 px-6 bg-gradient-to-b from-white to-gray-50">
        <div className="max-w-6xl mx-auto text-center">
          <h2 className="text-4xl font-bold mb-4">Choose Your Plan</h2>
          <p className="text-xl text-gray-600 mb-12">Start free, scale as you grow</p>
          
          <div className="grid md:grid-cols-3 gap-8">
            {/* Starter */}
            <div className="relative bg-white rounded-2xl shadow-lg p-8 border border-gray-200">
              <h3 className="text-lg font-semibold mb-4">Starter</h3>
              <div className="text-4xl font-bold mb-2">
                $20<span className="text-lg text-gray-500 font-normal">/mo</span>
              </div>
              <p className="text-gray-600 mb-6">Up to 5 properties</p>
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
                  <span className="text-sm">Basic reports & CSV export</span>
                </div>
                <div className="flex items-start">
                  <CheckCircle className="w-4 h-4 text-green-500 mr-2 mt-0.5 flex-shrink-0" />
                  <span className="text-sm">Email support</span>
                </div>
              </div>
              <Link to="/signup" className="block w-full py-3 bg-gray-100 text-gray-700 rounded-full hover:bg-gray-200 transition-colors font-medium">
                Start Free Trial
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
                  $50<span className="text-lg text-gray-500 font-normal">/mo</span>
                </div>
                <p className="text-gray-600 mb-6">Up to 20 properties</p>
                <div className="space-y-3 mb-8 text-left">
                  <div className="flex items-start">
                    <CheckCircle className="w-4 h-4 text-green-500 mr-2 mt-0.5 flex-shrink-0" />
                    <span className="text-sm font-medium">Everything in Starter</span>
                  </div>
                  <div className="flex items-start">
                    <CheckCircle className="w-4 h-4 text-green-500 mr-2 mt-0.5 flex-shrink-0" />
                    <span className="text-sm">Tax automation & reporting</span>
                  </div>
                  <div className="flex items-start">
                    <CheckCircle className="w-4 h-4 text-green-500 mr-2 mt-0.5 flex-shrink-0" />
                    <span className="text-sm">Guest analytics & insights</span>
                  </div>
                  <div className="flex items-start">
                    <CheckCircle className="w-4 h-4 text-green-500 mr-2 mt-0.5 flex-shrink-0" />
                    <span className="text-sm">Seasonal trend analysis</span>
                  </div>
                  <div className="flex items-start">
                    <CheckCircle className="w-4 h-4 text-green-500 mr-2 mt-0.5 flex-shrink-0" />
                    <span className="text-sm">Priority support</span>
                  </div>
                </div>
                <Link to="/signup" className="block w-full py-3 bg-gradient-to-r from-blue-600 to-blue-700 text-white rounded-full hover:shadow-lg transition-all transform hover:scale-105 font-medium">
                  Start Free Trial
                </Link>
              </div>
            </div>
            
            {/* Enterprise */}
            <div className="relative bg-white rounded-2xl shadow-lg p-8 border border-gray-200">
              <h3 className="text-lg font-semibold mb-4">Enterprise</h3>
              <div className="text-4xl font-bold mb-2">
                Custom
              </div>
              <p className="text-gray-600 mb-6">Unlimited properties</p>
              <div className="space-y-3 mb-8 text-left">
                <div className="flex items-start">
                  <CheckCircle className="w-4 h-4 text-green-500 mr-2 mt-0.5 flex-shrink-0" />
                  <span className="text-sm font-medium">Everything in Professional</span>
                </div>
                <div className="flex items-start">
                  <CheckCircle className="w-4 h-4 text-green-500 mr-2 mt-0.5 flex-shrink-0" />
                  <span className="text-sm">Custom integrations</span>
                </div>
                <div className="flex items-start">
                  <CheckCircle className="w-4 h-4 text-green-500 mr-2 mt-0.5 flex-shrink-0" />
                  <span className="text-sm">Advanced API access</span>
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
              <button className="block w-full py-3 bg-gray-900 text-white rounded-full hover:bg-gray-800 transition-colors font-medium">
                Contact Sales
              </button>
            </div>
          </div>
          
          <p className="text-sm text-gray-500 mt-8">All plans include 14-day free trial. No credit card required.</p>
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
            <span>99.9% uptime</span>
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
            Stop guessing. Start knowing. Transform your data today.
          </p>
          {!isAuthenticated && (
            <Link to="/signup" className="inline-flex items-center px-8 py-4 bg-white text-blue-600 rounded-full text-lg font-bold hover:shadow-xl transition-all transform hover:scale-105">
              Get Started Free
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