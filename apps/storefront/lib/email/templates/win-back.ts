/**
 * Win-Back Email Template
 * Marketing email sent to re-engage inactive customers
 */

import { EmailTemplateDefinition } from './index'
import { baseStyles, headerImg, jmsFooter } from '@/lib/email/shared/components'

export const winBackTemplate: EmailTemplateDefinition = {
  key: 'win_back',
  name: 'Win-Back Campaign',
  subject: 'We Miss You! 🌶️ Come Back for 20% Off',
  category: 'MARKETING',
  description: 'Re-engagement email for inactive customers',
  variables: {
    name: 'string',
    discountCode: 'string',
    lastPurchaseDate: 'string',
  },
  html: `
<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"><title>We Miss You</title></head>
<body style="${baseStyles.container}">
  <div style="${baseStyles.wrapper}">
    <div style="${baseStyles.header}">
      ${headerImg('miss-you-letter.png', 'We Miss You')}
    </div>
    <div style="${baseStyles.content}">
      <p style="font-size:16px;margin-bottom:20px;">Hi {{name}},</p>
      <p style="margin-bottom:20px;">It's been a while since we've seen you! We've been busy creating new flavors and perfecting our recipes, and we'd love to share them with you.</p>
      <p style="margin-bottom:20px;">Your last order was on {{lastPurchaseDate}}, and we've been wondering... did we lose our heat? 🌶️</p>
      <div style="background:#fef3c7;border-left:4px solid #f59e0b;padding:20px;margin:30px 0;border-radius:6px;">
        <p style="margin:0 0 10px;color:#92400e;font-weight:600;font-size:18px;">🎁 Welcome Back Gift!</p>
        <p style="margin:0;color:#92400e;">Use code <strong>{{discountCode}}</strong> for <strong>20% off</strong> your next order</p>
      </div>
      <p style="margin-bottom:20px;">We've missed having you as part of the José Madrid family. Come back and rediscover why our salsa is more than just a condiment - it's a tradition.</p>
      <div style="text-align:center;margin:30px 0;">
        <a href="https://www.josemadridsalsa.com/store" style="${baseStyles.button}">Shop Now & Save</a>
      </div>
      <hr style="${baseStyles.divider}">
      <h3 style="color:#dc2626;font-size:18px;margin-bottom:15px;">What's new since you've been gone:</h3>
      <ul style="padding-left:20px;">
        <li style="margin-bottom:10px;"><strong>New seasonal flavors</strong> you won't want to miss</li>
        <li style="margin-bottom:10px;"><strong>Improved recipes</strong> with even fresher ingredients</li>
        <li style="margin-bottom:10px;"><strong>Faster shipping</strong> to get salsa to your door quicker</li>
        <li style="margin-bottom:10px;"><strong>New bundle deals</strong> for better value</li>
      </ul>
      <p style="margin-top:30px;">Your discount code is waiting! This offer is our way of saying thank you for being part of our story.</p>
      <p style="margin-top:20px;font-size:14px;color:#6b5d50;font-style:italic;">* Offer expires in 7 days. Code valid on orders over $25.</p>
      <p style="margin-top:30px;">Questions? Reply to this email or call us at <a href="tel:7405214304" style="color:#dc2626;">740-521-4304</a>.</p>
      <p style="margin-top:20px;">We hope to see you again soon!</p>
      <p style="margin-top:10px;"><strong>The José Madrid Salsa Team</strong></p>
    </div>
    ${jmsFooter}
  </div>
</body>
</html>`,
  text: `Hi {{name}},

We Miss You!

It's been a while since your last order on {{lastPurchaseDate}}. We'd love to welcome you back!

WELCOME BACK GIFT:
Use code {{discountCode}} for 20% off your next order.

What's new:
- New seasonal flavors
- Improved recipes with fresher ingredients
- Faster shipping
- New bundle deals

Shop now: https://www.josemadridsalsa.com/store

* Offer expires in 7 days. Code valid on orders over $25.

Questions? Call 740-521-4304 or reply to this email.

We hope to see you again soon!
The José Madrid Salsa Team`,
}
