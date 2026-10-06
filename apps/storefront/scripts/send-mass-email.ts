/**
 * Mass email sender — send one raw HTML email to a list of contacts from a CSV.
 *
 * Reuses the app's existing Resend setup and suppression list so a manual blast
 * behaves like the admin campaign path (rate-limited, suppression-aware,
 * List-Unsubscribe headers, {{footer}} URLs populated per recipient).
 *
 * CSV format: a header row with an `email` column (required). An optional
 * `name` column is used for the {{name}} variable. Every other column becomes a
 * {{column_name}} template variable for that recipient.
 *
 *   email,name,city
 *   friend@example.com,Sam,Zanesville
 *
 * Usage:
 *   # Preview (default — NOTHING is sent):
 *   npx tsx scripts/send-mass-email.ts \
 *     --csv ./contacts.csv \
 *     --html ../../email-templates/price-increase-2026.html \
 *     --subject "An Important Update on Our Fundraising Pricing"
 *
 *   # Actually send (add --send):
 *   npx tsx scripts/send-mass-email.ts --csv ./contacts.csv \
 *     --html ../../email-templates/price-increase-2026.html \
 *     --subject "An Important Update on Our Fundraising Pricing" --send
 *
 * Flags:
 *   --csv <path>        (required) CSV file of recipients
 *   --html <path>       (required) HTML email body (template with {{variables}})
 *   --subject <text>    (required) email subject (may contain {{variables}})
 *   --from <text>       override From (default FROM_EMAIL env)
 *   --reply-to <email>  set Reply-To
 *   --send              actually send. Omit for a dry-run preview.
 *   --limit <n>         only process the first n recipients (testing)
 *   --delay <ms>        delay between sends (default 600ms ≈ under Resend's 2/s)
 *   --skip-suppression  do not check the suppression / unsubscribe list (not recommended)
 *
 * Env: RESEND_API_KEY (required to send), FROM_EMAIL, NEXT_PUBLIC_BASE_URL,
 * DATABASE_URL (required unless --skip-suppression). Loaded from .env.local / .env.
 */

import { config as loadEnv } from 'dotenv'
import { readFileSync } from 'fs'
import { resolve } from 'path'
import Papa from 'papaparse'
import { Resend } from 'resend'
import { substituteVariables, isValidEmail } from '@/lib/email/sender'

// Load env the same way the app does (.env.local wins, then .env fills gaps).
loadEnv({ path: resolve(process.cwd(), '.env.local') })
loadEnv()

/* ── Args ───────────────────────────────────────────────── */

function getFlag(name: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`)
  return i !== -1 ? process.argv[i + 1] : undefined
}
function hasFlag(name: string): boolean {
  return process.argv.includes(`--${name}`)
}

const csvPath = getFlag('csv')
const htmlPath = getFlag('html')
const subjectTemplate = getFlag('subject')
const fromOverride = getFlag('from')
const replyTo = getFlag('reply-to')
const send = hasFlag('send')
const skipSuppression = hasFlag('skip-suppression')
const limit = getFlag('limit') ? parseInt(getFlag('limit')!, 10) : undefined
const delayMs = getFlag('delay') ? parseInt(getFlag('delay')!, 10) : 600

if (!csvPath || !htmlPath || !subjectTemplate) {
  console.error('Missing required flags. Need --csv, --html and --subject.')
  console.error('See the header of this file for usage.')
  process.exit(1)
}

const FROM = fromOverride || process.env.FROM_EMAIL || 'Jose Madrid Salsa <mike@josemadridsalsa.com>'
const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL ?? 'https://josemadrid.net'

/* ── Footer variables (mirrors lib/email/transactional.ts footerVars) ── */

function footerVars(email: string) {
  return {
    UNSUBSCRIBE_URL: `${BASE_URL}/unsubscribe?email=${encodeURIComponent(email)}`,
    NEWSLETTER_PREFERENCES_URL: `${BASE_URL}/account/settings`,
    VIEW_IN_BROWSER_URL: '',
    FORWARD_TO_FRIEND_URL: '',
  }
}

const delay = (ms: number) => new Promise((r) => setTimeout(r, ms))

/* ── Main ───────────────────────────────────────────────── */

async function main() {
  const html = readFileSync(resolve(process.cwd(), htmlPath!), 'utf8')
  const csvContent = readFileSync(resolve(process.cwd(), csvPath!), 'utf8')

  const parsed = Papa.parse<Record<string, string>>(csvContent, {
    header: true,
    skipEmptyLines: true,
    transformHeader: (h) => h.trim().toLowerCase(),
  })

  if (!parsed.meta.fields?.includes('email')) {
    console.error('CSV must have an "email" column header.')
    process.exit(1)
  }

  // Build the recipient list, filtering invalid emails up front.
  const invalid: string[] = []
  let rows = parsed.data
    .map((row) => ({ ...row, email: (row.email || '').trim() }))
    .filter((row) => {
      if (isValidEmail(row.email)) return true
      if (row.email) invalid.push(row.email)
      return false
    })

  if (typeof limit === 'number') rows = rows.slice(0, limit)

  console.log(`\nMass email — ${send ? 'SEND' : 'DRY RUN (nothing will be sent)'}`)
  console.log(`  From:       ${FROM}`)
  console.log(`  Subject:    ${subjectTemplate}`)
  console.log(`  HTML:       ${htmlPath} (${html.length.toLocaleString()} bytes)`)
  console.log(`  CSV:        ${csvPath}`)
  console.log(`  Recipients: ${rows.length}${limit ? ` (limited from ${parsed.data.length})` : ''}`)
  if (invalid.length) console.log(`  Skipped ${invalid.length} invalid email(s): ${invalid.slice(0, 5).join(', ')}${invalid.length > 5 ? '…' : ''}`)
  console.log(`  Suppression check: ${skipSuppression ? 'DISABLED' : 'enabled'}\n`)

  if (rows.length === 0) {
    console.log('No valid recipients. Nothing to do.')
    return
  }

  // Suppression check (unsubscribed / bounced / complained).
  const checkSuppression = skipSuppression
    ? async () => false
    : (await import('@/lib/email/suppression')).checkSuppression

  if (!send) {
    const sample = rows[0]
    console.log('Preview of first recipient after variable substitution:')
    console.log(`  → ${sample.email}`)
    console.log(`  Subject: ${substituteVariables(subjectTemplate!, { ...sample, name: sample.name || sample.email.split('@')[0], ...footerVars(sample.email) })}`)
    console.log('\nThis was a DRY RUN. Re-run with --send to dispatch.\n')
    return
  }

  const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null
  if (!resend) {
    console.error('RESEND_API_KEY is not set — cannot send. Aborting.')
    process.exit(1)
  }

  let sent = 0
  let suppressed = 0
  let failed = 0
  const errors: Array<{ email: string; error: string }> = []

  for (const row of rows) {
    const email = row.email

    if (await checkSuppression(email)) {
      suppressed++
      console.log(`  ⊘ suppressed: ${email}`)
      continue
    }

    const variables = {
      ...row,
      name: row.name || email.split('@')[0],
      email,
      ...footerVars(email),
    }

    const unsubscribeUrl = footerVars(email).UNSUBSCRIBE_URL

    try {
      const { data, error } = await resend.emails.send({
        from: FROM,
        to: email,
        subject: substituteVariables(subjectTemplate!, variables),
        html: substituteVariables(html, variables),
        ...(replyTo ? { replyTo } : {}),
        headers: {
          'List-Unsubscribe': `<${unsubscribeUrl}>`,
          'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click',
        },
      })

      if (error) {
        failed++
        errors.push({ email, error: error.message })
        console.log(`  ✗ failed:    ${email} — ${error.message}`)
      } else {
        sent++
        console.log(`  ✓ sent:      ${email} (${data?.id ?? 'no-id'})`)
      }
    } catch (err) {
      failed++
      const msg = err instanceof Error ? err.message : String(err)
      errors.push({ email, error: msg })
      console.log(`  ✗ error:     ${email} — ${msg}`)
    }

    await delay(delayMs)
  }

  console.log(`\nDone. sent=${sent} suppressed=${suppressed} failed=${failed}`)
  if (errors.length) {
    console.log('\nFailures:')
    errors.forEach((e) => console.log(`  ${e.email}: ${e.error}`))
  }
}

main()
  .catch((err) => {
    console.error(err)
    process.exit(1)
  })
  .finally(async () => {
    // Release the Prisma connection opened by the suppression check.
    if (!skipSuppression) {
      const { prisma } = await import('@/lib/prisma')
      await prisma.$disconnect()
    }
  })
