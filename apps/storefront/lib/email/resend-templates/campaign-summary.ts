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
          <h1 style="${headingStyle()}">{{{CAMPAIGN_NAME}}} Campaign Summary</h1>
          <p style="${paragraphStyle()}">Hi {{{COORDINATOR_NAME}}},</p>
          <p style="${paragraphStyle()}">Here&rsquo;s a summary of your {{{ORGANIZATION_NAME}}} fundraising campaign. Great work!</p>

          <p style="${paragraphStyle('font-weight:600;')}">Campaign Totals:</p>
          <p style="${paragraphStyle('margin-bottom:8px;')}">Total Orders: {{{TOTAL_ORDERS}}}</p>
          <p style="${paragraphStyle('margin-bottom:8px;')}">Total Revenue: {{{TOTAL_REVENUE}}}</p>
          <p style="${paragraphStyle('margin-bottom:8px;')}">Total Raised: {{{TOTAL_RAISED}}}</p>
          <p style="${paragraphStyle()}">Active Participants: {{{PARTICIPANT_COUNT}}}</p>

          <!-- Top participants (pre-rendered) -->
          {{{TOP_PARTICIPANTS_HTML}}}

          <p style="${paragraphStyle()}">Thank you for your leadership and commitment to this fundraising campaign!</p>
        </td>
      </tr>
    </table>

    <table cellpadding="0" cellspacing="0" border="0" width="100%">
      <tr>
        <td align="center" style="padding:24px 0;">
          ${button('{{{CAMPAIGN_URL}}}', 'View Full Campaign Report')}
        </td>
      </tr>
    </table>

    <table cellpadding="0" cellspacing="0" border="0" width="100%">
      <tr>
        <td style="padding:0 0 24px 0;">
          <p style="${paragraphStyle()}">Access your campaign dashboard for detailed analytics, participant management, and more.</p>
          <p style="${paragraphStyle()}">Questions? Contact us at {{{SUPPORT_EMAIL}}}.</p>
        </td>
      </tr>
    </table>
  </td>
</tr>

${footer()}`

  return wrapDocument(
    '{{{CAMPAIGN_NAME}}} Campaign Summary - {{{TOTAL_RAISED}}} raised!',
    bodyRows,
  )
}

export const campaignSummary: ResendTemplateDefinition = {
  name: 'Campaign Summary',
  alias: 'campaign-summary',
  subject: '{{{CAMPAIGN_NAME}}} Campaign Summary - {{{TOTAL_RAISED}}} Raised!',
  from: 'Jose Madrid Salsa <mike@josemadridsalsa.com>',
  html: buildHtml(),
  variables: [
    { key: 'COORDINATOR_NAME', type: 'string' },
    { key: 'CAMPAIGN_NAME', type: 'string' },
    { key: 'ORGANIZATION_NAME', type: 'string' },
    { key: 'TOTAL_ORDERS', type: 'number' },
    { key: 'TOTAL_REVENUE', type: 'string' },
    { key: 'TOTAL_RAISED', type: 'string' },
    { key: 'PARTICIPANT_COUNT', type: 'number' },
    { key: 'TOP_PARTICIPANTS_HTML', type: 'string', fallbackValue: '' },
    { key: 'CAMPAIGN_URL', type: 'string' },
    { key: 'SUPPORT_EMAIL', type: 'string', fallbackValue: 'mike@josemadridsalsa.com' },
  ],
}
