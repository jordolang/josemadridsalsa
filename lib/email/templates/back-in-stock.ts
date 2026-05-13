/**
 * Back In Stock Email Template
 * Marketing email sent when a requested product is back in stock
 */

import { EmailTemplateDefinition } from '../template-library'
import { baseStyles, headerImg, jmsFooter } from '../shared/components'

export const backInStockTemplate: EmailTemplateDefinition = {
  key: 'back_in_stock',
  name: 'Back In Stock',
  subject: '🎉 {{productName}} is Back in Stock!',
  category: 'MARKETING',
  description: 'Notification email when a product is back in stock',
  variables: {
    name: 'string',
    productName: 'string',
    productUrl: 'string',
  },
  html: `
<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"><title>Back In Stock</title></head>
<body style="${baseStyles.container}">
  <div style="${baseStyles.wrapper}">
    <div style="${baseStyles.header}">
      ${headerImg('back-in-stock.png', 'Back In Stock')}
    </div>
    <div style="${baseStyles.content}">
      <p style="font-size:16px;margin-bottom:20px;">Hi {{name}},</p>
      <p style="margin-bottom:20px;">Great news! The product you've been waiting for is back in stock.</p>
      <div style="background:#dcfce7;border-left:4px solid #16a34a;padding:20px;margin:30px 0;border-radius:6px;">
        <p style="margin:0 0 10px;color:#166534;font-weight:600;font-size:18px;">{{productName}}</p>
        <p style="margin:0;color:#166534;">✓ Available Now - Limited Quantities</p>
      </div>
      <p style="margin-bottom:20px;">This flavor has been flying off the shelves! We've restocked, but based on demand, we expect it to sell out quickly.</p>
      <div style="text-align:center;margin:30px 0;">
        <a href="{{productUrl}}" style="${baseStyles.button}">Shop Now</a>
      </div>
      <hr style="${baseStyles.divider}">
      <h3 style="color:#dc2626;font-size:18px;margin-bottom:15px;">Why customers love it:</h3>
      <ul style="padding-left:20px;">
        <li style="margin-bottom:10px;">Award-winning flavor combination</li>
        <li style="margin-bottom:10px;">Made with fresh, premium ingredients</li>
        <li style="margin-bottom:10px;">Perfect heat level for any occasion</li>
        <li style="margin-bottom:10px;">Versatile - great with chips, tacos, and more</li>
      </ul>
      <p style="margin-top:30px;">Don't miss out this time! Order now to secure your jars.</p>
      <p style="margin-top:20px;">Questions? Reply to this email or call us at <a href="tel:7405214304" style="color:#dc2626;">740-521-4304</a>.</p>
      <p style="margin-top:20px;"><strong>The José Madrid Salsa Team</strong></p>
    </div>
    ${jmsFooter}
  </div>
</body>
</html>`,
  text: `Hi {{name}},

Great news! {{productName}} is back in stock!

This popular flavor has been restocked, but quantities are limited based on high demand.

Shop now: {{productUrl}}

Don't miss out this time - order today!

Questions? Call 740-521-4304 or reply to this email.

The José Madrid Salsa Team`,
}
