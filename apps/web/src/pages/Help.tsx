import { DocsLayout } from '@/components/DocsLayout'
import { Link } from 'react-router-dom'

const SLink = ({ tab, children }: { tab: string; children: React.ReactNode }) => (
  <Link to={`/settings?tab=${tab}`} className="text-primary hover:text-primary/80">{children}</Link>
)

export const Help = () => {
  return (
    <DocsLayout>
      <div className="prose prose-gray max-w-none">
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-foreground mb-1">Help & FAQ</h1>
          <p className="text-muted-foreground text-sm">Common questions and quick answers</p>
        </div>

        {/* quick links */}
        <div className="bg-info-subtle border border-info/20 rounded-xl p-4 mb-8">
          <h2 className="text-sm font-medium text-info-fg mb-2 mt-0">Quick Links</h2>
          <div className="grid md:grid-cols-2 gap-1.5">
            <Link to="/docs/ownerrez-data" className="text-primary hover:text-primary/80 text-sm">
              → What data we sync from OwnerRez
            </Link>
            <Link to="/settings" className="text-primary hover:text-primary/80 text-sm">
              → Manage your subscription
            </Link>
            <a href="https://status.baileysanalytics.com" target="_blank" rel="noopener noreferrer" className="text-primary hover:text-primary/80 text-sm">
              → System status page
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
              <p className="text-foreground text-sm mb-2">
                Head to <SLink tab="integrations">Settings → Integrations</SLink> and click "Connect to OwnerRez." You'll log in to your OwnerRez account and
                authorize the connection. The initial data sync takes a couple minutes after that.
              </p>
              <p className="text-muted-foreground text-sm">
                We use OAuth, so we never see your OwnerRez password.
              </p>
            </div>

            <div className="pb-4 border-b last:border-0 last:pb-0">
              <h3 className="text-sm font-semibold text-foreground mb-1">How long does the first sync take?</h3>
              <p className="text-foreground text-sm">
                Usually 2-5 minutes. We pull in 3 years of historical bookings and 1 year of future bookings. You can watch the progress after connecting.
              </p>
            </div>

            <div className="pb-4 border-b last:border-0 last:pb-0">
              <h3 className="text-sm font-semibold text-foreground mb-1">Is my data automatically updated?</h3>
              <p className="text-foreground text-sm">
                After the first sync, we use webhooks to get real-time updates from OwnerRez. When you create, update, or cancel a booking, it shows up on your dashboard within seconds.
              </p>
            </div>
          </div>
        </section>

        {/* data & syncing */}
        <section className="mb-8">
          <h2 className="text-lg font-semibold text-foreground mb-4">Data & Syncing</h2>

          <div className="space-y-6">
            <div className="pb-4 border-b last:border-0 last:pb-0">
              <h3 className="text-sm font-semibold text-foreground mb-1">Why isn't my data showing?</h3>
              <p className="text-foreground text-sm mb-2">
                A few things to check:
              </p>
              <ul className="text-foreground text-sm list-disc ml-6 space-y-1">
                <li>Make sure you're connected to OwnerRez in <SLink tab="integrations">Settings → Integrations</SLink></li>
                <li>Check if the initial sync finished</li>
                <li>Try a manual re-sync from <SLink tab="integrations">Settings → Integrations</SLink></li>
                <li>Make sure your OwnerRez account actually has properties and bookings</li>
              </ul>
            </div>

            <div className="pb-4 border-b last:border-0 last:pb-0">
              <h3 className="text-sm font-semibold text-foreground mb-1">Why is guest contact information missing?</h3>
              <p className="text-foreground text-sm">
                OwnerRez stores guest contact info separately from bookings. Run a Guest Details Sync from {' '}
                <SLink tab="integrations">Settings → Integrations</SLink> to backfill missing emails and phone numbers.
              </p>
            </div>

            <div className="pb-4 border-b last:border-0 last:pb-0">
              <h3 className="text-sm font-semibold text-foreground mb-1">What data do you sync from OwnerRez?</h3>
              <p className="text-foreground text-sm">
                Properties, bookings, guests, tags, and blocks. See the
                <Link to="/docs/ownerrez-data" className="text-primary hover:text-primary/80 ml-1">OwnerRez Data Guide</Link> for
                a full breakdown.
              </p>
            </div>

            <div className="pb-4 border-b last:border-0 last:pb-0">
              <h3 className="text-sm font-semibold text-foreground mb-1">How accurate is the dashboard data?</h3>
              <p className="text-foreground text-sm mb-2">
                Bookings, guest details, property info, and charge breakdowns all come straight from the OwnerRez API and stay current via webhooks.
              </p>
              <p className="text-foreground text-sm">
                A few things aren't available through the API, so you'll need to set them up yourself:
              </p>
              <ul className="text-foreground text-sm list-disc ml-6 space-y-1 mt-2">
                <li>Platform fees (Airbnb, Vrbo, etc.) in <SLink tab="platform-fees">Settings → Platform Fees</SLink></li>
                <li>Operating expenses like cleaning and maintenance in <SLink tab="expenses">Settings → Expenses</SLink></li>
              </ul>
              <p className="text-muted-foreground text-sm mt-2">
                Net revenue and profit calculations depend on these being set correctly.
              </p>
            </div>

            <div className="pb-4 border-b last:border-0 last:pb-0">
              <h3 className="text-sm font-semibold text-foreground mb-1">How do I manually sync my data?</h3>
              <p className="text-foreground text-sm">
                Go to <SLink tab="integrations">Settings → Integrations</SLink> and click "Re-sync All Data." This refreshes everything from OwnerRez.
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
              <p className="text-foreground text-sm mb-2">
                The first 30 days are $1. After that, it's $20/month or $192/year (saves 20%). Includes unlimited properties, reports, and data exports.
              </p>
            </div>

            <div className="pb-4 border-b last:border-0 last:pb-0">
              <h3 className="text-sm font-semibold text-foreground mb-1">How do I cancel my subscription?</h3>
              <p className="text-foreground text-sm mb-2">
                Go to <SLink tab="billing">Settings → Billing</SLink>, click "Manage Subscription," then cancel from the Stripe customer portal.
              </p>
              <p className="text-muted-foreground text-sm">
                You keep access until the end of your current billing period.
              </p>
            </div>

            <div className="pb-4 border-b last:border-0 last:pb-0">
              <h3 className="text-sm font-semibold text-foreground mb-1">Can I switch between monthly and yearly billing?</h3>
              <p className="text-foreground text-sm">
                Go to <SLink tab="billing">Settings → Billing</SLink> and click "Manage Subscription" to change your billing cycle. You'll get a prorated credit or charge.
              </p>
            </div>

            <div className="pb-4 border-b last:border-0 last:pb-0">
              <h3 className="text-sm font-semibold text-foreground mb-1">Do you offer refunds?</h3>
              <p className="text-foreground text-sm">
                Payments are non-refundable. The $1 trial gives you 30 days to try everything before committing.
              </p>
            </div>

            <div className="pb-4 border-b last:border-0 last:pb-0">
              <h3 className="text-sm font-semibold text-foreground mb-1">Are there any usage limits?</h3>
              <p className="text-foreground text-sm">
                No limits. Unlimited properties, bookings, reports, and API calls.
              </p>
            </div>
          </div>
        </section>

        {/* features */}
        <section className="mb-8">
          <h2 className="text-lg font-semibold text-foreground mb-4">Features</h2>

          <div className="space-y-6">
            <div className="pb-4 border-b last:border-0 last:pb-0">
              <h3 className="text-sm font-semibold text-foreground mb-1">How do I configure platform fees?</h3>
              <p className="text-foreground text-sm">
                Go to <SLink tab="platform-fees">Settings → Platform Fees</SLink>. Add your platform service fees per property so net revenue calculations are accurate.
              </p>
            </div>

            <div className="pb-4 border-b last:border-0 last:pb-0">
              <h3 className="text-sm font-semibold text-foreground mb-1">How do seasons work?</h3>
              <p className="text-foreground text-sm">
                Seasons let you define custom date ranges like "Summer 2024" or "Ski Season." Create them in <SLink tab="seasons">Settings → Seasons</SLink>, then use the dashboard filter bar to view performance for that period.
              </p>
            </div>

            <div className="pb-4 border-b last:border-0 last:pb-0">
              <h3 className="text-sm font-semibold text-foreground mb-1">Can I export my data?</h3>
              <p className="text-foreground text-sm">
                Use Reports to generate PDF exports of your analytics. You can also export everything as JSON from <SLink tab="account">Settings → Account</SLink>.
              </p>
            </div>

            <div className="pb-4 border-b last:border-0 last:pb-0">
              <h3 className="text-sm font-semibold text-foreground mb-1">What if I disconnect OwnerRez?</h3>
              <p className="text-foreground text-sm">
                You can disconnect anytime from <SLink tab="integrations">Settings → Integrations</SLink>. Your existing data stays in Baileys Analytics, but new bookings won't sync until you reconnect. We revoke our OAuth access when you disconnect.
              </p>
            </div>
          </div>
        </section>

        {/* security & privacy */}
        <section className="mb-8">
          <h2 className="text-lg font-semibold text-foreground mb-4">Security & Privacy</h2>

          <div className="space-y-6">
            <div className="pb-4 border-b last:border-0 last:pb-0">
              <h3 className="text-sm font-semibold text-foreground mb-1">Is my data secure?</h3>
              <p className="text-foreground text-sm mb-2">
                Here's how we handle security:
              </p>
              <ul className="text-foreground text-sm list-disc ml-6 space-y-1">
                <li>We use OAuth to connect to OwnerRez, so we never see your password</li>
                <li>All connections are encrypted with HTTPS</li>
                <li>Data is hosted on Supabase, which is SOC 2 compliant</li>
                <li>Row-level security keeps your data isolated from other users</li>
              </ul>
            </div>

            <div className="pb-4 border-b last:border-0 last:pb-0">
              <h3 className="text-sm font-semibold text-foreground mb-1">How do I delete my account?</h3>
              <p className="text-foreground text-sm">
                Go to <SLink tab="account">Settings → Account</SLink> and click "Delete Account." This permanently removes all your data, cancels your subscription, and revokes OwnerRez access.
              </p>
            </div>

            <div className="pb-4 border-b last:border-0 last:pb-0">
              <h3 className="text-sm font-semibold text-foreground mb-1">Where is my data stored?</h3>
              <p className="text-foreground text-sm">
                In a PostgreSQL database on Supabase, hosted in the United States. See our
                <Link to="/privacy" className="text-primary hover:text-primary/80 ml-1">Privacy Policy</Link> for details.
              </p>
            </div>
          </div>
        </section>

        {/* contact */}
        <section className="pt-6 border-t">
          <h2 className="text-lg font-semibold text-foreground mb-3">Still Need Help?</h2>
          <p className="text-muted-foreground text-sm mb-4">
            Can't find what you're looking for?
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
              className="inline-flex items-center justify-center px-4 py-2 bg-card border text-foreground text-sm rounded-lg hover:bg-muted/40 transition-colors"
            >
              Check System Status
            </a>
          </div>
        </section>
      </div>
    </DocsLayout>
  )
}
