import { Link } from 'react-router-dom'
import { Footer } from '@/components/Footer'

export const Terms = () => {
  return (
    <div className="min-h-screen flex flex-col">
      <nav className="p-4 border-b bg-white">
        <div className="max-w-4xl mx-auto flex justify-between items-center">
          <Link to="/" className="text-xl font-bold">Baileys Analytics</Link>
        </div>
      </nav>

      <main className="flex-1 max-w-4xl mx-auto p-6 py-12">
        <h1 className="text-3xl font-bold mb-8">Terms of Service</h1>
        
        <div className="prose prose-gray max-w-none space-y-6 text-gray-700">
          <p className="text-sm text-gray-500">Effective Date: January 1, 2025</p>

          <section>
            <h2 className="text-xl font-semibold mt-8 mb-4">1. Agreement to Terms</h2>
            <p>
              By accessing or using Baileys Analytics ("Service"), you agree to be bound by these Terms of Service ("Terms"). 
              If you disagree with any part of these terms, you may not access the Service.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mt-8 mb-4">2. Description of Service</h2>
            <p>
              Baileys Analytics provides vacation rental analytics and reporting services by connecting to and analyzing data 
              from your OwnerRez account. Our Service includes dashboards, financial reporting, tax calculations, guest analytics, 
              and various data visualization tools.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mt-8 mb-4">3. Account Registration</h2>
            <p>
              To use our Service, you must create an account and provide accurate, complete, and current information. 
              You are responsible for maintaining the confidentiality of your account credentials and for all activities 
              that occur under your account.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mt-8 mb-4">4. OwnerRez Connection</h2>
            <p>
              Our Service requires you to connect your OwnerRez account via OAuth. By connecting your account, you authorize 
              Baileys Analytics to access and retrieve your property and booking data from OwnerRez for the purpose of providing 
              analytics services. You can revoke this access at any time through your OwnerRez account settings.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mt-8 mb-4">5. Data Usage and Storage</h2>
            <p>
              We store and process your property and booking data to provide our analytics services. This includes:
            </p>
            <ul className="list-disc ml-6 mt-2 space-y-1">
              <li>Property information and configurations</li>
              <li>Booking details, revenues, and guest information</li>
              <li>Financial transactions and platform fees</li>
              <li>Tax configurations and calculations</li>
            </ul>
            <p className="mt-3">
              Your data is isolated from other users and is only accessible through your authenticated account.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mt-8 mb-4">6. Subscription and Payment</h2>
            <p>
              The Service is offered on a subscription basis. Pricing and available subscription tiers are displayed 
              during registration and in your account settings. You agree to pay all fees associated with your selected 
              subscription plan. Subscriptions automatically renew unless cancelled before the renewal date. We reserve 
              the right to change subscription fees upon reasonable notice.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mt-8 mb-4">7. Acceptable Use</h2>
            <p>You agree not to:</p>
            <ul className="list-disc ml-6 mt-2 space-y-1">
              <li>Use the Service for any unlawful purpose</li>
              <li>Attempt to gain unauthorized access to any portion of the Service</li>
              <li>Interfere with or disrupt the Service or servers</li>
              <li>Reverse engineer or attempt to extract the source code</li>
              <li>Resell or redistribute the Service without permission</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold mt-8 mb-4">8. Intellectual Property</h2>
            <p>
              The Service and its original content, features, and functionality are owned by Baileys Analytics and are 
              protected by international copyright, trademark, and other intellectual property laws. Your data remains 
              your property.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mt-8 mb-4">9. Data Accuracy and Tax Disclaimer</h2>
            <p>
              While we strive for accuracy, Baileys Analytics is an analytics and reporting tool. Tax calculations and 
              financial reports are provided for informational purposes only. You should consult with qualified professionals 
              for tax, legal, and financial advice. We are not responsible for any decisions made based on our reports.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mt-8 mb-4">10. Limitation of Liability</h2>
            <p>
              TO THE MAXIMUM EXTENT PERMITTED BY LAW, BAILEYS ANALYTICS SHALL NOT BE LIABLE FOR ANY INDIRECT, INCIDENTAL, 
              SPECIAL, CONSEQUENTIAL, OR PUNITIVE DAMAGES, INCLUDING BUT NOT LIMITED TO LOSS OF PROFITS, DATA, USE, OR 
              GOODWILL, ARISING OUT OF OR RELATED TO YOUR USE OF THE SERVICE.
            </p>
            <p className="mt-3">
              Our total liability shall not exceed the amount you paid us in the twelve months preceding the claim.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mt-8 mb-4">11. Service Availability</h2>
            <p>
              We strive to maintain high availability but do not guarantee uninterrupted access. The Service may be 
              temporarily unavailable due to maintenance, updates, or factors beyond our control.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mt-8 mb-4">12. Termination</h2>
            <p>
              You may terminate your account at any time. We may suspend or terminate your account for violations of 
              these Terms. Upon termination, your right to use the Service will cease immediately.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mt-8 mb-4">13. Data Export and Deletion</h2>
            <p>
              You can export your data at any time through the Service. Upon account termination, we will retain your 
              data for 30 days to allow for export, after which it will be permanently deleted unless required by law 
              to retain it longer.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mt-8 mb-4">14. Changes to Terms</h2>
            <p>
              We reserve the right to modify these Terms at any time. We will notify you of significant changes via 
              email or through the Service. Continued use after changes constitutes acceptance of the new Terms.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mt-8 mb-4">15. Governing Law</h2>
            <p>
              These Terms shall be governed by and construed in accordance with the laws of the United States and the 
              State of Delaware, without regard to its conflict of law provisions.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mt-8 mb-4">16. Contact Information</h2>
            <p>
              For questions about these Terms, please contact us at:<br />
              Email: legal@baileysanalytics.com<br />
              Address: Baileys Analytics, LLC
            </p>
          </section>
        </div>
      </main>

      <Footer />
    </div>
  )
}