import { EmailTemplateDefinition } from './index'
import { baseStyles, headerImg, jmsFooter } from '../shared/components'

export const giftCertificateDeliveryTemplate: EmailTemplateDefinition = {
  key: 'gift_certificate_delivery',
  name: 'Gift Certificate Delivery',
  subject: "You've received a José Madrid Salsa gift certificate!",
  category: 'TRANSACTIONAL',
  description: 'Sent to the recipient when a gift certificate is purchased for them',
  variables: {
    recipientName: 'string',
    purchaserName: 'string',
    code: 'string',
    amount: 'string',
    message: 'string',
    redeemUrl: 'string',
    theme: 'string',
  },
  html: `
<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"><title>Your Gift Certificate</title></head>
<body style="${baseStyles.container}">
  <div style="${baseStyles.wrapper}">
    <div style="${baseStyles.header}">
      ${headerImg('email-header.png', 'Gift Certificate')}
    </div>
    <div style="${baseStyles.content}">
      <p style="font-size:16px;margin-bottom:20px;">Hi {{recipientName}},</p>
      <p style="margin-bottom:20px;">Great news — <strong>{{purchaserName}}</strong> has sent you a José Madrid Salsa gift certificate!</p>

      <div style="background:#fef9f0;border:2px solid #f59e0b;border-radius:12px;padding:32px;margin:30px 0;text-align:center;">
        <p style="margin:0 0 8px;font-size:13px;color:#92400e;text-transform:uppercase;letter-spacing:1px;font-weight:600;">Gift Certificate Value</p>
        <p style="margin:0 0 20px;font-size:42px;font-weight:700;color:#dc2626;">{{amount}}</p>
        <div style="background:#ffffff;border:2px dashed #f59e0b;border-radius:8px;padding:16px;display:inline-block;min-width:200px;">
          <p style="margin:0 0 4px;font-size:11px;color:#92400e;text-transform:uppercase;letter-spacing:1px;">Your Code</p>
          <p style="margin:0;font-size:22px;font-weight:700;color:#1f2937;letter-spacing:3px;font-family:monospace;">{{code}}</p>
        </div>
      </div>

      {{#if message}}
      <div style="background:#f0fdf4;border-left:4px solid #16a34a;padding:20px;margin:24px 0;border-radius:0 8px 8px 0;">
        <p style="margin:0 0 8px;font-size:13px;color:#166534;font-weight:600;text-transform:uppercase;letter-spacing:0.5px;">A message from {{purchaserName}}:</p>
        <p style="margin:0;font-size:16px;color:#166534;font-style:italic;">"{{message}}"</p>
      </div>
      {{/if}}

      <div style="text-align:center;margin:32px 0;">
        <a href="{{redeemUrl}}" style="${baseStyles.button}">Shop Now &amp; Use Your Gift</a>
      </div>

      <div style="background:#f8fafc;border-radius:8px;padding:20px;margin:24px 0;">
        <p style="margin:0 0 12px;font-size:14px;font-weight:600;color:#1f2937;">How to use your gift certificate:</p>
        <ol style="margin:0;padding-left:20px;font-size:14px;color:#4b5563;line-height:1.8;">
          <li>Browse our full collection of handcrafted salsas</li>
          <li>Add your favorites to the cart</li>
          <li>Enter code <strong>{{code}}</strong> at checkout</li>
          <li>Enjoy your delicious salsa — on us!</li>
        </ol>
      </div>

      <p style="font-size:13px;color:#9ca3af;text-align:center;margin-top:24px;">
        Gift certificates never expire. Check your balance anytime at
        <a href="{{redeemUrl}}" style="color:#dc2626;">josemadrid.net/gift-certificates/balance</a>.
      </p>
    </div>
    ${jmsFooter}
  </div>
</body>
</html>`,
  text: `Hi {{recipientName}},

{{purchaserName}} has sent you a José Madrid Salsa gift certificate worth {{amount}}!

YOUR CODE: {{code}}

{{#if message}}
Message from {{purchaserName}}: "{{message}}"
{{/if}}

How to redeem: Visit {{redeemUrl}}, browse our salsas, and enter your code at checkout.

Gift certificates never expire.

— The José Madrid Salsa Team`,
}
