/**
 * Abandoned Cart Stage 3 Email Template
 * Final reminder, counting down to the moment the recovery link stops working
 *
 * `expiresIn` is a phrase ("28 days", "36 hours") read from the recovery link's own lifetime in
 * `lib/checkout/abandoned-cart`, not a number invented for the email. There is deliberately no
 * discount offer here: nothing in the codebase issues a code for an abandoned cart, and an email
 * advertising one would be advertising nothing.
 */

import { EmailTemplateDefinition } from './index'
import { baseStyles, headerImg, jmsFooter } from '@/lib/email/shared/components'

export const abandonedCartStage3Template: EmailTemplateDefinition = {
  key: 'abandoned_cart_stage_3',
  name: 'Abandoned Cart - Stage 3 (Final Chance)',
  subject: "⏰ Final Chance! Your cart expires soon 🌶️",
  category: 'MARKETING',
  description: 'Final reminder email for customers who abandoned their cart',
  variables: {
    name: 'string',
    cartUrl: 'string',
    cartTotal: 'string',
    expiresIn: 'string',
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
      <p style="margin-bottom:20px;"><strong>This is your final reminder.</strong> The link to your saved cart stops working in {{expiresIn}}, and this is the last email we'll send about it.</p>
      <div style="background:#fee2e2;border:3px solid #dc2626;padding:25px;margin:30px 0;border-radius:8px;text-align:center;">
        <p style="margin:0 0 15px;color:#991b1b;font-weight:700;font-size:24px;">⏰ YOUR CART LINK EXPIRES IN {{expiresIn}}</p>
        <p style="margin:0;color:#991b1b;font-weight:600;">After that you'll need to build your order again from scratch</p>
      </div>
      <div style="background:#fef3c7;border-left:4px solid #f59e0b;padding:20px;margin:30px 0;border-radius:6px;">
        <p style="margin:0 0 10px;color:#92400e;font-weight:600;">📦 Your Cart Total: {{cartTotal}}</p>
        <p style="margin:0;color:#92400e;">One click and it's back in your checkout, exactly as you left it</p>
      </div>
      <div style="text-align:center;margin:30px 0;">
        <a href="{{cartUrl}}" style="${baseStyles.button}">Claim Your Order Now</a>
      </div>
      <hr style="${baseStyles.divider}">
      <h3 style="color:#dc2626;font-size:18px;margin-bottom:15px;">🔥 This is your last chance to:</h3>
      <ul style="padding-left:20px;">
        <li style="margin-bottom:10px;"><strong>Keep your selections</strong> - your cart is saved right up until the link expires</li>
        <li style="margin-bottom:10px;"><strong>Lock in today's prices</strong> - prices subject to change</li>
        <li style="margin-bottom:10px;"><strong>Enjoy fresh salsa</strong> - handcrafted in small batches since 1982</li>
      </ul>
      <p style="margin-top:30px;">Need help completing your order? Reply to this email or call us at <a href="tel:7405214304" style="color:#dc2626;">740-521-4304</a>. We're here to help!</p>
      <p style="margin-top:20px;"><strong>The José Madrid Salsa Team</strong></p>
    </div>
    ${jmsFooter}
  </div>
</body>
</html>`,
  text: `Hi {{name}},

⏰ FINAL REMINDER - YOUR CART LINK EXPIRES IN {{expiresIn}}

This is your last chance. After that you'll need to build your order again from scratch.

Your Cart Total: {{cartTotal}}
One click and it's back in your checkout, exactly as you left it.

🔥 This is your last chance to:
- Keep your selections - your cart is saved right up until the link expires
- Lock in today's prices - prices subject to change
- Enjoy fresh salsa handcrafted in small batches since 1982

Claim your order now: {{cartUrl}}

Need help? Call 740-521-4304 or reply to this email.

The José Madrid Salsa Team`,
}
