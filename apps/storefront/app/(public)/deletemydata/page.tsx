import type { Metadata } from 'next';
import { createMetadata } from '@/lib/metadata';

const supportEmail = process.env.NEXT_PUBLIC_SUPPORT_EMAIL ?? 'mike@josemadridsalsa.com';

export const metadata: Metadata = createMetadata({
  title: 'Delete My Data - Jose Madrid Salsa',
  description: 'How to request deletion of your personal data and account from Jose Madrid Salsa.',
  pathname: '/deletemydata',
});

export const dynamic = 'force-dynamic';

export default function DeleteMyDataPage() {
  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-4 py-12">
        <div className="max-w-3xl mx-auto">
          <h1 className="text-3xl md:text-4xl font-serif font-bold text-foreground mb-6">Delete My Data</h1>
          <p className="text-sm text-muted-foreground mb-10">Last updated: {new Date().getFullYear()}</p>

          <div className="prose prose-slate dark:prose-invert max-w-none">
            <p>
              You can request that we delete your account and the personal data associated with it at any time.
              Follow the steps below and we will process your request.
            </p>

            <h2>How to Request Deletion</h2>
            <ol>
              <li>
                Email us at <a href={`mailto:${supportEmail}`}>{supportEmail}</a> from the email address associated
                with your account, using the subject line <strong>&ldquo;Delete My Data&rdquo;</strong>.
              </li>
              <li>
                Include the full name and email address on your account so we can locate and verify it. If you signed
                in with Facebook or Google, please tell us which provider you used.
              </li>
              <li>
                We may contact you to confirm your identity before deleting any data, to protect your account from
                unauthorized requests.
              </li>
            </ol>

            <h2>What We Delete</h2>
            <p>When we process your request, we permanently remove the personal data we hold about you, including:</p>
            <ul>
              <li>Your account profile (name, email, and login credentials).</li>
              <li>Saved shipping and billing addresses.</li>
              <li>Marketing and communication preferences.</li>
            </ul>

            <h2>What We May Retain</h2>
            <p>
              We may retain certain records where we are legally required to do so or where they are necessary for
              legitimate business purposes, such as completed order and transaction history needed for tax,
              accounting, fraud-prevention, and warranty obligations. Payment card details are handled by our payment
              providers and are not stored on our systems. Any retained records are kept only as long as required and
              are protected in accordance with our{' '}
              <a href="/privacy">Privacy Policy</a>.
            </p>

            <h2>Processing Time</h2>
            <p>
              We aim to complete verified deletion requests within 30 days. We will email you to confirm once your
              data has been deleted.
            </p>

            <h2>Questions</h2>
            <p>
              If you have any questions about deleting your data, contact us at{' '}
              <a href={`mailto:${supportEmail}`}>{supportEmail}</a>.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
