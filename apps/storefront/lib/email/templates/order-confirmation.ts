/**
 * Order Confirmation Email Template
 * Transactional email sent after successful purchase
 */

import { EmailTemplateDefinition } from './index'
import { baseStyles, headerImg, jmsFooter } from '../shared/components'

export const orderConfirmationTemplate: EmailTemplateDefinition = {
  key: 'order_confirmation',
  name: 'Order Confirmation',
  subject: 'Order Confirmed #{{orderNumber}}',
  category: 'TRANSACTIONAL',
  description: 'Purchase receipt with order details',
  variables: {
    name: 'string',
    orderNumber: 'string',
    orderDate: 'string',
    orderTotal: 'string',
    orderItems: 'string',
    shippingAddress: 'string',
    trackingLink: 'string',
  },
  html: `
<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"><title>Order Confirmation</title></head>
<body style="${baseStyles.container}">
  <div style="${baseStyles.wrapper}">
    <div style="${baseStyles.header}">
      ${headerImg('order-confirmed.png', 'Order Confirmed')}
    </div>
    <div style="${baseStyles.content}">
      <p style="font-size:16px;margin-bottom:20px;">Hi {{name}},</p>
      <p style="margin-bottom:20px;">Thanks for your order! We've received your payment and are preparing your items for shipment.</p>
      <div style="background:#f8f9fa;padding:25px;border-radius:8px;margin:30px 0;">
        <h3 style="color:#333;margin:0 0 15px;font-size:18px;">Order Summary</h3>
        <div style="margin-bottom:15px;">
          <p style="margin:0 0 5px;color:#6c757d;font-size:14px;">Order Date</p>
          <p style="margin:0;font-size:16px;font-weight:600;">{{orderDate}}</p>
        </div>
        <hr style="${baseStyles.divider}">
        <div>{{orderItems}}</div>
        <hr style="${baseStyles.divider}">
        <div style="text-align:right;">
          <p style="margin:0;font-size:20px;font-weight:700;color:#dc2626;">Total: {{orderTotal}}</p>
        </div>
      </div>
      <div style="background:#e7f5ff;padding:20px;border-radius:8px;border-left:4px solid:#1971c2;margin:30px 0;">
        <p style="margin:0 0 10px;color:#1864ab;font-weight:600;">📦 Shipping Address</p>
        <p style="margin:0;color:#1864ab;white-space:pre-line;">{{shippingAddress}}</p>
      </div>
      <div style="text-align:center;margin:30px 0;">
        <a href="{{trackingLink}}" style="${baseStyles.button}">Track Your Order</a>
      </div>
      <p style="color:#6c757d;font-size:14px;margin-top:30px;">Need help? Contact us at <a href="mailto:mike@josemadridsalsa.com" style="color:#dc2626;">mike@josemadridsalsa.com</a></p>
    </div>
    ${jmsFooter}
  </div>
</body>
</html>`,
  text: `Hi {{name}},

Your order #{{orderNumber}} has been confirmed!

Order Date: {{orderDate}}
Total: {{orderTotal}}

Shipping Address:
{{shippingAddress}}

Track your order: {{trackingLink}}

Questions? Email mike@josemadridsalsa.com`,
}
