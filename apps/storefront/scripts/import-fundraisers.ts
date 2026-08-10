/**
 * Stage 2 of the fundraiser-history import.
 *
 * Reads the raw records from `scripts/extract-fundraisers.py`, normalizes them
 * (`lib/archive/fundraiser-normalize.ts`), writes a reviewable CSV + summary, and
 * — only with `--commit` — upserts them into `ArchivedFundraiser`.
 *
 *   tsx scripts/import-fundraisers.ts --in <dir>
 *   tsx scripts/import-fundraisers.ts --in <dir> --commit
 *
 * Idempotent on `sourceFile`: re-running refreshes a file's summary in place.
 */

import fs from 'node:fs'
import path from 'node:path'
import { PrismaClient } from '@prisma/client'
import { withAccelerate } from '@prisma/extension-accelerate'
import {
  normalizeFundraiser,
  type NormalizedFundraiser,
  type RawFundraiser,
} from '../lib/archive/fundraiser-normalize'

const baseClient = new PrismaClient()
const prisma = process.env.DATABASE_URL?.includes('prisma+postgres://')
  ? (baseClient.$extends(withAccelerate()) as unknown as PrismaClient)
  : baseClient

interface Args {
  inDir: string
  commit: boolean
}

function parseArgs(argv: string[]): Args {
  const out: Args = { inDir: '', commit: false }
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]
    if (a === '--in') out.inDir = argv[++i]
    else if (a === '--commit') out.commit = true
  }
  if (!out.inDir) throw new Error('--in <dir> is required')
  return out
}

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

function writeReviewCsv(file: string, rows: NormalizedFundraiser[]): void {
  const header = ['organizationName', 'year', 'orderDate', 'formType', 'totalJars', 'orderCount', 'submittedBy', 'contactEmail', 'contactPhone', 'sourceFile', 'notes']
  const lines = [header.join(',')]
  for (const r of rows) {
    lines.push([r.organizationName, r.year, r.orderDate, r.formType, r.totalJars, r.orderCount, r.submittedBy, r.contactEmail, r.contactPhone, r.sourceFile, r.notes].map(csvCell).join(','))
  }
  fs.writeFileSync(file, lines.join('\n') + '\n', 'utf8')
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2))
  const inDir = path.resolve(args.inDir)
  const rawFile = path.join(inDir, 'fundraisers.raw.jsonl')
  if (!fs.existsSync(rawFile)) throw new Error(`no stage-1 output at ${rawFile}`)

  const raw: RawFundraiser[] = []
  for (const line of fs.readFileSync(rawFile, 'utf8').split('\n')) {
    if (line.trim()) raw.push(JSON.parse(line) as RawFundraiser)
  }
  const rows = raw.map(normalizeFundraiser)

  const byType = rows.reduce<Record<string, number>>((a, r) => ((a[r.formType] = (a[r.formType] ?? 0) + 1), a), {})
  const byYear = rows.reduce<Record<string, number>>((a, r) => ((a[r.year ?? 'unknown'] = (a[r.year ?? 'unknown'] ?? 0) + 1), a), {})
  const withJars = rows.filter((r) => r.totalJars).length
  const totalJars = rows.reduce((s, r) => s + (r.totalJars ?? 0), 0)
  const withEmail = rows.filter((r) => r.contactEmail).length
  const distinctOrgs = new Set(rows.map((r) => r.organizationName.toLowerCase())).size

  console.log(`\n${rows.length} fundraiser records from ${raw.length} files`)
  console.log(`  by form type: ${JSON.stringify(byType)}`)
  console.log(`  by year: ${JSON.stringify(byYear)}`)
  console.log(`  distinct organizations: ${distinctOrgs}`)
  console.log(`  with jar totals: ${withJars}   total jars across all: ${totalJars.toLocaleString()}`)
  console.log(`  with organizer email: ${withEmail}`)

  const reviewCsv = path.join(inDir, 'fundraisers.normalized.csv')
  writeReviewCsv(reviewCsv, rows)
  console.log(`\nreview file -> ${reviewCsv}`)

  if (!args.commit) {
    console.log('\ndry run — nothing written. re-run with --commit to upsert.')
    return
  }

  console.log(`\ntarget database: ${describeTarget()}`)
  const batchId = `fundraisers_${new Date().toISOString().slice(0, 10).replace(/-/g, '')}`
  const now = new Date()

  const existing = new Set(
    (await prisma.archivedFundraiser.findMany({ select: { sourceFile: true } })).map((r) => r.sourceFile)
  )
  const fresh = rows.filter((r) => !existing.has(r.sourceFile))
  const stale = rows.filter((r) => existing.has(r.sourceFile))
  console.log(`  ${fresh.length} new, ${stale.length} existing`)

  // Guard against out-of-range parsed dates (a typo'd month/day in a hand-filled
  // form can yield an unrepresentable date); keep the row, drop only the date.
  const safeDate = (iso: string | null): Date | null => {
    if (!iso) return null
    const d = new Date(`${iso}T00:00:00Z`)
    return Number.isNaN(d.getTime()) ? null : d
  }

  const data = (r: NormalizedFundraiser) => ({
    organizationName: r.organizationName,
    year: r.year,
    orderDate: safeDate(r.orderDate),
    submittedBy: r.submittedBy,
    contactEmail: r.contactEmail,
    contactPhone: r.contactPhone,
    formType: r.formType,
    totalJars: r.totalJars,
    orderCount: r.orderCount,
    flavorsJson: r.flavorsJson ?? undefined,
    sourceMd5: r.sourceMd5,
    notes: r.notes,
    importBatchId: batchId,
    importedAt: now,
  })

  const BATCH = 300
  let created = 0
  for (let i = 0; i < fresh.length; i += BATCH) {
    const slice = fresh.slice(i, i + BATCH)
    const res = await prisma.archivedFundraiser.createMany({
      data: slice.map((r) => ({ sourceFile: r.sourceFile, ...data(r) })),
      skipDuplicates: true,
    })
    created += res.count
    console.log(`  created ${Math.min(i + BATCH, fresh.length)}/${fresh.length}`)
  }

  let updated = 0
  let cursor = 0
  await Promise.all(
    Array.from({ length: Math.min(12, stale.length) }, async () => {
      while (cursor < stale.length) {
        const r = stale[cursor++]
        await prisma.archivedFundraiser.update({ where: { sourceFile: r.sourceFile }, data: data(r) })
        updated++
      }
    })
  )

  console.log(`\ndone: ${created} created, ${updated} updated`)
}

main()
  .catch((error) => {
    console.error(error)
    process.exitCode = 1
  })
  .finally(async () => {
    await baseClient.$disconnect()
  })
