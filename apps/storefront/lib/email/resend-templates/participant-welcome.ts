import {
  wrapDocument,
  header,
  footer,
  colors,
  font,
  headingStyle,
  paragraphStyle,
  button,
} from './shared'
import type { ResendTemplateDefinition } from './types'

function buildHtml(): string {
  const bodyRows = `
${header()}

<tr>
  <td style="padding:0 48px;">
    <table cellpadding="0" cellspacing="0" border="0" width="100%">
      <tr>
        <td style="padding:24px 0 0 0;">
          <h1 style="${headingStyle()}">Welcome to {{{FUNDRAISER_NAME}}}!</h1>
          <p style="${paragraphStyle()}">Hi {{{PARTICIPANT_NAME}}},</p>
          <p style="${paragraphStyle()}">You&rsquo;ve been added as a participant to the {{{FUNDRAISER_NAME}}} fundraiser! We&rsquo;re excited to have you on board.</p>

          <p style="${paragraphStyle('font-weight:600;')}">Your Referral Code:</p>
          <p style="margin:0 0 16px 0;font-size:20px;font-weight:700;color:${colors.primary};font-family:monospace;line-height:1.6;letter-spacing:2px;">{{{REFERRAL_CODE}}}</p>

          <p style="${paragraphStyle()}">Share your unique referral code with friends and family. Every order placed using your code helps support the fundraiser!</p>
        </td>
      </tr>
    </table>

    <table cellpadding="0" cellspacing="0" border="0" width="100%">
      <tr>
        <td align="center" style="padding:24px 0;">
          ${button('{{{FUNDRAISER_URL}}}', 'View Fundraiser Details')}
        </td>
      </tr>
    </table>

    <table cellpadding="0" cellspacing="0" border="0" width="100%">
      <tr>
        <td style="padding:0 0 24px 0;">
          <p style="${paragraphStyle('font-weight:600;')}">How It Works:</p>
          <p style="${paragraphStyle('margin-bottom:8px;')}">1. Share your referral code with supporters</p>
          <p style="${paragraphStyle('margin-bottom:8px;')}">2. They use your code when making a purchase</p>
          <p style="${paragraphStyle()}">3. Track your impact and help reach the fundraising goal</p>

          <p style="${paragraphStyle('margin-top:16px;')}">Questions? Contact us at {{{SUPPORT_EMAIL}}}.</p>
        </td>
      </tr>
    </table>
  </td>
</tr>

${footer()}`

  return wrapDocument(
    'Welcome to the {{{FUNDRAISER_NAME}}} fundraiser!',
    bodyRows,
  )
}

export const participantWelcome: ResendTemplateDefinition = {
  name: 'Participant Welcome',
  alias: 'participant-welcome',
  subject: 'Welcome to the {{{FUNDRAISER_NAME}}} Fundraiser!',
  from: 'Jose Madrid Salsa <mike@josemadridsalsa.com>',
  html: buildHtml(),
  variables: [
    { key: 'PARTICIPANT_NAME', type: 'string' },
    { key: 'FUNDRAISER_NAME', type: 'string' },
    { key: 'REFERRAL_CODE', type: 'string' },
    { key: 'FUNDRAISER_URL', type: 'string' },
    { key: 'SUPPORT_EMAIL', type: 'string', fallbackValue: 'mike@josemadridsalsa.com' },
  ],
}
