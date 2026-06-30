import type { Metadata } from 'next';
import { createMetadata } from '@/lib/metadata';

export const metadata: Metadata = createMetadata({
  title: 'Return Policy - Jose Madrid Salsa',
  description: 'Our return policy: return unopened jars within 14 days for a refund.',
  pathname: '/returns',
});

export const dynamic = 'force-dynamic';

export default function ReturnPolicyPage() {
  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-4 py-12">
        <div className="max-w-3xl mx-auto">
          <h1 className="text-3xl md:text-4xl font-serif font-bold text-foreground mb-6">Return Policy</h1>
          <p className="text-sm text-muted-foreground mb-10">Last updated: {new Date().getFullYear()}</p>

          <div className="prose prose-slate dark:prose-invert max-w-none">
            <p>
              We want you to be completely satisfied with your purchase from Jose Madrid Salsa. If you would like to
              return a product, please review the terms below.
            </p>

            <h2>Return Window</h2>
            <p>
              You have <strong>14 days</strong> from the date you receive your order to return your product for a
              refund. Returns requested after this 14-day period cannot be accepted.
            </p>

            <h2>Eligible Items</h2>
            <p>
              <strong>Only unopened jars will be accepted for return.</strong> Any jar that has been opened, used, or is
              no longer in its original sealed condition is not eligible for a refund.
            </p>

            <h2>Shipping &amp; Handling</h2>
            <p>
              Customers are responsible for all shipping and handling costs associated with returning a product. Return
              shipping and handling charges are non-refundable. We recommend using a trackable shipping method, as we
              cannot issue a refund for items that do not reach us.
            </p>

            <h2>How to Initiate a Return</h2>
            <p>
              To start a return, please contact our customer support team at
              <a href="mailto:mike@josemadridsalsa.com"> mike@josemadridsalsa.com</a> with your order number. We will
              provide you with return instructions.
            </p>

            <h2>Refund Processing</h2>
            <ul>
              <li>
                Once we receive and inspect your returned unopened jars, we will process your refund to the original
                payment method used for the purchase.
              </li>
              <li>The cost of return shipping and handling is not included in your refund.</li>
            </ul>

            <h2>Contact Us</h2>
            <p>
              If you have questions about our return policy or need assistance with your order, please contact us at
              <a href="mailto:mike@josemadridsalsa.com"> mike@josemadridsalsa.com</a>. We are here to help.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
