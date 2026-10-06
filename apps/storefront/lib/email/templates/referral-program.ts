/**
 * Referral Program Email Template
 * Marketing email explaining the referral rewards program
 */

import { EmailTemplateDefinition } from './index'
import { baseStyles, headerImg, jmsFooter } from '@/lib/email/shared/components'

export const referralProgramTemplate: EmailTemplateDefinition = {
  key: 'referral_program',
  name: 'Referral Program',
  subject: 'Share the Heat, Earn Rewards! 🌶️',
  category: 'MARKETING',
  description: 'Referral program explanation and invitation',
  variables: {
    name: 'string',
    referralCode: 'string',
    referralLink: 'string',
    reward: 'string',
  },
  html: `
<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"><title>Referral Program</title></head>
<body style="${baseStyles.container}">
  <div style="${baseStyles.wrapper}">
    <div style="${baseStyles.header}">
      ${headerImg('referral.png', 'Share the Heat')}
    </div>
    <div style="${baseStyles.content}">
      <p style="font-size:16px;margin-bottom:20px;">Hi {{name}},</p>
      <p style="margin-bottom:20px;">Love Jose Madrid Salsa? We bet your friends would too! And now you can earn rewards just for sharing the flavor.</p>
      <div style="background:linear-gradient(135deg,#dc2626 0%,#991b1b 100%);padding:35px;border-radius:12px;text-align:center;margin:30px 0;color:#ffffff;">
        <p style="margin:0 0 15px;font-size:24px;font-weight:700;">How It Works</p>
        <div style="background:rgba(255,255,255,0.15);padding:20px;border-radius:8px;margin:20px 0;">
          <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">
            <tr>
              <td style="padding:15px;text-align:center;">
                <div style="background:#ffffff;color:#dc2626;width:50px;height:50px;line-height:50px;border-radius:50%;font-size:24px;font-weight:700;margin:0 auto 10px;">1</div>
                <p style="margin:0;font-size:14px;color:#ffffff;">Share your unique link</p>
              </td>
              <td style="padding:15px;text-align:center;">
                <div style="background:#ffffff;color:#dc2626;width:50px;height:50px;line-height:50px;border-radius:50%;font-size:24px;font-weight:700;margin:0 auto 10px;">2</div>
                <p style="margin:0;font-size:14px;color:#ffffff;">Friend makes a purchase</p>
              </td>
              <td style="padding:15px;text-align:center;">
                <div style="background:#ffffff;color:#dc2626;width:50px;height:50px;line-height:50px;border-radius:50%;font-size:24px;font-weight:700;margin:0 auto 10px;">3</div>
                <p style="margin:0;font-size:14px;color:#ffffff;">You both get {{reward}}</p>
              </td>
            </tr>
          </table>
        </div>
      </div>
      <div style="background:#f8f9fa;padding:30px;border-radius:8px;text-align:center;margin:30px 0;">
        <p style="margin:0 0 15px;color:#333;font-size:16px;font-weight:600;">Your Personal Referral Link</p>
        <div style="background:#ffffff;padding:15px;border-radius:6px;border:2px dashed #dc2626;margin:15px 0;">
          <p style="margin:0;color:#dc2626;font-size:14px;word-break:break-all;">{{referralLink}}</p>
        </div>
        <p style="margin:15px 0 0;color:#6c757d;font-size:13px;">Or use code: <strong style="color:#dc2626;">{{referralCode}}</strong></p>
      </div>
      <div style="text-align:center;margin:30px 0;">
        <a href="{{referralLink}}" style="${baseStyles.button}">Share Your Link</a>
      </div>
      <hr style="${baseStyles.divider}">
      <div style="background:#e7f5ff;border-left:4px solid #1971c2;padding:20px;margin:30px 0;border-radius:6px;">
        <p style="margin:0 0 15px;color:#1864ab;font-weight:600;">✨ Bonus Benefits:</p>
        <ul style="padding-left:20px;margin:10px 0 0;color:#1864ab;">
          <li style="margin-bottom:8px;">Unlimited referrals - no cap on rewards!</li>
          <li style="margin-bottom:8px;">Your friend gets {{reward}} on their first order</li>
          <li style="margin-bottom:8px;">You get {{reward}} for each successful referral</li>
          <li>Rewards stack and never expire</li>
        </ul>
      </div>
      <div style="background:#fef3c7;border-left:4px solid #f59e0b;padding:20px;margin:30px 0;border-radius:6px;">
        <p style="margin:0 0 10px;color:#92400e;font-weight:600;">💡 Pro Tips for Sharing:</p>
        <ul style="padding-left:20px;margin:10px 0 0;color:#92400e;">
          <li style="margin-bottom:8px;">Share on social media with your food photos</li>
          <li style="margin-bottom:8px;">Text the link to salsa-loving friends</li>
          <li style="margin-bottom:8px;">Include it in your recipe shares</li>
          <li>Forward this email to friends who love good food</li>
        </ul>
      </div>
      <p style="margin-top:30px;text-align:center;font-size:18px;color:#dc2626;font-weight:600;">Start sharing the heat today!</p>
      <p style="margin-top:30px;">Questions about the referral program? Reply to this email or call us at <a href="tel:7405214304" style="color:#dc2626;">740-521-4304</a>.</p>
      <p style="margin-top:20px;"><strong>Happy Sharing,</strong></p>
      <p style="margin-top:10px;"><strong>The Jose Madrid Salsa Team</strong></p>
    </div>
    ${jmsFooter}
  </div>
</body>
</html>`,
  text: `Hi {{name}},

Love Jose Madrid Salsa? Share the flavor and earn rewards!

HOW IT WORKS:
1. Share your unique link
2. Friend makes a purchase
3. You both get {{reward}}

Your Personal Referral Link:
{{referralLink}}

Or use code: {{referralCode}}

BONUS BENEFITS:
- Unlimited referrals - no cap on rewards
- Your friend gets {{reward}} on their first order
- You get {{reward}} for each successful referral
- Rewards stack and never expire

PRO TIPS FOR SHARING:
- Share on social media with your food photos
- Text the link to salsa-loving friends
- Include it in your recipe shares
- Forward this email to friends who love good food

Start sharing the heat today!

Questions? Call 740-521-4304 or reply to this email.

Happy Sharing,
The Jose Madrid Salsa Team`,
}
