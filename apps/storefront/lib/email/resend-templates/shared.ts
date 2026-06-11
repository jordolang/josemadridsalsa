/**
 * Shared HTML building blocks for Resend email templates.
 *
 * All output is table-based with inline styles for maximum
 * email-client compatibility (Outlook, Gmail, Apple Mail, etc.).
 */

const IMAGE_BASE_URL = 'https://www.josemadridsalsa.com/email-templates'
const LOGO_URL = 'https://josemadrid.net/images/logo.png'

/* ── Colour palette ─────────────────────────────────────── */

export const colors = {
  primary: '#dc2626',
  textDark: '#1f2937',
  textMuted: '#64748b',
  textLight: '#94a3b8',
  bgBody: '#f6f9fc',
  bgCard: '#ffffff',
  bgMuted: '#f8fafc',
  bgGreen: '#f0fdf4',
  bgRedLight: '#fef2f2',
  borderLight: '#e2e8f0',
  greenBorder: '#22c55e',
  link: '#3b82f6',
  btnSecondary: '#475569',
} as const

/* ── Reusable inline-style snippets ─────────────────────── */

export const font = "font-family:Arial,Helvetica,sans-serif;"

export function headingStyle(extra = ''): string {
  return `margin:0 0 24px 0;font-size:24px;font-weight:700;color:${colors.primary};${font}line-height:1.3;${extra}`
}

export function paragraphStyle(extra = ''): string {
  return `margin:0 0 16px 0;font-size:16px;color:${colors.textDark};${font}line-height:1.6;${extra}`
}

export function sectionHeadingStyle(extra = ''): string {
  return `margin:0 0 16px 0;font-size:18px;font-weight:600;color:${colors.textDark};${font}line-height:1.4;${extra}`
}

export function labelStyle(): string {
  return `margin:0;font-size:14px;color:${colors.textMuted};${font}line-height:1.5;`
}

export function valueStyle(): string {
  return `margin:0;font-size:14px;font-weight:600;color:${colors.textDark};${font}line-height:1.5;`
}

/* ── Button builder ─────────────────────────────────────── */

type ButtonVariant = 'primary' | 'secondary'

export function button(
  href: string,
  label: string,
  variant: ButtonVariant = 'primary',
): string {
  const bg = variant === 'primary' ? colors.primary : colors.btnSecondary
  return `
<table cellpadding="0" cellspacing="0" border="0" style="margin:0 auto;">
  <tr>
    <td align="center" bgcolor="${bg}" style="background-color:${bg};border-radius:6px;">
      <!--[if mso]>
      <v:roundrect xmlns:v="urn:schemas-microsoft-com:vml" xmlns:w="urn:schemas-microsoft-com:office:word" href="${href}" style="height:48px;v-text-anchor:middle;width:220px;" arcsize="13%" fillcolor="${bg}" stroke="f">
        <w:anchorlock/>
        <center style="color:#ffffff;${font}font-size:16px;font-weight:600;">${label}</center>
      </v:roundrect>
      <![endif]-->
      <!--[if !mso]><!-->
      <a href="${href}" target="_blank" style="display:inline-block;padding:14px 32px;background-color:${bg};color:#ffffff;text-decoration:none;border-radius:6px;font-size:16px;font-weight:600;${font}text-align:center;mso-hide:all;">${label}</a>
      <!--<![endif]-->
    </td>
  </tr>
</table>`
}

/* ── Detail row (label : value) ─────────────────────────── */

export function detailRow(label: string, value: string): string {
  return `
<tr>
  <td width="40%" valign="top" style="padding:0 0 12px 0;">
    <p style="${labelStyle()}">${label}</p>
  </td>
  <td width="60%" valign="top" style="padding:0 0 12px 0;">
    <p style="${valueStyle()}">${value}</p>
  </td>
</tr>`
}

/* ── Divider ────────────────────────────────────────────── */

export function divider(): string {
  return `
<tr>
  <td style="padding:24px 0;">
    <table cellpadding="0" cellspacing="0" border="0" width="100%">
      <tr><td style="border-top:1px solid ${colors.borderLight};font-size:1px;line-height:1px;">&nbsp;</td></tr>
    </table>
  </td>
</tr>`
}

/* ── Header ─────────────────────────────────────────────── */

export function header(headerImage?: string, headerAlt = 'Jose Madrid Salsa'): string {
  if (headerImage) {
    return `
<tr>
  <td align="center" style="padding:0;margin:0;">
    <img src="${IMAGE_BASE_URL}/${headerImage}" alt="${headerAlt}" width="600" height="auto" border="0" style="display:block;width:100%;max-width:600px;height:auto;margin:0;padding:0;border:0;outline:none;" />
  </td>
</tr>`
  }

  return `
<tr>
  <td align="center" style="padding:40px 20px 0 20px;background-color:${colors.bgCard};">
    <img src="${LOGO_URL}" alt="Jose Madrid Salsa" width="180" height="auto" border="0" style="display:block;margin:0 auto;height:auto;" />
    <p style="margin:16px 0 0 0;font-size:14px;color:${colors.textMuted};${font}text-align:center;">Authentic homemade salsa delivered to your door</p>
  </td>
</tr>
<tr>
  <td style="padding:0;">
    <table cellpadding="0" cellspacing="0" border="0" width="100%">
      <tr><td style="border-top:1px solid ${colors.borderLight};font-size:1px;line-height:1px;">&nbsp;</td></tr>
    </table>
  </td>
</tr>`
}

/* ── Footer ─────────────────────────────────────────────── */

export function footer(): string {
  return `
<tr>
  <td style="padding:0;">
    <table cellpadding="0" cellspacing="0" border="0" width="100%">
      <tr><td style="border-top:1px solid ${colors.borderLight};font-size:1px;line-height:1px;">&nbsp;</td></tr>
    </table>
  </td>
</tr>
<tr>
  <td style="padding:32px 20px;background-color:${colors.bgMuted};text-align:center;">
    <p style="margin:8px 0;font-size:14px;color:${colors.textMuted};${font}line-height:1.5;text-align:center;">Jose Madrid Salsa</p>
    <p style="margin:8px 0;font-size:14px;color:${colors.textMuted};${font}line-height:1.5;text-align:center;">123 Main Street, Austin, TX 78701</p>
    <p style="margin:8px 0;font-size:14px;color:${colors.textMuted};${font}line-height:1.5;text-align:center;">
      Questions? Email us at <a href="mailto:mike@josemadridsalsa.com" style="color:${colors.link};text-decoration:none;">mike@josemadridsalsa.com</a>
    </p>
    <p style="margin:16px 0 8px 0;font-size:12px;color:${colors.textLight};${font}line-height:1.5;text-align:center;">
      <a href="{{{RESEND_UNSUBSCRIBE_URL}}}" style="color:${colors.link};text-decoration:none;">Unsubscribe</a>
      &middot;
      <a href="https://josemadrid.net/privacy" style="color:${colors.link};text-decoration:none;">Privacy Policy</a>
      &middot;
      <a href="https://josemadrid.net/terms" style="color:${colors.link};text-decoration:none;">Terms of Service</a>
    </p>
    <p style="margin:16px 0 0 0;font-size:12px;color:${colors.textLight};${font}text-align:center;">
      &copy; ${new Date().getFullYear()} Jose Madrid Salsa. All rights reserved.
    </p>
  </td>
</tr>`
}

/* ── Full document wrapper ──────────────────────────────── */

export function wrapDocument(previewText: string, bodyRows: string): string {
  return `<!DOCTYPE html>
<html lang="en" xmlns="http://www.w3.org/1999/xhtml" xmlns:v="urn:schemas-microsoft-com:vml" xmlns:o="urn:schemas-microsoft-com:office:office">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <meta http-equiv="X-UA-Compatible" content="IE=edge" />
  <title>Jose Madrid Salsa</title>
  <!--[if mso]>
  <noscript>
    <xml>
      <o:OfficeDocumentSettings>
        <o:PixelsPerInch>96</o:PixelsPerInch>
      </o:OfficeDocumentSettings>
    </xml>
  </noscript>
  <![endif]-->
</head>
<body style="margin:0;padding:0;background-color:${colors.bgBody};${font}">
  <!-- Preview text (hidden) -->
  <div style="display:none;font-size:1px;color:${colors.bgBody};line-height:1px;max-height:0;max-width:0;opacity:0;overflow:hidden;">
    ${previewText}
  </div>

  <!-- Outer wrapper -->
  <table cellpadding="0" cellspacing="0" border="0" width="100%" style="background-color:${colors.bgBody};">
    <tr>
      <td align="center" style="padding:0;">
        <!-- Inner container (600px) -->
        <table cellpadding="0" cellspacing="0" border="0" width="600" style="max-width:600px;background-color:${colors.bgCard};margin:0 auto;overflow:hidden;">
${bodyRows}
        </table>
        <!-- /Inner container -->
      </td>
    </tr>
  </table>
  <!-- /Outer wrapper -->
</body>
</html>`
}

/* ── Support blurb ──────────────────────────────────────── */

export function supportBlurb(email = 'mike@josemadridsalsa.com'): string {
  return `
<tr>
  <td style="padding:24px 48px 0 48px;">
    <p style="margin:0;font-size:14px;color:${colors.textMuted};${font}line-height:1.6;text-align:center;">
      Questions? We&rsquo;re here to help! Reply to this email or contact us at
      <a href="mailto:${email}" style="color:${colors.link};text-decoration:none;">${email}</a>
    </p>
  </td>
</tr>`
}
