/**
 * The re-signup solicitation sent to a past fundraising coordinator.
 *
 * This is marketing mail to people who last dealt with Jose Madrid years ago, so it is built
 * to survive that: it says plainly where the address came from, carries a real physical
 * address and a working one-click unsubscribe, and never claims an ongoing relationship the
 * recipient did not agree to. The personalization is drawn from the archive — the group's
 * name, the years they ran, the jars they moved — because "you sold 1,513 jars in 2023-2024"
 * is the whole reason this mail is worth sending rather than a generic blast.
 */

import { buildUnsubscribeUrl, getEmailBaseUrl } from '@/lib/email/unsubscribe-url'

export interface SolicitationRecipient {
  organizationName: string
  contactName: string | null
  email: string
  totalJars: number
  years: number[]
}

export interface SolicitationContent {
  subject: string
  html: string
  text: string
  headers: Record<string, string>
}

/**
 * Postal address is a CAN-SPAM requirement for commercial email, so it is not optional
 * decoration. Overridable by env for the same reason the base URL is: staging must not
 * advertise itself as the business.
 */
const POSTAL_ADDRESS =
  process.env.BUSINESS_POSTAL_ADDRESS ?? 'Jose Madrid Salsa, Zanesville, OH 43701'

const REPLY_TO = process.env.FUNDRAISING_REPLY_TO ?? 'mike@josemadridsalsa.com'

/** "2022, 2023 and 2025" — spelled out because a bare array reads like a database dump. */
export function formatYears(years: number[]): string {
  const sorted = [...new Set(years)].sort((a, b) => a - b)
  if (sorted.length === 0) return ''
  if (sorted.length === 1) return String(sorted[0])
  return `${sorted.slice(0, -1).join(', ')} and ${sorted[sorted.length - 1]}`
}

/**
 * The one line that makes this mail specific to the recipient.
 *
 * Falls back to silence rather than a guess: a contact recovered from the old mailing list has
 * no jar count, and "you sold 0 jars" would be both wrong and insulting.
 */
export function historyLine(recipient: SolicitationRecipient): string | null {
  const years = formatYears(recipient.years)
  if (recipient.totalJars > 0 && years) {
    return `Our records show ${recipient.organizationName} sold ${recipient.totalJars.toLocaleString()} jars with us in ${years} — thank you for that.`
  }
  if (recipient.totalJars > 0) {
    return `Our records show ${recipient.organizationName} sold ${recipient.totalJars.toLocaleString()} jars with us — thank you for that.`
  }
  if (years) {
    return `Our records show ${recipient.organizationName} ran a salsa fundraiser with us in ${years} — thank you for that.`
  }
  return null
}

function greeting(recipient: SolicitationRecipient): string {
  const name = recipient.contactName?.trim()
  // The archive stores a few coordinator cells as an organization name; "Hi Anderson HS Band"
  // is worse than no name at all, so only use it when it looks like a person.
  const looksLikePerson = !!name && name.split(/\s+/).length <= 3 && !/\b(school|club|band|team|pta|troop|inc)\b/i.test(name)
  return looksLikePerson ? `Hi ${name},` : 'Hello,'
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

/**
 * Builds the full message for one recipient.
 *
 * Returned rather than sent so the admin dialog can preview the exact bytes a given contact
 * will receive — including the personalization — before anything leaves the building.
 */
export function buildSolicitationEmail(recipient: SolicitationRecipient): SolicitationContent {
  const baseUrl = getEmailBaseUrl()
  const signupUrl = `${baseUrl}/fundraise`
  const unsubscribeUrl = buildUnsubscribeUrl(recipient.email)
  const history = historyLine(recipient)

  const subject = `Run another salsa fundraiser with Jose Madrid?`

  const textLines = [
    greeting(recipient),
    '',
    history ?? `You're receiving this because ${recipient.organizationName} has fundraised with Jose Madrid Salsa before.`,
    '',
    'We have rebuilt our fundraising program on a new site. Groups now get their own',
    'page, a shareable link, live sales tracking, and 50% of every jar sold — with no',
    'upfront cost and no order forms to chase.',
    '',
    `Start a new campaign: ${signupUrl}`,
    '',
    `Reply to this email if you would rather we set it up for you, or if you have questions.`,
    '',
    '— Mike, Jose Madrid Salsa',
    '',
    '---',
    `You are receiving this because ${escapeHtml(recipient.organizationName)} previously ran a fundraiser with us.`,
    `Unsubscribe: ${unsubscribeUrl}`,
    POSTAL_ADDRESS,
  ]

  const html = `<!doctype html>
<html>
  <body style="margin:0;padding:0;background:#f7f7f7;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f7f7f7;padding:24px 12px;">
      <tr>
        <td align="center">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#ffffff;border-radius:8px;padding:32px;font-family:Arial,Helvetica,sans-serif;color:#1f2937;">
            <tr><td>
              <p style="margin:0 0 20px;font-size:22px;font-weight:700;color:#dc2626;line-height:1.3;">
                Run another salsa fundraiser?
              </p>
              <p style="margin:0 0 16px;font-size:16px;line-height:1.6;">${escapeHtml(greeting(recipient))}</p>
              ${
                history
                  ? `<p style="margin:0 0 16px;font-size:16px;line-height:1.6;">${escapeHtml(history)}</p>`
                  : `<p style="margin:0 0 16px;font-size:16px;line-height:1.6;">You're receiving this because ${escapeHtml(recipient.organizationName)} has fundraised with Jose Madrid Salsa before.</p>`
              }
              <p style="margin:0 0 16px;font-size:16px;line-height:1.6;">
                We have rebuilt our fundraising program on a new site. Groups now get their own page,
                a shareable link, live sales tracking, and <strong>50% of every jar sold</strong> — with
                no upfront cost and no order forms to chase.
              </p>
              <p style="margin:0 0 28px;text-align:center;">
                <a href="${signupUrl}" style="display:inline-block;background:#dc2626;color:#ffffff;text-decoration:none;padding:14px 28px;border-radius:6px;font-size:16px;font-weight:700;">
                  Start a new campaign
                </a>
              </p>
              <p style="margin:0 0 16px;font-size:16px;line-height:1.6;">
                Reply to this email if you would rather we set it up for you, or if you have questions.
              </p>
              <p style="margin:0 0 8px;font-size:16px;line-height:1.6;">— Mike, Jose Madrid Salsa</p>
            </td></tr>
            <tr><td style="padding-top:24px;border-top:1px solid #e5e7eb;">
              <p style="margin:0 0 8px;font-size:12px;line-height:1.6;color:#6b7280;">
                You are receiving this because ${escapeHtml(recipient.organizationName)} previously ran a fundraiser with Jose Madrid Salsa.
              </p>
              <p style="margin:0 0 8px;font-size:12px;line-height:1.6;color:#6b7280;">
                <a href="${unsubscribeUrl}" style="color:#6b7280;">Unsubscribe from these emails</a>
              </p>
              <p style="margin:0;font-size:12px;line-height:1.6;color:#6b7280;">${escapeHtml(POSTAL_ADDRESS)}</p>
            </td></tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`

  return {
    subject,
    html,
    text: textLines.join('\n'),
    headers: {
      'List-Unsubscribe': `<${unsubscribeUrl}>`,
      'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click',
    },
  }
}

export const SOLICITATION_REPLY_TO = REPLY_TO
