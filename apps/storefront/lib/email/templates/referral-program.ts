/**
 * Referral Program Email Template
 * Marketing email explaining the referral rewards program
 */

import { EmailTemplateDefinition } from './index'

function getImageBaseUrl() {
  return 'https://www.josemadrid.net/email-templates'
}

const headerImg = (filename: string, alt: string) =>
  `<img src="${getImageBaseUrl()}/${filename}" alt="${alt}" width="600" style="display:block;width:100%;max-width:600px;height:auto;" />`

const baseStyles = {
  container: 'width:100%;background-color:#f4f4f7;padding:40px 0;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,"Helvetica Neue",Arial,sans-serif;',
  wrapper: 'max-width:600px;margin:0 auto;background-color:#ffffff;',
  header: 'padding:0;text-align:center;',
  content: 'padding:40px 32px;color:#333333;line-height:1.6;',
  button: 'display:inline-block;padding:14px 32px;background-color:#dc2626;color:#ffffff !important;text-decoration:none;border-radius:6px;font-weight:600;margin:20px 0;',
  divider: 'height:1px;background-color:#e2e8f0;margin:30px 0;border:none;',
}

const jmsFooter = `
<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background-color: #f4f1ec; font-family: Georgia, 'Times New Roman', serif;">
  <tr>
    <td align="center" style="padding: 0 16px;">
      <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="600" style="max-width: 600px; width: 100%;">
        <tr>
          <td style="padding: 32px 0 0 0;">
            <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">
              <tr>
                <td style="border-top: 2px solid #c8102e; font-size: 0; line-height: 0;" height="1">&nbsp;</td>
              </tr>
            </table>
          </td>
        </tr>
        <tr>
          <td align="center" style="padding: 28px 0 8px 0;">
            <a href="https://www.josemadridsalsa.com" target="_blank" style="text-decoration: none;">
              <img src="https://www.josemadrid.net/email-templates/Jose-Madrid-Profile.png" alt="José Madrid Salsa" width="180" height="auto" style="display: block; border: 0; outline: none; max-width: 180px; height: auto;" />
            </a>
          </td>
        </tr>
        <tr>
          <td align="center" style="padding: 4px 0 20px 0; font-family: Georgia, 'Times New Roman', serif; font-size: 13px; line-height: 1.4; color: #8c7a6b; letter-spacing: 0.5px;">
            Handcrafted Gourmet Salsas · Zanesville, Ohio · Est. 1988
          </td>
        </tr>
        <tr>
          <td align="center" style="padding: 0 0 20px 0;">
            <table role="presentation" cellpadding="0" cellspacing="0" border="0">
              <tr>
                <td style="padding: 0 12px;"><a href="https://www.josemadridsalsa.com" target="_blank" style="font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; font-size: 12px; font-weight: 700; color: #2d2318; text-decoration: none; text-transform: uppercase; letter-spacing: 1.2px;">Shop</a></td>
                <td style="color: #d4c8ba; font-size: 12px;">&#124;</td>
                <td style="padding: 0 12px;"><a href="https://www.josemadridsalsa.com/our-story" target="_blank" style="font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; font-size: 12px; font-weight: 700; color: #2d2318; text-decoration: none; text-transform: uppercase; letter-spacing: 1.2px;">Our Story</a></td>
                <td style="color: #d4c8ba; font-size: 12px;">&#124;</td>
                <td style="padding: 0 12px;"><a href="https://www.josemadridsalsa.com/our-salsas" target="_blank" style="font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; font-size: 12px; font-weight: 700; color: #2d2318; text-decoration: none; text-transform: uppercase; letter-spacing: 1.2px;">Flavors</a></td>
                <td style="color: #d4c8ba; font-size: 12px;">&#124;</td>
                <td style="padding: 0 12px;"><a href="https://josemadridsalsafundraising.com" target="_blank" style="font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; font-size: 12px; font-weight: 700; color: #2d2318; text-decoration: none; text-transform: uppercase; letter-spacing: 1.2px;">Fundraising</a></td>
                <td style="color: #d4c8ba; font-size: 12px;">&#124;</td>
                <td style="padding: 0 12px;"><a href="https://www.josemadridsalsa.com/contact-us" target="_blank" style="font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; font-size: 12px; font-weight: 700; color: #2d2318; text-decoration: none; text-transform: uppercase; letter-spacing: 1.2px;">Contact</a></td>
              </tr>
            </table>
          </td>
        </tr>
        <tr>
          <td align="center" style="padding: 0 0 24px 0;">
            <table role="presentation" cellpadding="0" cellspacing="0" border="0">
              <tr>
                <td style="padding: 0 8px;"><a href="https://www.facebook.com/josemadridsalsa" target="_blank" style="text-decoration: none;"><img src="https://cdn-icons-png.flaticon.com/512/733/733547.png" alt="Facebook" width="28" height="28" style="display: block; border: 0; border-radius: 50%;" /></a></td>
                <td style="padding: 0 8px;"><a href="https://www.instagram.com/josemadrid_salsa/" target="_blank" style="text-decoration: none;"><img src="https://cdn-icons-png.flaticon.com/512/2111/2111463.png" alt="Instagram" width="28" height="28" style="display: block; border: 0; border-radius: 50%;" /></a></td>
                <td style="padding: 0 8px;"><a href="https://x.com/madridsalsa" target="_blank" style="text-decoration: none;"><img src="https://cdn-icons-png.flaticon.com/512/5968/5968830.png" alt="X (Twitter)" width="28" height="28" style="display: block; border: 0; border-radius: 50%;" /></a></td>
                <td style="padding: 0 8px;"><a href="https://www.linkedin.com/company/jose-madrid-salsa" target="_blank" style="text-decoration: none;"><img src="https://cdn-icons-png.flaticon.com/512/3536/3536505.png" alt="LinkedIn" width="28" height="28" style="display: block; border: 0; border-radius: 50%;" /></a></td>
              </tr>
            </table>
          </td>
        </tr>
        <tr>
          <td align="center" style="padding: 0 0 20px 0;">
            <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background-color: #ebe5db; border-radius: 6px;">
              <tr>
                <td align="center" style="padding: 14px 20px;">
                  <table role="presentation" cellpadding="0" cellspacing="0" border="0">
                    <tr>
                      <td style="padding: 0 10px;"><a href="{{NEWSLETTER_PREFERENCES_URL}}" target="_blank" style="font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; font-size: 11px; color: #6b5d50; text-decoration: underline; letter-spacing: 0.3px;">Manage Preferences</a></td>
                      <td style="color: #c8bfb3; font-size: 11px;">&#8226;</td>
                      <td style="padding: 0 10px;"><a href="{{VIEW_IN_BROWSER_URL}}" target="_blank" style="font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; font-size: 11px; color: #6b5d50; text-decoration: underline; letter-spacing: 0.3px;">View in Browser</a></td>
                      <td style="color: #c8bfb3; font-size: 11px;">&#8226;</td>
                      <td style="padding: 0 10px;"><a href="{{FORWARD_TO_FRIEND_URL}}" target="_blank" style="font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; font-size: 11px; color: #6b5d50; text-decoration: underline; letter-spacing: 0.3px;">Forward to a Friend</a></td>
                    </tr>
                  </table>
                </td>
              </tr>
            </table>
          </td>
        </tr>
        <tr>
          <td align="center" style="padding: 0 20px 12px 20px; font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; font-size: 11px; line-height: 1.6; color: #a0948a;">
            You're receiving this email because you signed up for updates from José Madrid Salsa or made a purchase at josemadridsalsa.com.
          </td>
        </tr>
        <tr>
          <td align="center" style="padding: 0 20px 8px 20px; font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; font-size: 11px; line-height: 1.6; color: #a0948a;">
            José Madrid Salsa &middot; Zanesville, OH 43701 &middot; (740) 521-4304
          </td>
        </tr>
        <tr>
          <td align="center" style="padding: 0 0 32px 0;">
            <a href="{{UNSUBSCRIBE_URL}}" target="_blank" style="font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; font-size: 11px; font-weight: 700; color: #c8102e; text-decoration: underline; letter-spacing: 0.3px;">Unsubscribe</a>
          </td>
        </tr>
        <tr>
          <td style="padding: 0;">
            <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">
              <tr>
                <td style="border-top: 3px solid #c8102e; font-size: 0; line-height: 0;" height="1">&nbsp;</td>
              </tr>
            </table>
          </td>
        </tr>
        <tr>
          <td align="center" style="padding: 16px 0 32px 0; font-family: Georgia, 'Times New Roman', serif; font-size: 10px; color: #c0b6ab; letter-spacing: 0.3px;">
            &copy; 2026 José Madrid Salsa. All rights reserved.
          </td>
        </tr>
      </table>
    </td>
  </tr>
</table>
`

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
      ${headerImg('referral-program.png', 'Share the Heat')}
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
