/**
 * Stage 2 of the mileage import.
 *
 * Reads the raw rows produced by `scripts/extract-mileage.py`, normalizes and
 * de-duplicates them (`lib/archive/mileage-normalize.ts`), writes a reviewable
 * CSV + JSON summary, and — only with `--commit` — inserts them into
 * `MileageEntry`.
 *
 * Dry run by default. Nothing is written until the summary looks right.
 *
 *   tsx scripts/import-mileage.ts --in <scratchpad>/mileage-extract
 *   tsx scripts/import-mileage.ts --in <scratchpad>/mileage-extract --commit
 *
 * Idempotent: every row has a unique `contentHash`, so re-running with
 * `skipDuplicates` inserts only trips that are not already stored.
 */

import fs from 'node:fs'
import path from 'node:path'
import { PrismaClient } from '@prisma/client'
import { withAccelerate } from '@prisma/extension-accelerate'
import {
  normalizeMileage,
  type NormalizedMileageEntry,
  type RawMileageRow,
} from '../lib/archive/mileage-normalize'

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
  if (!out.inDir) throw new Error('--in <dir> is required (the stage-1 output directory)')
  return out
}

function readRawRows(file: string): RawMileageRow[] {
  const out: RawMileageRow[] = []
  for (const line of fs.readFileSync(file, 'utf8').split('\n')) {
    if (line.trim()) out.push(JSON.parse(line) as RawMileageRow)
  }
  return out
}

/** Host + database of whatever `DATABASE_URL` resolves to, printed before a write. */
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

function writeReviewCsv(file: string, entries: NormalizedMileageEntry[]): void {
  const header = [
    'tripDate', 'endDate', 'destination', 'city', 'state', 'miles',
    'oneWayMiles', 'odometerStart', 'odometerEnd', 'driver', 'sales',
    'category', 'year', 'sourceFile', 'sourceRow',
  ]
  const lines = [header.join(',')]
  for (const e of entries) {
    lines.push(
      [
        e.tripDate, e.endDate, e.destination, e.city, e.state, e.miles,
        e.oneWayMiles, e.odometerStart, e.odometerEnd, e.driver, e.sales,
        e.category, e.year, e.sourceFile, e.sourceRow,
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
  const rawFile = path.join(inDir, 'mileage.raw.jsonl')
  if (!fs.existsSync(rawFile)) {
    throw new Error(`no stage-1 output at ${rawFile} — run extract-mileage.py first`)
  }

  console.log(`reading ${rawFile}`)
  const raw = readRawRows(rawFile)
  const sourceFiles = new Set(raw.map((r) => r.sourceFile))
  console.log(`  ${raw.length} raw rows from ${sourceFiles.size} files`)

  const { entries, skipped, duplicatesDropped } = normalizeMileage(raw)

  const byYear = entries.reduce<Record<number, number>>((acc, e) => {
    acc[e.year] = (acc[e.year] ?? 0) + 1
    return acc
  }, {})
  const byDriver = entries.reduce<Record<string, number>>((acc, e) => {
    const k = e.driver ?? '(unknown)'
    acc[k] = (acc[k] ?? 0) + 1
    return acc
  }, {})
  const totalMiles = entries.reduce((s, e) => s + (e.miles ?? 0), 0)
  const totalSales = entries.reduce((s, e) => s + (e.sales ?? 0), 0)

  console.log(`\n${entries.length} distinct trips`)
  console.log(`  skipped: ${JSON.stringify(skipped)}`)
  console.log(`  duplicates collapsed: ${duplicatesDropped}`)
  console.log(`  by year: ${JSON.stringify(byYear)}`)
  console.log(`  by driver: ${JSON.stringify(byDriver)}`)
  console.log(`  total miles: ${totalMiles.toLocaleString()}   recorded sales: $${totalSales.toLocaleString()}`)

  const reviewCsv = path.join(inDir, 'mileage.normalized.csv')
  writeReviewCsv(reviewCsv, entries)
  fs.writeFileSync(
    path.join(inDir, 'mileage-report.json'),
    JSON.stringify(
      { rawRows: raw.length, sourceFiles: [...sourceFiles], distinctTrips: entries.length, skipped, duplicatesDropped, byYear, byDriver, totalMiles, totalSales },
      null,
      2
    ),
    'utf8'
  )
  console.log(`\nreview file -> ${reviewCsv}`)

  if (!args.commit) {
    console.log('\ndry run — nothing written. re-run with --commit to insert.')
    return
  }

  console.log(`\ntarget database: ${describeTarget()}`)
  const batchId = `mileage_${new Date().toISOString().slice(0, 10).replace(/-/g, '')}`
  const now = new Date()

  const BATCH = 500
  let created = 0
  for (let i = 0; i < entries.length; i += BATCH) {
    const slice = entries.slice(i, i + BATCH)
    const res = await prisma.mileageEntry.createMany({
      data: slice.map((e) => ({
        tripDate: new Date(`${e.tripDate}T00:00:00Z`),
        endDate: e.endDate ? new Date(`${e.endDate}T00:00:00Z`) : null,
        destination: e.destination,
        city: e.city,
        state: e.state,
        miles: e.miles,
        oneWayMiles: e.oneWayMiles,
        odometerStart: e.odometerStart,
        odometerEnd: e.odometerEnd,
        driver: e.driver,
        sales: e.sales,
        category: e.category,
        year: e.year,
        sourceFile: e.sourceFile,
        sourceMd5: e.sourceMd5,
        sourceSheet: e.sourceSheet,
        sourceRow: e.sourceRow,
        rawRow: e.rawRow,
        contentHash: e.contentHash,
        importBatchId: batchId,
        importedAt: now,
      })),
      // Re-runs and rows already stored under their contentHash are skipped.
      skipDuplicates: true,
    })
    created += res.count
    console.log(`  inserted ${Math.min(i + BATCH, entries.length)}/${entries.length} (new: ${created})`)
  }

  console.log(`\ndone: ${created} inserted, ${entries.length - created} already present`)
}

main()
  .catch((error) => {
    console.error(error)
    process.exitCode = 1
  })
  .finally(async () => {
    await baseClient.$disconnect()
  })
