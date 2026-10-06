/**
 * Abandoned Cart Stage 2 Email Template
 * Second reminder with urgency messaging about stock and waiting items
 */

import { EmailTemplateDefinition } from './index'
import { baseStyles, headerImg, jmsFooter } from '@/lib/email/shared/components'

export const abandonedCartStage2Template: EmailTemplateDefinition = {
  key: 'abandoned_cart_stage_2',
  name: 'Abandoned Cart - Stage 2 (Urgency)',
  subject: "Still waiting for you! Your cart won't last forever 🌶️",
  category: 'MARKETING',
  description: 'Second reminder email with urgency messaging for customers who abandoned their cart',
  variables: {
    name: 'string',
    cartUrl: 'string',
    cartTotal: 'string',
    hoursWaiting: 'string',
  },
  html: `
<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"><title>Your Cart is Still Waiting</title></head>
<body style="${baseStyles.container}">
  <div style="${baseStyles.wrapper}">
    <div style="${baseStyles.header}">
      ${headerImg('abandoned-cart.png', 'Your Cart is Still Waiting')}
    </div>
    <div style="${baseStyles.content}">
      <p style="font-size:16px;margin-bottom:20px;">Hi {{name}},</p>
      <p style="margin-bottom:20px;">Your cart has been waiting for {{hoursWaiting}} hours now, and we wanted to remind you before it's too late!</p>
      <div style="background:#fee2e2;border-left:4px solid #dc2626;padding:20px;margin:30px 0;border-radius:6px;">
        <p style="margin:0 0 10px;color:#991b1b;font-weight:600;">⚠️ Important Notice</p>
        <p style="margin:0;color:#991b1b;">We can't guarantee these items will still be in stock much longer. Popular flavors sell out fast!</p>
      </div>
      <div style="background:#fef3c7;border-left:4px solid #f59e0b;padding:20px;margin:30px 0;border-radius:6px;">
        <p style="margin:0 0 10px;color:#92400e;font-weight:600;">📦 Your Cart Total: {{cartTotal}}</p>
        <p style="margin:0;color:#92400e;">Items reserved for a limited time only</p>
      </div>
      <div style="text-align:center;margin:30px 0;">
        <a href="{{cartUrl}}" style="${baseStyles.button}">Secure Your Order Now</a>
      </div>
      <hr style="${baseStyles.divider}">
      <h3 style="color:#dc2626;font-size:18px;margin-bottom:15px;">⏰ Why order now:</h3>
      <ul style="padding-left:20px;">
        <li style="margin-bottom:10px;"><strong>Stock is limited</strong> - our most popular flavors sell out quickly</li>
        <li style="margin-bottom:10px;"><strong>Fresh batches</strong> - handcrafted in small quantities</li>
        <li style="margin-bottom:10px;"><strong>Fast shipping</strong> - get your salsa before it's gone</li>
        <li style="margin-bottom:10px;"><strong>100% satisfaction</strong> - guaranteed or your money back</li>
      </ul>
      <div style="background:#f3f4f6;border-radius:6px;padding:20px;margin:30px 0;text-align:center;">
        <p style="margin:0 0 10px;color:#374151;font-size:14px;font-weight:600;">🔥 HIGH DEMAND ALERT</p>
        <p style="margin:0;color:#6b7280;font-size:13px;">Your items are popular right now. Complete your order to avoid disappointment.</p>
      </div>
      <p style="margin-top:30px;">Have questions or need help? Reply to this email or call us at <a href="tel:7405214304" style="color:#dc2626;">740-521-4304</a>.</p>
      <p style="margin-top:20px;"><strong>The José Madrid Salsa Team</strong></p>
    </div>
    ${jmsFooter}
  </div>
</body>
</html>`,
  text: `Hi {{name}},

Your cart has been waiting for {{hoursWaiting}} hours now!

⚠️ IMPORTANT: We can't guarantee these items will still be in stock much longer. Popular flavors sell out fast!

Your Cart Total: {{cartTotal}}
Items reserved for a limited time only.

⏰ Why order now:
- Stock is limited - popular flavors sell out quickly
- Fresh batches handcrafted in small quantities
- Fast shipping - get your salsa before it's gone
- 100% satisfaction guaranteed

🔥 HIGH DEMAND ALERT: Your items are popular right now. Complete your order to avoid disappointment.

Secure your order: {{cartUrl}}

Questions? Call 740-521-4304 or reply to this email.

The José Madrid Salsa Team`,
}
