import type { Metadata } from 'next';
import { createMetadata } from '@/lib/metadata';

export const metadata: Metadata = createMetadata({
  title: 'Shipping Policy - Jose Madrid Salsa',
  description: 'Learn about shipping methods, delivery times, and shipping costs for Jose Madrid Salsa products.',
  pathname: '/shipping',
});

export const dynamic = 'force-dynamic';

export default function ShippingPolicyPage() {
  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-4 py-12">
        <div className="max-w-3xl mx-auto">
          <h1 className="text-3xl md:text-4xl font-serif font-bold text-foreground mb-6">Shipping Policy</h1>
          <p className="text-sm text-muted-foreground mb-10">Last updated: {new Date().getFullYear()}</p>

          <div className="prose prose-slate dark:prose-invert max-w-none">
            <p>
              This Shipping Policy outlines how we process and ship orders for Jose Madrid Salsa products.
              We strive to deliver your order quickly and safely. If you have questions about your shipment,
              please contact our support team.
            </p>

            <h2>Order Processing</h2>
            <p>
              Orders are typically processed within 1-2 business days (Monday-Friday, excluding holidays).
              Orders placed on weekends or holidays will be processed on the next business day. You will
              receive a confirmation email when your order is placed and a shipping notification with tracking
              information once your order ships.
            </p>

            <h2>Shipping Methods and Costs</h2>
            <p>
              We offer one shipping option:
            </p>
            <ul>
              <li>
                <strong>Standard Shipping</strong>: 5-7 business days. Rates calculated at checkout based on order weight
                and destination.
              </li>
            </ul>
            <p>
              Free standard shipping may be available on orders over a certain amount. Promotions and shipping costs
              are displayed at checkout before you complete your purchase.
            </p>

            <h2>Shipping Carriers</h2>
            <p>
              We partner with trusted carriers including USPS, UPS, and FedEx to ensure reliable delivery.
              The carrier for your order will be selected based on your shipping method and destination.
            </p>

            <h2>Delivery Timeframes</h2>
            <p>
              Estimated delivery times begin after your order ships and are provided by the carrier. These are
              estimates only and not guarantees. Actual delivery times may vary due to weather conditions,
              carrier delays, or other circumstances beyond our control. Remote or rural areas may experience
              longer delivery times.
            </p>

            <h2>Order Tracking</h2>
            <p>
              Once your order ships, you will receive an email with tracking information. You can use this
              tracking number on the carrier's website to monitor your shipment's progress. Tracking information
              may take 24-48 hours to become active after your order ships.
            </p>

            <h2>Shipping Restrictions</h2>
            <p>
              Currently, we ship within the United States only. We do not ship to P.O. boxes for certain products
              or shipping methods. If you have questions about shipping to your address, please contact us before
              placing your order.
            </p>

            <h2>International Shipping</h2>
            <p>
              International shipping is not currently available. We are working to expand our shipping options
              and hope to offer international delivery in the future. Please check back for updates.
            </p>

            <h2>Delivery Issues</h2>
            <p>
              If your order does not arrive within the estimated timeframe, first check the tracking information
              for updates. If the tracking shows delivered but you have not received your package:
            </p>
            <ul>
              <li>Check with neighbors or household members who may have accepted the delivery.</li>
              <li>Look around your delivery location for a safe place the carrier may have left the package.</li>
              <li>Contact the carrier directly using your tracking number for more information.</li>
              <li>If you still cannot locate your package, contact us at mike@josemadridsalsa.com and we will assist you.</li>
            </ul>

            <h2>Damaged or Lost Packages</h2>
            <p>
              While rare, packages may occasionally be damaged during shipping. If you receive a damaged package,
              please take photos of the packaging and product and contact us immediately at
              <a href="mailto:mike@josemadridsalsa.com"> mike@josemadridsalsa.com</a>. We will work with you and the
              carrier to resolve the issue. For lost packages, we will investigate with the carrier and provide
              a replacement or refund as appropriate.
            </p>

            <h2>Address Changes</h2>
            <p>
              Please ensure your shipping address is correct before completing your order. Once an order has shipped,
              we cannot change the delivery address. Contact us immediately if you need to update your address
              before shipment. You may be able to request address changes directly with the carrier using your
              tracking information, though this is not always possible.
            </p>

            <h2>Perishable Products</h2>
            <p>
              Some of our products are perishable and require special handling. These items may be shipped with
              ice packs or insulated packaging to maintain freshness. Perishable items are typically shipped at
              the beginning of the week to avoid weekend delays. Please refrigerate perishable products immediately
              upon arrival.
            </p>

            <h2>Contact Us</h2>
            <p>
              If you have questions about shipping, tracking, or delivery, please contact us at
              <a href="mailto:mike@josemadridsalsa.com"> mike@josemadridsalsa.com</a>. We're here to help ensure
              your order arrives safely and on time.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
