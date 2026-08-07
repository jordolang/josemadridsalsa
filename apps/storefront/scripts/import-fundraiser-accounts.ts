/**
 * Promote archived fundraiser campaigns to fundraiser accounts.
 *
 * Reads `ArchivedFundraiser` — one row per source spreadsheet — resolves the
 * distinct organizations behind those rows (`lib/archive/fundraiser-accounts.ts`)
 * and upserts the ones carrying a contact address into `Customer` with
 * `accountType: FUNDRAISING`.
 *
 * Dry run by default; prints its target database before writing.
 *
 *   tsx scripts/import-fundraiser-accounts.ts
 *   tsx scripts/import-fundraiser-accounts.ts --commit
 *
 * `Customer.email` is required and unique, so organizations whose campaigns
 * never recorded an address cannot become customer records. They are counted
 * and written to the review CSV so the gap is visible rather than silent; they
 * remain queryable in `ArchivedFundraiser`.
 *
 * Upserts fill blanks rather than overwrite, so re-running enriches an existing
 * customer instead of erasing hand-edited values. The organization name is
 * stored in `sourceName`, which is what the admin customer list searches as
 * "organization".
 */

import fs from 'node:fs'
import path from 'node:path'
import { PrismaClient } from '@prisma/client'
import {
  buildFundraiserAccounts,
  isLikelyOrganizationName,
  type FundraiserAccount,
} from '../lib/archive/fundraiser-accounts'

const prisma = new PrismaClient()

interface Args {
  commit: boolean
  out: string
}

function parseArgs(argv: string[]): Args {
  const out: Args = { commit: false, out: '' }
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--commit') out.commit = true
    else if (argv[i] === '--out') out.out = argv[++i]
  }
  return out
}

/** Show which database is about to be written, host and name only. */
function describeTarget(): string {
  const raw = process.env.DATABASE_URL
  if (!raw) return 'DATABASE_URL is not set'
  try {
    const url = new URL(raw)
    return `${url.host}${url.pathname}`
  } catch {
    return 'unparseable DATABASE_URL'
  }
}

function csvCell(v: unknown): string {
  if (v === null || v === undefined) return ''
  const s = String(v)
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
}

function writeReviewCsv(file: string, accounts: FundraiserAccount[]): void {
  const header = [
    'organizationName',
    'email',
    'importable',
    'firstName',
    'lastName',
    'years',
    'campaignCount',
    'sourceFiles',
  ]
  const lines = [header.join(',')]
  for (const a of accounts) {
    lines.push(
      [
        a.organizationName,
        a.email ?? '',
        a.email ? 'yes' : 'no (no contact address)',
        a.firstName ?? '',
        a.lastName ?? '',
        a.years.join(' '),
        a.campaignCount,
        a.sourceFiles.join(' | '),
      ]
        .map(csvCell)
        .join(',')
    )
  }
  fs.mkdirSync(path.dirname(file), { recursive: true })
  fs.writeFileSync(file, lines.join('\n') + '\n', 'utf8')
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2))

  const rows = await prisma.archivedFundraiser.findMany({
    select: {
      organizationName: true,
      contactEmail: true,
      submittedBy: true,
      year: true,
      orderDate: true,
      sourceFile: true,
    },
  })
  console.log(`${rows.length} archived campaign rows`)

  const accounts = buildFundraiserAccounts(rows)
  const importable = accounts.filter((a) => a.email)
  const unaddressed = accounts.filter((a) => !a.email)

  const artifacts = rows.filter((r) => !isLikelyOrganizationName(r.organizationName))

  console.log(`\n${accounts.length} distinct fundraiser organizations`)
  console.log(`  with a contact address (importable): ${importable.length}`)
  console.log(`  without one (cannot become Customer): ${unaddressed.length}`)
  console.log(
    `  campaign rows dropped as filing artifacts: ${artifacts.length}` +
      (artifacts.length
        ? ` (e.g. ${[...new Set(artifacts.map((r) => r.organizationName))]
            .slice(0, 3)
            .join(', ')})`
        : '')
  )

  const reviewCsv = args.out || path.join(process.cwd(), 'fundraiser-accounts.review.csv')
  writeReviewCsv(reviewCsv, accounts)
  console.log(`\nreview file -> ${reviewCsv}`)

  if (!args.commit) {
    console.log('\ndry run — nothing written. re-run with --commit to upsert.')
    return
  }

  console.log(`\ntarget database: ${describeTarget()}`)

  const batchId = `fundraiser_accounts_${new Date()
    .toISOString()
    .slice(0, 10)
    .replace(/-/g, '')}`
  const now = new Date()

  const existing = await prisma.customer.findMany({
    where: { email: { in: importable.map((a) => a.email as string) } },
    select: { email: true, sourceName: true },
  })
  const existingByEmail = new Map(
    existing.map((c) => [c.email.toLowerCase(), c])
  )

  let created = 0
  let filled = 0
  let leftAlone = 0

  for (const account of importable) {
    const email = account.email as string
    const notes = `Fundraiser organization "${account.organizationName}"; ${
      account.campaignCount
    } archived campaign(s)${
      account.years.length ? ` (${account.years.join(', ')})` : ''
    }.`

    const stored = existingByEmail.get(email)

    // A stored organization is the curated value — a hand edit, or a richer
    // name from an earlier import ("American Heritage Girls Troop OH0148" vs
    // the archive's "AHG OH0148"). Only fill it when it is blank.
    const hasStoredOrg = Boolean(stored?.sourceName?.trim())
    if (stored && hasStoredOrg) {
      leftAlone++
      continue
    }

    await prisma.customer.upsert({
      where: { email },
      create: {
        email,
        firstName: account.firstName,
        lastName: account.lastName,
        accountType: 'FUNDRAISING',
        source: 'IMPORT',
        sourceName: account.organizationName,
        notes,
        importSource: 'document-archive-fundraisers',
        importBatchId: batchId,
        importedAt: now,
      },
      update: {
        // Fill blanks only; never clobber a stored value.
        firstName: account.firstName ?? undefined,
        lastName: account.lastName ?? undefined,
        // Designation is authoritative from the archive.
        accountType: 'FUNDRAISING',
        sourceName: account.organizationName,
        importSource: 'document-archive-fundraisers',
        importBatchId: batchId,
        importedAt: now,
      },
    })

    if (stored) filled++
    else created++
  }

  console.log(`\n${importable.length} addressed fundraiser organizations`)
  console.log(`  created new customers        : ${created}`)
  console.log(`  filled a blank organization  : ${filled}`)
  console.log(`  left an existing name intact : ${leftAlone}`)
  console.log(
    `  skipped (no contact address) : ${unaddressed.length} organizations`
  )
}

main()
  .catch((error) => {
    console.error('import-fundraiser-accounts failed:', error)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
