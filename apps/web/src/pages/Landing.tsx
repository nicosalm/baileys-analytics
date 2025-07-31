import { Link } from 'react-router-dom'
import { useAuth } from '@/contexts/auth'

export const Landing = () => {
  const { state } = useAuth()
  const isAuthenticated = state.status === 'authenticated'

  return (
    <div className="min-h-screen">
      <nav className="p-4 border-b">
        <div className="max-w-6xl mx-auto flex justify-between items-center">
          <h1 className="text-xl font-bold">Baileys Analytics</h1>
          <div className="space-x-4">
            {isAuthenticated ? (
              <Link to="/dashboard" className="px-4 py-2 bg-blue-600 text-white rounded">
                Dashboard
              </Link>
            ) : (
              <>
                <Link to="/login" className="px-4 py-2">Login</Link>
                <Link to="/signup" className="px-4 py-2 bg-blue-600 text-white rounded">
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
            Comprehensive Analytics for Vacation Rentals
          </h2>
          <p className="text-xl text-gray-600 mb-8">
            Connect your OwnerRez account for automated tax reporting, property insights, and revenue analytics
          </p>
          {!isAuthenticated && (
            <Link to="/signup" className="px-6 py-3 bg-blue-600 text-white rounded text-lg">
              Get Started Free
            </Link>
          )}
        </section>

        <section className="grid md:grid-cols-3 gap-8 mb-16">
          <div className="p-6 border rounded">
            <h3 className="text-xl font-bold mb-2">Tax Reporting</h3>
            <p className="text-gray-600">
              Automated tax calculations by property and month with CSV export
            </p>
          </div>
          <div className="p-6 border rounded">
            <h3 className="text-xl font-bold mb-2">Property Analytics</h3>
            <p className="text-gray-600">
              Compare performance, occupancy rates, and revenue across properties
            </p>
          </div>
          <div className="p-6 border rounded">
            <h3 className="text-xl font-bold mb-2">Revenue Tracking</h3>
            <p className="text-gray-600">
              Monitor income by source, track trends, and identify growth opportunities
            </p>
          </div>
          <div className="p-6 border rounded">
            <h3 className="text-xl font-bold mb-2">Occupancy Insights</h3>
            <p className="text-gray-600">
              Visualize booking patterns and optimize pricing for peak seasons
            </p>
          </div>
          <div className="p-6 border rounded">
            <h3 className="text-xl font-bold mb-2">Automated Sync</h3>
            <p className="text-gray-600">
              Properties and bookings sync automatically every 12 hours
            </p>
          </div>
          <div className="p-6 border rounded">
            <h3 className="text-xl font-bold mb-2">Multi-Property Support</h3>
            <p className="text-gray-600">
              Manage unlimited properties with tenant-isolated data
            </p>
          </div>
        </section>

        <section className="mb-16 bg-gray-50 p-8 rounded-lg">
          <h3 className="text-2xl font-bold mb-6 text-center">Powerful Dashboard Features</h3>
          <div className="grid md:grid-cols-2 gap-6">
            <div>
              <h4 className="font-bold mb-2">Advanced Filtering</h4>
              <p className="text-gray-600">Filter by date ranges, properties, and custom tags</p>
            </div>
            <div>
              <h4 className="font-bold mb-2">Visual Analytics</h4>
              <p className="text-gray-600">Interactive charts for trends, comparisons, and distributions</p>
            </div>
            <div>
              <h4 className="font-bold mb-2">Real-Time Calculations</h4>
              <p className="text-gray-600">Accurate metrics updated with every sync</p>
            </div>
            <div>
              <h4 className="font-bold mb-2">Export Ready</h4>
              <p className="text-gray-600">Download reports for tax filing and analysis</p>
            </div>
          </div>
        </section>

        <section className="text-center">
          <h3 className="text-2xl font-bold mb-4">Simple Pricing</h3>
          <div className="max-w-sm mx-auto p-8 border rounded">
            <div className="text-3xl font-bold mb-2">$20/month</div>
            <p className="text-gray-600 mb-6">Unlimited properties and reports</p>
            {!isAuthenticated && (
              <Link to="/signup" className="block w-full py-2 bg-blue-600 text-white rounded">
                Start Free Trial
              </Link>
            )}
          </div>
        </section>
      </main>
    </div>
  )
}
