/**
 * Refund Processed Email Template
 * Sent when a refund has been processed for a customer order
 */

export interface EmailTemplateDefinition {
  key: string
  name: string
  subject: string
  category: 'TRANSACTIONAL' | 'MARKETING' | 'ADMINISTRATIVE'
  description: string
  variables: Record<string, string>
  html: string
  text: string
}

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

export const refundProcessedTemplate: EmailTemplateDefinition = {
  key: 'refund_processed',
  name: 'Refund Processed',
  subject: 'Refund Processed for Order #{{orderNumber}}',
  category: 'TRANSACTIONAL',
  description: 'Refund confirmation with timeline',
  variables: {
    name: 'string',
    orderNumber: 'string',
    refundAmount: 'string',
    refundMethod: 'string',
    processingDays: 'string',
    originalOrderDate: 'string',
  },
  html: `
<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"><title>Refund Processed</title></head>
<body style="${baseStyles.container}">
  <div style="${baseStyles.wrapper}">
    <div style="${baseStyles.header}">
      ${headerImg('refund-processed.png', 'Refund Processed')}
    </div>
    <div style="${baseStyles.content}">
      <p style="font-size:16px;margin-bottom:20px;">Hi {{name}},</p>
      <p style="margin-bottom:20px;">Your refund for order #{{orderNumber}} has been processed.</p>
      <div style="background:#f9fafb;border:1px solid #e2e8f0;border-radius:8px;padding:24px;margin:30px 0;">
        <table style="width:100%;border-collapse:collapse;">
          <tr style="border-bottom:1px solid #e2e8f0;">
            <td style="padding:12px 0;color:#6c757d;">Refund Amount:</td>
            <td style="padding:12px 0;text-align:right;font-weight:600;font-size:20px;color:#16a34a;">{{refundAmount}}</td>
          </tr>
          <tr style="border-bottom:1px solid #e2e8f0;">
            <td style="padding:12px 0;color:#6c757d;">Refund Method:</td>
            <td style="padding:12px 0;text-align:right;font-weight:600;">{{refundMethod}}</td>
          </tr>
          <tr style="border-bottom:1px solid #e2e8f0;">
            <td style="padding:12px 0;color:#6c757d;">Order Date:</td>
            <td style="padding:12px 0;text-align:right;">{{originalOrderDate}}</td>
          </tr>
          <tr>
            <td style="padding:12px 0;color:#6c757d;">Order Number:</td>
            <td style="padding:12px 0;text-align:right;font-weight:600;">#{{orderNumber}}</td>
          </tr>
        </table>
      </div>
      <div style="background:#fef3c7;border-left:4px solid #f59e0b;padding:20px;margin:30px 0;border-radius:6px;">
        <p style="margin:0 0 10px;color:#92400e;font-weight:600;">⏰ Processing Time</p>
        <p style="margin:0;color:#92400e;">Please allow {{processingDays}} for the refund to appear in your account, depending on your financial institution.</p>
      </div>
      <p style="margin-top:30px;">We're sorry things didn't work out this time. We're always working to improve our products and service.</p>
      <hr style="${baseStyles.divider}">
      <h3 style="color:#dc2626;font-size:18px;margin-bottom:15px;">We'd Love Your Feedback</h3>
      <p style="margin-bottom:20px;">If you have a moment, please let us know what went wrong so we can make it right:</p>
      <div style="text-align:center;margin:30px 0;">
        <a href="mailto:mike@josemadridsalsa.com" style="${baseStyles.button}">Share Feedback</a>
      </div>
      <p style="margin-top:30px;">Thank you for giving us a try.</p>
      <p style="margin-top:10px;"><strong>The Jose Madrid Salsa Team</strong></p>
    </div>
    ${jmsFooter}
  </div>
</body>
</html>`,
  text: `Hi {{name}},

Your refund for order #{{orderNumber}} has been processed.

REFUND DETAILS:
Amount: {{refundAmount}}
Method: {{refundMethod}}
Expected in Account: {{processingDays}}

Please allow {{processingDays}} for the refund to appear in your account.

We'd love your feedback on what went wrong. Reply to this email or call 740-349-3144.

Thank you for giving us a try.

The Jose Madrid Salsa Team`,
}
