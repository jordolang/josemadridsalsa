/**
 * Email Verification Template
 */

import { EmailTemplateDefinition } from './index'
import { baseStyles, headerImg, jmsFooter } from '@/lib/email/shared/components'

export const emailVerificationTemplate: EmailTemplateDefinition = {
  key: 'email_verification',
  name: 'Email Verification',
  subject: 'Please Verify Your Email - Jose Madrid Salsa',
  category: 'TRANSACTIONAL',
  description: 'Email address verification request with confirmation link',
  variables: {
    name: 'string',
    verificationUrl: 'string',
  },
  html: `
<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"><title>Verify Your Email</title></head>
<body style="${baseStyles.container}">
  <div style="${baseStyles.wrapper}">
    <div style="${baseStyles.header}">
      ${headerImg('security-notice.png', 'Verify Your Email')}
    </div>
    <div style="${baseStyles.content}">
      <p style="font-size:16px;margin-bottom:20px;">Hi {{name}},</p>
      <p style="margin-bottom:20px;">Thank you for creating an account with Jose Madrid Salsa! We're excited to have you join our community.</p>
      <p style="margin-bottom:20px;">To complete your registration and start shopping, please verify your email address by clicking the button below:</p>
      <div style="text-align:center;margin:30px 0;">
        <a href="{{verificationUrl}}" style="${baseStyles.button}">Verify Email Address</a>
      </div>
      <div style="background:#ecfdf5;border-left:4px solid #10b981;padding:20px;margin:30px 0;border-radius:6px;">
        <p style="margin:0 0 10px;color:#065f46;font-weight:600;">✓ Why verify?</p>
        <p style="margin:0;color:#065f46;font-size:14px;">Verifying your email helps us keep your account secure and ensures you receive important order updates and exclusive offers.</p>
      </div>
      <hr style="${baseStyles.divider}">
      <p style="margin-bottom:10px;font-size:14px;color:#6c757d;">If the button doesn't work, copy and paste this link into your browser:</p>
      <p style="word-break:break-all;font-size:12px;color:#dc2626;background:#f8f9fa;padding:12px;border-radius:4px;">{{verificationUrl}}</p>
      <p style="margin-top:30px;font-size:14px;color:#6c757d;">If you didn't create an account with Jose Madrid Salsa, you can safely ignore this email.</p>
      <p style="margin-top:30px;">Questions? Contact us at <a href="tel:7405214304" style="color:#dc2626;">740-521-4304</a> or reply to this email.</p>
      <p style="margin-top:20px;"><strong>The Jose Madrid Salsa Team</strong></p>
    </div>
    ${jmsFooter}
  </div>
</body>
</html>`,
  text: `Hi {{name}},

Thank you for creating an account with Jose Madrid Salsa!

Please verify your email address by clicking the link below:
{{verificationUrl}}

Verifying your email helps us keep your account secure and ensures you receive important order updates and exclusive offers.

If you didn't create an account with Jose Madrid Salsa, you can safely ignore this email.

Questions? Call 740-521-4304 or reply to this email.

---
José Madrid Salsa
Zanesville, OH 43701
(740) 521-4304
www.josemadridsalsa.com

© 2026 José Madrid Salsa. All rights reserved.`,
}
