/**
 * Fall Seasonal Email Template
 * Marketing campaign for fall season
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

const seasonalFallTemplate: EmailTemplateDefinition = {
  key: 'seasonal_fall',
  name: 'Fall Seasonal Promotion',
  subject: '🍂 Fall Flavors Have Arrived!',
  category: 'MARKETING',
  description: 'Fall seasonal marketing campaign',
  variables: {
    name: 'string',
    discountCode: 'string',
    expiryDate: 'string',
  },
  html: `
<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"><title>Fall Flavors</title></head>
<body style="${baseStyles.container}">
  <div style="${baseStyles.wrapper}">
    <div style="${baseStyles.header}">
      ${headerImg('fall-season.png', 'Fall Flavors')}
    </div>
    <div style="${baseStyles.content}">
      <p style="font-size:16px;margin-bottom:20px;">Hi {{name}},</p>
      <p style="margin-bottom:20px;">As the leaves change color, it's time to warm up your fall gatherings with bold, hearty flavors from Jose Madrid Salsa!</p>
      <div style="background:linear-gradient(135deg,#fed7aa 0%,#fdba74 100%);padding:30px;border-radius:12px;text-align:center;margin:30px 0;">
        <p style="margin:0 0 10px;color:#7c2d12;font-size:18px;font-weight:700;">🍂 Fall Harvest Special</p>
        <p style="margin:0 0 20px;color:#7c2d12;font-size:36px;font-weight:700;">15% OFF</p>
        <p style="margin:0 0 10px;color:#7c2d12;font-size:14px;">Use code: <strong style="font-size:18px;letter-spacing:2px;">{{discountCode}}</strong></p>
        <p style="margin:0;color:#7c2d12;font-size:12px;">Valid through {{expiryDate}}</p>
      </div>
      <div style="text-align:center;margin:30px 0;">
        <a href="https://www.josemadridsalsa.com/store" style="${baseStyles.button}">Shop Fall Favorites</a>
      </div>
      <hr style="${baseStyles.divider}">
      <h3 style="color:#dc2626;font-size:18px;margin-bottom:15px;">Perfect for Cozy Gatherings:</h3>
      <div style="background:#f8f9fa;padding:25px;border-radius:8px;margin:20px 0;">
        <ul style="padding-left:20px;margin:0;">
          <li style="margin-bottom:15px;"><strong>Smoky Chipotle</strong> - Rich, deep flavor for chili</li>
          <li style="margin-bottom:15px;"><strong>Roasted Red Pepper</strong> - Perfect for warm dips</li>
          <li style="margin-bottom:15px;"><strong>Fire Roasted Medium</strong> - Game day essential</li>
          <li><strong>Ghost Pepper Hot</strong> - For those who like it extra spicy</li>
        </ul>
      </div>
      <div style="background:#fff7ed;border-left:4px solid #ea580c;padding:20px;margin:30px 0;border-radius:6px;">
        <p style="margin:0 0 10px;color:#9a3412;font-weight:600;">🎃 Fall Recipe Idea</p>
        <p style="margin:0;color:#9a3412;">Try our salsas in your fall soups and stews! Add a spoonful to butternut squash soup or pumpkin chili for an authentic kick.</p>
      </div>
      <p style="margin-top:30px;">Don't let the cooler weather cool down your flavor game. Stock up on fall favorites and make every gathering memorable!</p>
      <p style="margin-top:20px;"><strong>The Jose Madrid Salsa Team</strong></p>
    </div>
    ${jmsFooter}
  </div>
</body>
</html>`,
  text: `Hi {{name}},

Fall is here! Warm up your gatherings with 15% off our bold, hearty salsas.

Use code {{discountCode}} - Valid through {{expiryDate}}

Perfect for Cozy Gatherings:
• Smoky Chipotle - Rich, deep flavor for chili
• Roasted Red Pepper - Perfect for warm dips
• Fire Roasted Medium - Game day essential
• Ghost Pepper Hot - For those who like it extra spicy

Fall Recipe Tip: Add a spoonful to butternut squash soup or pumpkin chili!

Shop now: https://www.josemadridsalsa.com/store

The Jose Madrid Salsa Team
740-521-4304

View in browser: {{VIEW_IN_BROWSER_URL}}
Unsubscribe: {{UNSUBSCRIBE_URL}}`,
}

export default seasonalFallTemplate
