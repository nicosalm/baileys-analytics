import { DocsLayout } from '@/components/DocsLayout'
import { Link } from 'react-router-dom'
import { usePageTitle } from '@/hooks/use-page-title'

const SLink = ({ tab, children }: { tab: string; children: React.ReactNode }) => (
  <Link to={`/settings?tab=${tab}`} className="text-primary hover:text-primary/80">
    {children}
  </Link>
)

export const Help = () => {
  usePageTitle('Help & FAQ')
  return (
    <DocsLayout>
      <div className="prose prose-gray max-w-none">
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-foreground mb-1">Help & FAQ</h1>
          <p className="text-muted-foreground text-sm">Answers to common questions about Baileys Analytics.</p>
        </div>

        {/* about this service */}
        <div className="mb-6 p-4 rounded-xl border border-border bg-muted/30">
          <h2 className="text-sm font-semibold text-foreground mb-2 mt-0">About Baileys Analytics</h2>
          <p className="text-sm text-muted-foreground mb-2">
            Baileys Analytics is built on top of the OwnerRez API. What we can show you depends on what OwnerRez exposes. Some figures, like
            guest-side platform fees, are estimated and labeled as such in the dashboard.
          </p>
          <p className="text-sm text-muted-foreground">
            Data quality reflects the quality of the data in your OwnerRez account. If a guest is missing a phone number there, it will be
            missing here too.
          </p>
        </div>

        {/* quick links */}
        <div className="bg-info-subtle border border-info/20 rounded-xl p-4 mb-8">
          <h2 className="text-sm font-medium text-info-fg mb-2 mt-0">Quick Links</h2>
          <div className="grid md:grid-cols-2 gap-1.5">
            <Link to="/docs/ownerrez-data" className="text-primary hover:text-primary/80 text-sm">
              → OwnerRez Data Guide
            </Link>
            <a
              href="https://status.baileysanalytics.com"
              target="_blank"
              rel="noopener noreferrer"
              className="text-primary hover:text-primary/80 text-sm"
            >
              → System status
            </a>
            <a href="mailto:support@baileysanalytics.com" className="text-primary hover:text-primary/80 text-sm">
              → Contact support
            </a>
          </div>
        </div>

        {/* getting started */}
        <section className="mb-8">
          <h2 className="text-lg font-semibold text-foreground mb-4">Getting Started</h2>

          <div className="space-y-6">
            <div className="pb-4 border-b last:border-0 last:pb-0">
              <h3 className="text-sm font-semibold text-foreground mb-1">How do I connect OwnerRez?</h3>
              <p className="text-muted-foreground text-sm mb-2">
                Open <SLink tab="integrations">Settings → Integrations</SLink> and click "Connect to OwnerRez." You will be redirected to
                OwnerRez to authorize the connection. The initial data sync begins immediately after.
              </p>
              <p className="text-muted-foreground text-sm">
                The connection uses OAuth. Your OwnerRez password is never shared with Baileys Analytics.
              </p>
            </div>

            <div className="pb-4 border-b last:border-0 last:pb-0">
              <h3 className="text-sm font-semibold text-foreground mb-1">How long does the first sync take?</h3>
              <p className="text-muted-foreground text-sm">
                Typically 2 to 5 minutes. The sync imports 4 years of historical bookings and 1 year of future bookings. Progress is visible
                on the dashboard during the process.
              </p>
            </div>

            <div className="pb-4 border-b last:border-0 last:pb-0">
              <h3 className="text-sm font-semibold text-foreground mb-1">Is my data updated automatically?</h3>
              <p className="text-muted-foreground text-sm">
                Yes. After the initial sync, OwnerRez webhooks push updates in real time. Booking changes, cancellations, and property edits
                appear on your dashboard within seconds.
              </p>
            </div>
          </div>
        </section>

        {/* data & syncing */}
        <section className="mb-8">
          <h2 className="text-lg font-semibold text-foreground mb-4">Data & Syncing</h2>

          <div className="space-y-6">
            <div className="pb-4 border-b last:border-0 last:pb-0">
              <h3 className="text-sm font-semibold text-foreground mb-1">No data is showing on my dashboard.</h3>
              <p className="text-muted-foreground text-sm mb-2">Verify the following:</p>
              <ul className="text-muted-foreground text-sm list-disc ml-6 space-y-1">
                <li>
                  OwnerRez is connected in <SLink tab="integrations">Settings → Integrations</SLink>
                </li>
                <li>The initial sync has completed</li>
                <li>Your OwnerRez account has at least one property and booking</li>
              </ul>
              <p className="text-muted-foreground text-sm mt-2">
                If the issue persists, try a manual re-sync from <SLink tab="integrations">Settings → Integrations</SLink>.
              </p>
            </div>

            <div className="pb-4 border-b last:border-0 last:pb-0">
              <h3 className="text-sm font-semibold text-foreground mb-1">Guest contact information is missing.</h3>
              <p className="text-muted-foreground text-sm">
                Guest contacts are synced automatically during initial setup. If still missing, the guest may not have contact info on file
                in OwnerRez, or you can use "Re-sync All Data" in <SLink tab="integrations">Settings → Integrations</SLink> to refresh.
              </p>
            </div>

            <div className="pb-4 border-b last:border-0 last:pb-0">
              <h3 className="text-sm font-semibold text-foreground mb-1">What data is synced from OwnerRez?</h3>
              <p className="text-muted-foreground text-sm">
                Properties, bookings, guests, tags, and blocks. See the
                <Link to="/docs/ownerrez-data" className="text-primary hover:text-primary/80 ml-1">
                  OwnerRez Data Guide
                </Link>{' '}
                for a full breakdown.
              </p>
            </div>

            <div className="pb-4 border-b last:border-0 last:pb-0">
              <h3 className="text-sm font-semibold text-foreground mb-1">How accurate is the dashboard data?</h3>
              <p className="text-muted-foreground text-sm mb-2">
                Bookings, guest details, property info, and charge breakdowns are sourced directly from the OwnerRez API and kept current
                via webhooks.
              </p>
              <p className="text-muted-foreground text-sm">
                Some data is not available through the OwnerRez API and must be configured manually:
              </p>
              <ul className="text-muted-foreground text-sm list-disc ml-6 space-y-1 mt-2">
                <li>
                  Operating expenses (cleaning, maintenance, etc.) in <SLink tab="expenses">Settings → Expenses</SLink>
                </li>
              </ul>
              <p className="text-muted-foreground text-sm mt-2">
                Host service fees come from OwnerRez directly. Guest service fees are estimated (Vrbo ~8%, Airbnb ~14% pre-Oct 2025, 0%
                after) until OwnerRez exposes them via their API. These are marked "(est.)" in the dashboard. Net revenue calculations
                require operating expenses to be set correctly.
              </p>
            </div>

            <div className="pb-4 border-b last:border-0 last:pb-0">
              <h3 className="text-sm font-semibold text-foreground mb-1">How do I manually sync my data?</h3>
              <p className="text-muted-foreground text-sm">
                Open <SLink tab="integrations">Settings → Integrations</SLink> and click "Re-sync All Data." This re-imports all properties
                and bookings from OwnerRez.
              </p>
            </div>
          </div>
        </section>

        {/* billing & subscription */}
        <section className="mb-8">
          <h2 className="text-lg font-semibold text-foreground mb-4">Billing & Subscription</h2>

          <div className="space-y-6">
            <div className="pb-4 border-b last:border-0 last:pb-0">
              <h3 className="text-sm font-semibold text-foreground mb-1">How much does Baileys Analytics cost?</h3>
              <p className="text-muted-foreground text-sm">
                Plans are priced by the number of properties you manage, billed monthly or yearly. See{' '}
                <Link to="/#pricing" className="text-primary hover:text-primary/80">
                  pricing
                </Link>{' '}
                for current rates.
              </p>
            </div>

            <div className="pb-4 border-b last:border-0 last:pb-0">
              <h3 className="text-sm font-semibold text-foreground mb-1">How do I cancel my subscription?</h3>
              <p className="text-muted-foreground text-sm mb-2">
                Open <SLink tab="billing">Settings → Billing</SLink>, click "Manage Subscription," and cancel from the Stripe customer
                portal.
              </p>
              <p className="text-muted-foreground text-sm">Access continues until the end of your current billing period.</p>
            </div>

            <div className="pb-4 border-b last:border-0 last:pb-0">
              <h3 className="text-sm font-semibold text-foreground mb-1">Can I switch between monthly and yearly billing?</h3>
              <p className="text-muted-foreground text-sm">
                Yes. Open <SLink tab="billing">Settings → Billing</SLink> and click "Manage Subscription" to change your billing cycle. The
                difference is prorated automatically.
              </p>
            </div>

            <div className="pb-4 border-b last:border-0 last:pb-0">
              <h3 className="text-sm font-semibold text-foreground mb-1">Do you offer refunds?</h3>
              <p className="text-muted-foreground text-sm">
                Payments are non-refundable. You can cancel anytime and access continues until the end of your billing period.
              </p>
            </div>

            <div className="pb-4 border-b last:border-0 last:pb-0">
              <h3 className="text-sm font-semibold text-foreground mb-1">Are there usage limits?</h3>
              <p className="text-muted-foreground text-sm">
                No. All plans include unlimited properties, bookings, reports, and API access.
              </p>
            </div>
          </div>
        </section>

        {/* features */}
        <section className="mb-8">
          <h2 className="text-lg font-semibold text-foreground mb-4">Features</h2>

          <div className="space-y-6">
            <div className="pb-4 border-b last:border-0 last:pb-0">
              <h3 className="text-sm font-semibold text-foreground mb-1">How are platform fees calculated?</h3>
              <p className="text-muted-foreground text-sm mb-3">
                Platform fees include host fees (what the platform charges you) and guest fees (what the platform charges the guest). Host
                fees are exact values from OwnerRez. Guest fees are estimated and marked "(est.)" because OwnerRez does not yet expose them
                via their API.
              </p>

              <div className="overflow-x-auto mb-3">
                <table className="w-full text-sm border-collapse">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left py-2 pr-4 text-foreground font-medium">Platform</th>
                      <th className="text-left py-2 pr-4 text-foreground font-medium">Host Fee</th>
                      <th className="text-left py-2 pr-4 text-foreground font-medium">Guest Fee</th>
                      <th className="text-left py-2 text-foreground font-medium">Source</th>
                    </tr>
                  </thead>
                  <tbody className="text-muted-foreground">
                    <tr className="border-b border-border/50">
                      <td className="py-2 pr-4">
                        Airbnb <span className="text-xs">(pre-Oct 2025)</span>
                      </td>
                      <td className="py-2 pr-4">~3%</td>
                      <td className="py-2 pr-4">
                        ~14.2% <span className="text-xs">(est.)</span>
                      </td>
                      <td className="py-2 text-xs">Host: OwnerRez | Guest: estimated</td>
                    </tr>
                    <tr className="border-b border-border/50">
                      <td className="py-2 pr-4">
                        Airbnb <span className="text-xs">(post-Oct 2025)</span>
                      </td>
                      <td className="py-2 pr-4">15.5%</td>
                      <td className="py-2 pr-4">0%</td>
                      <td className="py-2 text-xs">Host: OwnerRez | Guest: none (host-only model)</td>
                    </tr>
                    <tr className="border-b border-border/50">
                      <td className="py-2 pr-4">Vrbo</td>
                      <td className="py-2 pr-4">~8%</td>
                      <td className="py-2 pr-4">
                        ~8% <span className="text-xs">(est.)</span>
                      </td>
                      <td className="py-2 text-xs">Host: OwnerRez | Guest: estimated (6-15% sliding scale)</td>
                    </tr>
                    <tr className="border-b border-border/50">
                      <td className="py-2 pr-4">Booking.com</td>
                      <td className="py-2 pr-4">~15%</td>
                      <td className="py-2 pr-4">0%</td>
                      <td className="py-2 text-xs">Host: OwnerRez | Guest: none (host-only model)</td>
                    </tr>
                    <tr>
                      <td className="py-2 pr-4">Direct / Other</td>
                      <td className="py-2 pr-4">0%</td>
                      <td className="py-2 pr-4">0%</td>
                      <td className="py-2 text-xs">No platform involved</td>
                    </tr>
                  </tbody>
                </table>
              </div>

              <p className="text-muted-foreground text-sm">
                Vrbo's guest fee varies on a 6-15% sliding scale based on booking value. We use 8% as the midpoint for typical bookings.
                Direct booking savings shown in the dashboard equal host fee + guest fee + credit card fees.
              </p>
            </div>

            <div className="pb-4 border-b last:border-0 last:pb-0">
              <h3 className="text-sm font-semibold text-foreground mb-1">How do seasons work?</h3>
              <p className="text-muted-foreground text-sm">
                Seasons are custom date ranges (e.g., "Summer 2024" or "Ski Season") that you define in{' '}
                <SLink tab="seasons">Settings → Seasons</SLink>. Once created, they appear in the dashboard filter bar for viewing
                performance over that period.
              </p>
            </div>

            <div className="pb-4 border-b last:border-0 last:pb-0">
              <h3 className="text-sm font-semibold text-foreground mb-1">Can I export my data?</h3>
              <p className="text-muted-foreground text-sm">
                Yes. The guest, cancellation, and inquiry tables, the P&amp;L charge composition, and the Tax Center each download as CSV
                for the selected period.
              </p>
            </div>

            <div className="pb-4 border-b last:border-0 last:pb-0">
              <h3 className="text-sm font-semibold text-foreground mb-1">What happens if I disconnect OwnerRez?</h3>
              <p className="text-muted-foreground text-sm">
                Disconnecting stops future syncs but does not delete existing data. New bookings will not appear until you reconnect. OAuth
                access is revoked immediately on disconnect.
              </p>
            </div>
          </div>
        </section>

        {/* security & privacy */}
        <section className="mb-8">
          <h2 className="text-lg font-semibold text-foreground mb-4">Security & Privacy</h2>

          <div className="space-y-6">
            <div className="pb-4 border-b last:border-0 last:pb-0">
              <h3 className="text-sm font-semibold text-foreground mb-1">How is my data protected?</h3>
              <ul className="text-muted-foreground text-sm list-disc ml-6 space-y-1">
                <li>OwnerRez connection uses OAuth. Your OwnerRez password is never stored.</li>
                <li>All data is transferred over HTTPS.</li>
                <li>Data is hosted on Supabase (SOC 2 compliant).</li>
                <li>Row-level security isolates your data from other accounts.</li>
              </ul>
            </div>

            <div className="pb-4 border-b last:border-0 last:pb-0">
              <h3 className="text-sm font-semibold text-foreground mb-1">How do I delete my account?</h3>
              <p className="text-muted-foreground text-sm">
                Open <SLink tab="account">Settings → Account</SLink> and click "Delete Account." This permanently removes all data, cancels
                your subscription, and revokes OwnerRez access.
              </p>
            </div>

            <div className="pb-4 border-b last:border-0 last:pb-0">
              <h3 className="text-sm font-semibold text-foreground mb-1">Where is my data stored?</h3>
              <p className="text-muted-foreground text-sm">
                PostgreSQL on Supabase, hosted in the United States. See the
                <Link to="/privacy" className="text-primary hover:text-primary/80 ml-1">
                  Privacy Policy
                </Link>{' '}
                for details.
              </p>
            </div>
          </div>
        </section>

        {/* contact */}
        <section className="pt-6 border-t">
          <h2 className="text-lg font-semibold text-foreground mb-3">Contact & Feedback</h2>
          <p className="text-muted-foreground text-sm mb-4">
            Question not answered above? Reach out directly. Feature requests, UX suggestions, and bug reports are welcome. We read every
            message, and the roadmap is shaped by what hosts ask for.
          </p>
          <div className="flex flex-col sm:flex-row gap-2">
            <a
              href="mailto:support@baileysanalytics.com"
              className="inline-flex items-center justify-center px-4 py-2 bg-primary text-primary-foreground text-sm rounded-lg hover:opacity-90 transition-opacity"
            >
              Email Support
            </a>
            <a
              href="https://status.baileysanalytics.com"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center justify-center px-4 py-2 bg-card border text-muted-foreground text-sm rounded-lg hover:bg-muted/40 transition-colors"
            >
              System Status
            </a>
          </div>
        </section>
      </div>
    </DocsLayout>
  )
}
