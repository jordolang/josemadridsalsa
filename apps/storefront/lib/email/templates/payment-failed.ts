/**
 * Payment Failed Template
 * Transactional email for failed payment notification with retry link
 */

import { EmailTemplateDefinition } from './index'
import { baseStyles, headerImg, jmsFooter } from '@/lib/email/shared/components'

export const paymentFailedTemplate: EmailTemplateDefinition = {
  key: 'payment_failed',
  name: 'Payment Failed',
  subject: 'Action Required: Your Payment Failed',
  category: 'TRANSACTIONAL',
  description: 'Failed payment notification with retry link',
  variables: {
    name: 'string',
    orderNumber: 'string',
    amountDue: 'string',
    updatePaymentUrl: 'string',
  },
  html: `
<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"><title>Payment Failed</title></head>
<body style="${baseStyles.container}">
  <div style="${baseStyles.wrapper}">
    <div style="${baseStyles.header}">
      ${headerImg('payment-failure.png', 'Payment Failed')}
    </div>
    <div style="${baseStyles.content}">
      <p style="font-size:16px;margin-bottom:20px;">Hi {{name}},</p>
      <p style="margin-bottom:20px;">Unfortunately, we were unable to process the payment for your recent order #{{orderNumber}}.</p>
      <div style="background:#ffe3e3;border-left:4px solid #dc2626;padding:20px;margin:30px 0;border-radius:6px;">
        <p style="margin:0 0 10px;color:#991b1b;font-weight:600;">Action Required</p>
        <p style="margin:0;color:#991b1b;">Please update your payment information to keep your order active. Amount due: <strong>{{amountDue}}</strong></p>
      </div>
      <div style="text-align:center;margin:30px 0;">
        <a href="{{updatePaymentUrl}}" style="${baseStyles.button}">Update Payment Info</a>
      </div>
      <p style="margin-top:30px;">If your payment information is not updated within 3 days, your order will be automatically canceled.</p>
      <p style="margin-top:20px;">If you have any questions, please contact us at <a href="mailto:mike@josemadridsalsa.com" style="color:#dc2626;">mike@josemadridsalsa.com</a>.</p>
    </div>
    ${jmsFooter}
  </div>
</body>
</html>`,
  text: `Hi {{name}},

Your payment for order #{{orderNumber}} failed.

Amount due: {{amountDue}}

Please update your payment information: {{updatePaymentUrl}}

If not updated within 3 days, your order will be canceled.

Questions? Email mike@josemadridsalsa.com`,
}
