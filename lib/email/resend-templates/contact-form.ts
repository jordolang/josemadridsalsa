import {
  wrapDocument,
  header,
  footer,
  colors,
  font,
  headingStyle,
  paragraphStyle,
  sectionHeadingStyle,
  detailRow,
  divider,
  button,
} from './shared'
import type { ResendTemplateDefinition } from './types'

function buildHtml(): string {
  const bodyRows = `
${header('email-header.png', 'Jose Madrid Salsa')}

<tr>
  <td style="padding:0 48px;">
    <!-- Heading -->
    <table cellpadding="0" cellspacing="0" border="0" width="100%">
      <tr>
        <td style="padding:24px 0 0 0;">
          <h1 style="${headingStyle()}">New Contact Form Submission</h1>
          <p style="${paragraphStyle()}">You&rsquo;ve received a new message through the contact form.</p>
        </td>
      </tr>
    </table>

    <!-- Contact details box -->
    <table cellpadding="0" cellspacing="0" border="0" width="100%" style="margin:24px 0;">
      <tr>
        <td style="padding:20px;background-color:${colors.bgMuted};border-radius:8px;">
          <p style="${sectionHeadingStyle()}">Contact Information</p>
          <table cellpadding="0" cellspacing="0" border="0" width="100%">
            ${detailRow('Name:', '{{{CONTACT_NAME}}}')}
            <tr>
              <td width="40%" valign="top" style="padding:0 0 12px 0;">
                <p style="margin:0;font-size:14px;color:${colors.textMuted};${font}line-height:1.5;">Email:</p>
              </td>
              <td width="60%" valign="top" style="padding:0 0 12px 0;">
                <p style="margin:0;font-size:14px;font-weight:600;color:${colors.textDark};${font}line-height:1.5;">
                  <a href="mailto:{{{CONTACT_EMAIL}}}" style="color:${colors.link};text-decoration:none;">{{{CONTACT_EMAIL}}}</a>
                </p>
              </td>
            </tr>
            ${detailRow('Phone:', '{{{CONTACT_PHONE}}}')}
            ${detailRow('Submitted:', '{{{SUBMITTED_AT}}}')}
          </table>
        </td>
      </tr>
    </table>

    ${divider()}

    <!-- Message content -->
    <table cellpadding="0" cellspacing="0" border="0" width="100%">
      <tr>
        <td style="padding:0;">
          <p style="${sectionHeadingStyle()}">Message</p>
          <table cellpadding="0" cellspacing="0" border="0" width="100%">
            <tr>
              <td style="padding:20px;background-color:${colors.bgCard};border:1px solid ${colors.borderLight};border-radius:8px;">
                <p style="margin:0;font-size:15px;color:${colors.textDark};${font}line-height:1.6;white-space:pre-wrap;">{{{CONTACT_MESSAGE}}}</p>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>

    ${divider()}

    <!-- Reply CTA -->
    <table cellpadding="0" cellspacing="0" border="0" width="100%">
      <tr>
        <td align="center" style="padding:24px 0;">
          <p style="${paragraphStyle('text-align:center;')}">Reply to this message by clicking the button below:</p>
          ${button('mailto:{{{CONTACT_EMAIL}}}', 'Reply to {{{CONTACT_NAME}}}')}
        </td>
      </tr>
    </table>
  </td>
</tr>

${footer()}`

  return wrapDocument(
    'New contact form submission from {{{CONTACT_NAME}}}',
    bodyRows,
  )
}

export const contactForm: ResendTemplateDefinition = {
  name: 'Contact Form Notification',
  alias: 'contact-form',
  subject: 'New Contact Form Submission from {{{CONTACT_NAME}}}',
  from: 'Jose Madrid Salsa <mike@josemadrid.net>',
  html: buildHtml(),
  variables: [
    { key: 'CONTACT_NAME', type: 'string' },
    { key: 'CONTACT_EMAIL', type: 'string' },
    { key: 'CONTACT_PHONE', type: 'string', fallbackValue: 'Not provided' },
    { key: 'CONTACT_MESSAGE', type: 'string' },
    { key: 'SUBMITTED_AT', type: 'string', fallbackValue: '' },
  ],
}
