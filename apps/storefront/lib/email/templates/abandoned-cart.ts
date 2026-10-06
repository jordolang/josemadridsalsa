/**
 * Abandoned Cart Email Template
 * Marketing email sent to customers who left items in their cart
 */

import { EmailTemplateDefinition } from './index'
import { baseStyles, headerImg, jmsFooter } from '@/lib/email/shared/components'

export const abandonedCartTemplate: EmailTemplateDefinition = {
  key: 'abandoned_cart',
  name: 'Abandoned Cart',
  subject: "Don't forget your salsa! 🌶️",
  category: 'MARKETING',
  description: 'Reminder email for customers who abandoned their cart',
  variables: {
    name: 'string',
    cartUrl: 'string',
    cartTotal: 'string',
  },
  html: `
<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"><title>Your Cart is Waiting</title></head>
<body style="${baseStyles.container}">
  <div style="${baseStyles.wrapper}">
    <div style="${baseStyles.header}">
      ${headerImg('abandoned-cart.png', 'Your Cart is Waiting')}
    </div>
    <div style="${baseStyles.content}">
      <p style="font-size:16px;margin-bottom:20px;">Hi {{name}},</p>
      <p style="margin-bottom:20px;">We noticed you left some delicious items in your cart. Your taste in salsa is excellent, and we'd hate for you to miss out!</p>
      <div style="background:#fef3c7;border-left:4px solid #f59e0b;padding:20px;margin:30px 0;border-radius:6px;">
        <p style="margin:0 0 10px;color:#92400e;font-weight:600;">📦 Cart Total: {{cartTotal}}</p>
        <p style="margin:0;color:#92400e;">Your items are reserved and ready to ship</p>
      </div>
      <div style="text-align:center;margin:30px 0;">
        <a href="{{cartUrl}}" style="${baseStyles.button}">Complete Your Order</a>
      </div>
      <hr style="${baseStyles.divider}">
      <h3 style="color:#dc2626;font-size:18px;margin-bottom:15px;">Why customers love José Madrid Salsa:</h3>
      <ul style="padding-left:20px;">
        <li style="margin-bottom:10px;">Handcrafted in small batches since 1982</li>
        <li style="margin-bottom:10px;">Fresh, premium ingredients</li>
        <li style="margin-bottom:10px;">Fast, secure shipping</li>
        <li style="margin-bottom:10px;">Satisfaction guaranteed</li>
      </ul>
      <p style="margin-top:30px;">Questions? Reply to this email or call us at <a href="tel:7405214304" style="color:#dc2626;">740-521-4304</a>.</p>
      <p style="margin-top:20px;"><strong>The José Madrid Salsa Team</strong></p>
    </div>
    ${jmsFooter}
  </div>
</body>
</html>`,
  text: `Hi {{name}},

You left some items in your cart! Your cart total: {{cartTotal}}

Complete your order: {{cartUrl}}

Questions? Call 740-521-4304 or reply to this email.

The José Madrid Salsa Team`,
}
