/**
 * Subscription Renewal Template
 * Transactional email for recurring order confirmation and reminder
 */

import { EmailTemplateDefinition } from './index'
import { baseStyles, headerImg, jmsFooter } from '@/lib/email/shared/components'

export const subscriptionRenewalTemplate: EmailTemplateDefinition = {
  key: 'subscription_renewal',
  name: 'Subscription Renewal',
  subject: 'Your Upcoming Subscription Renewal',
  category: 'TRANSACTIONAL',
  description: 'Recurring order confirmation and reminder',
  variables: {
    name: 'string',
    subscriptionName: 'string',
    renewalDate: 'string',
    renewalPrice: 'string',
    manageSubscriptionUrl: 'string',
    orderItems: 'string',
  },
  html: `
<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"><title>Subscription Renewal</title></head>
<body style="${baseStyles.container}">
  <div style="${baseStyles.wrapper}">
    <div style="${baseStyles.header}">
      ${headerImg('renew-subscription.png', 'Subscription Renewal')}
    </div>
    <div style="${baseStyles.content}">
      <p style="font-size:16px;margin-bottom:20px;">Hi {{name}},</p>
      <p style="margin-bottom:20px;">This is a reminder that your {{subscriptionName}} subscription is scheduled to renew on <strong>{{renewalDate}}</strong>.</p>
      <div style="background:#f9fafb;border:1px solid #e2e8f0;border-radius:8px;padding:24px;margin:30px 0;">
        <h3 style="color:#333;margin:0 0 20px;font-size:18px;">Renewal Details</h3>
        <div style="margin-bottom:15px;">{{orderItems}}</div>
        <hr style="${baseStyles.divider}">
        <table style="width:100%;border-collapse:collapse;">
          <tr>
            <td style="padding:8px 0;color:#6c757d;">Renewal Price:</td>
            <td style="padding:8px 0;text-align:right;font-weight:600;font-size:18px;">{{renewalPrice}}</td>
          </tr>
          <tr>
            <td style="padding:8px 0;color:#6c757d;">Renewal Date:</td>
            <td style="padding:8px 0;text-align:right;font-weight:600;">{{renewalDate}}</td>
          </tr>
        </table>
      </div>
      <div style="background:#e7f5ff;border-left:4px solid #1971c2;padding:20px;margin:30px 0;border-radius:6px;">
        <p style="margin:0;color:#1864ab;">No action is needed. Your order will be processed automatically. To make changes to your subscription, please visit your account dashboard.</p>
      </div>
      <div style="text-align:center;margin:30px 0;">
        <a href="{{manageSubscriptionUrl}}" style="${baseStyles.button}">Manage Subscription</a>
      </div>
      <p style="margin-top:30px;">Thank you for being a loyal subscriber!</p>
      <p style="margin-top:10px;"><strong>The Jose Madrid Salsa Team</strong></p>
    </div>
    ${jmsFooter}
  </div>
</body>
</html>`,
  text: `Hi {{name}},

This is a reminder that your {{subscriptionName}} subscription is scheduled to renew on {{renewalDate}}.

RENEWAL DETAILS:
{{orderItems}}
Price: {{renewalPrice}}
Date: {{renewalDate}}

No action is needed. Your order will be processed automatically.

To make changes, visit: {{manageSubscriptionUrl}}

Thank you for being a loyal subscriber!
The Jose Madrid Salsa Team`,
}
