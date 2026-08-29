/**
 * Fall Seasonal Email Template
 * Marketing campaign for fall season
 */

import { EmailTemplateDefinition } from './index'
import { baseStyles, headerImg, jmsFooter } from '../shared/components'

const seasonalFallTemplate: EmailTemplateDefinition = {
  key: 'seasonal_fall',
  name: 'Fall Seasonal Promotion',
  subject: '🍂 Fall Flavors Have Arrived!',
  category: 'MARKETING',
  description: 'Fall seasonal marketing campaign',
  variables: {
    name: 'string',
    discountCode: 'string',
    expiryDate: 'string',
  },
  html: `
<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"><title>Fall Flavors</title></head>
<body style="${baseStyles.container}">
  <div style="${baseStyles.wrapper}">
    <div style="${baseStyles.header}">
      ${headerImg('fall.png', 'Fall Flavors')}
    </div>
    <div style="${baseStyles.content}">
      <p style="font-size:16px;margin-bottom:20px;">Hi {{name}},</p>
      <p style="margin-bottom:20px;">As the leaves change color, it's time to warm up your fall gatherings with bold, hearty flavors from Jose Madrid Salsa!</p>
      <div style="background:linear-gradient(135deg,#fed7aa 0%,#fdba74 100%);padding:30px;border-radius:12px;text-align:center;margin:30px 0;">
        <p style="margin:0 0 10px;color:#7c2d12;font-size:18px;font-weight:700;">🍂 Fall Harvest Special</p>
        <p style="margin:0 0 20px;color:#7c2d12;font-size:36px;font-weight:700;">15% OFF</p>
        <p style="margin:0 0 10px;color:#7c2d12;font-size:14px;">Use code: <strong style="font-size:18px;letter-spacing:2px;">{{discountCode}}</strong></p>
        <p style="margin:0;color:#7c2d12;font-size:12px;">Valid through {{expiryDate}}</p>
      </div>
      <div style="text-align:center;margin:30px 0;">
        <a href="https://www.josemadridsalsa.com/store" style="${baseStyles.button}">Shop Fall Favorites</a>
      </div>
      <hr style="${baseStyles.divider}">
      <h3 style="color:#dc2626;font-size:18px;margin-bottom:15px;">Perfect for Cozy Gatherings:</h3>
      <div style="background:#f8f9fa;padding:25px;border-radius:8px;margin:20px 0;">
        <ul style="padding-left:20px;margin:0;">
          <li style="margin-bottom:15px;"><strong>Smoky Chipotle</strong> - Rich, deep flavor for chili</li>
          <li style="margin-bottom:15px;"><strong>Roasted Red Pepper</strong> - Perfect for warm dips</li>
          <li style="margin-bottom:15px;"><strong>Fire Roasted Medium</strong> - Game day essential</li>
          <li><strong>Ghost Pepper Hot</strong> - For those who like it extra spicy</li>
        </ul>
      </div>
      <div style="background:#fff7ed;border-left:4px solid #ea580c;padding:20px;margin:30px 0;border-radius:6px;">
        <p style="margin:0 0 10px;color:#9a3412;font-weight:600;">🎃 Fall Recipe Idea</p>
        <p style="margin:0;color:#9a3412;">Try our salsas in your fall soups and stews! Add a spoonful to butternut squash soup or pumpkin chili for an authentic kick.</p>
      </div>
      <p style="margin-top:30px;">Don't let the cooler weather cool down your flavor game. Stock up on fall favorites and make every gathering memorable!</p>
      <p style="margin-top:20px;"><strong>The Jose Madrid Salsa Team</strong></p>
    </div>
    ${jmsFooter}
  </div>
</body>
</html>`,
  text: `Hi {{name}},

Fall is here! Warm up your gatherings with 15% off our bold, hearty salsas.

Use code {{discountCode}} - Valid through {{expiryDate}}

Perfect for Cozy Gatherings:
• Smoky Chipotle - Rich, deep flavor for chili
• Roasted Red Pepper - Perfect for warm dips
• Fire Roasted Medium - Game day essential
• Ghost Pepper Hot - For those who like it extra spicy

Fall Recipe Tip: Add a spoonful to butternut squash soup or pumpkin chili!

Shop now: https://www.josemadridsalsa.com/store

The Jose Madrid Salsa Team
740-521-4304

View in browser: {{VIEW_IN_BROWSER_URL}}
Unsubscribe: {{UNSUBSCRIBE_URL}}`,
}

export default seasonalFallTemplate
