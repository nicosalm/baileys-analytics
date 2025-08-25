import { Link } from 'react-router-dom'
import { useAuth } from '@/contexts/auth'
import { Footer } from '@/components/Footer'

export const Landing = () => {
  const { state } = useAuth()
  const isAuthenticated = state.status === 'authenticated'

  return (
    <div className="min-h-screen flex flex-col">
      <nav className="p-4 border-b">
        <div className="max-w-6xl mx-auto flex justify-between items-center">
          <h1 className="text-xl font-bold">Baileys Analytics</h1>
          <div className="space-x-4">
            {isAuthenticated ? (
              <Link to="/dashboard/overview" className="px-4 py-2 bg-blue-600 text-white rounded-sm hover:bg-blue-700 transition-colors">
                Dashboard
              </Link>
            ) : (
              <>
                <Link to="/login" className="px-4 py-2 hover:text-blue-600 transition-colors">Login</Link>
                <Link to="/signup" className="px-4 py-2 bg-blue-600 text-white rounded-sm hover:bg-blue-700 transition-colors">
                  Sign Up
                </Link>
              </>
            )}
          </div>
        </div>
      </nav>

      <main className="max-w-6xl mx-auto p-4 py-16">
        <section className="text-center mb-16">
          <h2 className="text-4xl font-bold mb-4">
            Advanced Analytics Suite for Vacation Rental Professionals
          </h2>
          <p className="text-xl text-gray-600 mb-8">
            Connect your OwnerRez account for comprehensive financial reporting, guest insights, and revenue optimization
          </p>
          {!isAuthenticated && (
            <Link to="/signup" className="px-6 py-3 bg-blue-600 text-white rounded-sm text-lg hover:bg-blue-700 transition-colors">
              Get Started Free
            </Link>
          )}
        </section>

        <section className="grid md:grid-cols-3 gap-8 mb-16">
          <div className="p-6 border rounded-sm hover:shadow-lg transition-shadow">
            <h3 className="text-xl font-bold mb-2">Financial Dashboard</h3>
            <p className="text-gray-600">
              Complete P&L statements, cash flow analysis, expense tracking, and platform fee breakdowns
            </p>
          </div>
          <div className="p-6 border rounded-sm hover:shadow-lg transition-shadow">
            <h3 className="text-xl font-bold mb-2">Tax Reporting</h3>
            <p className="text-gray-600">
              Automated tax calculations with effective rate analysis and CSV export for easy filing
            </p>
          </div>
          <div className="p-6 border rounded-sm hover:shadow-lg transition-shadow">
            <h3 className="text-xl font-bold mb-2">Guest Analytics</h3>
            <p className="text-gray-600">
              Track repeat guests, analyze spending patterns, and identify top performers by source
            </p>
          </div>
          <div className="p-6 border rounded-sm hover:shadow-lg transition-shadow">
            <h3 className="text-xl font-bold mb-2">Seasonal Intelligence</h3>
            <p className="text-gray-600">
              Year-over-year comparisons, peak season identification, and dynamic pricing recommendations
            </p>
          </div>
          <div className="p-6 border rounded-sm hover:shadow-lg transition-shadow">
            <h3 className="text-xl font-bold mb-2">Property Performance</h3>
            <p className="text-gray-600">
              Compare metrics across properties with radar charts and occupancy heat maps
            </p>
          </div>
          <div className="p-6 border rounded-sm hover:shadow-lg transition-shadow">
            <h3 className="text-xl font-bold mb-2">Revenue Optimization</h3>
            <p className="text-gray-600">
              Track income by platform, identify underpriced periods, and maximize RevPAR
            </p>
          </div>
        </section>

        <section className="mb-16 bg-gray-50 p-8 rounded-lg">
          <h3 className="text-2xl font-bold mb-6 text-center">Enterprise-Grade Dashboard Features</h3>
          <div className="grid md:grid-cols-2 gap-6">
            <div>
              <h4 className="font-bold mb-2">Advanced Filtering & Tagging</h4>
              <p className="text-gray-600">Filter by date ranges, properties, and custom tags with persistent preferences</p>
            </div>
            <div>
              <h4 className="font-bold mb-2">Interactive Visualizations</h4>
              <p className="text-gray-600">Drill-down charts, trend analysis, and comparative views with real-time updates</p>
            </div>
            <div>
              <h4 className="font-bold mb-2">Financial Health Scoring</h4>
              <p className="text-gray-600">Automated scoring for liquidity, efficiency, profitability, and growth metrics</p>
            </div>
            <div>
              <h4 className="font-bold mb-2">Platform Analysis</h4>
              <p className="text-gray-600">Compare performance across Airbnb, VRBO, and direct bookings</p>
            </div>
            <div>
              <h4 className="font-bold mb-2">Automated Sync</h4>
              <p className="text-gray-600">Properties and bookings sync automatically every 12 hours</p>
            </div>
            <div>
              <h4 className="font-bold mb-2">Export & Integration</h4>
              <p className="text-gray-600">CSV exports for all reports, budget vs actual tracking, and tax-ready formats</p>
            </div>
          </div>
        </section>

        <section className="mb-16">
          <h3 className="text-2xl font-bold mb-6 text-center">Key Performance Metrics</h3>
          <div className="grid md:grid-cols-4 gap-4 text-center">
            <div className="p-4 bg-white border rounded-sm">
              <div className="text-3xl font-bold text-blue-600">RevPAR</div>
              <p className="text-sm text-gray-600">Revenue per available room</p>
            </div>
            <div className="p-4 bg-white border rounded-sm">
              <div className="text-3xl font-bold text-green-600">GOPPAR</div>
              <p className="text-sm text-gray-600">Gross operating profit per room</p>
            </div>
            <div className="p-4 bg-white border rounded-sm">
              <div className="text-3xl font-bold text-purple-600">ROI</div>
              <p className="text-sm text-gray-600">Return on investment tracking</p>
            </div>
            <div className="p-4 bg-white border rounded-sm">
              <div className="text-3xl font-bold text-orange-600">EBITDA</div>
              <p className="text-sm text-gray-600">Earnings analysis</p>
            </div>
          </div>
        </section>

        <section className="text-center">
          <h3 className="text-2xl font-bold mb-4">Simple, Transparent Pricing</h3>
          <div className="max-w-sm mx-auto p-8 border rounded-sm hover:shadow-lg transition-shadow">
            <div className="text-3xl font-bold mb-2">$20/month</div>
            <p className="text-gray-600 mb-6">Unlimited properties and reports</p>
            <ul className="text-left text-sm text-gray-600 mb-6 space-y-2">
              <li>✓ All dashboard features included</li>
              <li>✓ Unlimited CSV exports</li>
              <li>✓ Automatic OwnerRez sync</li>
              <li>✓ Historical data analysis</li>
              <li>✓ Email support</li>
            </ul>
            {!isAuthenticated && (
              <Link to="/signup" className="block w-full py-2 bg-blue-600 text-white rounded-sm hover:bg-blue-700 transition-colors">
                Start 14-Day Free Trial
              </Link>
            )}
          </div>
        </section>

        <section className="mt-16 text-center text-gray-600">
          <p className="mb-2">Built specifically for OwnerRez users</p>
          <p className="text-sm">Secure, tenant-isolated data with automatic backups</p>
        </section>
      </main>
      <Footer />
    </div>
  )
}
