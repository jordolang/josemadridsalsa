/**
 * Password Reset Email Template
 */

import { EmailTemplateDefinition } from './index'
import { baseStyles, headerImg, jmsFooter } from '../shared/components'

export const passwordResetTemplate: EmailTemplateDefinition = {
  key: 'password_reset',
  name: 'Password Reset',
  subject: 'Reset Your Password - Jose Madrid Salsa',
  category: 'TRANSACTIONAL',
  description: 'Password reset request email with secure reset link',
  variables: {
    name: 'string',
    resetUrl: 'string',
  },
  html: `
<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"><title>Reset Your Password</title></head>
<body style="${baseStyles.container}">
  <div style="${baseStyles.wrapper}">
    <div style="${baseStyles.header}">
      ${headerImg('security-notice.png', 'Reset Your Password')}
    </div>
    <div style="${baseStyles.content}">
      <p style="font-size:16px;margin-bottom:20px;">Hi {{name}},</p>
      <p style="margin-bottom:20px;">We received a request to reset your password for your Jose Madrid Salsa account.</p>
      <p style="margin-bottom:20px;">Click the button below to create a new password. This link will expire in 1 hour for security reasons.</p>
      <div style="text-align:center;margin:30px 0;">
        <a href="{{resetUrl}}" style="${baseStyles.button}">Reset Password</a>
      </div>
      <div style="background:#fef2f2;border-left:4px solid #dc2626;padding:20px;margin:30px 0;border-radius:6px;">
        <p style="margin:0 0 10px;color:#991b1b;font-weight:600;">🔒 Security Note</p>
        <p style="margin:0;color:#991b1b;font-size:14px;">If you didn't request a password reset, you can safely ignore this email. Your password will remain unchanged.</p>
      </div>
      <hr style="${baseStyles.divider}">
      <p style="margin-bottom:10px;font-size:14px;color:#6c757d;">If the button doesn't work, copy and paste this link into your browser:</p>
      <p style="word-break:break-all;font-size:12px;color:#dc2626;background:#f8f9fa;padding:12px;border-radius:4px;">{{resetUrl}}</p>
      <p style="margin-top:30px;">Need help? Contact us at <a href="tel:7405214304" style="color:#dc2626;">740-521-4304</a> or reply to this email.</p>
      <p style="margin-top:20px;"><strong>The Jose Madrid Salsa Team</strong></p>
    </div>
    ${jmsFooter}
  </div>
</body>
</html>`,
  text: `Hi {{name}},

We received a request to reset your password for your Jose Madrid Salsa account.

Click the link below to create a new password (expires in 1 hour):
{{resetUrl}}

If you didn't request a password reset, you can safely ignore this email.

Need help? Call 740-521-4304 or reply to this email.

---
José Madrid Salsa
Zanesville, OH 43701
(740) 521-4304
www.josemadridsalsa.com

© 2026 José Madrid Salsa. All rights reserved.`,
}
