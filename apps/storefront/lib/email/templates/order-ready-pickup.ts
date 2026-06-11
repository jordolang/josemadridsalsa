import { EmailTemplateDefinition } from './index'
import { baseStyles, headerImg, jmsFooter } from '../shared/components'

export const orderReadyPickupTemplate: EmailTemplateDefinition = {
  key: 'order_ready_pickup',
  name: 'Order Ready for Pickup',
  subject: 'Your Order #{{orderNumber}} is Ready for Pickup!',
  category: 'TRANSACTIONAL',
  description: 'Sent to POS customers when their order is ready to collect',
  variables: {
    name: 'string',
    orderNumber: 'string',
    pickupLocation: 'string',
    pickupHours: 'string',
    pickupDeadline: 'string',
  },
  html: `
<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"><title>Order Ready for Pickup</title></head>
<body style="${baseStyles.container}">
  <div style="${baseStyles.wrapper}">
    <div style="${baseStyles.header}">
      ${headerImg('order-ready.png', 'Order Ready for Pickup')}
    </div>
    <div style="${baseStyles.content}">
      <p style="font-size:16px;margin-bottom:20px;">Hi {{name}},</p>
      <p style="margin-bottom:20px;">Your order <strong>#{{orderNumber}}</strong> is packed and ready for you to collect!</p>
      <div style="background:#f0fdf4;border:1px solid #bbf7d0;border-radius:8px;padding:24px;margin:30px 0;">
        <p style="margin:0 0 12px;font-size:16px;font-weight:600;color:#166534;">Pickup Details</p>
        <p style="margin:0 0 8px;color:#166534;"><strong>Location:</strong> {{pickupLocation}}</p>
        <p style="margin:0 0 8px;color:#166534;"><strong>Hours:</strong> {{pickupHours}}</p>
        {{#if pickupDeadline}}<p style="margin:0;color:#166534;"><strong>Please pick up by:</strong> {{pickupDeadline}}</p>{{/if}}
      </div>
      <div style="background:#fef9c3;border-left:4px solid #f59e0b;padding:16px 20px;margin:24px 0;border-radius:0 6px 6px 0;">
        <p style="margin:0;color:#92400e;font-size:14px;">Please bring this email or order number <strong>#{{orderNumber}}</strong> when you come to pick up.</p>
      </div>
      <p style="margin-top:30px;color:#6b7280;font-size:14px;">Questions? Contact us at <a href="mailto:mike@josemadridsalsa.com" style="color:#dc2626;">mike@josemadridsalsa.com</a> or (740) 521-4304.</p>
    </div>
    ${jmsFooter}
  </div>
</body>
</html>`,
  text: `Hi {{name}},

Your order #{{orderNumber}} is ready for pickup!

PICKUP DETAILS:
Location: {{pickupLocation}}
Hours: {{pickupHours}}
{{#if pickupDeadline}}Please pick up by: {{pickupDeadline}}{{/if}}

Please bring this email or your order number when you arrive.

Questions? mike@josemadridsalsa.com · (740) 521-4304`,
}
