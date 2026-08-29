/**
 * Shared Email Components
 * Reusable HTML components and utilities for email templates
 */

/**
 * Get the base URL for email template images.
 *
 * Email clients cannot resolve relative paths, so every image needs an absolute
 * URL. Set EMAIL_IMAGE_BASE_URL to serve the assets from the Vercel Blob store
 * instead of the storefront's own `public/email-templates` directory.
 */
export function getImageBaseUrl(): string {
  return process.env.EMAIL_IMAGE_BASE_URL || 'https://www.josemadrid.net/email-templates'
}

/**
 * Absolute URL for the José Madrid Salsa logo used in email headers and footers.
 */
export function getLogoUrl(): string {
  return `${getImageBaseUrl()}/Jose-Madrid-Profile.png`
}

/**
 * Create a header image element
 */
export function headerImg(filename: string, alt: string): string {
  return `<img src="${getImageBaseUrl()}/${filename}" alt="${alt}" width="600" style="display:block;width:100%;max-width:600px;height:auto;" />`
}

/**
 * Base inline styles for email templates
 * Using inline styles for maximum email client compatibility
 */
export const baseStyles = {
  container: 'width:100%;background-color:#f4f4f7;padding:40px 0;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,"Helvetica Neue",Arial,sans-serif;',
  wrapper: 'max-width:600px;margin:0 auto;background-color:#ffffff;',
  header: 'padding:0;text-align:center;',
  headerTitle: 'color:#ffffff;font-size:28px;font-weight:700;margin:0;',
  content: 'padding:40px 32px;color:#333333;line-height:1.6;',
  button: 'display:inline-block;padding:14px 32px;background-color:#dc2626;color:#ffffff !important;text-decoration:none;border-radius:6px;font-weight:600;margin:20px 0;',
  footer: 'background-color:#f8f9fa;padding:30px 32px;text-align:center;color:#6c757d;font-size:14px;',
  divider: 'height:1px;background-color:#e2e8f0;margin:30px 0;border:none;',
}

/**
 * José Madrid Salsa branded footer component
 * Includes logo, navigation links, social media icons, and unsubscribe options
 * Uses placeholder URLs that should be replaced with actual values at render time:
 * - {{NEWSLETTER_PREFERENCES_URL}}
 * - {{VIEW_IN_BROWSER_URL}}
 * - {{FORWARD_TO_FRIEND_URL}}
 * - {{UNSUBSCRIBE_URL}}
 */
export const jmsFooter = `
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
              <img src="${getLogoUrl()}" alt="José Madrid Salsa" width="180" height="auto" style="display: block; border: 0; outline: none; max-width: 180px; height: auto;" />
            </a>
          </td>
        </tr>
        <tr>
          <td align="center" style="padding: 4px 0 20px 0; font-family: Georgia, 'Times New Roman', serif; font-size: 13px; line-height: 1.4; color: #8c7a6b; letter-spacing: 0.5px;">
            Handcrafted Gourmet Salsas · Zanesville, Ohio · Est.&nbsp;1988
          </td>
        </tr>
        <tr>
          <td align="center" style="padding: 0 0 20px 0; line-height: 2;">
            <a href="https://www.josemadridsalsa.com" target="_blank" style="display: inline-block; white-space: nowrap; padding: 0 4px; font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; font-size: 10px; font-weight: 700; color: #2d2318; text-decoration: none; text-transform: uppercase; letter-spacing: 0.4px;">Shop</a><span style="color: #d4c8ba; font-size: 10px;">&#124;</span><a href="https://www.josemadridsalsa.com/our-story" target="_blank" style="display: inline-block; white-space: nowrap; padding: 0 4px; font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; font-size: 10px; font-weight: 700; color: #2d2318; text-decoration: none; text-transform: uppercase; letter-spacing: 0.4px;">Our Story</a><span style="color: #d4c8ba; font-size: 10px;">&#124;</span><a href="https://www.josemadridsalsa.com/our-salsas" target="_blank" style="display: inline-block; white-space: nowrap; padding: 0 4px; font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; font-size: 10px; font-weight: 700; color: #2d2318; text-decoration: none; text-transform: uppercase; letter-spacing: 0.4px;">Flavors</a><span style="color: #d4c8ba; font-size: 10px;">&#124;</span><a href="https://josemadridsalsafundraising.com" target="_blank" style="display: inline-block; white-space: nowrap; padding: 0 4px; font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; font-size: 10px; font-weight: 700; color: #2d2318; text-decoration: none; text-transform: uppercase; letter-spacing: 0.4px;">Fundraising</a><span style="color: #d4c8ba; font-size: 10px;">&#124;</span><a href="https://www.josemadridsalsa.com/contact-us" target="_blank" style="display: inline-block; white-space: nowrap; padding: 0 4px; font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; font-size: 10px; font-weight: 700; color: #2d2318; text-decoration: none; text-transform: uppercase; letter-spacing: 0.4px;">Contact</a>
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
                <td align="center" style="padding: 14px 10px; line-height: 2;">
                  <a href="{{NEWSLETTER_PREFERENCES_URL}}" target="_blank" style="display: inline-block; white-space: nowrap; padding: 0 5px; font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; font-size: 10px; color: #6b5d50; text-decoration: underline; letter-spacing: 0.3px;">Manage Preferences</a><span style="color: #c8bfb3; font-size: 10px;">&#8226;</span><a href="{{VIEW_IN_BROWSER_URL}}" target="_blank" style="display: inline-block; white-space: nowrap; padding: 0 5px; font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; font-size: 10px; color: #6b5d50; text-decoration: underline; letter-spacing: 0.3px;">View in Browser</a><span style="color: #c8bfb3; font-size: 10px;">&#8226;</span><a href="{{FORWARD_TO_FRIEND_URL}}" target="_blank" style="display: inline-block; white-space: nowrap; padding: 0 5px; font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; font-size: 10px; color: #6b5d50; text-decoration: underline; letter-spacing: 0.3px;">Forward to a Friend</a>
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
            <a href="{{UNSUBSCRIBE_URL}}" target="_blank" style="display: inline-block; white-space: nowrap; font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; font-size: 11px; font-weight: 700; color: #c8102e; text-decoration: underline; letter-spacing: 0.3px;">Unsubscribe</a>
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
