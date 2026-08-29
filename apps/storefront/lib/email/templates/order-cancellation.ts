/**
 * Order Cancellation Email Template
 * Sent when an order has been canceled
 */

import { EmailTemplateDefinition } from './index'
import { baseStyles, headerImg, jmsFooter } from '../shared/components'

export const orderCancellationTemplate: EmailTemplateDefinition = {
  key: 'order_cancellation',
  name: 'Order Cancellation',
  subject: 'Your Order #{{orderNumber}} Has Been Canceled',
  category: 'TRANSACTIONAL',
  description: 'Cancellation confirmation',
  variables: {
    name: 'string',
    orderNumber: 'string',
    cancellationDate: 'string',
  },
  html: `
<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"><title>Order Canceled</title></head>
<body style="${baseStyles.container}">
  <div style="${baseStyles.wrapper}">
    <div style="${baseStyles.header}">
      ${headerImg('order-cancellation.png', 'Order Canceled')}
    </div>
    <div style="${baseStyles.content}">
      <p style="font-size:16px;margin-bottom:20px;">Hi {{name}},</p>
      <p style="margin-bottom:20px;">Your order #{{orderNumber}} has been canceled as of {{cancellationDate}}.</p>
      <div style="background:#ffe3e3;border-left:4px solid #dc2626;padding:20px;margin:30px 0;border-radius:6px;">
        <p style="margin:0;color:#991b1b;">If you did not request this cancellation, please contact us immediately at <a href="mailto:mike@josemadridsalsa.com" style="color:#991b1b;">mike@josemadridsalsa.com</a>.</p>
      </div>
      <p style="margin-top:30px;">If you have any questions, feel free to reach out. We're here to help.</p>
    </div>
    ${jmsFooter}
  </div>
</body>
</html>`,
  text: `Hi {{name}},

Your order #{{orderNumber}} has been canceled as of {{cancellationDate}}.

If you did not request this, please contact us immediately at mike@josemadridsalsa.com.

If you have any questions, feel free to reach out.`,
}
