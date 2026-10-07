/**
 * Manual Email Testing Script
 *
 * This script helps send test emails to real email addresses for manual client testing.
 * Run with: npx tsx tests/email/send-test-emails.ts
 *
 * Usage:
 *   npx tsx tests/email/send-test-emails.ts --to your-email@gmail.com
 *   npx tsx tests/email/send-test-emails.ts --to test@example.com --type order-confirmation
 *   npx tsx tests/email/send-test-emails.ts --to test@example.com --all
 */

import { OrderConfirmationEmail } from '@/emails/order-confirmation';
import { ShippingNotificationEmail } from '@/emails/shipping-notification';
import { DeliveryConfirmationEmail } from '@/emails/delivery-confirmation';
import { ContactFormEmail } from '@/emails/contact-form';
import { sendEmail } from '@/lib/email/client';

// Sample test data
const TEST_ORDER_DATA = {
  orderNumber: 'TEST-2026-001',
  orderDate: new Date().toISOString(),
  customerName: 'Test Customer',
  email: 'test@example.com',
  shippingAddress: '123 Main Street, Apt 4B, San Francisco, CA 94102, US',
  items: [
    {
      productName: 'Jose Madrid Salsa - Mild Heat',
      quantity: 2,
      totalPrice: 17.98,
      productSku: 'JMS-MILD-001',
    },
    {
      productName: 'Jose Madrid Salsa - Medium Heat',
      quantity: 1,
      totalPrice: 8.99,
      productSku: 'JMS-MEDIUM-001',
    },
    {
      productName: 'Jose Madrid Salsa - Hot Heat',
      quantity: 3,
      totalPrice: 29.97,
      productSku: 'JMS-HOT-001',
    },
  ],
  total: 47.94,
  trackingUrl: 'https://josemadridsalsa.com/orders/TEST-2026-001',
};

const TEST_SHIPPING_DATA = {
  orderNumber: 'TEST-2026-001',
  trackingNumber: '1Z999AA10123456784',
  trackingUrl: 'https://www.ups.com/track?tracknum=1Z999AA10123456784',
  carrier: 'UPS',
  estimatedDelivery: '2026-02-20',
  shippingAddress: TEST_ORDER_DATA.shippingAddress,
  items: TEST_ORDER_DATA.items,
};

const TEST_DELIVERY_DATA = {
  orderNumber: 'TEST-2026-001',
  deliveryDate: new Date().toISOString(),
  shippingAddress: TEST_ORDER_DATA.shippingAddress,
  items: TEST_ORDER_DATA.items,
  feedbackUrl: 'https://josemadridsalsa.com/review?order=TEST-2026-001',
  orderDetailsUrl: 'https://josemadridsalsa.com/orders/TEST-2026-001',
};

const TEST_CONTACT_DATA = {
  name: 'Test Customer',
  email: 'customer@example.com',
  phone: '555-123-4567',
  message: 'This is a test contact form submission. I have a question about my recent order #TEST-2026-001. Can you help me track my shipment?',
  submittedAt: new Date().toISOString(),
};

async function sendOrderConfirmationTest(toEmail: string) {
  console.log('📧 Sending Order Confirmation test email...');

  const result = await sendEmail({
    to: toEmail,
    subject: `[TEST] Order Confirmation - #${TEST_ORDER_DATA.orderNumber}`,
    react: OrderConfirmationEmail({
      name: TEST_ORDER_DATA.customerName,
      orderNumber: TEST_ORDER_DATA.orderNumber,
      orderDate: TEST_ORDER_DATA.orderDate,
      orderTotal: `$${TEST_ORDER_DATA.total.toFixed(2)}`,
      items: TEST_ORDER_DATA.items,
      shippingAddress: TEST_ORDER_DATA.shippingAddress,
      trackingLink: TEST_ORDER_DATA.trackingUrl,
    }),
    type: 'order-confirmation',
    orderId: TEST_ORDER_DATA.orderNumber,
  });

  if (result.success) {
    console.log('✅ Order Confirmation email sent successfully!');
    console.log(`   Email ID: ${result.data?.id}`);
  } else {
    console.error('❌ Failed to send Order Confirmation email:', result.error);
  }

  return result;
}

async function sendShippingNotificationTest(toEmail: string) {
  console.log('📧 Sending Shipping Notification test email...');

  const result = await sendEmail({
    to: toEmail,
    subject: `[TEST] Your Order Has Shipped - #${TEST_SHIPPING_DATA.orderNumber}`,
    react: ShippingNotificationEmail(TEST_SHIPPING_DATA),
    type: 'shipping-notification',
    orderId: TEST_SHIPPING_DATA.orderNumber,
  });

  if (result.success) {
    console.log('✅ Shipping Notification email sent successfully!');
    console.log(`   Email ID: ${result.data?.id}`);
  } else {
    console.error('❌ Failed to send Shipping Notification email:', result.error);
  }

  return result;
}

async function sendDeliveryConfirmationTest(toEmail: string) {
  console.log('📧 Sending Delivery Confirmation test email...');

  const result = await sendEmail({
    to: toEmail,
    subject: `[TEST] Your Order Has Been Delivered - #${TEST_DELIVERY_DATA.orderNumber}`,
    react: DeliveryConfirmationEmail(TEST_DELIVERY_DATA),
    type: 'delivery-confirmation',
    orderId: TEST_DELIVERY_DATA.orderNumber,
  });

  if (result.success) {
    console.log('✅ Delivery Confirmation email sent successfully!');
    console.log(`   Email ID: ${result.data?.id}`);
  } else {
    console.error('❌ Failed to send Delivery Confirmation email:', result.error);
  }

  return result;
}

async function sendContactFormTest(toEmail: string) {
  console.log('📧 Sending Contact Form test email...');

  const result = await sendEmail({
    to: toEmail,
    subject: '[TEST] New Contact Form Submission',
    react: ContactFormEmail(TEST_CONTACT_DATA),
    type: 'contact-form',
    replyTo: TEST_CONTACT_DATA.email,
  });

  if (result.success) {
    console.log('✅ Contact Form email sent successfully!');
    console.log(`   Email ID: ${result.data?.id}`);
  } else {
    console.error('❌ Failed to send Contact Form email:', result.error);
  }

  return result;
}

async function main() {
  const args = process.argv.slice(2);

  // Parse command line arguments
  const toIndex = args.indexOf('--to');
  const typeIndex = args.indexOf('--type');
  const allFlag = args.includes('--all');

  if (toIndex === -1 || !args[toIndex + 1]) {
    console.error('❌ Error: --to email address is required');
    console.log('\nUsage:');
    console.log('  npx tsx tests/email/send-test-emails.ts --to your-email@gmail.com');
    console.log('  npx tsx tests/email/send-test-emails.ts --to test@example.com --type order-confirmation');
    console.log('  npx tsx tests/email/send-test-emails.ts --to test@example.com --all');
    console.log('\nAvailable types:');
    console.log('  - order-confirmation');
    console.log('  - shipping-notification');
    console.log('  - delivery-confirmation');
    console.log('  - contact-form');
    process.exit(1);
  }

  const toEmail = args[toIndex + 1];
  const emailType = typeIndex !== -1 ? args[typeIndex + 1] : null;

  console.log('🚀 Email Testing Script');
  console.log('========================\n');
  console.log(`Sending to: ${toEmail}\n`);

  try {
    if (allFlag || !emailType) {
      // Send all test emails
      console.log('Sending all test emails...\n');

      await sendOrderConfirmationTest(toEmail);
      console.log('');

      await new Promise(resolve => setTimeout(resolve, 1000)); // Wait 1s between emails
      await sendShippingNotificationTest(toEmail);
      console.log('');

      await new Promise(resolve => setTimeout(resolve, 1000));
      await sendDeliveryConfirmationTest(toEmail);
      console.log('');

      await new Promise(resolve => setTimeout(resolve, 1000));
      await sendContactFormTest(toEmail);
      console.log('');

      console.log('✨ All test emails sent!');
    } else {
      // Send specific email type
      switch (emailType) {
        case 'order-confirmation':
          await sendOrderConfirmationTest(toEmail);
          break;
        case 'shipping-notification':
          await sendShippingNotificationTest(toEmail);
          break;
        case 'delivery-confirmation':
          await sendDeliveryConfirmationTest(toEmail);
          break;
        case 'contact-form':
          await sendContactFormTest(toEmail);
          break;
        default:
          console.error(`❌ Unknown email type: ${emailType}`);
          console.log('Available types: order-confirmation, shipping-notification, delivery-confirmation, contact-form');
          process.exit(1);
      }
    }

    console.log('\n📋 Next Steps:');
    console.log('1. Check your inbox at:', toEmail);
    console.log('2. Verify emails in Gmail, Outlook, Apple Mail, Yahoo');
    console.log('3. Check spam folder if not in inbox');
    console.log('4. Test all links and buttons');
    console.log('5. Verify mobile rendering');
    console.log('6. Check Resend dashboard: https://resend.com/emails');
    console.log('7. Document results in manual-testing-guide.md checklist');

  } catch (error) {
    console.error('❌ Error sending test emails:', error);
    process.exit(1);
  }
}

// Run the script
main();
