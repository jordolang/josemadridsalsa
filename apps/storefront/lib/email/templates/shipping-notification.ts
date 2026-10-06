/**
 * Shipping Notification Email Template
 * Transactional email sent when order ships with tracking information
 */

import { EmailTemplateDefinition } from './index'
import { baseStyles, headerImg, jmsFooter } from '@/lib/email/shared/components'

export const shippingNotificationTemplate: EmailTemplateDefinition = {
  key: 'shipping_notification',
  name: 'Shipping Notification',
  subject: 'Your Order is On the Way! 🚚',
  category: 'TRANSACTIONAL',
  description: 'Shipping confirmation with tracking',
  variables: {
    name: 'string',
    orderNumber: 'string',
    trackingNumber: 'string',
    trackingUrl: 'string',
    carrier: 'string',
    estimatedDelivery: 'string',
  },
  html: `
<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"><title>Shipped</title></head>
<body style="${baseStyles.container}">
  <div style="${baseStyles.wrapper}">
    <div style="${baseStyles.header}">
      ${headerImg('shipping-notification.png', 'Your Order Has Shipped')}
    </div>
    <div style="${baseStyles.content}">
      <p style="font-size:16px;margin-bottom:20px;">Hi {{name}},</p>
      <p style="margin-bottom:30px;font-size:18px;">Great news! Your order #{{orderNumber}} is on its way to you.</p>
      <div style="background:linear-gradient(135deg,#10b981 0%,#059669 100%);padding:30px;border-radius:12px;text-align:center;margin:30px 0;">
        <p style="color:#ffffff;margin:0 0 10px;font-size:14px;text-transform:uppercase;letter-spacing:1px;">Tracking Number</p>
        <p style="color:#ffffff;margin:0 0 20px;font-size:24px;font-weight:700;">{{trackingNumber}}</p>
        <a href="{{trackingUrl}}" style="display:inline-block;padding:12px 28px;background-color:#ffffff;color:#059669 !important;text-decoration:none;border-radius:6px;font-weight:600;">Track Package</a>
      </div>
      <div style="background:#f8f9fa;padding:25px;border-radius:8px;margin:30px 0;">
        <table style="width:100%;border-collapse:collapse;">
          <tr>
            <td style="padding:10px 0;border-bottom:1px solid #e2e8f0;">
              <p style="margin:0;color:#6c757d;font-size:14px;">Carrier</p>
              <p style="margin:5px 0 0;font-weight:600;">{{carrier}}</p>
            </td>
            <td style="padding:10px 0;border-bottom:1px solid #e2e8f0;text-align:right;">
              <p style="margin:0;color:#6c757d;font-size:14px;">Estimated Delivery</p>
              <p style="margin:5px 0 0;font-weight:600;color:#dc2626;">{{estimatedDelivery}}</p>
            </td>
          </tr>
        </table>
      </div>
      <div style="background:#fff3cd;border-left:4px solid #ffc107;padding:20px;margin:30px 0;border-radius:6px;">
        <p style="margin:0;color:#856404;"><strong>📍 Tip:</strong> Make sure someone is available to receive the package or provide delivery instructions to your carrier.</p>
      </div>
      <p style="margin-top:30px;">We hope you enjoy your Jose Madrid Salsa! Share your creations with us on social media using #JoseMadridSalsa</p>
    </div>
    ${jmsFooter}
  </div>
</body>
</html>`,
  text: `Hi {{name}},

Your order #{{orderNumber}} has shipped!

Tracking Number: {{trackingNumber}}
Carrier: {{carrier}}
Estimated Delivery: {{estimatedDelivery}}

Track your package: {{trackingUrl}}

Questions? Call 740-349-3144`,
}
