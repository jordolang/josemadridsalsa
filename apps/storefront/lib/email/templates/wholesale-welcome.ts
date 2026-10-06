/**
 * Wholesale Welcome Template
 * Transactional email sent to new B2B wholesale partners
 */

import { EmailTemplateDefinition } from './index'
import { baseStyles, headerImg, jmsFooter } from '@/lib/email/shared/components'

export const wholesaleWelcomeTemplate: EmailTemplateDefinition = {
  key: 'wholesale_welcome',
  name: 'Wholesale Welcome',
  subject: 'Welcome to Our Wholesale Program! 🤝',
  category: 'TRANSACTIONAL',
  description: 'B2B partner onboarding',
  variables: {
    businessName: 'string',
    contactName: 'string',
    accountManager: 'string',
    accountManagerEmail: 'string',
    accountManagerPhone: 'string',
    discountRate: 'string',
    orderPortalUrl: 'string',
  },
  html: `
<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"><title>Wholesale Welcome</title></head>
<body style="${baseStyles.container}">
  <div style="${baseStyles.wrapper}">
    <div style="${baseStyles.header}">
      ${headerImg('wholesale-welcome.png', 'Welcome to Wholesale')}
    </div>
    <div style="${baseStyles.content}">
      <p style="font-size:16px;margin-bottom:20px;">Dear {{contactName}},</p>
      <p style="margin-bottom:20px;">We're excited to partner with {{businessName}} as an official Jose Madrid Salsa wholesale customer! Thank you for choosing to carry our products.</p>

      <div style="background:linear-gradient(135deg,#10b981 0%,#059669 100%);padding:30px;border-radius:12px;text-align:center;margin:30px 0;color:#ffffff;">
        <p style="margin:0 0 10px;font-size:14px;text-transform:uppercase;letter-spacing:1px;">Your Wholesale Discount</p>
        <p style="margin:0;font-size:42px;font-weight:700;">{{discountRate}}</p>
      </div>

      <div style="background:#f8f9fa;padding:25px;border-radius:8px;margin:30px 0;">
        <h3 style="color:#333;margin:0 0 20px;font-size:20px;">Your Account Manager</h3>
        <table style="width:100%;border-collapse:collapse;">
          <tr>
            <td style="padding:10px 0;">
              <p style="margin:0 0 5px;color:#6c757d;font-size:14px;">Name</p>
              <p style="margin:0;font-weight:600;">{{accountManager}}</p>
            </td>
          </tr>
          <tr>
            <td style="padding:10px 0;">
              <p style="margin:0 0 5px;color:#6c757d;font-size:14px;">Email</p>
              <p style="margin:0;"><a href="mailto:{{accountManagerEmail}}" style="color:#dc2626;">{{accountManagerEmail}}</a></p>
            </td>
          </tr>
          <tr>
            <td style="padding:10px 0;">
              <p style="margin:0 0 5px;color:#6c757d;font-size:14px;">Phone</p>
              <p style="margin:0;"><a href="tel:{{accountManagerPhone}}" style="color:#dc2626;">{{accountManagerPhone}}</a></p>
            </td>
          </tr>
        </table>
      </div>

      <div style="text-align:center;margin:30px 0;">
        <a href="{{orderPortalUrl}}" style="${baseStyles.button}">Access Order Portal</a>
      </div>

      <div style="margin:30px 0;">
        <h3 style="color:#dc2626;font-size:20px;margin:0 0 15px;">What's Included:</h3>
        <ul style="padding-left:20px;">
          <li style="margin-bottom:12px;"><strong>Priority Ordering:</strong> Online portal with order history tracking</li>
          <li style="margin-bottom:12px;"><strong>Marketing Support:</strong> Point-of-sale materials, shelf talkers, and digital assets</li>
          <li style="margin-bottom:12px;"><strong>Product Training:</strong> Staff tasting kits and product knowledge sheets</li>
          <li style="margin-bottom:12px;"><strong>Flexible Terms:</strong> Net 30 payment options for qualified accounts</li>
          <li><strong>Dedicated Support:</strong> Direct line to your account manager</li>
        </ul>
      </div>

      <div style="background:#e7f5ff;border-left:4px solid #1971c2;padding:20px;margin:30px 0;border-radius:6px;">
        <p style="margin:0 0 10px;color:#1864ab;font-weight:600;">📦 First Order Bonus</p>
        <p style="margin:0;color:#1864ab;">Orders over $500 ship free and include a POS display kit!</p>
      </div>

      <hr style="${baseStyles.divider}">

      <p style="margin-top:30px;"><strong>Next Steps:</strong></p>
      <ol style="padding-left:20px;line-height:1.8;">
        <li>Log in to your wholesale portal</li>
        <li>Review our current product catalog</li>
        <li>Schedule a call with {{accountManager}} if needed</li>
        <li>Place your first order!</li>
      </ol>

      <p style="margin-top:30px;">We're here to help you succeed. Don't hesitate to reach out with questions or for support.</p>
      <p style="margin-top:20px;"><strong>Welcome to the Jose Madrid Salsa family!</strong></p>
    </div>
    ${jmsFooter}
  </div>
</body>
</html>`,
  text: `Welcome to Jose Madrid Salsa Wholesale, {{businessName}}!

Your wholesale discount: {{discountRate}}

Your Account Manager:
{{accountManager}}
{{accountManagerEmail}}
{{accountManagerPhone}}

Access your wholesale portal: {{orderPortalUrl}}

First order over $500 ships free!

Questions? Contact {{accountManager}} directly.`,
}
