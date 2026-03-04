import { DocsLayout } from '@/components/DocsLayout'
import { Link } from 'react-router-dom'

const SLink = ({ tab, children }: { tab: string; children: React.ReactNode }) => (
  <Link to={`/settings?tab=${tab}`} className="text-primary hover:text-primary/80">{children}</Link>
)

export const OwnerRezDataGuide = () => {
  return (
    <DocsLayout>
      <div className="prose prose-gray max-w-none">
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-foreground mb-1">OwnerRez Data Guide</h1>
          <p className="text-muted-foreground text-sm">What we sync, how updates work, and what you need to configure yourself</p>
        </div>

        {/* what we sync */}
        <section className="mb-8">
          <h2 className="text-lg font-semibold text-foreground mb-4">What We Sync</h2>

          <div className="space-y-6">
            <div>
              <h3 className="text-sm font-semibold text-foreground mb-2">Properties</h3>
              <ul className="text-muted-foreground space-y-1 list-disc ml-6 text-sm">
                <li>Name, address, bedrooms, bathrooms, max guests</li>
                <li>Location data including GPS coordinates</li>
                <li>Active/inactive status</li>
                <li>Property tags</li>
              </ul>
            </div>

            <div>
              <h3 className="text-sm font-semibold text-foreground mb-2">Bookings</h3>
              <ul className="text-muted-foreground space-y-1 list-disc ml-6 text-sm">
                <li>Dates, guest count, and status</li>
                <li>Financial data including charge breakdowns</li>
                <li>Guest name, email, and phone</li>
                <li>Booking source (Airbnb, Vrbo, Direct, etc.)</li>
                <li>Platform reservation numbers</li>
                <li>Tags and line-item charges</li>
              </ul>
            </div>

            <div>
              <h3 className="text-sm font-semibold text-foreground mb-2">Guests</h3>
              <ul className="text-muted-foreground space-y-1 list-disc ml-6 text-sm">
                <li>Contact info and tags</li>
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
          <h2 className="text-lg font-semibold text-foreground mb-4">What You'll Need to Configure</h2>
          <p className="text-muted-foreground text-sm mb-4">
            These aren't available through the OwnerRez API, so you'll set them up yourself:
          </p>
          <ul className="text-muted-foreground space-y-1 list-disc ml-6 text-sm">
            <li>Platform fees for Airbnb, Vrbo, Booking.com, etc. in <SLink tab="platform-fees">Settings → Platform Fees</SLink></li>
            <li>Operating expenses like cleaning and maintenance in <SLink tab="expenses">Settings → Expenses</SLink></li>
          </ul>
          <p className="text-muted-foreground text-sm mt-4">
            Net revenue and profit calculations depend on these being set correctly.
          </p>
        </section>

        {/* real-time webhooks */}
        <section className="mb-8">
          <h2 className="text-lg font-semibold text-foreground mb-4">Real-Time Updates</h2>

          <p className="text-muted-foreground text-sm mb-4">
            We use OwnerRez webhooks to keep your dashboard current. When something changes in OwnerRez, it shows up here automatically.
          </p>

          <h3 className="text-sm font-semibold text-foreground mb-2">What updates automatically</h3>
          <ul className="text-muted-foreground space-y-1 list-disc ml-6 text-sm">
            <li>New bookings appear when confirmed in OwnerRez</li>
            <li>Date changes and guest info edits sync over</li>
            <li>Cancellations are reflected on your dashboard</li>
            <li>Property name, status, and tag changes come through</li>
            <li>Guest info updates apply to their associated bookings</li>
          </ul>
        </section>

        {/* initial sync */}
        <section className="mb-8">
          <h2 className="text-lg font-semibold text-foreground mb-4">Initial Sync</h2>

          <p className="text-muted-foreground text-sm mb-4">
            When you first connect, we pull in 3 years of historical bookings and 1 year of future bookings. This usually takes 2-5 minutes.
          </p>

          <p className="text-muted-foreground text-sm">
            After that, everything stays up to date via webhooks.
          </p>
        </section>

        {/* manual sync */}
        <section className="mb-8">
          <h2 className="text-lg font-semibold text-foreground mb-4">Manual Sync</h2>

          <p className="text-muted-foreground text-sm mb-4">
            Webhooks handle most updates, but you can also sync manually from <SLink tab="integrations">Settings → Integrations</SLink>:
          </p>

          <ul className="text-muted-foreground space-y-1 list-disc ml-6 text-sm">
            <li>Re-sync All Data refreshes all properties and bookings</li>
            <li>Guest Details Sync backfills missing contact info</li>
          </ul>

          <p className="text-muted-foreground text-sm mt-4">
            You shouldn't need to do this often. It's there if something looks off.
          </p>
        </section>

        {/* security */}
        <section className="mb-8">
          <h2 className="text-lg font-semibold text-foreground mb-4">Security & Privacy</h2>

          <ul className="text-muted-foreground space-y-1 list-disc ml-6 text-sm">
            <li>We connect via OAuth. We never store your OwnerRez password.</li>
            <li>All data transfers are encrypted over HTTPS.</li>
            <li>Your data is isolated from other users with row-level security.</li>
            <li>Webhooks are authenticated to prevent unauthorized access.</li>
            <li>You can disconnect anytime from <SLink tab="integrations">Settings → Integrations</SLink>.</li>
          </ul>
        </section>

        {/* troubleshooting */}
        <section>
          <h2 className="text-lg font-semibold text-foreground mb-4">Troubleshooting</h2>

          <div className="space-y-4">
            <div>
              <h3 className="text-sm font-semibold text-foreground mb-1">No data showing</h3>
              <p className="text-muted-foreground text-sm">
                Check your connection status in <SLink tab="integrations">Settings → Integrations</SLink>. If it's disconnected, reconnect and wait for the initial sync to finish.
              </p>
            </div>

            <div>
              <h3 className="text-sm font-semibold text-foreground mb-1">Missing guest contact info</h3>
              <p className="text-muted-foreground text-sm">
                Run a Guest Details Sync from <SLink tab="integrations">Settings → Integrations</SLink>. OwnerRez sometimes stores guest info separately from bookings.
              </p>
            </div>

            <div>
              <h3 className="text-sm font-semibold text-foreground mb-1">Data seems outdated</h3>
              <p className="text-muted-foreground text-sm">
                Check webhook status in <SLink tab="integrations">Settings → Integrations</SLink>. If webhooks aren't working, use "Re-sync All Data" to refresh.
              </p>
            </div>
          </div>

          <div className="mt-6 pt-6 border-t">
            <p className="text-muted-foreground text-sm">
              Need help? Reach us at <a href="mailto:support@baileysanalytics.com" className="text-primary hover:text-primary/80">support@baileysanalytics.com</a> or
              visit the <Link to="/help" className="text-primary hover:text-primary/80">Help Center</Link>.
            </p>
          </div>
        </section>
      </div>
    </DocsLayout>
  )
}
