/**
 * Stage 2 of the show-sales import.
 *
 * Reads the raw rows from `scripts/extract-show-sales.py`, normalizes and
 * de-duplicates them (`lib/archive/show-sales-normalize.ts`), and — only with
 * `--commit` — inserts them into `ArchivedShowSale`. Dry run by default,
 * idempotent via the unique `contentHash`.
 *
 *   tsx scripts/import-show-sales.ts --in <dir>
 *   tsx scripts/import-show-sales.ts --in <dir> --commit
 */

import fs from 'node:fs'
import path from 'node:path'
import { PrismaClient } from '@prisma/client'
import { withAccelerate } from '@prisma/extension-accelerate'
import {
  normalizeShowSales,
  type RawShowSale,
} from '../lib/archive/show-sales-normalize'

const baseClient = new PrismaClient()
const prisma = process.env.DATABASE_URL?.includes('prisma+postgres://')
  ? (baseClient.$extends(withAccelerate()) as unknown as PrismaClient)
  : baseClient

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

async function main(): Promise<void> {
  const argv = process.argv.slice(2)
  let inDir = ''
  let commit = false
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--in') inDir = argv[++i]
    else if (argv[i] === '--commit') commit = true
  }
  if (!inDir) throw new Error('--in <dir> is required')

  const rawFile = path.join(path.resolve(inDir), 'show-sales.raw.jsonl')
  if (!fs.existsSync(rawFile)) throw new Error(`no stage-1 output at ${rawFile}`)

  const raw: RawShowSale[] = []
  for (const line of fs.readFileSync(rawFile, 'utf8').split('\n')) {
    if (line.trim()) raw.push(JSON.parse(line) as RawShowSale)
  }

  const { entries, duplicatesDropped, skipped } = normalizeShowSales(raw)
  const byType = entries.reduce<Record<string, number>>((a, e) => ((a[e.eventType] = (a[e.eventType] ?? 0) + 1), a), {})
  const byYear = entries.reduce<Record<string, number>>((a, e) => ((a[e.year ?? 'unknown'] = (a[e.year ?? 'unknown'] ?? 0) + 1), a), {})
  const totalSales = entries.reduce((s, e) => s + (e.sales ?? 0), 0)

  console.log(`\n${entries.length} event-day rows (from ${raw.length} raw; ${duplicatesDropped} dupes, ${skipped} skipped)`)
  console.log(`  by type: ${JSON.stringify(byType)}`)
  console.log(`  by year: ${JSON.stringify(byYear)}`)
  console.log(`  total recorded sales: $${totalSales.toLocaleString()}`)

  if (!commit) {
    console.log('\ndry run — nothing written. re-run with --commit to insert.')
    return
  }

  console.log(`\ntarget database: ${describeTarget()}`)
  const batchId = `showsales_${new Date().toISOString().slice(0, 10).replace(/-/g, '')}`
  const now = new Date()

  const res = await prisma.archivedShowSale.createMany({
    data: entries.map((e) => ({
      showName: e.showName,
      showDate: e.showDate ? new Date(`${e.showDate}T00:00:00Z`) : null,
      dateText: e.dateText,
      year: e.year,
      eventType: e.eventType,
      sales: e.sales,
      amountPaid: e.amountPaid,
      expenses: e.expenses,
      salesPerson: e.salesPerson,
      sourceFile: e.sourceFile,
      sourceMd5: e.sourceMd5,
      sourceRow: e.sourceRow,
      contentHash: e.contentHash,
      importBatchId: batchId,
      importedAt: now,
    })),
    skipDuplicates: true,
  })
  console.log(`\ndone: ${res.count} inserted, ${entries.length - res.count} already present`)
}

main()
  .catch((error) => {
    console.error(error)
    process.exitCode = 1
  })
  .finally(async () => {
    await baseClient.$disconnect()
  })
