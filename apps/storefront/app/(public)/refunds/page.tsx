import type { Metadata } from 'next';
import { createMetadata } from '@/lib/metadata';

export const metadata: Metadata = createMetadata({
  title: 'Return & Refund Policy - Jose Madrid Salsa',
  description: 'Learn about our return and refund policy for Jose Madrid Salsa products.',
  pathname: '/refunds',
});

export const revalidate = 86400; // 24 hours

export default function RefundPolicyPage() {
  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-4 py-12">
        <div className="max-w-3xl mx-auto">
          <h1 className="text-3xl md:text-4xl font-serif font-bold text-foreground mb-6">Return & Refund Policy</h1>
          <p className="text-sm text-muted-foreground mb-10">Last updated: {new Date().getFullYear()}</p>

          <div className="prose prose-slate dark:prose-invert max-w-none">
            <p>
              We want you to be completely satisfied with your purchase from Jose Madrid Salsa. If you are not
              satisfied for any reason, please review our return and refund policy below.
            </p>

            <h2>Return Window</h2>
            <p>
              You may return most items within 30 days of receipt for a full refund or exchange. Items must be
              unused, in their original condition, and in original packaging with all tags attached.
            </p>

            <h2>How to Initiate a Return</h2>
            <p>
              To start a return, please contact our customer support team at
              <a href="mailto:mike@josemadridsalsa.com"> mike@josemadridsalsa.com</a> with your order number and
              reason for return. We will provide you with return instructions and a return authorization if applicable.
            </p>

            <h2>Refund Processing</h2>
            <ul>
              <li>Once we receive and inspect your returned item, we will process your refund within 5-7 business days.</li>
              <li>Refunds are issued to the original payment method used for the purchase.</li>
              <li>Depending on your financial institution, it may take an additional 3-5 business days for the refund to appear in your account.</li>
              <li>You will receive an email confirmation once your refund has been processed.</li>
            </ul>

            <h2>Return Shipping Costs</h2>
            <ul>
              <li>
                <strong>Defective or incorrect items</strong>: We will provide a prepaid return label and cover all return
                shipping costs for items that are defective, damaged, or incorrect.
              </li>
              <li>
                <strong>Change of mind or other reasons</strong>: Customers are responsible for return shipping costs unless
                the return is due to our error.
              </li>
            </ul>

            <h2>Exchanges</h2>
            <p>
              If you would like to exchange an item for a different size, color, or product, please contact us. We will
              work with you to facilitate the exchange. Original shipping charges are non-refundable for exchanges.
            </p>

            <h2>Non-Returnable Items</h2>
            <p>Certain items cannot be returned, including:</p>
            <ul>
              <li>Perishable goods or items marked as final sale.</li>
              <li>Personalized or custom-made products.</li>
              <li>Items that have been opened, used, or are not in their original condition.</li>
              <li>Gift cards or digital products.</li>
            </ul>

            <h2>Damaged or Defective Items</h2>
            <p>
              If you receive a damaged or defective item, please contact us immediately at
              <a href="mailto:mike@josemadridsalsa.com"> mike@josemadridsalsa.com</a> with photos of the damage or defect.
              We will arrange for a replacement or full refund, including return shipping costs.
            </p>

            <h2>Late or Missing Refunds</h2>
            <p>
              If you have not received your refund after the timeframes mentioned above, please:
            </p>
            <ul>
              <li>Check your bank account or credit card statement again.</li>
              <li>Contact your financial institution, as processing times may vary.</li>
              <li>If you have done this and still have not received your refund, please contact us at
                <a href="mailto:mike@josemadridsalsa.com"> mike@josemadridsalsa.com</a>.
              </li>
            </ul>

            <h2>International Returns</h2>
            <p>
              For international orders, customers are responsible for return shipping costs and any applicable customs
              fees. We recommend using a trackable shipping method. Please contact us before returning international
              orders to ensure proper processing.
            </p>

            <h2>Cancellations</h2>
            <p>
              You may cancel your order before it ships by contacting us immediately. Once an order has shipped, you
              will need to follow the standard return process to receive a refund.
            </p>

            <h2>Contact Us</h2>
            <p>
              If you have questions about returns or refunds, or need assistance with your order, please contact us at
              <a href="mailto:mike@josemadridsalsa.com"> mike@josemadridsalsa.com</a>. We are here to help and will work
              with you to resolve any issues.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
