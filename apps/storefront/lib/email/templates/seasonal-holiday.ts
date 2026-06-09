/**
 * Holiday Seasonal Email Template
 * Marketing campaign for holiday season
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
  headerTitle: 'color:#ffffff;font-size:28px;font-weight:700;margin:0;',
  content: 'padding:40px 32px;color:#333333;line-height:1.6;',
  button: 'display:inline-block;padding:14px 32px;background-color:#dc2626;color:#ffffff !important;text-decoration:none;border-radius:6px;font-weight:600;margin:20px 0;',
  footer: 'background-color:#f8f9fa;padding:30px 32px;text-align:center;color:#6c757d;font-size:14px;',
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

const seasonalHolidayTemplate: EmailTemplateDefinition = {
  key: 'seasonal_holiday',
  name: 'Holiday Seasonal Promotion',
  subject: '🎄 Spread Holiday Cheer with Gourmet Salsa!',
  category: 'MARKETING',
  description: 'Holiday seasonal marketing campaign',
  variables: {
    name: 'string',
    discountCode: 'string',
    expiryDate: 'string',
    freeShippingThreshold: 'string',
  },
  html: `
<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"><title>Holiday Cheer</title></head>
<body style="${baseStyles.container}">
  <div style="${baseStyles.wrapper}">
    <div style="${baseStyles.header}">
      ${headerImg('holiday-season.png', 'Holiday Cheer')}
    </div>
    <div style="${baseStyles.content}">
      <p style="font-size:16px;margin-bottom:20px;">Hi {{name}},</p>
      <p style="margin-bottom:20px;">The holidays are here, and there's no better gift than authentic, handcrafted salsa! Whether you're hosting festive gatherings or searching for the perfect gift, we've got you covered.</p>
      <div style="background:linear-gradient(135deg,#dc2626 0%,#991b1b 100%);padding:30px;border-radius:12px;text-align:center;margin:30px 0;color:#ffffff;">
        <p style="margin:0 0 10px;font-size:18px;font-weight:700;">🎁 Holiday Gift Special</p>
        <p style="margin:0 0 20px;font-size:36px;font-weight:700;">25% OFF</p>
        <p style="margin:0 0 10px;font-size:14px;">Use code: <strong style="font-size:18px;letter-spacing:2px;">{{discountCode}}</strong></p>
        <p style="margin:0 0 20px;font-size:12px;">Plus FREE shipping on orders over {{freeShippingThreshold}}</p>
        <p style="margin:0;font-size:12px;">Valid through {{expiryDate}}</p>
      </div>
      <div style="text-align:center;margin:30px 0;">
        <a href="https://www.josemadridsalsa.com/store" style="${baseStyles.button}background-color:#ffffff;color:#dc2626 !important;">Shop Holiday Gifts</a>
      </div>
      <hr style="${baseStyles.divider}">
      <h3 style="color:#dc2626;font-size:18px;margin-bottom:15px;">Perfect Holiday Picks:</h3>
      <div style="background:#f8f9fa;padding:25px;border-radius:8px;margin:20px 0;">
        <ul style="padding-left:20px;margin:0;">
          <li style="margin-bottom:15px;"><strong>Gift Sets</strong> - Curated variety packs for every taste</li>
          <li style="margin-bottom:15px;"><strong>Premium Collection</strong> - Our finest artisan flavors</li>
          <li style="margin-bottom:15px;"><strong>Party Bundles</strong> - Stock up for holiday entertaining</li>
          <li><strong>Custom Gift Baskets</strong> - Create the perfect personal gift</li>
        </ul>
      </div>
      <div style="background:#ecfdf5;border-left:4px solid #059669;padding:20px;margin:30px 0;border-radius:6px;">
        <p style="margin:0 0 10px;color:#065f46;font-weight:600;">🎅 Holiday Hosting Tip</p>
        <p style="margin:0;color:#065f46;">Create a festive appetizer spread with our salsa varieties, cream cheese, and crackers. Simple, delicious, and crowd-pleasing!</p>
      </div>
      <div style="background:#fef3c7;padding:25px;border-radius:8px;text-align:center;margin:30px 0;">
        <p style="margin:0 0 10px;color:#92400e;font-size:16px;font-weight:600;">🚚 Order by December 18th</p>
        <p style="margin:0;color:#92400e;font-size:14px;">Guaranteed delivery before Christmas!</p>
      </div>
      <p style="margin-top:30px;">Make this holiday season extra special with the gift of authentic, handcrafted flavor. Your friends and family will thank you!</p>
      <p style="margin-top:20px;">Warmest wishes for a wonderful holiday season,</p>
      <p style="margin-top:10px;"><strong>The Jose Madrid Salsa Team</strong></p>
    </div>
    ${jmsFooter}
  </div>
</body>
</html>`,
  text: `Hi {{name}},

The holidays are here! Give the gift of authentic, handcrafted salsa.

Holiday Gift Special: 25% OFF + FREE shipping on orders over {{freeShippingThreshold}}

Use code {{discountCode}} - Valid through {{expiryDate}}

Perfect Holiday Picks:
• Gift Sets - Curated variety packs for every taste
• Premium Collection - Our finest artisan flavors
• Party Bundles - Stock up for holiday entertaining
• Custom Gift Baskets - Create the perfect personal gift

Order by December 18th for guaranteed Christmas delivery!

Holiday Hosting Tip: Create a festive appetizer spread with our salsa varieties, cream cheese, and crackers.

Shop now: https://www.josemadridsalsa.com/store

Warmest wishes for a wonderful holiday season,
The Jose Madrid Salsa Team
740-521-4304

View in browser: {{VIEW_IN_BROWSER_URL}}
Unsubscribe: {{UNSUBSCRIBE_URL}}`,
}

export default seasonalHolidayTemplate
