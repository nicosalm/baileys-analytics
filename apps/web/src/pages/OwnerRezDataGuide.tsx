import { DocsLayout } from '@/components/DocsLayout'
import { usePageTitle } from '@/hooks/use-page-title'
import { Link } from 'react-router-dom'

const SLink = ({ tab, children }: { tab: string; children: React.ReactNode }) => (
  <Link to={`/settings?tab=${tab}`} className="text-primary hover:text-primary/80">
    {children}
  </Link>
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

        {/* about this service */}
        <div className="mb-8 p-4 rounded-xl border border-border bg-muted/30">
          <p className="text-sm text-muted-foreground mb-2">
            Baileys Analytics is a best-effort layer on top of the OwnerRez API. We surface what OwnerRez exposes and estimate what it does
            not. What appears on your dashboard reflects both the coverage of the OwnerRez API and the quality of the data in your OwnerRez
            account.
          </p>
          <p className="text-sm text-muted-foreground">
            Where a figure is estimated rather than synced directly, it is labeled "(est.)" in the dashboard. Where manual configuration is
            required, this guide will say so.
          </p>
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

        {/* initial sync */}
        <section className="mb-8">
          <h2 className="text-lg font-semibold text-foreground mb-4">Initial Sync</h2>

          <p className="text-muted-foreground text-sm mb-4">
            On first connection, the system imports 4 years of historical bookings and 1 year of future bookings. This typically takes 2 to
            5 minutes.
          </p>

          <p className="text-muted-foreground text-sm">All subsequent updates are handled by webhooks.</p>
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

        {/* tagging */}
        <section id="tagging" className="mb-8 scroll-mt-20">
          <h2 className="text-lg font-semibold text-foreground mb-4">Tagging</h2>

          <p className="text-muted-foreground text-sm mb-4">
            Tags are imported from OwnerRez. You create and apply them inside OwnerRez, and Baileys Analytics syncs them automatically. The
            dashboard filter bar surfaces every tag across all five views, so a consistent tagging strategy is the single biggest lever for
            slicing your data the way you actually think about your portfolio.
          </p>

          <h3 className="text-sm font-semibold text-foreground mb-2">What you can tag</h3>
          <ul className="text-muted-foreground space-y-1 list-disc ml-6 text-sm mb-4">
            <li>Properties (e.g. waterfront, downtown, premium)</li>
            <li>Bookings (e.g. repeat guest, long stay, owner referral)</li>
            <li>Guests (carried through to their booking history)</li>
          </ul>

          <h3 className="text-sm font-semibold text-foreground mb-2">Tagging strategies that pay off</h3>
          <ul className="text-muted-foreground space-y-1 list-disc ml-6 text-sm mb-4">
            <li>
              <strong className="text-foreground font-medium">By location.</strong> Group properties that share a market so you can compare
              neighborhoods or regions.
            </li>
            <li>
              <strong className="text-foreground font-medium">By tier.</strong> Separate premium and standard listings to see margin
              differences without averaging them out.
            </li>
            <li>
              <strong className="text-foreground font-medium">By guest type.</strong> Tag bookings as family, business, or repeat to spot
              which segments drive the most revenue.
            </li>
            <li>
              <strong className="text-foreground font-medium">By season or campaign.</strong> Tag bookings tied to a specific promotion to
              measure its impact directly.
            </li>
            <li>
              <strong className="text-foreground font-medium">By status.</strong> Flag properties under renovation or temporarily off-market
              so they do not skew portfolio averages.
            </li>
          </ul>

          <p className="text-muted-foreground text-sm">
            Tag changes in OwnerRez sync automatically via webhook, usually within seconds. You do not need to re-sync after editing tags.
          </p>
        </section>

        {/* what we don't sync */}
        <section className="mb-8">
          <h2 className="text-lg font-semibold text-foreground mb-4">Manual Configuration</h2>
          <p className="text-muted-foreground text-sm mb-4">
            The following data is not available through the OwnerRez API and must be entered manually:
          </p>
          <ul className="text-muted-foreground space-y-1 list-disc ml-6 text-sm">
            <li>
              Operating expenses (cleaning, maintenance, etc.) in <SLink tab="expenses">Settings → Expenses</SLink>
            </li>
          </ul>
          <p className="text-muted-foreground text-sm mt-4">
            Host service fees are imported from OwnerRez booking data. Guest service fees are estimated (Vrbo ~8%, Airbnb ~14% pre-Oct 2025,
            0% after) until OwnerRez exposes them via their API. Booking.com and direct bookings have no guest fee. All estimated figures
            are marked "(est.)" in the dashboard. Net revenue calculations also require operating expenses to be configured.
          </p>
        </section>

        {/* troubleshooting */}
        <section className="mb-8">
          <h2 className="text-lg font-semibold text-foreground mb-4">Troubleshooting</h2>

          <div className="space-y-4">
            <div>
              <h3 className="text-sm font-semibold text-foreground mb-1">No data showing</h3>
              <p className="text-muted-foreground text-sm">
                Check your connection status in <SLink tab="integrations">Settings → Integrations</SLink>. If disconnected, reconnect and
                allow the initial sync to complete.
              </p>
            </div>

            <div>
              <h3 className="text-sm font-semibold text-foreground mb-1">Missing guest contact info</h3>
              <p className="text-muted-foreground text-sm">
                Guest contacts (email, phone) are synced as part of the standard guest sync. If a guest's contact info is missing, either
                they haven't provided it in OwnerRez, or their record predates your initial sync. Use "Re-sync All Data" in{' '}
                <SLink tab="integrations">Settings → Integrations</SLink> to refresh.
              </p>
            </div>

            <div>
              <h3 className="text-sm font-semibold text-foreground mb-1">Data appears outdated</h3>
              <p className="text-muted-foreground text-sm">
                Check webhook status in <SLink tab="integrations">Settings → Integrations</SLink>. If webhooks are inactive, use "Re-sync
                All Data" to refresh.
              </p>
            </div>

            <div>
              <h3 className="text-sm font-semibold text-foreground mb-1">Triggering a manual sync</h3>
              <p className="text-muted-foreground text-sm">
                Webhooks handle most updates automatically, so manual syncing is rarely needed. If something looks stale, open{' '}
                <SLink tab="integrations">Settings → Integrations</SLink> and click "Re-sync All Data" to re-import all properties and
                bookings from OwnerRez.
              </p>
            </div>
          </div>
        </section>

        {/* security */}
        <section className="mb-8">
          <h2 className="text-lg font-semibold text-foreground mb-4">Security & Privacy</h2>

          <ul className="text-muted-foreground space-y-1 list-disc ml-6 text-sm">
            <li>Connection uses OAuth. Your OwnerRez password is never stored.</li>
            <li>All data transfers are encrypted over HTTPS.</li>
            <li>Row-level security isolates your data from other accounts.</li>
            <li>Webhooks are authenticated to prevent unauthorized access.</li>
            <li>
              You can disconnect at any time from <SLink tab="integrations">Settings → Integrations</SLink>.
            </li>
          </ul>

          <div className="mt-6 pt-6 border-t">
            <p className="text-muted-foreground text-sm mb-2">
              Something missing, wrong, or unclear? Tell us. Feature requests and feedback shape what we build next.
            </p>
            <p className="text-muted-foreground text-sm">
              Email{' '}
              <a href="mailto:support@baileysanalytics.com" className="text-primary hover:text-primary/80">
                support@baileysanalytics.com
              </a>{' '}
              or visit the{' '}
              <Link to="/help" className="text-primary hover:text-primary/80">
                Help Center
              </Link>
              .
            </p>
          </div>
        </section>
      </div>
    </DocsLayout>
  )
}
