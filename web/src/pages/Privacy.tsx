import { DocsLayout } from '@/components/DocsLayout'
import { usePageTitle } from '@/hooks/use-page-title'

export const Privacy = () => {
  usePageTitle('Privacy Policy')
  return (
    <DocsLayout>
      <article>
        <div className="mb-6">
          <h1 className="landing-serif text-3xl md:text-4xl font-semibold tracking-tight text-foreground mb-2">Privacy Policy</h1>
          <p className="text-muted-foreground text-sm">Effective January 1, 2025</p>
        </div>

        <div className="space-y-8">
          <section>
            <p className="text-muted-foreground text-sm leading-relaxed">
              This Privacy Policy describes how Baileys Analytics collects, uses, shares, and protects your information when you use the
              Service.
            </p>
          </section>

          <section>
            <h2 className="text-base font-semibold text-foreground mb-2">1. Information We Collect</h2>

            <h3 className="text-sm font-semibold text-foreground mt-4 mb-2">Account Information</h3>
            <p className="text-muted-foreground text-sm leading-relaxed mb-3">When you create an account, we collect:</p>
            <ul className="list-disc ml-6 space-y-1 text-muted-foreground text-sm">
              <li>Email address</li>
              <li>Payment information (processed through Stripe; card numbers are never stored by Baileys Analytics)</li>
            </ul>

            <h3 className="text-sm font-semibold text-foreground mt-4 mb-2">OwnerRez Data</h3>
            <p className="text-muted-foreground text-sm leading-relaxed mb-3">
              When you connect your OwnerRez account, we access and store:
            </p>
            <ul className="list-disc ml-6 space-y-1 text-muted-foreground text-sm">
              <li>Property details (names, addresses, configurations)</li>
              <li>Booking information (dates, amounts, platforms)</li>
              <li>Guest information (names, and if available: email addresses, phone numbers)</li>
              <li>Financial data (revenue, fees)</li>
            </ul>

            <h3 className="text-sm font-semibold text-foreground mt-4 mb-2">Usage Data</h3>
            <p className="text-muted-foreground text-sm leading-relaxed mb-3">We automatically collect:</p>
            <ul className="list-disc ml-6 space-y-1 text-muted-foreground text-sm">
              <li>Log data (IP address, browser type, pages visited)</li>
              <li>Device information (operating system, device type)</li>
              <li>Authentication cookies and preference cookies</li>
              <li>Aggregated feature usage patterns</li>
            </ul>
          </section>

          <section>
            <h2 className="text-base font-semibold text-foreground mb-2">2. How We Use Your Information</h2>
            <p className="text-muted-foreground text-sm leading-relaxed mb-3">Your information is used to:</p>
            <ul className="list-disc ml-6 space-y-1 text-muted-foreground text-sm">
              <li>Provide and maintain the analytics service</li>
              <li>Generate reports, dashboards, and insights</li>
              <li>Send service-related communications</li>
              <li>Process payments and manage subscriptions</li>
              <li>Improve the Service and develop new features</li>
              <li>Provide customer support</li>
              <li>Detect and prevent fraud or abuse</li>
            </ul>
          </section>

          <section>
            <h2 className="text-base font-semibold text-foreground mb-2">3. Data Storage and Security</h2>
            <p className="text-muted-foreground text-sm leading-relaxed mb-3">
              Data is stored on Supabase infrastructure in the United States. Security measures include:
            </p>
            <ul className="list-disc ml-6 space-y-1 text-muted-foreground text-sm">
              <li>Encryption in transit (HTTPS) and at rest</li>
              <li>Row-level security isolating each account's data</li>
              <li>OAuth for OwnerRez connections (your OwnerRez password is never stored)</li>
              <li>Regular automated backups</li>
            </ul>
            <p className="text-muted-foreground text-sm leading-relaxed mt-3">
              No method of transmission over the Internet is completely secure. Baileys Analytics takes reasonable measures to protect your
              data but cannot guarantee absolute security.
            </p>
          </section>

          <section>
            <h2 className="text-base font-semibold text-foreground mb-2">4. Information Sharing</h2>
            <p className="text-muted-foreground text-sm leading-relaxed mb-3">
              Baileys Analytics does not sell, trade, or rent your personal information. Information may be shared only in these cases:
            </p>
            <ul className="list-disc ml-6 space-y-1 text-muted-foreground text-sm">
              <li>With service providers that help operate the Service (Stripe for payments, Supabase for hosting)</li>
              <li>When required by law, subpoena, or legal process</li>
              <li>To protect the rights, property, or safety of Baileys Analytics, its users, or the public</li>
              <li>In connection with a merger, acquisition, or sale of assets</li>
            </ul>
            <p className="text-muted-foreground text-sm leading-relaxed mt-3">
              Your OwnerRez data and analytics are never shared with other users or third parties.
            </p>
          </section>

          <section>
            <h2 className="text-base font-semibold text-foreground mb-2">5. Your Rights</h2>

            <h3 className="text-sm font-semibold text-foreground mt-4 mb-2">Access and Export</h3>
            <p className="text-muted-foreground text-sm leading-relaxed">
              You can access your data at any time in the dashboard and export it as CSV.
            </p>

            <h3 className="text-sm font-semibold text-foreground mt-4 mb-2">Correction</h3>
            <p className="text-muted-foreground text-sm leading-relaxed">
              Account information can be updated in Settings. Property and booking data syncs from OwnerRez and should be corrected there.
            </p>

            <h3 className="text-sm font-semibold text-foreground mt-4 mb-2">Deletion</h3>
            <p className="text-muted-foreground text-sm leading-relaxed">
              You can delete your account and all associated data from Settings → Account. Data is removed within 30 days unless retention
              is required by law.
            </p>

            <h3 className="text-sm font-semibold text-foreground mt-4 mb-2">Communications</h3>
            <p className="text-muted-foreground text-sm leading-relaxed">
              Promotional emails can be opted out of via the unsubscribe link. Service-related communications (billing, security) cannot be
              opted out of while an account is active.
            </p>
          </section>

          <section>
            <h2 className="text-base font-semibold text-foreground mb-2">6. Cookies</h2>
            <p className="text-muted-foreground text-sm leading-relaxed mb-3">Cookies are used to:</p>
            <ul className="list-disc ml-6 space-y-1 text-muted-foreground text-sm">
              <li>Maintain authentication sessions</li>
              <li>Store user preferences</li>
              <li>Collect usage analytics</li>
            </ul>
            <p className="text-muted-foreground text-sm leading-relaxed mt-3">
              Cookies can be controlled through browser settings. Disabling them may limit functionality.
            </p>
          </section>

          <section>
            <h2 className="text-base font-semibold text-foreground mb-2">7. Third-Party Services</h2>
            <p className="text-muted-foreground text-sm leading-relaxed mb-3">The Service integrates with:</p>
            <ul className="list-disc ml-6 space-y-1 text-muted-foreground text-sm">
              <li>OwnerRez for property and booking data (under your authorization)</li>
              <li>Stripe for payment processing</li>
              <li>Supabase for database hosting and authentication</li>
            </ul>
            <p className="text-muted-foreground text-sm leading-relaxed mt-3">Each provider operates under its own privacy policy.</p>
          </section>

          <section>
            <h2 className="text-base font-semibold text-foreground mb-2">8. Data Retention</h2>
            <p className="text-muted-foreground text-sm leading-relaxed mb-3">
              Data is retained for the duration of an active account. After account deletion:
            </p>
            <ul className="list-disc ml-6 space-y-1 text-muted-foreground text-sm">
              <li>Account data is deleted within 30 days</li>
              <li>Backups may persist for up to 90 days</li>
              <li>Aggregated, anonymized data may be retained indefinitely</li>
              <li>Data required by law may be retained as legally required</li>
            </ul>
          </section>

          <section>
            <h2 className="text-base font-semibold text-foreground mb-2">9. California Privacy Rights</h2>
            <p className="text-muted-foreground text-sm leading-relaxed mb-3">
              California residents have additional rights under the CCPA:
            </p>
            <ul className="list-disc ml-6 space-y-1 text-muted-foreground text-sm">
              <li>Right to know what personal information is collected</li>
              <li>Right to request deletion of personal information</li>
              <li>Right to opt out of sale of personal information (Baileys Analytics does not sell personal information)</li>
              <li>Right to non-discrimination for exercising these rights</li>
            </ul>
          </section>

          <section>
            <h2 className="text-base font-semibold text-foreground mb-2">10. Children's Privacy</h2>
            <p className="text-muted-foreground text-sm leading-relaxed">
              The Service is not intended for users under 13. Baileys Analytics does not knowingly collect information from children under
              13. If such information is discovered, it will be deleted promptly.
            </p>
          </section>

          <section>
            <h2 className="text-base font-semibold text-foreground mb-2">11. Changes to This Policy</h2>
            <p className="text-muted-foreground text-sm leading-relaxed">
              This Privacy Policy may be updated from time to time. Material changes will be communicated via email or through the Service.
              Continued use after changes constitutes acceptance.
            </p>
          </section>

          <section>
            <h2 className="text-base font-semibold text-foreground mb-2">12. Contact</h2>
            <p className="text-muted-foreground text-sm leading-relaxed">
              For questions about this Privacy Policy, email{' '}
              <a href="mailto:support@baileysanalytics.com" className="text-primary hover:text-primary/80">
                support@baileysanalytics.com
              </a>
              .
            </p>
          </section>
        </div>
      </article>
    </DocsLayout>
  )
}
