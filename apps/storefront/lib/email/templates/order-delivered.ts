/**
 * Order Delivered Email Template
 * Sent when an order is successfully delivered to the customer
 */

import { EmailTemplateDefinition } from './index'
import { baseStyles, headerImg, jmsFooter } from '../shared/components'

export const orderDeliveredTemplate: EmailTemplateDefinition = {
  key: 'order_delivered',
  name: 'Order Delivered',
  subject: 'Your Order Has Been Delivered! 📦',
  category: 'TRANSACTIONAL',
  description: 'Delivery confirmation with review request',
  variables: {
    name: 'string',
    orderNumber: 'string',
    deliveryDate: 'string',
    reviewUrl: 'string',
    orderItems: 'string',
  },
  html: `
<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"><title>Order Delivered</title></head>
<body style="${baseStyles.container}">
  <div style="${baseStyles.wrapper}">
    <div style="${baseStyles.header}">
      ${headerImg('order-delivered.png', 'Your Order Arrived')}
    </div>
    <div style="${baseStyles.content}">
      <p style="font-size:16px;margin-bottom:20px;">Hi {{name}},</p>
      <p style="margin-bottom:20px;">Great news! Your order #{{orderNumber}} was delivered on {{deliveryDate}}.</p>
      <div style="background:#dcfce7;border-left:4px solid #16a34a;padding:20px;margin:30px 0;border-radius:6px;">
        <p style="margin:0 0 10px;color:#166534;font-weight:600;">✓ Delivery Confirmed</p>
        <p style="margin:0;color:#166534;">Your package should now be at your doorstep. We hope you enjoy every bite!</p>
      </div>
      <h3 style="color:#dc2626;font-size:18px;margin-bottom:15px;">Items Delivered:</h3>
      <div style="background:#f9fafb;padding:20px;border-radius:8px;margin-bottom:30px;">
        {{orderItems}}
      </div>
      <hr style="${baseStyles.divider}">
      <h3 style="color:#dc2626;font-size:18px;margin-bottom:15px;">How Did We Do?</h3>
      <p style="margin-bottom:20px;">We'd love to hear what you think! Leave a review and get a special discount code for your next order.</p>
      <div style="text-align:center;margin:30px 0;">
        <a href="{{reviewUrl}}" style="${baseStyles.button}">Leave a Review</a>
      </div>
      <div style="background:#f8f9fa;padding:20px;border-radius:8px;margin:30px 0;">
        <h3 style="color:#333;font-size:16px;margin:0 0 15px;">Recipe Ideas:</h3>
        <ul style="padding-left:20px;margin:0;">
          <li style="margin-bottom:10px;">Classic chips and salsa</li>
          <li style="margin-bottom:10px;">Salsa-topped eggs or omelets</li>
          <li style="margin-bottom:10px;">Mix into guacamole or sour cream</li>
          <li>Use as a marinade for chicken or fish</li>
        </ul>
      </div>
      <p style="margin-top:30px;">Enjoy your salsa!</p>
      <p style="margin-top:10px;"><strong>The Jose Madrid Salsa Team</strong></p>
    </div>
    ${jmsFooter}
  </div>
</body>
</html>`,
  text: `Hi {{name}},

Great news! Your order #{{orderNumber}} was delivered on {{deliveryDate}}.

We hope you enjoy every bite!

HOW DID WE DO?
Leave a review and get a special discount code: {{reviewUrl}}

RECIPE IDEAS:
- Classic chips and salsa
- Salsa-topped eggs or omelets
- Mix into guacamole or sour cream
- Use as a marinade for chicken or fish

Enjoy your salsa!

The Jose Madrid Salsa Team`,
}
