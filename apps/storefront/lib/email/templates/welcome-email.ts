/**
 * Welcome Email Template
 * Transactional email sent to new customers
 */

import { EmailTemplateDefinition } from './index'
import { baseStyles, headerImg, jmsFooter } from '@/lib/email/shared/components'

export const welcomeEmailTemplate: EmailTemplateDefinition = {
  key: 'welcome_email',
  name: 'Welcome Email',
  subject: 'Welcome to Jose Madrid Salsa! 🌶️',
  category: 'TRANSACTIONAL',
  description: 'New customer onboarding email',
  variables: {
    name: 'string',
    discountCode: 'string',
  },
  html: `
<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"><title>Welcome</title></head>
<body style="${baseStyles.container}">
  <div style="${baseStyles.wrapper}">
    <div style="${baseStyles.header}">
      ${headerImg('new-welcome.png', 'Welcome to the Family')}
    </div>
    <div style="${baseStyles.content}">
      <p style="font-size:16px;margin-bottom:20px;">Hi {{name}},</p>
      <p style="margin-bottom:20px;">Thank you for joining the Jose Madrid Salsa community! We're thrilled to have you here and can't wait to add some heat to your kitchen.</p>
      <p style="margin-bottom:20px;">Since 1982, we've been crafting authentic salsas using time-honored recipes passed down through generations. Every jar is made with fresh ingredients and packed with flavor.</p>
      <div style="background:#fef3c7;border-left:4px solid #f59e0b;padding:20px;margin:30px 0;border-radius:6px;">
        <p style="margin:0 0 10px;color:#92400e;font-weight:600;">🎁 Welcome Gift!</p>
        <p style="margin:0;color:#92400e;">Use code <strong>{{discountCode}}</strong> for 15% off your first order</p>
      </div>
      <div style="text-align:center;margin:30px 0;">
        <a href="https://www.josemadridsalsa.com/store" style="${baseStyles.button}">Start Shopping</a>
      </div>
      <hr style="${baseStyles.divider}">
      <h3 style="color:#dc2626;font-size:18px;margin-bottom:15px;">What to Try First:</h3>
      <ul style="padding-left:20px;">
        <li style="margin-bottom:10px;"><strong>Mild Red Salsa</strong> - Perfect for beginners</li>
        <li style="margin-bottom:10px;"><strong>Fire Roasted Medium</strong> - Our most popular</li>
        <li style="margin-bottom:10px;"><strong>Habanero Hot</strong> - For heat seekers</li>
      </ul>
      <p style="margin-top:30px;">Questions? Reply to this email or call us at <a href="tel:7403493144" style="color:#dc2626;">740-349-3144</a>.</p>
      <p style="margin-top:20px;">Welcome aboard!</p>
      <p style="margin-top:10px;"><strong>The Jose Madrid Salsa Team</strong></p>
    </div>
    ${jmsFooter}
  </div>
</body>
</html>`,
  text: `Hi {{name}},

Welcome to Jose Madrid Salsa! Thank you for joining our community.

Use code {{discountCode}} for 15% off your first order.

Shop now: https://www.josemadridsalsa.com/store

Questions? Call 740-349-3144 or reply to this email.

Jose Madrid Salsa Team`,
}
