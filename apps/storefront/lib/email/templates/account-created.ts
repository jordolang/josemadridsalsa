/**
 * Account Created Email Template
 */

import { EmailTemplateDefinition } from './index'
import { baseStyles, headerImg, jmsFooter } from '@/lib/email/shared/components'

export const accountCreatedTemplate: EmailTemplateDefinition = {
  key: 'account_created',
  name: 'Account Created',
  subject: 'Your Jose Madrid Salsa Account is Ready!',
  category: 'TRANSACTIONAL',
  description: 'Account creation confirmation email',
  variables: {
    name: 'string',
    email: 'string',
  },
  html: `
<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"><title>Account Created</title></head>
<body style="${baseStyles.container}">
  <div style="${baseStyles.wrapper}">
    <div style="${baseStyles.header}">
      ${headerImg('account-created.png', 'Account Created Successfully')}
    </div>
    <div style="${baseStyles.content}">
      <p style="font-size:16px;margin-bottom:20px;">Hi {{name}},</p>
      <p style="margin-bottom:20px;">Great news! Your Jose Madrid Salsa account has been successfully created and verified.</p>
      <div style="background:#ecfdf5;border-left:4px solid #10b981;padding:20px;margin:30px 0;border-radius:6px;">
        <p style="margin:0 0 10px;color:#065f46;font-weight:600;">✓ Account Details</p>
        <p style="margin:0;color:#065f46;font-size:14px;">Email: <strong>{{email}}</strong></p>
      </div>
      <p style="margin-bottom:20px;">You can now enjoy all the benefits of your account, including:</p>
      <ul style="padding-left:20px;">
        <li style="margin-bottom:10px;">Fast checkout with saved information</li>
        <li style="margin-bottom:10px;">Order history and tracking</li>
        <li style="margin-bottom:10px;">Exclusive member-only offers</li>
        <li style="margin-bottom:10px;">Early access to new flavors</li>
      </ul>
      <div style="text-align:center;margin:30px 0;">
        <a href="https://www.josemadridsalsa.com/account" style="${baseStyles.button}">Go to My Account</a>
      </div>
      <hr style="${baseStyles.divider}">
      <h3 style="color:#dc2626;font-size:18px;margin-bottom:15px;">What's Next?</h3>
      <p style="margin-bottom:15px;">Start exploring our delicious selection of handcrafted salsas. Whether you prefer mild, medium, or fire-hot, we have the perfect flavor for you!</p>
      <div style="text-align:center;margin:30px 0;">
        <a href="https://www.josemadridsalsa.com/store" style="display:inline-block;padding:12px 28px;background-color:#ffffff;color:#dc2626 !important;text-decoration:none;border:2px solid #dc2626;border-radius:6px;font-weight:600;">Browse Our Salsas</a>
      </div>
      <p style="margin-top:30px;">Need help getting started? Our team is here to assist you. Call us at <a href="tel:7405214304" style="color:#dc2626;">740-521-4304</a> or reply to this email.</p>
      <p style="margin-top:20px;">Welcome to the family!</p>
      <p style="margin-top:10px;"><strong>The Jose Madrid Salsa Team</strong></p>
    </div>
    ${jmsFooter}
  </div>
</body>
</html>`,
  text: `Hi {{name}},

Great news! Your Jose Madrid Salsa account has been successfully created and verified.

Account Email: {{email}}

You can now enjoy:
- Fast checkout with saved information
- Order history and tracking
- Exclusive member-only offers
- Early access to new flavors

Manage your account: https://www.josemadridsalsa.com/account
Browse our salsas: https://www.josemadridsalsa.com/store

Need help? Call 740-521-4304 or reply to this email.

Welcome to the family!

---
José Madrid Salsa
Zanesville, OH 43701
(740) 521-4304
www.josemadridsalsa.com

© 2026 José Madrid Salsa. All rights reserved.`,
}
