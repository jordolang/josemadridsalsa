/**
 * Product Launch Email Template
 * Marketing email sent to announce new products
 */

import { EmailTemplateDefinition } from './index'
import { baseStyles, headerImg, jmsFooter } from '@/lib/email/shared/components'

export const productLaunchTemplate: EmailTemplateDefinition = {
  key: 'product_launch',
  name: 'Product Launch',
  subject: '🎉 NEW: {{productName}} is here!',
  category: 'MARKETING',
  description: 'Announcement email for new product launches',
  variables: {
    name: 'string',
    productName: 'string',
    productDescription: 'string',
    productUrl: 'string',
  },
  html: `
<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"><title>New Product Launch</title></head>
<body style="${baseStyles.container}">
  <div style="${baseStyles.wrapper}">
    <div style="${baseStyles.header}">
      ${headerImg('product-launch.png', 'New Product Launch')}
    </div>
    <div style="${baseStyles.content}">
      <p style="font-size:16px;margin-bottom:20px;">Hi {{name}},</p>
      <p style="margin-bottom:20px;">Big news! We're thrilled to introduce our latest creation: <strong>{{productName}}</strong>!</p>
      <div style="background:#fee2e2;border-left:4px solid #dc2626;padding:20px;margin:30px 0;border-radius:6px;">
        <p style="margin:0 0 10px;color:#991b1b;font-weight:600;font-size:18px;">{{productName}}</p>
        <p style="margin:0;color:#991b1b;">{{productDescription}}</p>
      </div>
      <p style="margin-bottom:20px;">Crafted with the same care and quality you've come to expect from José Madrid, this new flavor is already creating a buzz with our taste testers.</p>
      <div style="text-align:center;margin:30px 0;">
        <a href="{{productUrl}}" style="${baseStyles.button}">Try It Now</a>
      </div>
      <hr style="${baseStyles.divider}">
      <h3 style="color:#dc2626;font-size:18px;margin-bottom:15px;">What makes it special:</h3>
      <ul style="padding-left:20px;">
        <li style="margin-bottom:10px;">Made with premium, locally-sourced ingredients</li>
        <li style="margin-bottom:10px;">Small-batch crafted for maximum flavor</li>
        <li style="margin-bottom:10px;">Perfect for chips, tacos, and everything in between</li>
        <li style="margin-bottom:10px;">Limited initial production - get yours while supplies last!</li>
      </ul>
      <p style="margin-top:30px;">Be one of the first to experience our newest creation. We can't wait to hear what you think!</p>
      <p style="margin-top:20px;">Questions? Reply to this email or call us at <a href="tel:7405214304" style="color:#dc2626;">740-521-4304</a>.</p>
      <p style="margin-top:20px;"><strong>The José Madrid Salsa Team</strong></p>
    </div>
    ${jmsFooter}
  </div>
</body>
</html>`,
  text: `Hi {{name}},

Exciting news! We're launching a new product: {{productName}}!

{{productDescription}}

Order now: {{productUrl}}

Limited initial production - get yours while supplies last!

Questions? Call 740-521-4304 or reply to this email.

The José Madrid Salsa Team`,
}
