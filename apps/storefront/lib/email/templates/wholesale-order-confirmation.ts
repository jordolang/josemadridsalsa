/**
 * Wholesale Order Confirmation Template
 * Transactional email sent to confirm B2B wholesale orders
 */

import { EmailTemplateDefinition } from './index'
import { baseStyles, headerImg, jmsFooter } from '../shared/components'

export const wholesaleOrderConfirmationTemplate: EmailTemplateDefinition = {
  key: 'wholesale_order_confirmation',
  name: 'Wholesale Order Confirmation',
  subject: 'Wholesale Order #{{orderNumber}} Confirmed',
  category: 'TRANSACTIONAL',
  description: 'B2B order confirmation',
  variables: {
    businessName: 'string',
    orderNumber: 'string',
    orderDate: 'string',
    orderTotal: 'string',
    orderItems: 'string',
    shippingAddress: 'string',
  },
  html: `
<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"><title>Wholesale Order Confirmation</title></head>
<body style="${baseStyles.container}">
  <div style="${baseStyles.wrapper}">
    <div style="${baseStyles.header}">
      ${headerImg('wholesale-order-confirm.png', 'Wholesale Order Confirmed')}
    </div>
    <div style="${baseStyles.content}">
      <p style="font-size:16px;margin-bottom:20px;">Hello {{businessName}},</p>
      <p style="margin-bottom:20px;">Thank you for your wholesale order. We are preparing your items for shipment.</p>
      <div style="background:#f8f9fa;padding:25px;border-radius:8px;margin:30px 0;">
        <h3 style="color:#333;margin:0 0 15px;font-size:18px;">Order Summary</h3>
        <p><strong>Order Date:</strong> {{orderDate}}</p>
        <hr style="${baseStyles.divider}">
        {{orderItems}}
        <hr style="${baseStyles.divider}">
        <p style="text-align:right;font-size:20px;font-weight:700;color:#dc2626;">Total: {{orderTotal}}</p>
      </div>
      <div style="background:#e7f5ff;padding:20px;border-radius:8px;border-left:4px solid:#1971c2;margin:30px 0;">
        <p style="margin:0 0 10px;color:#1864ab;font-weight:600;">📦 Shipping Address</p>
        <p style="margin:0;color:#1864ab;white-space:pre-line;">{{shippingAddress}}</p>
      </div>
      <p style="margin-top:30px;">For any questions regarding your order, please contact your account manager.</p>
    </div>
    ${jmsFooter}
  </div>
</body>
</html>`,
  text: `Hello {{businessName}},

Thank you for your wholesale order #{{orderNumber}}.

Order Date: {{orderDate}}
Total: {{orderTotal}}

Shipping Address:
{{shippingAddress}}

For questions, contact your account manager.

Thank you for your partnership!`,
}
