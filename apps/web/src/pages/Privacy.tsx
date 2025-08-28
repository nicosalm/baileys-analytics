import { LegalLayout } from '@/components/LegalLayout'

export const Privacy = () => {
  return (
    <LegalLayout>
      <div className="prose prose-gray max-w-none">
        <h1 className="text-3xl font-bold text-gray-900 mb-4">Privacy Policy</h1>
        <p className="text-sm text-gray-500 mb-8">Effective Date: January 1, 2025</p>

        <div className="space-y-8 text-gray-700">
          <section>
            <p className="leading-relaxed">
              At Baileys Analytics, we take your privacy seriously. This Privacy Policy explains how we collect, use,
              disclose, and safeguard your information when you use our vacation rental analytics service.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 mb-3">1. Information We Collect</h2>

            <h3 className="text-lg font-medium text-gray-800 mt-4 mb-2">Account Information</h3>
            <p className="leading-relaxed mb-3">When you create an account, we collect:</p>
            <ul className="list-disc ml-6 space-y-1">
              <li>Email address</li>
              <li>Password (encrypted)</li>
              <li>Company name (optional)</li>
              <li>Payment information (processed securely through our payment provider)</li>
            </ul>

            <h3 className="text-lg font-medium text-gray-800 mt-4 mb-2">OwnerRez Data</h3>
            <p className="leading-relaxed mb-3">When you connect your OwnerRez account, we access and store:</p>
            <ul className="list-disc ml-6 space-y-1">
              <li>Property details (names, addresses, configurations)</li>
              <li>Booking information (dates, amounts, platforms)</li>
              <li>Guest information (names, and if provided by you: email addresses, phone numbers)</li>
              <li>Financial data (revenues, fees, taxes)</li>
              <li>Platform-specific data (Airbnb, VRBO, direct bookings)</li>
            </ul>

            <h3 className="text-lg font-medium text-gray-800 mt-4 mb-2">Usage Data</h3>
            <p className="leading-relaxed mb-3">We automatically collect:</p>
            <ul className="list-disc ml-6 space-y-1">
              <li>Log data (IP address, browser type, pages visited)</li>
              <li>Device information (operating system, device type)</li>
              <li>Cookies and similar tracking technologies</li>
              <li>Feature usage patterns and preferences</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 mb-3">2. How We Use Your Information</h2>
            <p className="leading-relaxed mb-3">We use your information to:</p>
            <ul className="list-disc ml-6 space-y-1">
              <li>Provide and maintain our analytics service</li>
              <li>Generate reports, dashboards, and insights</li>
              <li>Calculate taxes and financial metrics</li>
              <li>Send service-related communications</li>
              <li>Process payments and manage subscriptions</li>
              <li>Improve and develop new features</li>
              <li>Provide customer support</li>
              <li>Detect and prevent fraud or abuse</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 mb-3">3. Data Storage and Security</h2>
            <p className="leading-relaxed mb-3">
              Your data is stored on secure servers in the United States. We implement industry-standard security measures including:
            </p>
            <ul className="list-disc ml-6 space-y-1">
              <li>Encryption of data in transit and at rest</li>
              <li>Regular security audits and updates</li>
              <li>Access controls and authentication</li>
              <li>Isolated tenant data architecture</li>
              <li>Regular automated backups</li>
            </ul>
            <p className="leading-relaxed mt-3">
              While we strive to protect your information, no method of transmission over the Internet is 100% secure.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 mb-3">4. Information Sharing</h2>
            <p className="leading-relaxed mb-3">
              We do not sell, trade, or rent your personal information. We may share your information only in these circumstances:
            </p>
            <ul className="list-disc ml-6 space-y-1">
              <li><strong>With your consent:</strong> When you explicitly authorize us to share information</li>
              <li><strong>Service providers:</strong> With trusted third parties who assist in operating our service (e.g., payment processors, hosting providers)</li>
              <li><strong>Legal requirements:</strong> When required by law, subpoena, or legal process</li>
              <li><strong>Protection of rights:</strong> To protect the rights, property, or safety of Baileys Analytics, our users, or the public</li>
              <li><strong>Business transfers:</strong> In connection with a merger, acquisition, or sale of assets</li>
            </ul>
            <p className="leading-relaxed mt-3">
              We never share your OwnerRez data or analytics with other users or competitors.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 mb-3">5. Your Rights and Choices</h2>

            <h3 className="text-lg font-medium text-gray-800 mt-4 mb-2">Access and Portability</h3>
            <p className="leading-relaxed">
              You can access and export your data at any time through the Service. We provide CSV export functionality
              for all reports and data.
            </p>

            <h3 className="text-lg font-medium text-gray-800 mt-4 mb-2">Correction</h3>
            <p className="leading-relaxed">
              You can update your account information at any time through your account settings. Property and booking
              data is synced from OwnerRez and should be corrected there.
            </p>

            <h3 className="text-lg font-medium text-gray-800 mt-4 mb-2">Deletion</h3>
            <p className="leading-relaxed">
              You can request deletion of your account and all associated data by contacting us. We will delete your
              data within 30 days unless we are required by law to retain it.
            </p>

            <h3 className="text-lg font-medium text-gray-800 mt-4 mb-2">Communication Preferences</h3>
            <p className="leading-relaxed">
              You can opt out of promotional emails using the unsubscribe link in any email. Service-related
              communications cannot be opted out of while you maintain an account.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 mb-3">6. Cookies and Tracking</h2>
            <p className="leading-relaxed mb-3">
              We use cookies and similar technologies to:
            </p>
            <ul className="list-disc ml-6 space-y-1">
              <li>Keep you logged in</li>
              <li>Remember your preferences</li>
              <li>Understand how you use our Service</li>
              <li>Improve our Service</li>
            </ul>
            <p className="leading-relaxed mt-3">
              You can control cookies through your browser settings, but disabling them may limit functionality.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 mb-3">7. Third-Party Services</h2>
            <p className="leading-relaxed mb-3">
              Our Service integrates with:
            </p>
            <ul className="list-disc ml-6 space-y-1">
              <li><strong>OwnerRez:</strong> We access your data through their API under your authorization</li>
              <li><strong>Payment processors:</strong> We use secure payment providers who have their own privacy policies</li>
              <li><strong>Analytics tools:</strong> We may use tools to understand Service usage (in aggregate, not individual)</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 mb-3">8. Data Retention</h2>
            <p className="leading-relaxed mb-3">
              We retain your data for as long as you maintain an active account. After account termination:
            </p>
            <ul className="list-disc ml-6 space-y-1">
              <li>Account data is deleted after 30 days</li>
              <li>Backups may persist for up to 90 days</li>
              <li>Aggregated, anonymized data may be retained indefinitely</li>
              <li>Data required for legal or tax purposes may be retained as required by law</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 mb-3">9. GDPR Compliance</h2>
            <p className="leading-relaxed mb-3">
              For users in the European Economic Area, we comply with GDPR requirements:
            </p>
            <ul className="list-disc ml-6 space-y-1">
              <li>We process data based on legitimate interests and consent</li>
              <li>You have rights to access, rectification, erasure, and portability</li>
              <li>You can object to processing and request restriction</li>
              <li>You can withdraw consent at any time</li>
              <li>You can lodge complaints with supervisory authorities</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 mb-3">10. California Privacy Rights</h2>
            <p className="leading-relaxed mb-3">
              California residents have additional rights under CCPA:
            </p>
            <ul className="list-disc ml-6 space-y-1">
              <li>Right to know what personal information we collect</li>
              <li>Right to delete personal information</li>
              <li>Right to opt-out of sale (we do not sell personal information)</li>
              <li>Right to non-discrimination</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 mb-3">11. Children's Privacy</h2>
            <p className="leading-relaxed">
              Our Service is not intended for children under 13. We do not knowingly collect information from
              children under 13. If we discover such information, we will promptly delete it.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 mb-3">12. Changes to This Policy</h2>
            <p className="leading-relaxed">
              We may update this Privacy Policy from time to time. We will notify you of material changes via
              email or through the Service. Your continued use after changes constitutes acceptance.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 mb-3">13. Customer Support</h2>
            <div className="bg-blue-50 p-6 rounded-lg mb-4">
              <p className="leading-relaxed mb-3">
                <strong>For customer service and general support:</strong>
              </p>
              <div className="space-y-2">
                <p><strong>Email:</strong> support@baileysanalytics.com</p>
                <p><strong>Response Time:</strong> Within 24-48 hours on business days</p>
                <p><strong>Business Hours:</strong> Monday - Friday, 9 AM - 5 PM EST</p>
              </div>
            </div>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 mb-3">14. Contact Information</h2>
            <div className="bg-gray-50 p-6 rounded-lg">
              <p className="leading-relaxed">
                For questions about this Privacy Policy or our privacy practices, contact us at:
              </p>
              <div className="mt-3 space-y-1">
                <p><strong>Email:</strong> privacy@baileysanalytics.com</p>
                <p><strong>Address:</strong> Baileys Analytics, LLC</p>
                <p><strong>Data Protection Officer:</strong> dpo@baileysanalytics.com</p>
              </div>
            </div>
          </section>

          <section>
            <div className="bg-amber-50 border-l-4 border-amber-400 p-6 rounded mt-8">
              <h3 className="text-lg font-medium text-amber-900 mb-3">Your Privacy Rights Summary</h3>
              <ul className="list-disc ml-6 space-y-1 text-amber-900">
                <li>We only collect data necessary to provide our service</li>
                <li>Your data is never sold or shared with competitors</li>
                <li>You can export or delete your data at any time</li>
                <li>We use industry-standard security measures</li>
                <li>You control your OwnerRez connection and can revoke access anytime</li>
              </ul>
            </div>
          </section>
        </div>
      </div>
    </LegalLayout>
  )
}
