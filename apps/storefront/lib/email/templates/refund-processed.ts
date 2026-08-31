/**
 * Refund Processed Email Template
 * Sent when a refund has been processed for a customer order
 */

import { EmailTemplateDefinition } from './index'
import { baseStyles, headerImg, jmsFooter } from '../shared/components'

export const refundProcessedTemplate: EmailTemplateDefinition = {
  key: 'refund_processed',
  name: 'Refund Processed',
  subject: 'Refund Processed for Order #{{orderNumber}}',
  category: 'TRANSACTIONAL',
  description: 'Refund confirmation with timeline',
  variables: {
    name: 'string',
    orderNumber: 'string',
    refundAmount: 'string',
    refundMethod: 'string',
    processingDays: 'string',
    originalOrderDate: 'string',
  },
  html: `
<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"><title>Refund Processed</title></head>
<body style="${baseStyles.container}">
  <div style="${baseStyles.wrapper}">
    <div style="${baseStyles.header}">
      ${headerImg('refund-processed.png', 'Refund Processed')}
    </div>
    <div style="${baseStyles.content}">
      <p style="font-size:16px;margin-bottom:20px;">Hi {{name}},</p>
      <p style="margin-bottom:20px;">Your refund for order #{{orderNumber}} has been processed.</p>
      <div style="background:#f9fafb;border:1px solid #e2e8f0;border-radius:8px;padding:24px;margin:30px 0;">
        <table style="width:100%;border-collapse:collapse;">
          <tr style="border-bottom:1px solid #e2e8f0;">
            <td style="padding:12px 0;color:#6c757d;">Refund Amount:</td>
            <td style="padding:12px 0;text-align:right;font-weight:600;font-size:20px;color:#16a34a;">{{refundAmount}}</td>
          </tr>
          <tr style="border-bottom:1px solid #e2e8f0;">
            <td style="padding:12px 0;color:#6c757d;">Refund Method:</td>
            <td style="padding:12px 0;text-align:right;font-weight:600;">{{refundMethod}}</td>
          </tr>
          <tr style="border-bottom:1px solid #e2e8f0;">
            <td style="padding:12px 0;color:#6c757d;">Order Date:</td>
            <td style="padding:12px 0;text-align:right;">{{originalOrderDate}}</td>
          </tr>
          <tr>
            <td style="padding:12px 0;color:#6c757d;">Order Number:</td>
            <td style="padding:12px 0;text-align:right;font-weight:600;">#{{orderNumber}}</td>
          </tr>
        </table>
      </div>
      <div style="background:#fef3c7;border-left:4px solid #f59e0b;padding:20px;margin:30px 0;border-radius:6px;">
        <p style="margin:0 0 10px;color:#92400e;font-weight:600;">⏰ Processing Time</p>
        <p style="margin:0;color:#92400e;">Please allow {{processingDays}} for the refund to appear in your account, depending on your financial institution.</p>
      </div>
      <p style="margin-top:30px;">We're sorry things didn't work out this time. We're always working to improve our products and service.</p>
      <hr style="${baseStyles.divider}">
      <h3 style="color:#dc2626;font-size:18px;margin-bottom:15px;">We'd Love Your Feedback</h3>
      <p style="margin-bottom:20px;">If you have a moment, please let us know what went wrong so we can make it right:</p>
      <div style="text-align:center;margin:30px 0;">
        <a href="mailto:mike@josemadridsalsa.com" style="${baseStyles.button}">Share Feedback</a>
      </div>
      <p style="margin-top:30px;">Thank you for giving us a try.</p>
      <p style="margin-top:10px;"><strong>The Jose Madrid Salsa Team</strong></p>
    </div>
    ${jmsFooter}
  </div>
</body>
</html>`,
  text: `Hi {{name}},

Your refund for order #{{orderNumber}} has been processed.

REFUND DETAILS:
Amount: {{refundAmount}}
Method: {{refundMethod}}
Expected in Account: {{processingDays}}

Please allow {{processingDays}} for the refund to appear in your account.

We'd love your feedback on what went wrong. Reply to this email or call 740-349-3144.

Thank you for giving us a try.

The Jose Madrid Salsa Team`,
}
