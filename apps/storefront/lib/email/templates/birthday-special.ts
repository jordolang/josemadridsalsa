/**
 * Birthday Special Email Template
 * Marketing email celebrating customer birthdays with a special offer
 */

import { EmailTemplateDefinition } from './index'
import { baseStyles, headerImg, jmsFooter } from '@/lib/email/shared/components'

export const birthdaySpecialTemplate: EmailTemplateDefinition = {
  key: 'birthday_special',
  name: 'Birthday Special',
  subject: 'Happy Birthday {{name}}! 🎉 Here\'s a Special Gift',
  category: 'MARKETING',
  description: 'Birthday celebration email with special offer',
  variables: {
    name: 'string',
    discountCode: 'string',
    expiryDate: 'string',
  },
  html: `
<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"><title>Happy Birthday</title></head>
<body style="${baseStyles.container}">
  <div style="${baseStyles.wrapper}">
    <div style="${baseStyles.header}">
      ${headerImg('birthday-header.png', 'Happy Birthday')}
    </div>
    <div style="${baseStyles.content}">
      <p style="font-size:20px;margin-bottom:25px;text-align:center;color:#dc2626;font-weight:700;">🎂 Happy Birthday {{name}}! 🎂</p>
      <p style="margin-bottom:20px;">We're so grateful to have you as part of the Jose Madrid Salsa family. Your birthday is the perfect time to celebrate YOU!</p>
      <p style="margin-bottom:30px;">To make your special day even better, we'd like to treat you to a birthday gift...</p>
      <div style="background:linear-gradient(135deg,#fef3c7 0%,#fde68a 100%);padding:35px;border-radius:12px;text-align:center;margin:30px 0;border:3px dashed #f59e0b;">
        <p style="margin:0 0 10px;color:#92400e;font-size:16px;font-weight:600;">🎁 YOUR BIRTHDAY GIFT 🎁</p>
        <p style="margin:0 0 20px;color:#92400e;font-size:42px;font-weight:700;line-height:1;">20% OFF</p>
        <p style="margin:0 0 20px;color:#92400e;font-size:14px;">Your entire order!</p>
        <div style="background:#ffffff;padding:15px;border-radius:8px;margin:20px 0;">
          <p style="margin:0 0 5px;color:#92400e;font-size:12px;text-transform:uppercase;letter-spacing:1px;">Use Code:</p>
          <p style="margin:0;color:#dc2626;font-size:24px;font-weight:700;letter-spacing:3px;">{{discountCode}}</p>
        </div>
        <a href="https://www.josemadridsalsa.com/store" style="${baseStyles.button}background-color:#dc2626;">Claim Your Gift</a>
        <p style="margin:20px 0 0;color:#92400e;font-size:13px;">Valid through {{expiryDate}}</p>
      </div>
      <hr style="${baseStyles.divider}">
      <div style="background:#e7f5ff;border-left:4px solid #1971c2;padding:20px;margin:30px 0;border-radius:6px;">
        <p style="margin:0 0 10px;color:#1864ab;font-weight:600;">🌟 Birthday Shopping Ideas:</p>
        <ul style="padding-left:20px;margin:10px 0 0;color:#1864ab;">
          <li style="margin-bottom:8px;">Try a new flavor you've been eyeing</li>
          <li style="margin-bottom:8px;">Stock up on your favorites</li>
          <li style="margin-bottom:8px;">Build the ultimate salsa gift basket</li>
          <li>Treat yourself to our variety pack</li>
        </ul>
      </div>
      <p style="margin-top:30px;text-align:center;font-size:16px;color:#dc2626;font-weight:600;">Make it a delicious birthday celebration!</p>
      <p style="margin-top:30px;">Wishing you an amazing birthday filled with great food, good friends, and plenty of salsa!</p>
      <p style="margin-top:20px;"><strong>Cheers to another year,</strong></p>
      <p style="margin-top:10px;"><strong>The Jose Madrid Salsa Team</strong></p>
    </div>
    ${jmsFooter}
  </div>
</body>
</html>`,
  text: `Happy Birthday {{name}}! 🎂

We're so grateful to have you as part of the Jose Madrid Salsa family.

YOUR BIRTHDAY GIFT: 20% OFF your entire order!

Use code: {{discountCode}}
Valid through: {{expiryDate}}

Shop now: https://www.josemadridsalsa.com/store

Birthday Shopping Ideas:
- Try a new flavor you've been eyeing
- Stock up on your favorites
- Build the ultimate salsa gift basket
- Treat yourself to our variety pack

Make it a delicious birthday celebration!

Wishing you an amazing birthday!

The Jose Madrid Salsa Team`,
}
