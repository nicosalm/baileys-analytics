import { DocsLayout } from '@/components/DocsLayout'

export const Terms = () => {
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
            <p className="text-foreground text-sm leading-relaxed">
              By accessing or using Baileys Analytics ("Service"), you agree to be bound by these Terms of Service ("Terms").
              If you disagree with any part of these terms, you may not access the Service.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-foreground mb-3">2. Description of Service</h2>
            <p className="text-foreground text-sm leading-relaxed">
              Baileys Analytics provides vacation rental analytics and reporting services by connecting to and analyzing data
              from your OwnerRez account. The Service includes dashboards, financial reporting, guest analytics,
              and data visualization tools.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-foreground mb-3">3. Account Registration</h2>
            <p className="text-foreground text-sm leading-relaxed">
              To use the Service, you must create an account and provide accurate, complete, and current information.
              You are responsible for maintaining the confidentiality of your account credentials and for all activities
              that occur under your account.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-foreground mb-3">4. OwnerRez Connection</h2>
            <p className="text-foreground text-sm leading-relaxed">
              The Service requires you to connect your OwnerRez account via OAuth. By connecting, you authorize
              Baileys Analytics to access and retrieve your property and booking data from OwnerRez for the purpose of providing
              analytics services. You can revoke this access at any time through your account settings.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-foreground mb-3">5. Data Usage and Storage</h2>
            <p className="text-foreground text-sm leading-relaxed mb-3">
              We store and process your property and booking data to provide analytics. This includes:
            </p>
            <ul className="list-disc ml-6 space-y-1 text-foreground text-sm">
              <li>Property information and configurations</li>
              <li>Booking details, revenues, and guest information</li>
              <li>Financial transactions and platform fees</li>
            </ul>
            <p className="text-foreground text-sm leading-relaxed mt-3">
              Your data is isolated from other users and is only accessible through your authenticated account.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-foreground mb-3">6. Subscription and Payment</h2>
            <p className="text-foreground text-sm leading-relaxed mb-3">
              The Service is offered on a subscription basis:
            </p>
            <ul className="list-disc ml-6 space-y-1 text-foreground text-sm mb-3">
              <li>First 30 days for $1</li>
              <li>$20/month after trial, or $192/year (20% savings)</li>
              <li>Subscriptions automatically renew unless cancelled before the renewal date</li>
              <li>All payments are non-refundable</li>
            </ul>
            <p className="text-foreground text-sm leading-relaxed">
              Payments are processed through Stripe. We do not store credit card information.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-foreground mb-3">7. Cancellation Policy</h2>
            <p className="text-foreground text-sm leading-relaxed mb-3">
              You may cancel your subscription at any time through your account settings or by contacting support.
            </p>
            <ul className="list-disc ml-6 space-y-1 text-foreground text-sm">
              <li>Cancellations take effect at the end of the current billing period</li>
              <li>You retain access to the Service until the end of your paid period</li>
              <li>To cancel, go to Settings → Billing or email support@baileysanalytics.com</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-foreground mb-3">8. No Refunds</h2>
            <p className="text-foreground text-sm leading-relaxed mb-3">
              All payments are final and non-refundable, including the $1 trial period.
            </p>
            <p className="text-foreground text-sm leading-relaxed mb-3">
              For billing errors or unauthorized charges, contact us within 60 days. We will investigate and respond
              within 5 business days. Legitimate billing errors will be corrected. Chargebacks initiated without
              contacting us first may result in account suspension.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-foreground mb-3">9. Acceptable Use</h2>
            <p className="text-foreground text-sm leading-relaxed mb-3">You agree not to:</p>
            <ul className="list-disc ml-6 space-y-1 text-foreground text-sm">
              <li>Use the Service for any unlawful purpose</li>
              <li>Attempt to gain unauthorized access to any portion of the Service</li>
              <li>Interfere with or disrupt the Service or servers</li>
              <li>Reverse engineer or attempt to extract the source code</li>
              <li>Resell or redistribute the Service without permission</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-foreground mb-3">10. Intellectual Property</h2>
            <p className="text-foreground text-sm leading-relaxed">
              The Service and its original content, features, and functionality are owned by Baileys Analytics and are
              protected by copyright, trademark, and other intellectual property laws. Your data remains your property.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-foreground mb-3">11. Data Accuracy Disclaimer</h2>
            <div className="bg-warning-subtle border-l-4 border-warning p-4 rounded">
              <p className="text-sm leading-relaxed font-medium text-warning-fg">
                Baileys Analytics is an analytics and reporting tool. Financial reports are provided for informational
                purposes only. You should consult with qualified professionals for tax, legal, and financial advice.
                We are not responsible for decisions made based on our reports.
              </p>
            </div>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-foreground mb-3">12. Limitation of Liability</h2>
            <p className="text-foreground text-sm leading-relaxed">
              TO THE MAXIMUM EXTENT PERMITTED BY LAW, BAILEYS ANALYTICS SHALL NOT BE LIABLE FOR ANY INDIRECT, INCIDENTAL,
              SPECIAL, CONSEQUENTIAL, OR PUNITIVE DAMAGES, INCLUDING BUT NOT LIMITED TO LOSS OF PROFITS, DATA, USE, OR
              GOODWILL, ARISING OUT OF OR RELATED TO YOUR USE OF THE SERVICE.
            </p>
            <p className="text-foreground text-sm leading-relaxed mt-3">
              Our total liability shall not exceed the amount you paid us in the twelve months preceding the claim.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-foreground mb-3">13. Service Availability</h2>
            <p className="text-foreground text-sm leading-relaxed">
              We strive to maintain high availability but do not guarantee uninterrupted access. The Service may be
              temporarily unavailable due to maintenance, updates, or factors beyond our control.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-foreground mb-3">14. Termination</h2>
            <p className="text-foreground text-sm leading-relaxed">
              You may terminate your account at any time. We may suspend or terminate your account for violations of
              these Terms. Upon termination, your right to use the Service will cease immediately.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-foreground mb-3">15. Data Export and Deletion</h2>
            <p className="text-foreground text-sm leading-relaxed">
              You can export your data at any time through the Service as JSON or PDF. Upon account termination, we retain your
              data for 30 days to allow for export, after which it is permanently deleted unless required by law
              to retain it longer.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-foreground mb-3">16. Changes to Terms</h2>
            <p className="text-foreground text-sm leading-relaxed">
              We reserve the right to modify these Terms at any time. We will notify you of significant changes via
              email or through the Service. Continued use after changes constitutes acceptance of the new Terms.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-foreground mb-3">17. Governing Law</h2>
            <p className="text-foreground text-sm leading-relaxed">
              These Terms shall be governed by and construed in accordance with the laws of the United States and the
              State of Wisconsin, without regard to its conflict of law provisions.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-foreground mb-3">18. Contact</h2>
            <p className="text-foreground text-sm leading-relaxed">
              For questions about these Terms or for support, email us
              at <a href="mailto:support@baileysanalytics.com" className="text-primary hover:text-primary/80">support@baileysanalytics.com</a>.
            </p>
          </section>
        </div>
      </div>
    </DocsLayout>
  )
}
