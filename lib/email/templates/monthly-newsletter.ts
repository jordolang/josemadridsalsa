/**
 * Monthly Newsletter Email Template
 * Marketing email with monthly updates, recipes, and special offers
 */

import { EmailTemplateDefinition } from './index'
import { baseStyles, headerImg, jmsFooter } from '../shared/components'

export const monthlyNewsletterTemplate: EmailTemplateDefinition = {
  key: 'monthly_newsletter',
  name: 'Monthly Newsletter',
  subject: 'The Salsa Scoop: {{month}} Edition 📰',
  category: 'MARKETING',
  description: 'Monthly updates and stories',
  variables: {
    month: 'string',
    featuredRecipe: 'string',
    recipeLink: 'string',
    newsUpdate: 'string',
    specialOffer: 'string',
    offerCode: 'string',
  },
  html: `
<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"><title>Newsletter</title></head>
<body style="${baseStyles.container}">
  <div style="${baseStyles.wrapper}">
    <div style="${baseStyles.header}">
      ${headerImg('newsletter.png', 'The Salsa Scoop Newsletter')}
    </div>
    <div style="${baseStyles.content}">
      <p style="font-size:16px;margin-bottom:30px;">Hello Salsa Lovers! Here's what's cooking this month at Jose Madrid Salsa.</p>

      <div style="margin:40px 0;">
        <h2 style="color:#dc2626;font-size:24px;margin:0 0 15px;border-bottom:3px solid #dc2626;padding-bottom:10px;">🍴 Featured Recipe</h2>
        <h3 style="font-size:20px;margin:0 0 15px;">{{featuredRecipe}}</h3>
        <p style="margin-bottom:20px;">Try this month's featured recipe using our signature salsa. Perfect for family dinners or entertaining guests!</p>
        <a href="{{recipeLink}}" style="color:#dc2626;text-decoration:none;font-weight:600;">Get the Full Recipe →</a>
      </div>

      <hr style="${baseStyles.divider}">

      <div style="margin:40px 0;">
        <h2 style="color:#dc2626;font-size:24px;margin:0 0 15px;border-bottom:3px solid #dc2626;padding-bottom:10px;">📣 What's New</h2>
        <p style="line-height:1.8;">{{newsUpdate}}</p>
      </div>

      <hr style="${baseStyles.divider}">

      <div style="background:linear-gradient(135deg,#dc2626 0%,#991b1b 100%);padding:35px;border-radius:12px;text-align:center;margin:40px 0;color:#ffffff;">
        <h2 style="margin:0 0 15px;font-size:26px;">This Month's Special</h2>
        <p style="margin:0 0 20px;font-size:18px;line-height:1.6;">{{specialOffer}}</p>
        <p style="margin:0 0 25px;font-size:16px;">Use code: <strong style="font-size:20px;letter-spacing:2px;background-color:rgba(255,255,255,0.2);padding:8px 16px;border-radius:6px;">{{offerCode}}</strong></p>
        <a href="https://www.josemadridsalsa.com/store" style="display:inline-block;padding:14px 32px;background-color:#ffffff;color:#dc2626 !important;text-decoration:none;border-radius:6px;font-weight:600;">Shop Now</a>
      </div>

      <div style="background:#f8f9fa;padding:25px;border-radius:8px;margin:30px 0;">
        <h3 style="color:#333;margin:0 0 15px;font-size:18px;">📍 Where to Find Us</h3>
        <p style="margin:0;line-height:1.6;">Visit us at farmers markets, food festivals, and retail locations throughout Ohio. Check our website for the latest schedule!</p>
      </div>

      <p style="margin-top:40px;text-align:center;font-size:16px;">Thank you for being part of our community!</p>
      <p style="text-align:center;margin-top:10px;"><strong>- The Jose Madrid Salsa Family</strong></p>
    </div>
    ${jmsFooter}
  </div>
</body>
</html>`,
  text: `THE SALSA SCOOP - {{month}} Edition

FEATURED RECIPE: {{featuredRecipe}}
{{recipeLink}}

WHAT'S NEW:
{{newsUpdate}}

THIS MONTH'S SPECIAL:
{{specialOffer}}
Use code: {{offerCode}}

Shop: https://www.josemadridsalsa.com/store

Thank you for being part of our community!
- The Jose Madrid Salsa Family`,
}
