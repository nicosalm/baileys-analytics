import { DocsLayout } from '@/components/DocsLayout'
import { Link } from 'react-router-dom'

export const OwnerRezDataGuide = () => {
  return (
    <DocsLayout>
      <div className="prose prose-gray max-w-none">
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-gray-900 mb-1">OwnerRez Data Guide</h1>
          <p className="text-gray-500 text-sm">What data we sync, how it works, and how to keep everything up to date</p>
        </div>

        {/* overview */}
        <div className="bg-blue-50 border border-blue-100 rounded-xl p-4 mb-8">
          <h2 className="text-sm font-medium text-blue-900 mb-1 mt-0">How It Works</h2>
          <p className="text-blue-800 text-sm mb-0">
            Baileys Analytics connects to your OwnerRez account via OAuth and syncs data using webhooks.
            After the initial connection, updates sync automatically.
          </p>
        </div>

        {/* what we sync */}
        <section className="mb-8">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">What We Sync from OwnerRez</h2>

          <div className="space-y-6">
            <div>
              <h3 className="text-sm font-semibold text-gray-900 mb-2">Properties</h3>
              <ul className="text-gray-600 space-y-1 list-disc ml-6 text-sm">
                <li>Property details (name, address, bedrooms, bathrooms, max guests)</li>
                <li>Location data (city, state, postal code, GPS coordinates)</li>
                <li>Property status (active/inactive)</li>
                <li>Property tags (synced automatically via webhooks)</li>
              </ul>
            </div>

            <div>
              <h3 className="text-sm font-semibold text-gray-900 mb-2">Bookings</h3>
              <ul className="text-gray-600 space-y-1 list-disc ml-6 text-sm">
                <li>Reservation details (arrival, departure, guest count)</li>
                <li>Financial data (total amount, platform fees, charge breakdowns)</li>
                <li>Guest information (name, email, phone)</li>
                <li>Booking status (confirmed, canceled, pending)</li>
                <li>Booking source (Airbnb, Vrbo, Booking.com, Direct, etc.)</li>
                <li>Platform reservation numbers</li>
                <li>Booking tags (synced automatically)</li>
                <li>Line-item charges (rent, cleaning fees, taxes, add-ons)</li>
              </ul>
            </div>

            <div>
              <h3 className="text-sm font-semibold text-gray-900 mb-2">Guests</h3>
              <ul className="text-gray-600 space-y-1 list-disc ml-6 text-sm">
                <li>Contact information (name, email, phone)</li>
                <li>Guest tags (synced automatically)</li>
                <li>Booking history and repeat guest tracking</li>
              </ul>
            </div>

            <div>
              <h3 className="text-sm font-semibold text-gray-900 mb-2">Blocks & Unavailable Periods</h3>
              <ul className="text-gray-600 space-y-1 list-disc ml-6 text-sm">
                <li>Owner blocks and unavailable periods</li>
                <li>Block type and reason</li>
                <li>Block dates (arrival, departure)</li>
              </ul>
            </div>
          </div>
        </section>

        {/* real-time webhooks */}
        <section className="mb-8">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Real-Time Data Updates</h2>

          <p className="text-gray-600 text-sm mb-4">
            Baileys Analytics uses OwnerRez webhooks to stay in sync. When data changes in OwnerRez,
            your dashboard updates automatically.
          </p>

          <h3 className="text-sm font-semibold text-gray-900 mb-2">What Gets Updated Automatically</h3>
          <ul className="text-gray-600 space-y-1 list-disc ml-6 text-sm">
            <li><strong>New bookings</strong> - appear when confirmed in OwnerRez</li>
            <li><strong>Booking updates</strong> - date changes, guest info edits</li>
            <li><strong>Cancellations</strong> - reflected in your dashboard</li>
            <li><strong>Property changes</strong> - name, status, tags</li>
            <li><strong>Guest info</strong> - updates apply to associated bookings</li>
          </ul>
        </section>

        {/* initial sync */}
        <section className="mb-8">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Initial Data Sync</h2>

          <p className="text-gray-600 text-sm mb-4">
            When you first connect your OwnerRez account, we perform an initial sync:
          </p>

          <ul className="text-gray-600 space-y-1 list-disc ml-6 mb-4 text-sm">
            <li><strong>3 years</strong> of historical bookings</li>
            <li><strong>1 year</strong> of future bookings</li>
            <li>Typically completes in <strong>2-5 minutes</strong></li>
          </ul>

          <p className="text-gray-600 text-sm">
            After initial sync completes, updates happen automatically via webhooks.
          </p>
        </section>

        {/* manual sync */}
        <section className="mb-8">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Manual Sync Options</h2>

          <p className="text-gray-600 text-sm mb-4">
            While webhooks keep your data current, you can also manually sync from Settings → Integrations:
          </p>

          <ul className="text-gray-600 space-y-1 list-disc ml-6 text-sm">
            <li><strong>Re-sync All Data</strong> - Complete refresh of all properties and bookings</li>
            <li><strong>Guest Details Sync</strong> - Update missing contact information</li>
          </ul>

          <p className="text-gray-500 text-sm mt-4">
            Note: Manual syncing is rarely needed. Use it only if you suspect data is out of sync.
          </p>
        </section>

        {/* security */}
        <section className="mb-8">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Security & Privacy</h2>

          <ul className="text-gray-600 space-y-1 list-disc ml-6 text-sm">
            <li><strong>OAuth authentication</strong> - We never store your OwnerRez password</li>
            <li><strong>Encrypted connections</strong> - All data transfers use HTTPS encryption</li>
            <li><strong>Tenant isolation</strong> - Your data is completely isolated from other users</li>
            <li><strong>Webhook authentication</strong> - Webhooks use authentication to prevent unauthorized access</li>
            <li><strong>Revocable access</strong> - Disconnect anytime from Settings → Integrations</li>
          </ul>
        </section>

        {/* troubleshooting */}
        <section>
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Troubleshooting</h2>

          <div className="space-y-4">
            <div>
              <h3 className="text-sm font-semibold text-gray-900 mb-1">"No data showing"</h3>
              <p className="text-gray-600 text-sm">
                Check your OwnerRez connection status in Settings → Integrations. If disconnected, reconnect and wait for initial sync to complete.
              </p>
            </div>

            <div>
              <h3 className="text-sm font-semibold text-gray-900 mb-1">"Missing guest contact info"</h3>
              <p className="text-gray-600 text-sm">
                Run Guest Details sync from Settings → Integrations. OwnerRez sometimes stores guest info separately from bookings.
              </p>
            </div>

            <div>
              <h3 className="text-sm font-semibold text-gray-900 mb-1">"Data seems outdated"</h3>
              <p className="text-gray-600 text-sm">
                Check the webhook status in Settings → Integrations. If webhooks aren't working, use "Re-sync All Data" to refresh your data.
              </p>
            </div>
          </div>

          <div className="mt-6 pt-6 border-t border-gray-200">
            <p className="text-gray-600 text-sm">
              Need more help? Contact us at <a href="mailto:support@baileysanalytics.com" className="text-blue-600 hover:text-blue-700">support@baileysanalytics.com</a> or
              visit the <Link to="/help" className="text-blue-600 hover:text-blue-700">Help Center</Link>.
            </p>
          </div>
        </section>
      </div>
    </DocsLayout>
  )
}
