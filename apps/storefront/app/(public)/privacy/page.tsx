import type { Metadata } from 'next';
import { createMetadata } from '@/lib/metadata';
import { LegalPage } from '@/components/store/legal-page';
import { getStoreSettings } from '@/lib/store-settings';

export const metadata: Metadata = createMetadata({
  title: 'Privacy Policy - Jose Madrid Salsa',
  description: 'Learn how Jose Madrid Salsa collects, uses, and protects your personal information.',
  pathname: '/privacy',
});

export const dynamic = 'force-dynamic';

export default async function PrivacyPolicyPage() {
  const settings = await getStoreSettings();

  return (
    <LegalPage title="Privacy Policy" content={settings.privacyContent}>
      <p className="text-sm text-muted-foreground mb-10">Last updated: 2026</p>

      <div className="prose prose-slate dark:prose-invert max-w-none">
            <p>
              This Privacy Policy describes how we collect, use, and disclose your information when you use our
              website and services. By accessing or using our site, you agree to the collection and use of
              information in accordance with this policy.
            </p>

            <h2>Information We Collect</h2>
            <ul>
              <li>
                <strong>Information you provide</strong>: name, email, shipping/billing address, payment details (processed
                securely by our payment providers), account credentials, and communication content.
              </li>
              <li>
                <strong>Automatic information</strong>: device and browser data, IP address, pages viewed, and cookies to improve
                site performance and your experience.
              </li>
            </ul>

            <h2>How We Use Your Information</h2>
            <ul>
              <li>Process and fulfill orders, provide customer support, and maintain your account.</li>
              <li>Send transactional emails and, with your consent, marketing communications (you may opt out at any time).</li>
              <li>Improve our products, services, and website functionality and security.</li>
              <li>Comply with legal obligations and enforce our terms.</li>
            </ul>

            <h2>Sharing of Information</h2>
            <p>
              We do not sell your personal information. We may share information with trusted service providers
              (e.g., payment processors, shipping carriers, analytics and email providers) who perform services on
              our behalf under appropriate confidentiality and data protection terms, and as required by law.
            </p>

            <h2>Cookies and Tracking</h2>
            <p>
              We use cookies and similar technologies to remember your preferences, keep you signed in, and analyze
              site traffic. You can control cookies through your browser settings; disabling cookies may impact site
              functionality.
            </p>

            <h2>Data Security</h2>
            <p>
              We implement administrative, technical, and physical safeguards designed to protect your information.
              No method of transmission or storage is 100% secure; we strive to use commercially acceptable means to
              protect your personal data.
            </p>

            <h2>Your Choices and Rights</h2>
            <ul>
              <li>Access, update, or delete certain account information in your account settings.</li>
              <li>Unsubscribe from marketing emails using the link in those emails.</li>
              <li>Contact us to exercise applicable privacy rights based on your jurisdiction.</li>
            </ul>

            <h2>Children's Privacy</h2>
            <p>
              Our services are not directed to children under 13. We do not knowingly collect personal information from
              children. If you believe a child has provided us personal information, please contact us to remove it.
            </p>

            <h2>International Transfers</h2>
            <p>
              If you access our services from outside the United States, your information may be processed in the U.S.,
              where data protection laws may differ from those in your jurisdiction.
            </p>

            <h2>Changes to This Policy</h2>
            <p>
              We may update this Privacy Policy from time to time. Changes will be posted on this page with an updated
              “Last updated” date. Your continued use of the site after changes indicates acceptance of the updated policy.
            </p>

            <h2>Contact Us</h2>
            <p>
              If you have questions about this Privacy Policy or our data practices, please contact us at
              <a href="mailto:mike@josemadridsalsa.com"> mike@josemadridsalsa.com</a>.
            </p>
      </div>
    </LegalPage>
  );
}


