/**
 * Holiday Seasonal Email Template
 * Marketing campaign for holiday season
 */

import { EmailTemplateDefinition } from './index'
import { baseStyles, headerImg, jmsFooter } from '../shared/components'

const seasonalHolidayTemplate: EmailTemplateDefinition = {
  key: 'seasonal_holiday',
  name: 'Holiday Seasonal Promotion',
  subject: '🎄 Spread Holiday Cheer with Gourmet Salsa!',
  category: 'MARKETING',
  description: 'Holiday seasonal marketing campaign',
  variables: {
    name: 'string',
    discountCode: 'string',
    expiryDate: 'string',
  },
  html: `
<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"><title>Holiday Cheer</title></head>
<body style="${baseStyles.container}">
  <div style="${baseStyles.wrapper}">
    <div style="${baseStyles.header}">
      ${headerImg('christmas.png', 'Holiday Cheer')}
    </div>
    <div style="${baseStyles.content}">
      <p style="font-size:16px;margin-bottom:20px;">Hi {{name}},</p>
      <p style="margin-bottom:20px;">The holidays are here, and there's no better gift than authentic, handcrafted salsa! Whether you're hosting festive gatherings or searching for the perfect gift, we've got you covered.</p>
      <div style="background:linear-gradient(135deg,#dc2626 0%,#991b1b 100%);padding:30px;border-radius:12px;text-align:center;margin:30px 0;color:#ffffff;">
        <p style="margin:0 0 10px;font-size:18px;font-weight:700;">🎁 Holiday Gift Special</p>
        <p style="margin:0 0 20px;font-size:36px;font-weight:700;">25% OFF</p>
        <p style="margin:0 0 10px;font-size:14px;">Use code: <strong style="font-size:18px;letter-spacing:2px;">{{discountCode}}</strong></p>
        <p style="margin:0;font-size:12px;">Valid through {{expiryDate}}</p>
      </div>
      <div style="text-align:center;margin:30px 0;">
        <a href="https://www.josemadridsalsa.com/store" style="${baseStyles.button}background-color:#ffffff;color:#dc2626 !important;">Shop Holiday Gifts</a>
      </div>
      <hr style="${baseStyles.divider}">
      <h3 style="color:#dc2626;font-size:18px;margin-bottom:15px;">Perfect Holiday Picks:</h3>
      <div style="background:#f8f9fa;padding:25px;border-radius:8px;margin:20px 0;">
        <ul style="padding-left:20px;margin:0;">
          <li style="margin-bottom:15px;"><strong>Gift Sets</strong> - Curated variety packs for every taste</li>
          <li style="margin-bottom:15px;"><strong>Premium Collection</strong> - Our finest artisan flavors</li>
          <li style="margin-bottom:15px;"><strong>Party Bundles</strong> - Stock up for holiday entertaining</li>
          <li><strong>Custom Gift Baskets</strong> - Create the perfect personal gift</li>
        </ul>
      </div>
      <div style="background:#ecfdf5;border-left:4px solid #059669;padding:20px;margin:30px 0;border-radius:6px;">
        <p style="margin:0 0 10px;color:#065f46;font-weight:600;">🎅 Holiday Hosting Tip</p>
        <p style="margin:0;color:#065f46;">Create a festive appetizer spread with our salsa varieties, cream cheese, and crackers. Simple, delicious, and crowd-pleasing!</p>
      </div>
      <div style="background:#fef3c7;padding:25px;border-radius:8px;text-align:center;margin:30px 0;">
        <p style="margin:0 0 10px;color:#92400e;font-size:16px;font-weight:600;">🚚 Order by December 18th</p>
        <p style="margin:0;color:#92400e;font-size:14px;">Guaranteed delivery before Christmas!</p>
      </div>
      <p style="margin-top:30px;">Make this holiday season extra special with the gift of authentic, handcrafted flavor. Your friends and family will thank you!</p>
      <p style="margin-top:20px;">Warmest wishes for a wonderful holiday season,</p>
      <p style="margin-top:10px;"><strong>The Jose Madrid Salsa Team</strong></p>
    </div>
    ${jmsFooter}
  </div>
</body>
</html>`,
  text: `Hi {{name}},

The holidays are here! Give the gift of authentic, handcrafted salsa.

Holiday Gift Special: 25% OFF

Use code {{discountCode}} - Valid through {{expiryDate}}

Perfect Holiday Picks:
• Gift Sets - Curated variety packs for every taste
• Premium Collection - Our finest artisan flavors
• Party Bundles - Stock up for holiday entertaining
• Custom Gift Baskets - Create the perfect personal gift

Order by December 18th for guaranteed Christmas delivery!

Holiday Hosting Tip: Create a festive appetizer spread with our salsa varieties, cream cheese, and crackers.

Shop now: https://www.josemadridsalsa.com/store

Warmest wishes for a wonderful holiday season,
The Jose Madrid Salsa Team
740-521-4304

View in browser: {{VIEW_IN_BROWSER_URL}}
Unsubscribe: {{UNSUBSCRIBE_URL}}`,
}

export default seasonalHolidayTemplate
