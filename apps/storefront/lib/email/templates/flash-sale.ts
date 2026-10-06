/**
 * Flash Sale Email Template
 * Marketing email sent to announce limited-time sales
 */

import { EmailTemplateDefinition } from './index'
import { baseStyles, headerImg, jmsFooter } from '@/lib/email/shared/components'

export const flashSaleTemplate: EmailTemplateDefinition = {
  key: 'flash_sale',
  name: 'Flash Sale',
  subject: '⚡ Flash Sale: {{discountPercent}}% OFF - {{hoursLeft}} Hours Only!',
  category: 'MARKETING',
  description: 'Limited-time promotional sale announcements',
  variables: {
    name: 'string',
    discountPercent: 'string',
    discountCode: 'string',
    hoursLeft: 'string',
    saleUrl: 'string',
  },
  html: `
<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"><title>Flash Sale</title></head>
<body style="${baseStyles.container}">
  <div style="${baseStyles.wrapper}">
    <div style="${baseStyles.header}">
      ${headerImg('flash-sale.png', 'Flash Sale Alert')}
    </div>
    <div style="${baseStyles.content}">
      <p style="font-size:16px;margin-bottom:20px;">Hi {{name}},</p>
      <p style="margin-bottom:20px;">⚡ <strong>FLASH SALE ALERT!</strong> ⚡</p>
      <p style="margin-bottom:20px;">For a very limited time, save {{discountPercent}}% on your entire order. This is our biggest discount of the year, but it won't last long!</p>
      <div style="background:#fef3c7;border:3px solid #f59e0b;padding:30px;margin:30px 0;border-radius:8px;text-align:center;">
        <p style="margin:0 0 15px;color:#92400e;font-weight:700;font-size:32px;">{{discountPercent}}% OFF</p>
        <p style="margin:0 0 10px;color:#92400e;font-weight:600;font-size:18px;">Use code: {{discountCode}}</p>
        <p style="margin:0;color:#dc2626;font-weight:700;font-size:20px;">⏰ Only {{hoursLeft}} Hours Left!</p>
      </div>
      <div style="text-align:center;margin:30px 0;">
        <a href="{{saleUrl}}" style="${baseStyles.button}">Shop Now & Save</a>
      </div>
      <hr style="${baseStyles.divider}">
      <h3 style="color:#dc2626;font-size:18px;margin-bottom:15px;">🔥 Why shop now:</h3>
      <ul style="padding-left:20px;">
        <li style="margin-bottom:10px;"><strong>{{discountPercent}}% off</strong> all products - no exclusions</li>
        <li style="margin-bottom:10px;">Stock up on your favorites</li>
        <li style="margin-bottom:10px;">Try new flavors at incredible prices</li>
        <li style="margin-bottom:10px;">Perfect time to gift salsa to friends & family</li>
      </ul>
      <div style="background:#fee2e2;border-left:4px solid #dc2626;padding:20px;margin:30px 0;border-radius:6px;">
        <p style="margin:0;color:#991b1b;font-weight:600;">⚠️ This flash sale ends in {{hoursLeft}} hours. Don't miss out!</p>
      </div>
      <p style="margin-top:30px;">Questions? Reply to this email or call us at <a href="tel:7405214304" style="color:#dc2626;">740-521-4304</a>.</p>
      <p style="margin-top:20px;"><strong>The José Madrid Salsa Team</strong></p>
    </div>
    ${jmsFooter}
  </div>
</body>
</html>`,
  text: `Hi {{name}},

⚡ FLASH SALE ALERT! ⚡

Save {{discountPercent}}% on your entire order!

Use code: {{discountCode}}
Only {{hoursLeft}} hours left!

Shop now: {{saleUrl}}

Questions? Call 740-521-4304 or reply to this email.

The José Madrid Salsa Team`,
}
