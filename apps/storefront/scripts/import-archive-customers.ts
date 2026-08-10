/**
 * Stage 2 of the document-archive customer import.
 *
 * Reads the raw contact records produced by
 * `scripts/extract-archive-customers.py`, merges them into one customer per
 * email (`lib/customers/archive-merge.ts`), writes a reviewable summary, and —
 * only with `--commit` — upserts them into `Customer`.
 *
 * Dry run by default. Nothing is written until the summary looks right.
 *
 *   tsx scripts/import-archive-customers.ts --in ../../data/customer-extract
 *   tsx scripts/import-archive-customers.ts --in ../../data/customer-extract --commit
 *   tsx scripts/import-archive-customers.ts --in <dir> --account-type FUNDRAISING --commit
 *
 * Upserts are keyed on email and fill blanks rather than overwriting stored
 * values, so re-running enriches an existing customer instead of erasing it.
 * `accountType`, `emailStatus` and the rollups are authoritative from the
 * archive and always applied — they are merged across every source, so a second
 * run recomputes the same answer.
 */

import fs from 'node:fs'
import path from 'node:path'
import { PrismaClient } from '@prisma/client'
import { withAccelerate } from '@prisma/extension-accelerate'
import {
  type MergedArchiveCustomer,
  type RawArchiveContact,
  mergeArchiveContacts,
} from '../lib/customers/archive-merge'

const baseClient = new PrismaClient()
const prisma = process.env.DATABASE_URL?.includes('prisma+postgres://')
  ? (baseClient.$extends(withAccelerate()) as unknown as PrismaClient)
  : baseClient

const ACCOUNT_TYPES = ['STANDARD', 'FUNDRAISING', 'WHOLESALE'] as const
type AccountTypeFilter = (typeof ACCOUNT_TYPES)[number]

interface Args {
  inDir: string
  commit: boolean
  limit: number
  /** Restrict the run to one designation. Empty means every customer. */
  accountType: AccountTypeFilter | null
}

function parseArgs(argv: string[]): Args {
  const out: Args = { inDir: '', commit: false, limit: 0, accountType: null }
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]
    if (a === '--in') out.inDir = argv[++i]
    else if (a === '--commit') out.commit = true
    else if (a === '--limit') out.limit = Number(argv[++i])
    else if (a === '--account-type') {
      const value = (argv[++i] ?? '').toUpperCase() as AccountTypeFilter
      if (!ACCOUNT_TYPES.includes(value)) {
        throw new Error(
          `--account-type must be one of ${ACCOUNT_TYPES.join(', ')} (got "${value}")`
        )
      }
      out.accountType = value
    }
  }
  if (!out.inDir) {
    throw new Error('--in <dir> is required (the stage-1 output directory)')
  }
  return out
}

function readRawContacts(file: string): RawArchiveContact[] {
  const text = fs.readFileSync(file, 'utf8')
  const out: RawArchiveContact[] = []
  for (const line of text.split('\n')) {
    if (!line.trim()) continue
    out.push(JSON.parse(line) as RawArchiveContact)
  }
  return out
}

/**
 * Host and database name of whatever `DATABASE_URL` resolves to. This script
 * can write thousands of rows, and the repo keeps a dev URL in `.env` next to a
 * production one in `.env.vercel.production`, so the target is always printed
 * before a commit rather than assumed.
 */
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

function writeReviewCsv(file: string, customers: MergedArchiveCustomer[]): void {
  const header = [
    'email', 'accountType', 'firstName', 'lastName', 'phone', 'sourceName',
    'emailStatus', 'emailPermissionStatus', 'totalOrders', 'totalSpent',
    'lastOrderAt', 'signals', 'sourceFileCount', 'sourceFiles',
  ]
  const lines = [header.join(',')]
  for (const c of customers) {
    lines.push(
      [
        c.email, c.accountType, c.firstName, c.lastName, c.phone, c.sourceName,
        c.emailStatus, c.emailPermissionStatus, c.totalOrders, c.totalSpent,
        c.lastOrderAt ? c.lastOrderAt.toISOString().slice(0, 10) : '',
        c.signals.join('|'), c.sourceFiles.length, c.sourceFiles.join(' | '),
      ]
        .map(csvCell)
        .join(',')
    )
  }
  fs.writeFileSync(file, lines.join('\n') + '\n', 'utf8')
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2))
  const inDir = path.resolve(args.inDir)
  const rawFile = path.join(inDir, 'contacts.raw.jsonl')
  if (!fs.existsSync(rawFile)) {
    throw new Error(`no stage-1 output at ${rawFile} — run extract-archive-customers.py first`)
  }

  console.log(`reading ${rawFile}`)
  const raw = readRawContacts(rawFile)
  console.log(`  ${raw.length} raw records from ${new Set(raw.map((r) => r.sourceFile)).size} files`)

  let customers = mergeArchiveContacts(raw)

  // Designation is decided by merging every source, so filtering after the
  // merge (not before) keeps each customer's account type authoritative.
  if (args.accountType) {
    const before = customers.length
    customers = customers.filter((c) => c.accountType === args.accountType)
    console.log(
      `  --account-type ${args.accountType}: ${customers.length} of ${before} customers`
    )
  }

  if (args.limit > 0) customers = customers.slice(0, args.limit)

  const byType = customers.reduce<Record<string, number>>((acc, c) => {
    acc[c.accountType] = (acc[c.accountType] ?? 0) + 1
    return acc
  }, {})
  const withName = customers.filter((c) => c.firstName || c.lastName).length
  const withPhone = customers.filter((c) => c.phone).length
  const unsub = customers.filter((c) => c.emailStatus === 'Unsubscribed').length
  const withOrders = customers.filter((c) => c.totalOrders > 0).length
  const spend = customers.reduce((s, c) => s + c.totalSpent, 0)

  console.log(`\n${customers.length} distinct customers`)
  console.log(`  by account type: ${JSON.stringify(byType)}`)
  console.log(`  with a name: ${withName}   with a phone: ${withPhone}`)
  console.log(`  unsubscribed: ${unsub}`)
  console.log(`  with order history: ${withOrders}   reconstructed spend: $${spend.toFixed(2)}`)

  const reviewCsv = path.join(inDir, 'customers.merged.csv')
  writeReviewCsv(reviewCsv, customers)
  fs.writeFileSync(
    path.join(inDir, 'merge-report.json'),
    JSON.stringify(
      {
        rawRecords: raw.length,
        distinctCustomers: customers.length,
        byAccountType: byType,
        withName,
        withPhone,
        unsubscribed: unsub,
        withOrderHistory: withOrders,
        reconstructedSpend: Math.round(spend * 100) / 100,
      },
      null,
      2
    ),
    'utf8'
  )
  console.log(`\nreview file -> ${reviewCsv}`)

  if (!args.commit) {
    console.log('\ndry run — nothing written. re-run with --commit to upsert.')
    return
  }

  console.log(`\ntarget database: ${describeTarget()}`)

  const batchId = `archive_${new Date().toISOString().slice(0, 10).replace(/-/g, '')}`
  const now = new Date()
  const emails = customers.map((c) => c.email)

  // Pull what is already stored so the run can report creates vs updates and,
  // more importantly, never regress a value the live system computed.
  interface Existing {
    totalOrders: number
    totalSpent: number
    lastOrderAt: Date | null
    notes: string | null
  }
  const known = new Map<string, Existing>()
  const CHUNK = 1000
  for (let i = 0; i < emails.length; i += CHUNK) {
    const found = await prisma.customer.findMany({
      where: { email: { in: emails.slice(i, i + CHUNK) } },
      select: {
        email: true,
        totalOrders: true,
        totalSpent: true,
        lastOrderAt: true,
        notes: true,
      },
    })
    for (const f of found) {
      known.set(f.email, {
        totalOrders: f.totalOrders,
        totalSpent: Number(f.totalSpent),
        lastOrderAt: f.lastOrderAt,
        notes: f.notes,
      })
    }
  }
  console.log(
    `\ncommitting as batch ${batchId} (${known.size} existing, ${customers.length - known.size} new)`
  )

  const ARCHIVE_NOTE_PREFIX = 'Document archive import'
  const failures: Array<{ email: string; message: string }> = []

  const shared = (c: MergedArchiveCustomer) => ({
    accountType: c.accountType,
    emailStatus: c.emailStatus ?? undefined,
    emailPermissionStatus: c.emailPermissionStatus ?? undefined,
    sourceName: c.sourceName ?? undefined,
    importSource: 'document-archive',
    importBatchId: batchId,
    importedAt: now,
  })

  // Rows with no counterpart in the database go in with `createMany`: at ~300ms
  // of round-trip latency, upserting 22k rows one at a time takes hours, while
  // batched inserts take a couple of minutes.
  const fresh = customers.filter((c) => !known.has(c.email))
  const BATCH = 500
  let created = 0
  for (let i = 0; i < fresh.length; i += BATCH) {
    const slice = fresh.slice(i, i + BATCH)
    try {
      const res = await prisma.customer.createMany({
        data: slice.map((c) => ({
          email: c.email,
          firstName: c.firstName,
          lastName: c.lastName,
          phone: c.phone,
          source: 'IMPORT' as const,
          notes: c.notes,
          totalOrders: c.totalOrders,
          totalSpent: c.totalSpent,
          lastOrderAt: c.lastOrderAt,
          ...shared(c),
        })),
        // A concurrent signup claiming an email mid-run must not abort the batch.
        skipDuplicates: true,
      })
      created += res.count
    } catch (error) {
      for (const c of slice) {
        failures.push({
          email: c.email,
          message: error instanceof Error ? error.message : 'failed to insert',
        })
      }
    }
    console.log(`  created ${Math.min(i + BATCH, fresh.length)}/${fresh.length}`)
  }

  // Existing rows need per-row updates because each merges against what is
  // already stored; run them with bounded concurrency rather than serially.
  const existing = customers.filter((c) => known.has(c.email))
  let updated = 0
  const CONCURRENCY = 12

  async function updateOne(c: MergedArchiveCustomer): Promise<void> {
    const prior = known.get(c.email)!
    // Order rollups from `/api/admin/customers/sync` come from real `Order`
    // rows and are more trustworthy than anything reconstructed from a
    // spreadsheet, so the archive only ever raises them.
    const rollups = {
      totalOrders: c.totalOrders > prior.totalOrders ? c.totalOrders : undefined,
      totalSpent: c.totalSpent > prior.totalSpent ? c.totalSpent : undefined,
      lastOrderAt:
        c.lastOrderAt && (!prior.lastOrderAt || c.lastOrderAt > prior.lastOrderAt)
          ? c.lastOrderAt
          : undefined,
    }
    // Don't destroy a hand-written note; replace only this importer's own.
    const notes =
      !prior.notes?.trim() || prior.notes.trimStart().startsWith(ARCHIVE_NOTE_PREFIX)
        ? c.notes
        : `${prior.notes.trim()}\n\n${c.notes}`

    try {
      await prisma.customer.update({
        where: { email: c.email },
        // `?? undefined` leaves a stored value untouched when the archive has
        // nothing for that field, matching the admin CSV import's behaviour.
        data: {
          firstName: c.firstName ?? undefined,
          lastName: c.lastName ?? undefined,
          phone: c.phone ?? undefined,
          notes,
          ...rollups,
          ...shared(c),
        },
      })
      updated++
    } catch (error) {
      failures.push({
        email: c.email,
        message: error instanceof Error ? error.message : 'failed to update',
      })
    }
  }

  let cursor = 0
  await Promise.all(
    Array.from({ length: Math.min(CONCURRENCY, existing.length) }, async () => {
      while (cursor < existing.length) {
        const index = cursor++
        await updateOne(existing[index])
        if ((updated + failures.length) % 500 === 0) {
          console.log(`  updated ${updated}/${existing.length}`)
        }
      }
    })
  )

  console.log(`\ndone: ${created} created, ${updated} updated, ${failures.length} failed`)
  if (failures.length > 0) {
    const failFile = path.join(inDir, 'commit-failures.json')
    fs.writeFileSync(failFile, JSON.stringify(failures, null, 2), 'utf8')
    console.log(`failures -> ${failFile}`)
  }
}

main()
  .catch((error) => {
    console.error(error)
    process.exitCode = 1
  })
  .finally(async () => {
    await baseClient.$disconnect()
  })
