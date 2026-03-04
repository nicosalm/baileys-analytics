import { DocsLayout } from '@/components/DocsLayout'

export const Privacy = () => {
  return (
    <DocsLayout>
      <div className="prose prose-gray max-w-none">
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-foreground mb-1">Privacy Policy</h1>
          <p className="text-muted-foreground text-sm">Effective January 1, 2025</p>
        </div>

        <div className="space-y-8">
          <section>
            <p className="text-foreground text-sm leading-relaxed">
              This Privacy Policy explains how Baileys Analytics collects, uses,
              discloses, and safeguards your information when you use our vacation rental analytics service.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-foreground mb-3">1. Information We Collect</h2>

            <h3 className="text-sm font-semibold text-foreground mt-4 mb-2">Account Information</h3>
            <p className="text-foreground text-sm leading-relaxed mb-3">When you create an account, we collect:</p>
            <ul className="list-disc ml-6 space-y-1 text-foreground text-sm">
              <li>Email address</li>
              <li>Payment information (processed securely through Stripe — we never see your card number)</li>
            </ul>

            <h3 className="text-sm font-semibold text-foreground mt-4 mb-2">OwnerRez Data</h3>
            <p className="text-foreground text-sm leading-relaxed mb-3">When you connect your OwnerRez account, we access and store:</p>
            <ul className="list-disc ml-6 space-y-1 text-foreground text-sm">
              <li>Property details (names, addresses, configurations)</li>
              <li>Booking information (dates, amounts, platforms)</li>
              <li>Guest information (names, and if provided: email addresses, phone numbers)</li>
              <li>Financial data (revenues, fees)</li>
            </ul>

            <h3 className="text-sm font-semibold text-foreground mt-4 mb-2">Usage Data</h3>
            <p className="text-foreground text-sm leading-relaxed mb-3">We automatically collect:</p>
            <ul className="list-disc ml-6 space-y-1 text-foreground text-sm">
              <li>Log data (IP address, browser type, pages visited)</li>
              <li>Device information (operating system, device type)</li>
              <li>Cookies for authentication and preferences</li>
              <li>Aggregated feature usage patterns</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-foreground mb-3">2. How We Use Your Information</h2>
            <p className="text-foreground text-sm leading-relaxed mb-3">We use your information to:</p>
            <ul className="list-disc ml-6 space-y-1 text-foreground text-sm">
              <li>Provide and maintain the analytics service</li>
              <li>Generate reports, dashboards, and insights</li>
              <li>Send service-related communications</li>
              <li>Process payments and manage subscriptions</li>
              <li>Improve and develop new features</li>
              <li>Provide customer support</li>
              <li>Detect and prevent fraud or abuse</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-foreground mb-3">3. Data Storage and Security</h2>
            <p className="text-foreground text-sm leading-relaxed mb-3">
              Your data is stored on Supabase servers in the United States. We use:
            </p>
            <ul className="list-disc ml-6 space-y-1 text-foreground text-sm">
              <li>Encryption in transit (HTTPS) and at rest</li>
              <li>Row-level security to isolate each user's data</li>
              <li>OAuth for OwnerRez connections (we never see your OwnerRez password)</li>
              <li>Regular automated backups</li>
            </ul>
            <p className="text-foreground text-sm leading-relaxed mt-3">
              No method of transmission over the Internet is 100% secure, but we take reasonable measures to protect your data.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-foreground mb-3">4. Information Sharing</h2>
            <p className="text-foreground text-sm leading-relaxed mb-3">
              We do not sell, trade, or rent your personal information. We may share information only in these cases:
            </p>
            <ul className="list-disc ml-6 space-y-1 text-foreground text-sm">
              <li>With service providers who help operate the Service (Stripe for payments, Supabase for hosting)</li>
              <li>When required by law, subpoena, or legal process</li>
              <li>To protect the rights, property, or safety of Baileys Analytics, our users, or the public</li>
              <li>In connection with a merger, acquisition, or sale of assets</li>
            </ul>
            <p className="text-foreground text-sm leading-relaxed mt-3">
              We never share your OwnerRez data or analytics with other users or competitors.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-foreground mb-3">5. Your Rights</h2>

            <h3 className="text-sm font-semibold text-foreground mt-4 mb-2">Access and Export</h3>
            <p className="text-foreground text-sm leading-relaxed">
              You can access and export your data at any time. The Service supports JSON and PDF exports.
            </p>

            <h3 className="text-sm font-semibold text-foreground mt-4 mb-2">Correction</h3>
            <p className="text-foreground text-sm leading-relaxed">
              You can update your account information in Settings. Property and booking
              data syncs from OwnerRez and should be corrected there.
            </p>

            <h3 className="text-sm font-semibold text-foreground mt-4 mb-2">Deletion</h3>
            <p className="text-foreground text-sm leading-relaxed">
              You can delete your account and all associated data from Settings → Account. Data is removed
              within 30 days unless we are required by law to retain it.
            </p>

            <h3 className="text-sm font-semibold text-foreground mt-4 mb-2">Communications</h3>
            <p className="text-foreground text-sm leading-relaxed">
              You can opt out of promotional emails using the unsubscribe link. Service-related
              communications (billing, security) cannot be opted out of while you have an active account.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-foreground mb-3">6. Cookies</h2>
            <p className="text-foreground text-sm leading-relaxed mb-3">
              We use cookies to:
            </p>
            <ul className="list-disc ml-6 space-y-1 text-foreground text-sm">
              <li>Keep you logged in</li>
              <li>Remember your preferences</li>
              <li>Understand how the Service is used</li>
            </ul>
            <p className="text-foreground text-sm leading-relaxed mt-3">
              You can control cookies through your browser settings, but disabling them may limit functionality.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-foreground mb-3">7. Third-Party Services</h2>
            <p className="text-foreground text-sm leading-relaxed mb-3">
              The Service integrates with:
            </p>
            <ul className="list-disc ml-6 space-y-1 text-foreground text-sm">
              <li>OwnerRez for property and booking data (under your authorization)</li>
              <li>Stripe for payment processing</li>
              <li>Supabase for database hosting and authentication</li>
            </ul>
            <p className="text-foreground text-sm leading-relaxed mt-3">
              These providers have their own privacy policies governing how they handle your data.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-foreground mb-3">8. Data Retention</h2>
            <p className="text-foreground text-sm leading-relaxed mb-3">
              We retain your data for as long as you have an active account. After account deletion:
            </p>
            <ul className="list-disc ml-6 space-y-1 text-foreground text-sm">
              <li>Account data is deleted within 30 days</li>
              <li>Backups may persist for up to 90 days</li>
              <li>Aggregated, anonymized data may be retained indefinitely</li>
              <li>Data required for legal purposes may be retained as required by law</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-foreground mb-3">9. California Privacy Rights</h2>
            <p className="text-foreground text-sm leading-relaxed mb-3">
              California residents have additional rights under CCPA:
            </p>
            <ul className="list-disc ml-6 space-y-1 text-foreground text-sm">
              <li>Right to know what personal information we collect</li>
              <li>Right to delete personal information</li>
              <li>Right to opt-out of sale (we do not sell personal information)</li>
              <li>Right to non-discrimination</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-foreground mb-3">10. Children's Privacy</h2>
            <p className="text-foreground text-sm leading-relaxed">
              The Service is not intended for children under 13. We do not knowingly collect information from
              children under 13. If we discover such information, we will promptly delete it.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-foreground mb-3">11. Changes to This Policy</h2>
            <p className="text-foreground text-sm leading-relaxed">
              We may update this Privacy Policy from time to time. We will notify you of material changes via
              email or through the Service. Continued use after changes constitutes acceptance.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-foreground mb-3">12. Contact</h2>
            <p className="text-foreground text-sm leading-relaxed">
              For questions about this Privacy Policy, email us
              at <a href="mailto:support@baileysanalytics.com" className="text-primary hover:text-primary/80">support@baileysanalytics.com</a>.
            </p>
          </section>
        </div>
      </div>
    </DocsLayout>
  )
}
