/**
 * Thank You Email Template
 * Transactional email sent after purchase for appreciation
 */

import { EmailTemplateDefinition } from './index'
import { baseStyles, headerImg, jmsFooter } from '../shared/components'

export const thankYouTemplate: EmailTemplateDefinition = {
  key: 'thank_you',
  name: 'Thank You Email',
  subject: 'Thank You for Your Order! 💚',
  category: 'TRANSACTIONAL',
  description: 'Post-purchase appreciation',
  variables: {
    name: 'string',
    orderNumber: 'string',
    reviewUrl: 'string',
    referralCode: 'string',
  },
  html: `
<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"><title>Thank You</title></head>
<body style="${baseStyles.container}">
  <div style="${baseStyles.wrapper}">
    <div style="${baseStyles.header}">
      ${headerImg('thank-you.png', 'Thank You')}
    </div>
    <div style="${baseStyles.content}">
      <p style="font-size:16px;margin-bottom:20px;">Dear {{name}},</p>
      <p style="margin-bottom:20px;font-size:18px;">We wanted to take a moment to personally thank you for your order #{{orderNumber}}.</p>
      <p style="margin-bottom:30px;">Your support means the world to our family business and helps us continue crafting authentic salsa using recipes passed down through generations.</p>

      <div style="background:linear-gradient(135deg,#10b981 0%,#059669 100%);padding:35px;border-radius:12px;text-align:center;margin:30px 0;color:#ffffff;">
        <h2 style="margin:0 0 15px;font-size:26px;">We Hope You Love It!</h2>
        <p style="margin:0;font-size:16px;line-height:1.6;">Once you've had a chance to taste your salsa, we'd love to hear what you think.</p>
      </div>

      <div style="text-align:center;margin:30px 0;">
        <a href="{{reviewUrl}}" style="${baseStyles.button}background-color:#10b981;">Leave a Review</a>
      </div>

      <hr style="${baseStyles.divider}">

      <div style="background:#f8f9fa;padding:25px;border-radius:8px;margin:30px 0;">
        <h3 style="color:#333;margin:0 0 15px;font-size:20px;">🎁 Share the Love, Get Rewarded</h3>
        <p style="margin:0 0 15px;">Know someone who'd love Jose Madrid Salsa? Give them 15% off their first order with your personal referral code:</p>
        <div style="background:#ffffff;padding:15px;border-radius:6px;text-align:center;border:2px dashed #dc2626;">
          <p style="margin:0;font-size:24px;font-weight:700;color:#dc2626;letter-spacing:2px;">{{referralCode}}</p>
        </div>
        <p style="margin:15px 0 0;font-size:14px;color:#6c757d;text-align:center;">You'll earn $10 credit when they make their first purchase!</p>
      </div>

      <div style="background:#e7f5ff;border-left:4px solid #1971c2;padding:20px;margin:30px 0;border-radius:6px;">
        <p style="margin:0 0 10px;color:#1864ab;font-weight:600;">📸 Show Us Your Creations!</p>
        <p style="margin:0;color:#1864ab;">Tag us <strong>@JoseMadridSalsa</strong> on social media for a chance to be featured and win free products!</p>
      </div>

      <hr style="${baseStyles.divider}">

      <div style="margin:30px 0;">
        <h3 style="color:#dc2626;font-size:18px;margin:0 0 15px;">Ways to Enjoy Your Salsa:</h3>
        <ul style="padding-left:20px;">
          <li style="margin-bottom:10px;">Classic chips & salsa (obviously!)</li>
          <li style="margin-bottom:10px;">Mix into scrambled eggs or omelets</li>
          <li style="margin-bottom:10px;">Top grilled chicken or fish</li>
          <li style="margin-bottom:10px;">Stir into soups and chilis</li>
          <li>Use as a marinade base</li>
        </ul>
        <p style="margin-top:15px;"><a href="https://www.josemadridsalsa.com/recipes" style="color:#dc2626;font-weight:600;">Browse All Recipes →</a></p>
      </div>

      <p style="margin-top:40px;">Thank you again for choosing Jose Madrid Salsa. We're honored to be part of your kitchen!</p>
      <p style="margin-top:20px;"><strong>With gratitude,</strong><br>The Jose Madrid Family</p>
    </div>
    ${jmsFooter}
  </div>
</body>
</html>`,
  text: `Dear {{name}},

Thank you for your order #{{orderNumber}}!

Your support means everything to our family business.

LEAVE A REVIEW: {{reviewUrl}}

REFER A FRIEND:
Give them 15% off with code: {{referralCode}}
You'll earn $10 when they order!

Show us your creations on social media @JoseMadridSalsa

Thank you for choosing Jose Madrid Salsa!

The Jose Madrid Family`,
}
