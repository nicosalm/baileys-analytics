import { DocsLayout } from '@/components/DocsLayout'
import { usePageTitle } from '@/hooks/use-page-title'
import { Link } from 'react-router-dom'

const SLink = ({ tab, children }: { tab: string; children: React.ReactNode }) => (
  <Link to={`/settings?tab=${tab}`} className="text-primary hover:text-primary/80">{children}</Link>
)

export const OwnerRezDataGuide = () => {
  usePageTitle('Data Guide')
  return (
    <DocsLayout>
      <div className="prose prose-gray max-w-none">
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-foreground mb-1">OwnerRez Data Guide</h1>
          <p className="text-muted-foreground text-sm">What is synced, how updates work, and what requires manual configuration.</p>
        </div>

        {/* what we sync */}
        <section className="mb-8">
          <h2 className="text-lg font-semibold text-foreground mb-4">Synced Data</h2>

          <p className="text-muted-foreground text-sm mb-4">
            The following data is imported from your OwnerRez account and kept current via webhooks.
          </p>

          <div className="space-y-6">
            <div>
              <h3 className="text-sm font-semibold text-foreground mb-2">Properties</h3>
              <ul className="text-muted-foreground space-y-1 list-disc ml-6 text-sm">
                <li>Name, address, bedrooms, bathrooms, max guests</li>
                <li>GPS coordinates</li>
                <li>Active/inactive status</li>
                <li>Property tags</li>
              </ul>
            </div>

            <div>
              <h3 className="text-sm font-semibold text-foreground mb-2">Bookings</h3>
              <ul className="text-muted-foreground space-y-1 list-disc ml-6 text-sm">
                <li>Dates, guest count, and status</li>
                <li>Charge breakdowns and financial data</li>
                <li>Guest name, email, and phone</li>
                <li>Booking source (Airbnb, Vrbo, Direct, etc.)</li>
                <li>Platform reservation numbers</li>
                <li>Tags and line-item charges</li>
              </ul>
            </div>

            <div>
              <h3 className="text-sm font-semibold text-foreground mb-2">Guests</h3>
              <ul className="text-muted-foreground space-y-1 list-disc ml-6 text-sm">
                <li>Contact information and tags</li>
                <li>Booking history and repeat guest tracking</li>
              </ul>
            </div>

            <div>
              <h3 className="text-sm font-semibold text-foreground mb-2">Blocks</h3>
              <ul className="text-muted-foreground space-y-1 list-disc ml-6 text-sm">
                <li>Owner blocks and unavailable periods</li>
                <li>Block type, reason, and dates</li>
              </ul>
            </div>
          </div>
        </section>

        {/* what we don't sync */}
        <section className="mb-8">
          <h2 className="text-lg font-semibold text-foreground mb-4">Manual Configuration</h2>
          <p className="text-muted-foreground text-sm mb-4">
            The following data is not available through the OwnerRez API and must be entered manually:
          </p>
          <ul className="text-muted-foreground space-y-1 list-disc ml-6 text-sm">
            <li>Operating expenses (cleaning, maintenance, etc.) in <SLink tab="expenses">Settings → Expenses</SLink></li>
          </ul>
          <p className="text-muted-foreground text-sm mt-4">
            Host service fees are imported from OwnerRez booking data. Guest service fees are estimated (Vrbo ~8%, Airbnb ~14% pre-Oct 2025, 0% after) until OwnerRez exposes them via their API. Booking.com and direct bookings have no guest fee. All estimated figures are marked "(est.)" in the dashboard. Net revenue calculations also require operating expenses to be configured.
          </p>
        </section>

        {/* real-time webhooks */}
        <section className="mb-8">
          <h2 className="text-lg font-semibold text-foreground mb-4">Real-Time Updates</h2>

          <p className="text-muted-foreground text-sm mb-4">
            OwnerRez webhooks push changes to Baileys Analytics as they happen. No action is required on your part.
          </p>

          <h3 className="text-sm font-semibold text-foreground mb-2">Events that trigger automatic updates</h3>
          <ul className="text-muted-foreground space-y-1 list-disc ml-6 text-sm">
            <li>New bookings confirmed in OwnerRez</li>
            <li>Date changes and guest info edits</li>
            <li>Cancellations</li>
            <li>Property name, status, and tag changes</li>
            <li>Guest contact info updates</li>
          </ul>
        </section>

        {/* initial sync */}
        <section className="mb-8">
          <h2 className="text-lg font-semibold text-foreground mb-4">Initial Sync</h2>

          <p className="text-muted-foreground text-sm mb-4">
            On first connection, the system imports 4 years of historical bookings and 1 year of future bookings. This typically takes 2 to 5 minutes.
          </p>

          <p className="text-muted-foreground text-sm">
            All subsequent updates are handled by webhooks.
          </p>
        </section>

        {/* manual sync */}
        <section className="mb-8">
          <h2 className="text-lg font-semibold text-foreground mb-4">Manual Sync</h2>

          <p className="text-muted-foreground text-sm mb-4">
            Webhooks handle most updates automatically. If needed, you can trigger a manual sync from <SLink tab="integrations">Settings → Integrations</SLink>:
          </p>

          <ul className="text-muted-foreground space-y-1 list-disc ml-6 text-sm">
            <li><strong>Re-sync All Data</strong> re-imports all properties and bookings</li>
            <li><strong>Guest Details Sync</strong> backfills missing contact information</li>
          </ul>

          <p className="text-muted-foreground text-sm mt-4">
            Manual syncing is rarely needed. Use it if data appears stale or incomplete.
          </p>
        </section>

        {/* security */}
        <section className="mb-8">
          <h2 className="text-lg font-semibold text-foreground mb-4">Security & Privacy</h2>

          <ul className="text-muted-foreground space-y-1 list-disc ml-6 text-sm">
            <li>Connection uses OAuth. Your OwnerRez password is never stored.</li>
            <li>All data transfers are encrypted over HTTPS.</li>
            <li>Row-level security isolates your data from other accounts.</li>
            <li>Webhooks are authenticated to prevent unauthorized access.</li>
            <li>You can disconnect at any time from <SLink tab="integrations">Settings → Integrations</SLink>.</li>
          </ul>
        </section>

        {/* troubleshooting */}
        <section>
          <h2 className="text-lg font-semibold text-foreground mb-4">Troubleshooting</h2>

          <div className="space-y-4">
            <div>
              <h3 className="text-sm font-semibold text-foreground mb-1">No data showing</h3>
              <p className="text-muted-foreground text-sm">
                Check your connection status in <SLink tab="integrations">Settings → Integrations</SLink>. If disconnected, reconnect and allow the initial sync to complete.
              </p>
            </div>

            <div>
              <h3 className="text-sm font-semibold text-foreground mb-1">Missing guest contact info</h3>
              <p className="text-muted-foreground text-sm">
                Run a Guest Details Sync from <SLink tab="integrations">Settings → Integrations</SLink>. OwnerRez stores guest contact details separately from booking records.
              </p>
            </div>

            <div>
              <h3 className="text-sm font-semibold text-foreground mb-1">Data appears outdated</h3>
              <p className="text-muted-foreground text-sm">
                Check webhook status in <SLink tab="integrations">Settings → Integrations</SLink>. If webhooks are inactive, use "Re-sync All Data" to refresh.
              </p>
            </div>
          </div>

          <div className="mt-6 pt-6 border-t">
            <p className="text-muted-foreground text-sm">
              Questions? Contact us at <a href="mailto:support@baileysanalytics.com" className="text-primary hover:text-primary/80">support@baileysanalytics.com</a> or
              visit the <Link to="/help" className="text-primary hover:text-primary/80">Help Center</Link>.
            </p>
          </div>
        </section>
      </div>
    </DocsLayout>
  )
}
