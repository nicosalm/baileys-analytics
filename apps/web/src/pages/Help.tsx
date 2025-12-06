import { DocsLayout } from '@/components/DocsLayout'
import { Link } from 'react-router-dom'

export const Help = () => {
  return (
    <DocsLayout>
      <div className="prose prose-gray max-w-none">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-gray-900 mb-1">Help & FAQ</h1>
          <p className="text-gray-500 text-sm">Common questions and quick answers</p>
        </div>

        {/* quick links */}
        <div className="bg-blue-50 border border-blue-100 rounded-xl p-4 mb-8">
          <h2 className="text-sm font-medium text-blue-900 mb-2 mt-0">Quick Links</h2>
          <div className="grid md:grid-cols-2 gap-1.5">
            <Link to="/docs/ownerrez-data" className="text-blue-700 hover:text-blue-800 text-sm">
              → What data we sync from OwnerRez
            </Link>
            <Link to="/settings" className="text-blue-700 hover:text-blue-800 text-sm">
              → Manage your subscription
            </Link>
            <a href="https://status.baileysanalytics.com" target="_blank" rel="noopener noreferrer" className="text-blue-700 hover:text-blue-800 text-sm">
              → System status page
            </a>
            <a href="mailto:support@baileysanalytics.com" className="text-blue-700 hover:text-blue-800 text-sm">
              → Contact support
            </a>
          </div>
        </div>

        {/* getting started */}
        <section className="mb-8">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Getting Started</h2>

          <div className="space-y-6">
            <div className="pb-4 border-b border-gray-100 last:border-0 last:pb-0">
              <h3 className="text-sm font-semibold text-gray-900 mb-1">How do I connect OwnerRez?</h3>
              <p className="text-gray-700 text-sm mb-2">
                1. Go to <strong>Settings → Integrations</strong><br />
                2. Click <strong>"Connect to OwnerRez"</strong><br />
                3. Log in to your OwnerRez account and authorize the connection<br />
                4. Wait 2-5 minutes for initial data sync to complete
              </p>
              <p className="text-gray-600 text-sm">
                The connection uses OAuth, so we never see your OwnerRez password.
              </p>
            </div>

            <div className="pb-4 border-b border-gray-100 last:border-0 last:pb-0">
              <h3 className="text-sm font-semibold text-gray-900 mb-1">How long does the first sync take?</h3>
              <p className="text-gray-700 text-sm">
                Initial sync typically takes <strong>2-5 minutes</strong>. We import 3 years of historical bookings plus 1 year of future bookings.
                You can watch the progress in real-time after connecting.
              </p>
            </div>

            <div className="pb-4 border-b border-gray-100 last:border-0 last:pb-0">
              <h3 className="text-sm font-semibold text-gray-900 mb-1">Is my data automatically updated?</h3>
              <p className="text-gray-700 text-sm">
                After initial sync, Baileys Analytics uses webhooks to receive real-time updates from OwnerRez.
                When you create, update, or cancel a booking in OwnerRez, it appears in your dashboard within seconds.
              </p>
            </div>
          </div>
        </section>

        {/* data & syncing */}
        <section className="mb-8">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Data & Syncing</h2>

          <div className="space-y-6">
            <div className="pb-4 border-b border-gray-100 last:border-0 last:pb-0">
              <h3 className="text-sm font-semibold text-gray-900 mb-1">Why isn't my data showing?</h3>
              <p className="text-gray-700 text-sm mb-2">
                Check these common issues:
              </p>
              <ul className="text-gray-700 text-sm list-disc ml-6 space-y-1">
                <li>Verify you're connected to OwnerRez (Settings → Integrations)</li>
                <li>Check if initial sync completed successfully</li>
                <li>Try manually re-syncing data from Settings → Integrations</li>
                <li>Ensure your OwnerRez account has properties and bookings</li>
              </ul>
            </div>

            <div className="pb-4 border-b border-gray-100 last:border-0 last:pb-0">
              <h3 className="text-sm font-semibold text-gray-900 mb-1">Why is guest contact information missing?</h3>
              <p className="text-gray-700 text-sm">
                OwnerRez stores guest contact info separately from bookings. Run <strong>Guest Details Sync</strong> from
                Settings → Integrations to backfill missing email addresses and phone numbers.
              </p>
            </div>

            <div className="pb-4 border-b border-gray-100 last:border-0 last:pb-0">
              <h3 className="text-sm font-semibold text-gray-900 mb-1">What data do you sync from OwnerRez?</h3>
              <p className="text-gray-700 text-sm">
                We sync properties, bookings, guests, tags, and blocks/unavailable periods. See our complete
                <Link to="/docs/ownerrez-data" className="text-blue-600 hover:text-blue-700 ml-1">OwnerRez Data Guide</Link> for
                a detailed breakdown.
              </p>
            </div>

            <div className="pb-4 border-b border-gray-100 last:border-0 last:pb-0">
              <h3 className="text-sm font-semibold text-gray-900 mb-1">How do I manually sync my data?</h3>
              <p className="text-gray-700 text-sm">
                Go to <strong>Settings → Integrations</strong> and click <strong>"Re-sync All Data"</strong>. This refreshes
                all properties and bookings from OwnerRez.
              </p>
            </div>
          </div>
        </section>

        {/* billing & subscription */}
        <section className="mb-8">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Billing & Subscription</h2>

          <div className="space-y-6">
            <div className="pb-4 border-b border-gray-100 last:border-0 last:pb-0">
              <h3 className="text-sm font-semibold text-gray-900 mb-1">How much does Baileys Analytics cost?</h3>
              <p className="text-gray-700 text-sm mb-2">
                <strong>Trial:</strong> $1 for the first 30 days<br />
                <strong>After trial:</strong> $20/month or $192/year (20% discount)
              </p>
              <p className="text-gray-600 text-sm">
                Includes unlimited properties, reports, and data exports.
              </p>
            </div>

            <div className="pb-4 border-b border-gray-100 last:border-0 last:pb-0">
              <h3 className="text-sm font-semibold text-gray-900 mb-1">How do I cancel my subscription?</h3>
              <p className="text-gray-700 text-sm mb-2">
                1. Go to <strong>Settings → Billing</strong><br />
                2. Click <strong>"Manage Subscription"</strong><br />
                3. Click <strong>"Cancel Subscription"</strong> in the Stripe customer portal
              </p>
              <p className="text-gray-600 text-sm">
                Your access continues until the end of your current billing period. You can cancel anytime.
              </p>
            </div>

            <div className="pb-4 border-b border-gray-100 last:border-0 last:pb-0">
              <h3 className="text-sm font-semibold text-gray-900 mb-1">Can I switch between monthly and yearly billing?</h3>
              <p className="text-gray-700 text-sm">
                Yes! Go to <strong>Settings → Billing</strong> and click <strong>"Manage Subscription"</strong> to change your billing cycle.
                You'll get a prorated credit or charge based on the switch.
              </p>
            </div>

            <div className="pb-4 border-b border-gray-100 last:border-0 last:pb-0">
              <h3 className="text-sm font-semibold text-gray-900 mb-1">Do you offer refunds?</h3>
              <p className="text-gray-700 text-sm">
                All payments are non-refundable. The 30-day $1 trial allows you to evaluate the full platform
                before committing to regular pricing.
              </p>
            </div>

            <div className="pb-4 border-b border-gray-100 last:border-0 last:pb-0">
              <h3 className="text-sm font-semibold text-gray-900 mb-1">Are there any usage limits?</h3>
              <p className="text-gray-700 text-sm">
                Your subscription includes unlimited properties, bookings, reports, and API calls.
              </p>
            </div>
          </div>
        </section>

        {/* features */}
        <section className="mb-8">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Features</h2>

          <div className="space-y-6">
            <div className="pb-4 border-b border-gray-100 last:border-0 last:pb-0">
              <h3 className="text-sm font-semibold text-gray-900 mb-1">How do I configure tax rates?</h3>
              <p className="text-gray-700 text-sm">
                Go to <strong>Settings → Tax & Fees</strong> to add property tax rates and platform fees. This helps calculate accurate
                net revenue after taxes and platform commissions.
              </p>
            </div>

            <div className="pb-4 border-b border-gray-100 last:border-0 last:pb-0">
              <h3 className="text-sm font-semibold text-gray-900 mb-1">How do seasons work?</h3>
              <p className="text-gray-700 text-sm">
                Seasons let you filter data by custom date ranges (e.g., "Summer 2024", "Winter Ski Season"). Create seasons in
                <strong> Settings → Seasons</strong>, then select them from the dashboard filter bar to analyze performance for specific periods.
              </p>
            </div>

            <div className="pb-4 border-b border-gray-100 last:border-0 last:pb-0">
              <h3 className="text-sm font-semibold text-gray-900 mb-1">Can I export my data?</h3>
              <p className="text-gray-700 text-sm">
                Yes! Use the <strong>Reports</strong> feature to generate PDF exports of your analytics. You can also export your
                complete data as JSON from Settings → Account (GDPR compliance).
              </p>
            </div>

            <div className="pb-4 border-b border-gray-100 last:border-0 last:pb-0">
              <h3 className="text-sm font-semibold text-gray-900 mb-1">What if I disconnect OwnerRez?</h3>
              <p className="text-gray-700 text-sm">
                You can disconnect anytime from <strong>Settings → Integrations</strong>. Your existing data remains in Baileys Analytics,
                but new bookings won't sync until you reconnect. We'll revoke our OAuth access to your OwnerRez account.
              </p>
            </div>
          </div>
        </section>

        {/* security & privacy */}
        <section className="mb-8">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Security & Privacy</h2>

          <div className="space-y-6">
            <div className="pb-4 border-b border-gray-100 last:border-0 last:pb-0">
              <h3 className="text-sm font-semibold text-gray-900 mb-1">Is my data secure?</h3>
              <p className="text-gray-700 text-sm mb-2">
                Yes. We use enterprise-grade security:
              </p>
              <ul className="text-gray-700 text-sm list-disc ml-6 space-y-1">
                <li>OAuth authentication (we never see your OwnerRez password)</li>
                <li>All connections encrypted with HTTPS/TLS</li>
                <li>Database hosted on Supabase (SOC 2 compliant)</li>
                <li>Row-level security ensures your data is isolated from other users</li>
              </ul>
            </div>

            <div className="pb-4 border-b border-gray-100 last:border-0 last:pb-0">
              <h3 className="text-sm font-semibold text-gray-900 mb-1">How do I delete my account?</h3>
              <p className="text-gray-700 text-sm">
                Go to <strong>Settings → Account</strong> and click <strong>"Delete Account"</strong>. This permanently deletes all your data,
                cancels your subscription, and revokes OwnerRez access.
              </p>
            </div>

            <div className="pb-4 border-b border-gray-100 last:border-0 last:pb-0">
              <h3 className="text-sm font-semibold text-gray-900 mb-1">Where is my data stored?</h3>
              <p className="text-gray-700 text-sm">
                Your data is stored in Supabase (PostgreSQL database) hosted in the United States. See our
                <Link to="/privacy" className="text-blue-600 hover:text-blue-700 ml-1">Privacy Policy</Link> for complete details.
              </p>
            </div>
          </div>
        </section>

        {/* contact */}
        <section className="pt-6 border-t border-gray-200">
          <h2 className="text-lg font-semibold text-gray-900 mb-3">Still Need Help?</h2>
          <p className="text-gray-600 text-sm mb-4">
            Can't find what you're looking for?
          </p>
          <div className="flex flex-col sm:flex-row gap-2">
            <a
              href="mailto:support@baileysanalytics.com"
              className="inline-flex items-center justify-center px-4 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 transition-colors"
            >
              Email Support
            </a>
            <a
              href="https://status.baileysanalytics.com"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center justify-center px-4 py-2 bg-white border border-gray-200 text-gray-700 text-sm rounded-lg hover:bg-gray-50 transition-colors"
            >
              Check System Status
            </a>
          </div>
        </section>
      </div>
    </DocsLayout>
  )
}
