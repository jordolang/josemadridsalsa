import type { Metadata } from 'next';
import { createMetadata } from '@/lib/metadata';
import { LegalPage } from '@/components/store/legal-page';
import { getStoreSettings } from '@/lib/store-settings';

export const metadata: Metadata = createMetadata({
  title: 'Terms of Service - Jose Madrid Salsa',
  description: 'Read the terms that govern the use of Jose Madrid Salsa’s website and services.',
  pathname: '/terms',
});

export const revalidate = 86400; // 24 hours

export default async function TermsOfServicePage() {
  const settings = await getStoreSettings();

  return (
    <LegalPage title="Terms of Service" content={settings.termsContent}>
      <p className="text-sm text-muted-foreground mb-10">Last updated: 2026</p>

      <div className="prose prose-slate dark:prose-invert max-w-none">
        <p>
              These Terms of Service ("Terms") govern your access to and use of our website and services.
              By accessing or using our site, you agree to be bound by these Terms.
            </p>

            <h2>Use of the Site</h2>
            <p>
              You agree to use the site only for lawful purposes and in accordance with these Terms. You are
              responsible for maintaining the confidentiality of your account credentials and for all activities
              occurring under your account.
            </p>

            <h2>Orders, Payment, and Shipping</h2>
            <ul>
              <li>Prices, promotions, and availability are subject to change without notice.</li>
              <li>Payments are processed securely by our payment providers; we do not store full card details.</li>
              <li>Estimated shipping times are not guarantees; delays may occur due to carrier or weather events.</li>
            </ul>

            <h2>Returns and Refunds</h2>
            <p>
              If you are not satisfied with your purchase, please contact support at
              <a href="mailto:mike@josemadridsalsa.com"> mike@josemadridsalsa.com</a>. We will work with you to
              address any issues in accordance with our policies and applicable law.
            </p>

            <h2>Intellectual Property</h2>
            <p>
              All content on the site, including logos, text, graphics, and images, is the property of Jose Madrid
              Salsa or its licensors and is protected by intellectual property laws. You may not copy, modify,
              distribute, or create derivative works without written permission.
            </p>

            <h2>User Content</h2>
            <p>
              If you submit reviews, feedback, or other content, you grant us a non-exclusive, worldwide, royalty-free
              license to use, reproduce, and display that content in connection with our services.
            </p>

            <h2>Third-Party Services</h2>
            <p>
              Our site may contain links to third-party websites or services. We are not responsible for the content
              or practices of third parties. Your use of third-party services is at your own risk.
            </p>

            <h2>Disclaimers and Limitation of Liability</h2>
            <p>
              The site and services are provided "as is" without warranties of any kind. To the fullest extent permitted
              by law, we disclaim all warranties and are not liable for any indirect, incidental, or consequential damages
              arising from your use of the site or services.
            </p>

            <h2>Indemnification</h2>
            <p>
              You agree to indemnify and hold harmless Jose Madrid Salsa, its affiliates, and employees from any claims
              arising out of your use of the site, your violation of these Terms, or your violation of any rights of a third party.
            </p>

            <h2>Changes to These Terms</h2>
            <p>
              We may update these Terms from time to time. Changes will be posted on this page with an updated “Last updated”
              date. Your continued use of the site after changes indicates acceptance of the updated Terms.
            </p>

            <h2>Governing Law</h2>
            <p>
              These Terms are governed by the laws of the State of Ohio, without regard to its conflict of law provisions.
            </p>

            <h2>Contact</h2>
            <p>
              For questions about these Terms, contact us at
              <a href="mailto:mike@josemadridsalsa.com"> mike@josemadridsalsa.com</a>.
            </p>
      </div>
    </LegalPage>
  );
}


