/**
 * Sync email templates to Resend.
 *
 * Sources:
 *   1. Code-defined templates in lib/email/resend-templates/
 *   2. Active EmailTemplate rows from the database (legacy)
 *
 * For each template the script:
 *   - Skips if a template with the same name already exists in Resend
 *   - Creates the template with its alias, subject, variables, and HTML
 *   - Publishes the template so it is immediately usable
 *
 * Requires a **full-access** Resend API key (not sending-only).
 *
 * Usage:
 *   npx tsx scripts/sync-templates-to-resend.ts
 *   npx tsx scripts/sync-templates-to-resend.ts --code-only   # skip DB templates
 *   npx tsx scripts/sync-templates-to-resend.ts --db-only     # skip code templates
 */

import { Resend } from 'resend'
import { PrismaClient } from '@prisma/client'
import { allTemplates } from '../lib/email/resend-templates'
import type { ResendTemplateVariable } from '../lib/email/resend-templates'

/* ── Config ─────────────────────────────────────────────── */

const RESEND_API_KEY = process.env.RESEND_API_KEY
if (!RESEND_API_KEY) {
  console.error('RESEND_API_KEY environment variable is required')
  process.exit(1)
}

const resend = new Resend(RESEND_API_KEY)
const prisma = new PrismaClient()

const args = process.argv.slice(2)
const codeOnly = args.includes('--code-only')
const dbOnly = args.includes('--db-only')

/* ── Reserved variable names in Resend ──────────────────── */

const RESERVED_NAMES = new Set([
  'FIRST_NAME',
  'LAST_NAME',
  'EMAIL',
  'UNSUBSCRIBE_URL',
  'RESEND_UNSUBSCRIBE_URL',
  'contact',
  'this',
])

/* ── Helpers ────────────────────────────────────────────── */

/** Convert a camelCase DB key to UPPER_SNAKE_CASE, avoiding reserved names. */
function toResendKey(dbKey: string): string {
  const upper = dbKey.replace(/([a-z])([A-Z])/g, '$1_$2').toUpperCase()
  return RESERVED_NAMES.has(upper) ? `USER_${upper}` : upper
}

/** Replace {{var}} with {{{VAR}}} for Resend. */
function convertVariableSyntax(
  template: string,
  keyMap: Map<string, string>,
): string {
  let result = template
  for (const [dbKey, resendKey] of keyMap) {
    const pattern = new RegExp(`\\{\\{\\s*${dbKey}\\s*\\}\\}`, 'g')
    result = result.replace(pattern, `{{{${resendKey}}}}`)
  }
  return result
}

/** List all existing Resend templates keyed by name. */
async function getExistingTemplates(): Promise<Map<string, string>> {
  const map = new Map<string, string>()
  try {
    const { data } = await resend.templates.list()
    if (data?.data) {
      for (const t of data.data) {
        if (t.name) map.set(t.name, t.id)
      }
    }
  } catch {
    // If listing fails, proceed without dedup
  }
  return map
}

/** Respect the Resend rate limit (2 req/s). */
const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

/* ── Create + Publish a single template ─────────────────── */

interface SyncResult {
  created: number
  skipped: number
  failed: number
}

async function createAndPublish(
  name: string,
  alias: string,
  subject: string,
  from: string,
  html: string,
  text: string | undefined,
  variables: ResendTemplateVariable[],
  existingTemplates: Map<string, string>,
  counters: SyncResult,
): Promise<void> {
  if (existingTemplates.has(name)) {
    console.log(`  SKIP  ${alias} ("${name}") - already exists in Resend`)
    counters.skipped++
    return
  }

  console.log(`Creating: ${alias} ("${name}")...`)

  // Filter out reserved variable names from the definitions
  const safeVars = variables.filter((v) => !RESERVED_NAMES.has(v.key))

  const { data: createData, error: createError } =
    await resend.templates.create({
      name,
      alias,
      subject,
      from,
      html,
      ...(text ? { text } : {}),
      ...(safeVars.length > 0 ? { variables: safeVars } : {}),
    })

  if (createError) {
    console.error(`  FAIL  ${alias}: ${createError.message}`)
    counters.failed++
    await delay(1200)
    return
  }

  const templateId = createData!.id

  const { error: publishError } = await resend.templates.publish(templateId)

  if (publishError) {
    console.error(
      `  WARN  ${alias}: created but publish failed: ${publishError.message}`,
    )
  } else {
    console.log(`  OK    ${alias} -> ${templateId} (published)`)
  }

  counters.created++
  await delay(1200)
}

/* ── Sync code-defined templates ────────────────────────── */

async function syncCodeTemplates(
  existingTemplates: Map<string, string>,
): Promise<SyncResult> {
  console.log(`\n--- Code-defined templates (${allTemplates.length}) ---\n`)

  const counters: SyncResult = { created: 0, skipped: 0, failed: 0 }

  for (const tpl of allTemplates) {
    await createAndPublish(
      tpl.name,
      tpl.alias,
      tpl.subject,
      tpl.from,
      tpl.html,
      tpl.text,
      tpl.variables,
      existingTemplates,
      counters,
    )
  }

  return counters
}

/* ── Sync database templates (legacy) ───────────────────── */

async function syncDbTemplates(
  existingTemplates: Map<string, string>,
): Promise<SyncResult> {
  const dbTemplates = await prisma.emailTemplate.findMany({
    where: { isActive: true },
    select: {
      id: true,
      key: true,
      name: true,
      subject: true,
      html: true,
      text: true,
      variables: true,
    },
  })

  console.log(`\n--- Database templates (${dbTemplates.length}) ---\n`)

  const counters: SyncResult = { created: 0, skipped: 0, failed: 0 }

  for (const tpl of dbTemplates) {
    const dbVars = (tpl.variables as Record<string, string>) ?? {}
    const dbKeys = Object.keys(dbVars)

    const keyMap = new Map<string, string>()
    for (const k of dbKeys) {
      keyMap.set(k, toResendKey(k))
    }

    const html = convertVariableSyntax(tpl.html, keyMap)
    const text = tpl.text ? convertVariableSyntax(tpl.text, keyMap) : undefined
    const subject = convertVariableSyntax(tpl.subject, keyMap)

    const variables: ResendTemplateVariable[] = Array.from(keyMap.values())
      .filter((k) => !RESERVED_NAMES.has(k))
      .map((key) => ({ key, type: 'string' as const, fallbackValue: '' }))

    await createAndPublish(
      tpl.name,
      tpl.key,
      subject,
      process.env.FROM_EMAIL || 'Jose Madrid Salsa <mike@josemadrid.net>',
      html,
      text,
      variables,
      existingTemplates,
      counters,
    )
  }

  return counters
}

/* ── Main ───────────────────────────────────────────────── */

async function main() {
  console.log('Fetching existing Resend templates...')
  const existingTemplates = await getExistingTemplates()
  console.log(`Found ${existingTemplates.size} existing templates in Resend`)

  let codeResult: SyncResult = { created: 0, skipped: 0, failed: 0 }
  let dbResult: SyncResult = { created: 0, skipped: 0, failed: 0 }

  if (!dbOnly) {
    codeResult = await syncCodeTemplates(existingTemplates)
  }

  if (!codeOnly) {
    dbResult = await syncDbTemplates(existingTemplates)
  }

  const total = {
    created: codeResult.created + dbResult.created,
    skipped: codeResult.skipped + dbResult.skipped,
    failed: codeResult.failed + dbResult.failed,
  }

  console.log(
    `\nDone! Created: ${total.created}, Skipped: ${total.skipped}, Failed: ${total.failed}`,
  )

  await prisma.$disconnect()
}

main().catch((err) => {
  console.error('Fatal error:', err)
  prisma.$disconnect()
  process.exit(1)
})
