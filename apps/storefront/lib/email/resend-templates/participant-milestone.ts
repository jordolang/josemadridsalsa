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
          <h1 style="${headingStyle()}">Congratulations on Your Milestone!</h1>
          <p style="${paragraphStyle()}">Hi {{{PARTICIPANT_NAME}}},</p>
          <p style="${paragraphStyle()}">{{{MILESTONE_MESSAGE}}}</p>

          <p style="${paragraphStyle('font-weight:600;')}">Your Impact:</p>
          <p style="${paragraphStyle('margin-bottom:8px;')}">Total Sales: {{{TOTAL_SALES}}}</p>
          <p style="${paragraphStyle()}">Total Raised: {{{TOTAL_RAISED}}}</p>

          <p style="${paragraphStyle('margin-top:16px;')}">Thank you for your dedication to {{{FUNDRAISER_NAME}}}. Every sale brings us closer to our goal!</p>
        </td>
      </tr>
    </table>

    <table cellpadding="0" cellspacing="0" border="0" width="100%">
      <tr>
        <td align="center" style="padding:24px 0;">
          ${button('{{{DASHBOARD_URL}}}', 'View Your Dashboard')}
        </td>
      </tr>
    </table>

    <table cellpadding="0" cellspacing="0" border="0" width="100%">
      <tr>
        <td style="padding:0 0 24px 0;">
          <p style="${paragraphStyle()}">Keep sharing your referral code to continue making an impact!</p>
          <p style="${paragraphStyle()}">Questions? Contact us at {{{SUPPORT_EMAIL}}}.</p>
        </td>
      </tr>
    </table>
  </td>
</tr>

${footer()}`

  return wrapDocument(
    "Congratulations! You've reached {{{MILESTONE}}} sales!",
    bodyRows,
  )
}

export const participantMilestone: ResendTemplateDefinition = {
  name: 'Participant Milestone',
  alias: 'participant-milestone',
  subject: "Congratulations! You've Reached {{{MILESTONE}}} Sales!",
  from: 'Jose Madrid Salsa <mike@josemadridsalsa.com>',
  html: buildHtml(),
  variables: [
    { key: 'PARTICIPANT_NAME', type: 'string' },
    { key: 'FUNDRAISER_NAME', type: 'string' },
    { key: 'MILESTONE', type: 'number' },
    { key: 'MILESTONE_MESSAGE', type: 'string' },
    { key: 'TOTAL_SALES', type: 'number' },
    { key: 'TOTAL_RAISED', type: 'string' },
    { key: 'DASHBOARD_URL', type: 'string' },
    { key: 'SUPPORT_EMAIL', type: 'string', fallbackValue: 'mike@josemadridsalsa.com' },
  ],
}
