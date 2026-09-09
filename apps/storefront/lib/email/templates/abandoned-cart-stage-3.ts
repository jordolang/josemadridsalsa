/**
 * Abandoned Cart Stage 3 Email Template
 * Final reminder with last chance messaging and optional discount incentive
 */

import { EmailTemplateDefinition } from './index'
import { baseStyles, headerImg, jmsFooter } from '../shared/components'

export const abandonedCartStage3Template: EmailTemplateDefinition = {
  key: 'abandoned_cart_stage_3',
  name: 'Abandoned Cart - Stage 3 (Final Chance)',
  subject: "⏰ Final Chance! Your cart expires soon 🌶️",
  category: 'MARKETING',
  description: 'Final reminder email with last chance messaging and optional discount for customers who abandoned their cart',
  variables: {
    name: 'string',
    cartUrl: 'string',
    cartTotal: 'string',
    discountCode: 'string',
    discountPercent: 'string',
    expiresInHours: 'string',
  },
  html: `
<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"><title>Final Chance - Your Cart Expires Soon</title></head>
<body style="${baseStyles.container}">
  <div style="${baseStyles.wrapper}">
    <div style="${baseStyles.header}">
      ${headerImg('abandoned-cart.png', 'Final Chance - Your Cart Expires Soon')}
    </div>
    <div style="${baseStyles.content}">
      <p style="font-size:16px;margin-bottom:20px;">Hi {{name}},</p>
      <p style="margin-bottom:20px;"><strong>This is your final reminder.</strong> Your cart will expire in {{expiresInHours}} hours, and we won't be able to hold your items any longer.</p>
      <div style="background:#fee2e2;border:3px solid #dc2626;padding:25px;margin:30px 0;border-radius:8px;text-align:center;">
        <p style="margin:0 0 15px;color:#991b1b;font-weight:700;font-size:28px;">⏰ CART EXPIRES IN {{expiresInHours}} HOURS</p>
        <p style="margin:0;color:#991b1b;font-weight:600;">Your reserved items will be released after this time</p>
      </div>
      {{#if discountCode}}
      <div style="background:#dcfce7;border:3px solid #16a34a;padding:30px;margin:30px 0;border-radius:8px;text-align:center;">
        <p style="margin:0 0 10px;color:#166534;font-weight:700;font-size:20px;">🎁 SPECIAL OFFER - JUST FOR YOU!</p>
        <p style="margin:0 0 15px;color:#166534;font-size:32px;font-weight:700;">{{discountPercent}}% OFF</p>
        <p style="margin:0 0 10px;color:#166534;font-weight:600;font-size:18px;">Use code: {{discountCode}}</p>
        <p style="margin:0;color:#166534;font-size:14px;">This exclusive offer expires with your cart!</p>
      </div>
      {{/if}}
      <div style="background:#fef3c7;border-left:4px solid #f59e0b;padding:20px;margin:30px 0;border-radius:6px;">
        <p style="margin:0 0 10px;color:#92400e;font-weight:600;">📦 Your Cart Total: {{cartTotal}}</p>
        {{#if discountCode}}
        <p style="margin:0;color:#92400e;">Save {{discountPercent}}% with code <strong>{{discountCode}}</strong></p>
        {{else}}
        <p style="margin:0;color:#92400e;">Complete your order before it's too late</p>
        {{/if}}
      </div>
      <div style="text-align:center;margin:30px 0;">
        <a href="{{cartUrl}}" style="${baseStyles.button}">Claim Your Order Now</a>
      </div>
      <hr style="${baseStyles.divider}">
      <h3 style="color:#dc2626;font-size:18px;margin-bottom:15px;">🔥 This is your last chance to:</h3>
      <ul style="padding-left:20px;">
        <li style="margin-bottom:10px;"><strong>Secure your items</strong> - they'll be released to other customers after expiration</li>
        {{#if discountCode}}
        <li style="margin-bottom:10px;"><strong>Save {{discountPercent}}%</strong> - this exclusive discount expires with your cart</li>
        {{/if}}
        <li style="margin-bottom:10px;"><strong>Lock in today's prices</strong> - prices subject to change</li>
        <li style="margin-bottom:10px;"><strong>Enjoy fresh salsa</strong> - handcrafted in small batches since 1982</li>
      </ul>
      <div style="background:#fef3c7;border-radius:6px;padding:20px;margin:30px 0;text-align:center;">
        <p style="margin:0 0 10px;color:#92400e;font-size:14px;font-weight:600;">⚠️ URGENT: Your cart will be cleared in {{expiresInHours}} hours</p>
        <p style="margin:0;color:#92400e;font-size:13px;">After that, we cannot guarantee availability or pricing.</p>
      </div>
      <p style="margin-top:30px;">Need help completing your order? Reply to this email or call us at <a href="tel:7405214304" style="color:#dc2626;">740-521-4304</a>. We're here to help!</p>
      <p style="margin-top:20px;"><strong>The José Madrid Salsa Team</strong></p>
    </div>
    ${jmsFooter}
  </div>
</body>
</html>`,
  text: `Hi {{name}},

⏰ FINAL REMINDER - YOUR CART EXPIRES IN {{expiresInHours}} HOURS

This is your last chance. Your cart will expire soon, and we won't be able to hold your items any longer.

{{#if discountCode}}
🎁 SPECIAL OFFER - JUST FOR YOU!
Save {{discountPercent}}% with code: {{discountCode}}
This exclusive offer expires with your cart!
{{/if}}

Your Cart Total: {{cartTotal}}
{{#if discountCode}}
Save {{discountPercent}}% with code {{discountCode}}
{{else}}
Complete your order before it's too late
{{/if}}

🔥 This is your last chance to:
- Secure your items - they'll be released to other customers after expiration
{{#if discountCode}}
- Save {{discountPercent}}% - this exclusive discount expires with your cart
{{/if}}
- Lock in today's prices - prices subject to change
- Enjoy fresh salsa handcrafted in small batches since 1982

⚠️ URGENT: Your cart will be cleared in {{expiresInHours}} hours. After that, we cannot guarantee availability or pricing.

Claim your order now: {{cartUrl}}

Need help? Call 740-521-4304 or reply to this email.

The José Madrid Salsa Team`,
}
