/**
 * Summer Seasonal Email Template
 * Marketing campaign for summer season
 */

import { EmailTemplateDefinition } from './index'
import { baseStyles, headerImg, jmsFooter } from '@/lib/email/shared/components'

const seasonalSummerTemplate: EmailTemplateDefinition = {
  key: 'seasonal_summer',
  name: 'Summer Seasonal Promotion',
  subject: '☀️ Summer Flavors Are Here!',
  category: 'MARKETING',
  description: 'Summer seasonal marketing campaign',
  variables: {
    name: 'string',
    discountCode: 'string',
    expiryDate: 'string',
  },
  html: `
<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"><title>Summer Flavors</title></head>
<body style="${baseStyles.container}">
  <div style="${baseStyles.wrapper}">
    <div style="${baseStyles.header}">
      ${headerImg('summer.png', 'Summer Flavors')}
    </div>
    <div style="${baseStyles.content}">
      <p style="font-size:16px;margin-bottom:20px;">Hi {{name}},</p>
      <p style="margin-bottom:20px;">Summer is here, and so are the perfect salsas for your backyard BBQs, pool parties, and outdoor gatherings!</p>
      <div style="background:linear-gradient(135deg,#fef3c7 0%,#fde68a 100%);padding:30px;border-radius:12px;text-align:center;margin:30px 0;">
        <p style="margin:0 0 10px;color:#92400e;font-size:18px;font-weight:700;">🌞 Summer Special</p>
        <p style="margin:0 0 20px;color:#92400e;font-size:36px;font-weight:700;">20% OFF</p>
        <p style="margin:0 0 10px;color:#92400e;font-size:14px;">Use code: <strong style="font-size:18px;letter-spacing:2px;">{{discountCode}}</strong></p>
        <p style="margin:0;color:#92400e;font-size:12px;">Valid through {{expiryDate}}</p>
      </div>
      <div style="text-align:center;margin:30px 0;">
        <a href="https://www.josemadridsalsa.com/store" style="${baseStyles.button}">Shop Summer Salsas</a>
      </div>
      <hr style="${baseStyles.divider}">
      <h3 style="color:#dc2626;font-size:18px;margin-bottom:15px;">Perfect for Summer:</h3>
      <div style="background:#f8f9fa;padding:25px;border-radius:8px;margin:20px 0;">
        <ul style="padding-left:20px;margin:0;">
          <li style="margin-bottom:15px;"><strong>Mango Habanero</strong> - Sweet heat for grilled chicken</li>
          <li style="margin-bottom:15px;"><strong>Pineapple Jalapeño</strong> - Tropical twist for fish tacos</li>
          <li style="margin-bottom:15px;"><strong>Roasted Garlic</strong> - Bold flavor for burgers</li>
          <li><strong>Classic Mild</strong> - Family-friendly for all ages</li>
        </ul>
      </div>
      <div style="background:#e7f5ff;border-left:4px solid #1971c2;padding:20px;margin:30px 0;border-radius:6px;">
        <p style="margin:0 0 10px;color:#1971c2;font-weight:600;">💡 Summer Party Tip</p>
        <p style="margin:0;color:#1971c2;">Set up a salsa bar with 3-4 different heat levels. Your guests will love creating their perfect combination!</p>
      </div>
      <p style="margin-top:30px;">Make this summer unforgettable with authentic Jose Madrid Salsa flavors. Stock up now and save!</p>
      <p style="margin-top:20px;"><strong>The Jose Madrid Salsa Team</strong></p>
    </div>
    ${jmsFooter}
  </div>
</body>
</html>`,
  text: `Hi {{name}},

Summer is here! Get 20% off all salsas for your BBQs and outdoor gatherings.

Use code {{discountCode}} - Valid through {{expiryDate}}

Perfect for Summer:
• Mango Habanero - Sweet heat for grilled chicken
• Pineapple Jalapeño - Tropical twist for fish tacos
• Roasted Garlic - Bold flavor for burgers
• Classic Mild - Family-friendly for all ages

Shop now: https://www.josemadridsalsa.com/store

The Jose Madrid Salsa Team
740-521-4304

View in browser: {{VIEW_IN_BROWSER_URL}}
Unsubscribe: {{UNSUBSCRIBE_URL}}`,
}

export default seasonalSummerTemplate
