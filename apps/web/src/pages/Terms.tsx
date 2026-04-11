import { DocsLayout } from '@/components/DocsLayout'
import { usePageTitle } from '@/hooks/use-page-title'

export const Terms = () => {
  usePageTitle('Terms of Service')
  return (
    <DocsLayout>
      <div className="prose prose-gray max-w-none">
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-foreground mb-1">Terms of Service</h1>
          <p className="text-muted-foreground text-sm">Effective January 1, 2025</p>
        </div>

        <div className="space-y-8">
          <section>
            <h2 className="text-lg font-semibold text-foreground mb-3">1. Agreement to Terms</h2>
            <p className="text-muted-foreground text-sm leading-relaxed">
              By accessing or using Baileys Analytics ("Service"), you agree to these Terms of Service ("Terms").
              If you do not agree, you may not use the Service.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-foreground mb-3">2. Description of Service</h2>
            <p className="text-muted-foreground text-sm leading-relaxed">
              Baileys Analytics provides vacation rental analytics and reporting by connecting to your OwnerRez account.
              The Service includes dashboards, financial reporting, guest analytics, data visualization, and a REST API for programmatic data access.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-foreground mb-3">3. Account Registration</h2>
            <p className="text-muted-foreground text-sm leading-relaxed">
              You must create an account and provide accurate, complete information.
              You are responsible for maintaining the confidentiality of your credentials and for all activity under your account.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-foreground mb-3">4. OwnerRez Connection</h2>
            <p className="text-muted-foreground text-sm leading-relaxed">
              The Service requires an OwnerRez connection via OAuth. By connecting, you authorize Baileys Analytics to access and store
              your property, booking, and guest data for the purpose of providing analytics. This access can be revoked at any time in Settings.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-foreground mb-3">5. Data Usage and Storage</h2>
            <p className="text-muted-foreground text-sm leading-relaxed mb-3">
              The following data is stored and processed to provide analytics:
            </p>
            <ul className="list-disc ml-6 space-y-1 text-muted-foreground text-sm">
              <li>Property information and configurations</li>
              <li>Booking details, revenue, and guest information</li>
              <li>Financial transactions and platform fees</li>
            </ul>
            <p className="text-muted-foreground text-sm leading-relaxed mt-3">
              Your data is isolated from other accounts via row-level security and is only accessible through your authenticated session or API token.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-foreground mb-3">6. Subscription and Payment</h2>
            <p className="text-muted-foreground text-sm leading-relaxed mb-3">
              The Service is offered on a subscription basis:
            </p>
            <ul className="list-disc ml-6 space-y-1 text-muted-foreground text-sm mb-3">
              <li>$20/month or $192/year (20% discount)</li>
              <li>Subscriptions renew automatically unless canceled before the renewal date</li>
              <li>All payments are non-refundable</li>
            </ul>
            <p className="text-muted-foreground text-sm leading-relaxed">
              Payments are processed through Stripe. Baileys Analytics does not store credit card information.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-foreground mb-3">7. Cancellation Policy</h2>
            <p className="text-muted-foreground text-sm leading-relaxed mb-3">
              You may cancel your subscription at any time through Settings or by contacting support.
            </p>
            <ul className="list-disc ml-6 space-y-1 text-muted-foreground text-sm">
              <li>Cancellation takes effect at the end of the current billing period</li>
              <li>Access to the Service continues until your paid period ends</li>
              <li>Cancel via Settings → Billing or by emailing support@baileysanalytics.com</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-foreground mb-3">8. No Refunds</h2>
            <p className="text-muted-foreground text-sm leading-relaxed mb-3">
              All payments are final and non-refundable.
            </p>
            <p className="text-muted-foreground text-sm leading-relaxed">
              For billing errors or unauthorized charges, contact us within 60 days. We will investigate and respond
              within 5 business days. Legitimate billing errors will be corrected. Chargebacks initiated without
              contacting us first may result in account suspension.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-foreground mb-3">9. Acceptable Use</h2>
            <p className="text-muted-foreground text-sm leading-relaxed mb-3">You agree not to:</p>
            <ul className="list-disc ml-6 space-y-1 text-muted-foreground text-sm">
              <li>Use the Service for any unlawful purpose</li>
              <li>Attempt to gain unauthorized access to any part of the Service (see Section 15 for security research exceptions)</li>
              <li>Interfere with or disrupt the Service or its infrastructure</li>
              <li>Reverse engineer or attempt to extract the source code</li>
              <li>Resell or redistribute the Service without permission</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-foreground mb-3">10. Intellectual Property</h2>
            <p className="text-muted-foreground text-sm leading-relaxed">
              The Service, its content, features, and functionality are owned by Baileys Analytics and are
              protected by copyright, trademark, and other intellectual property laws. Your data remains your property.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-foreground mb-3">11. Data Accuracy Disclaimer</h2>
            <div className="bg-warning-subtle border-l-4 border-warning p-4 rounded">
              <p className="text-sm leading-relaxed font-medium text-warning-fg">
                Baileys Analytics is an analytics and reporting tool. Financial reports are provided for informational
                purposes only. Consult qualified professionals for tax, legal, and financial advice.
                Baileys Analytics is not responsible for decisions made based on its reports.
              </p>
            </div>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-foreground mb-3">12. Limitation of Liability</h2>
            <p className="text-muted-foreground text-sm leading-relaxed">
              TO THE MAXIMUM EXTENT PERMITTED BY LAW, BAILEYS ANALYTICS SHALL NOT BE LIABLE FOR ANY INDIRECT, INCIDENTAL,
              SPECIAL, CONSEQUENTIAL, OR PUNITIVE DAMAGES, INCLUDING BUT NOT LIMITED TO LOSS OF PROFITS, DATA, USE, OR
              GOODWILL, ARISING OUT OF OR RELATED TO YOUR USE OF THE SERVICE.
            </p>
            <p className="text-muted-foreground text-sm leading-relaxed mt-3">
              Total liability shall not exceed the amount paid to Baileys Analytics in the twelve months preceding the claim.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-foreground mb-3">13. Service Availability</h2>
            <p className="text-muted-foreground text-sm leading-relaxed">
              Baileys Analytics strives for high availability but does not guarantee uninterrupted access. The Service may be
              temporarily unavailable due to maintenance, updates, or factors beyond our control.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-foreground mb-3">14. Termination</h2>
            <p className="text-muted-foreground text-sm leading-relaxed">
              You may terminate your account at any time. Baileys Analytics may suspend or terminate accounts that violate
              these Terms. Upon termination, your right to use the Service ceases immediately.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-foreground mb-3">15. Responsible Disclosure</h2>
            <p className="text-muted-foreground text-sm leading-relaxed mb-3">
              Baileys Analytics welcomes good-faith security research. If you discover a vulnerability, please report it
              to <a href="mailto:support@baileysanalytics.com" className="text-primary hover:text-primary/80">support@baileysanalytics.com</a> with enough detail to reproduce the issue.
            </p>
            <p className="text-muted-foreground text-sm leading-relaxed mb-3">
              When conducting research, you must:
            </p>
            <ul className="list-disc ml-6 space-y-1 text-muted-foreground text-sm mb-3">
              <li>Only test against your own account and data</li>
              <li>Not access, modify, or delete another user's data</li>
              <li>Not degrade, disrupt, or deny service to other users</li>
              <li>Not publicly disclose the vulnerability before it has been resolved</li>
            </ul>
            <p className="text-muted-foreground text-sm leading-relaxed">
              Baileys Analytics will not pursue legal action against researchers who follow these guidelines and act in good faith.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-foreground mb-3">16. Data Export and Deletion</h2>
            <p className="text-muted-foreground text-sm leading-relaxed">
              You can export your data at any time as JSON via the Data API. After account deletion, data is retained for
              30 days to allow for export, then permanently deleted unless required by law.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-foreground mb-3">17. Changes to Terms</h2>
            <p className="text-muted-foreground text-sm leading-relaxed">
              Baileys Analytics reserves the right to modify these Terms at any time. Significant changes will be communicated via
              email or through the Service. Continued use after changes constitutes acceptance.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-foreground mb-3">18. Governing Law</h2>
            <p className="text-muted-foreground text-sm leading-relaxed">
              These Terms are governed by the laws of the United States and the State of Wisconsin,
              without regard to conflict of law provisions.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-foreground mb-3">19. Contact</h2>
            <p className="text-muted-foreground text-sm leading-relaxed">
              For questions about these Terms, email <a href="mailto:support@baileysanalytics.com" className="text-primary hover:text-primary/80">support@baileysanalytics.com</a>.
            </p>
          </section>
        </div>
      </div>
    </DocsLayout>
  )
}
