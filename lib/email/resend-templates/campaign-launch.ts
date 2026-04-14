import {
  wrapDocument,
  header,
  footer,
  colors,
  font,
  headingStyle,
  paragraphStyle,
  button,
  supportBlurb,
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
          <h1 style="${headingStyle()}">Your {{{CAMPAIGN_NAME}}} fundraiser is ready!</h1>
          <p style="${paragraphStyle()}">Hi {{{COORDINATOR_NAME}}},</p>
          <p style="${paragraphStyle()}">Great news! Your fundraising campaign for {{{ORGANIZATION_NAME}}} is now live and ready to share with participants.</p>

          <p style="${paragraphStyle('font-weight:600;')}">Campaign Details:</p>
          <p style="${paragraphStyle('margin-bottom:8px;')}">Campaign: {{{CAMPAIGN_NAME}}}</p>
          <p style="${paragraphStyle('margin-bottom:8px;')}">Duration: {{{START_DATE}}} - {{{END_DATE}}}</p>
          <p style="${paragraphStyle()}">{{{GOAL_AMOUNT_LINE}}}</p>

          <p style="${paragraphStyle()}">Access your campaign dashboard to add participants, track progress, and share referral links.</p>
        </td>
      </tr>
    </table>

    <table cellpadding="0" cellspacing="0" border="0" width="100%">
      <tr>
        <td align="center" style="padding:24px 0;">
          ${button('{{{CAMPAIGN_URL}}}', 'View Campaign Dashboard')}
        </td>
      </tr>
    </table>

    <table cellpadding="0" cellspacing="0" border="0" width="100%">
      <tr>
        <td style="padding:0 0 24px 0;">
          <p style="${paragraphStyle()}">Need help getting started? Our fundraising team is here to support you every step of the way.</p>
          <p style="${paragraphStyle()}">Questions? Contact us at {{{SUPPORT_EMAIL}}}.</p>
        </td>
      </tr>
    </table>
  </td>
</tr>

${footer()}`

  return wrapDocument(
    'Your {{{CAMPAIGN_NAME}}} fundraiser is ready to launch!',
    bodyRows,
  )
}

export const campaignLaunch: ResendTemplateDefinition = {
  name: 'Campaign Launch',
  alias: 'campaign-launch',
  subject: 'Your {{{CAMPAIGN_NAME}}} Fundraiser is Ready!',
  from: 'Jose Madrid Salsa <mike@josemadrid.net>',
  html: buildHtml(),
  variables: [
    { key: 'COORDINATOR_NAME', type: 'string' },
    { key: 'CAMPAIGN_NAME', type: 'string' },
    { key: 'ORGANIZATION_NAME', type: 'string' },
    { key: 'CAMPAIGN_URL', type: 'string' },
    { key: 'START_DATE', type: 'string' },
    { key: 'END_DATE', type: 'string' },
    { key: 'GOAL_AMOUNT_LINE', type: 'string', fallbackValue: '' },
    { key: 'SUPPORT_EMAIL', type: 'string', fallbackValue: 'fundraising@josemadridsalsa.com' },
  ],
}
