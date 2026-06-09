import type { Metadata } from 'next';
import { createMetadata } from '@/lib/metadata';

export const dynamic = 'force-dynamic'

export const metadata: Metadata = createMetadata({
  title: 'Cookie Policy - Jose Madrid Salsa',
  description: 'Learn about how Jose Madrid Salsa uses cookies and similar technologies on our website.',
  pathname: '/cookies',
});

export default function CookiePolicyPage() {
  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-4 py-12">
        <div className="max-w-3xl mx-auto">
          <h1 className="text-3xl md:text-4xl font-serif font-bold text-foreground mb-6">Cookie Policy</h1>
          <p className="text-sm text-muted-foreground mb-10">Last updated: {new Date().getFullYear()}</p>

          <div className="prose prose-slate dark:prose-invert max-w-none">
            <p>
              This Cookie Policy explains how Jose Madrid Salsa uses cookies and similar technologies on our website.
              By using our site, you consent to the use of cookies in accordance with this policy.
            </p>

            <h2>What Are Cookies?</h2>
            <p>
              Cookies are small text files that are placed on your device when you visit a website. They are widely
              used to make websites work more efficiently and provide information to website owners.
            </p>

            <h2>How We Use Cookies</h2>
            <p>We use cookies for the following purposes:</p>
            <ul>
              <li>
                <strong>Essential Cookies</strong>: Required for the website to function properly, including authentication,
                security, and maintaining your session.
              </li>
              <li>
                <strong>Functional Cookies</strong>: Remember your preferences and settings to enhance your experience,
                such as language preferences and theme settings.
              </li>
              <li>
                <strong>Analytics Cookies</strong>: Help us understand how visitors interact with our website by
                collecting and reporting information anonymously.
              </li>
              <li>
                <strong>Performance Cookies</strong>: Collect information about how you use our website to help us improve
                site performance and user experience.
              </li>
            </ul>

            <h2>Third-Party Cookies</h2>
            <p>
              We may use third-party services that set cookies on your device, such as:
            </p>
            <ul>
              <li>Google Analytics for website analytics</li>
              <li>Payment processors for secure transaction processing</li>
              <li>Social media platforms for sharing features</li>
            </ul>
            <p>
              These third parties have their own privacy policies and cookie practices. We encourage you to review them.
            </p>

            <h2>Managing Cookies</h2>
            <p>
              You can control and manage cookies in various ways:
            </p>
            <ul>
              <li>
                <strong>Browser Settings</strong>: Most browsers allow you to refuse or accept cookies, delete existing
                cookies, and set preferences for cookie handling. Check your browser's help section for instructions.
              </li>
              <li>
                <strong>Opt-Out Tools</strong>: You can opt out of certain analytics cookies through tools provided by
                third-party services.
              </li>
            </ul>
            <p>
              Please note that disabling certain cookies may impact the functionality of our website and your user experience.
            </p>

            <h2>Types of Cookies We Use</h2>
            <table className="w-full border-collapse border border-gray-300 dark:border-gray-700 my-4">
              <thead>
                <tr className="bg-gray-100 dark:bg-gray-800">
                  <th className="border border-gray-300 dark:border-gray-700 p-2 text-left">Cookie Type</th>
                  <th className="border border-gray-300 dark:border-gray-700 p-2 text-left">Purpose</th>
                  <th className="border border-gray-300 dark:border-gray-700 p-2 text-left">Duration</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td className="border border-gray-300 dark:border-gray-700 p-2">Session Cookies</td>
                  <td className="border border-gray-300 dark:border-gray-700 p-2">Maintain your login session</td>
                  <td className="border border-gray-300 dark:border-gray-700 p-2">Session</td>
                </tr>
                <tr>
                  <td className="border border-gray-300 dark:border-gray-700 p-2">Preference Cookies</td>
                  <td className="border border-gray-300 dark:border-gray-700 p-2">Remember your settings and preferences</td>
                  <td className="border border-gray-300 dark:border-gray-700 p-2">Up to 1 year</td>
                </tr>
                <tr>
                  <td className="border border-gray-300 dark:border-gray-700 p-2">Analytics Cookies</td>
                  <td className="border border-gray-300 dark:border-gray-700 p-2">Help us understand website usage</td>
                  <td className="border border-gray-300 dark:border-gray-700 p-2">Up to 2 years</td>
                </tr>
              </tbody>
            </table>

            <h2>Updates to This Policy</h2>
            <p>
              We may update this Cookie Policy from time to time to reflect changes in our practices or for other
              operational, legal, or regulatory reasons. Changes will be posted on this page with an updated "Last updated" date.
            </p>

            <h2>Contact Us</h2>
            <p>
              If you have questions about our use of cookies, please contact us at
              <a href="mailto:support@josemadrid.net"> support@josemadrid.net</a>.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

