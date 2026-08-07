/**
 * Builds the searchable document index (`ArchiveDocument`) for the local
 * (gitignored) `Documents/` archive.
 *
 * Merges two inputs, keyed on archive-relative path:
 *   1. the archive's own `search_index.csv` (metadata: category, size, md5, ...)
 *   2. `archive-text.jsonl` from `scripts/extract-archive-text.py` (full text)
 *
 * Every file is classified for sensitivity (`lib/archive/document-classify.ts`)
 * so HR/tax/bank records are gated. Dry run by default.
 *
 *   tsx scripts/import-archive-documents.ts --archive ../../Documents --text <dir>
 *   tsx scripts/import-archive-documents.ts --archive ../../Documents --text <dir> --commit
 *
 * `--redact-sensitive-text` stores SENSITIVE documents as metadata only, with
 * `extractedText` null — full row parity without the raw identifiers those
 * files carry. Use it when the target is a database that also serves public
 * traffic.
 *
 * Idempotent: upserts on the unique `path`, so re-running refreshes text and
 * classification without creating duplicates.
 */

import fs from 'node:fs'
import path from 'node:path'
import { PrismaClient } from '@prisma/client'
import { withAccelerate } from '@prisma/extension-accelerate'
import { parseCsv } from '../lib/csv'
import {
  classifySensitivity,
  parseArchiveYear,
} from '../lib/archive/document-classify'

const baseClient = new PrismaClient()
const prisma = process.env.DATABASE_URL?.includes('prisma+postgres://')
  ? (baseClient.$extends(withAccelerate()) as unknown as PrismaClient)
  : baseClient

type ExtractionStatus =
  | 'PENDING'
  | 'EXTRACTED'
  | 'EMPTY'
  | 'SCANNED_NO_TEXT'
  | 'UNSUPPORTED'
  | 'ERROR'

interface TextRecord {
  path: string
  ext: string
  textChars: number
  extraction: ExtractionStatus
  needsOcr: boolean
  extractedText: string | null
}

interface Args {
  archiveDir: string
  textDir: string
  commit: boolean
  /** Store SENSITIVE documents as metadata only, without their text. */
  redactSensitiveText: boolean
}

function parseArgs(argv: string[]): Args {
  const out: Args = {
    archiveDir: '../../Documents',
    textDir: '',
    commit: false,
    redactSensitiveText: false,
  }
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]
    if (a === '--archive') out.archiveDir = argv[++i]
    else if (a === '--text') out.textDir = argv[++i]
    else if (a === '--commit') out.commit = true
    else if (a === '--redact-sensitive-text') out.redactSensitiveText = true
  }
  if (!out.textDir) throw new Error('--text <dir> is required (extract-archive-text.py output)')
  return out
}

/** Postgres text columns reject NUL (0x00); strip it from any extracted string. */
function stripNul<T extends string | null>(v: T): T {
  return (v === null ? null : (v.split(String.fromCharCode(0)).join('') as string)) as T
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

function loadTextRecords(file: string): Map<string, TextRecord> {
  const byPath = new Map<string, TextRecord>()
  for (const line of fs.readFileSync(file, 'utf8').split('\n')) {
    if (!line.trim()) continue
    const rec = JSON.parse(line) as TextRecord
    byPath.set(rec.path, rec)
  }
  return byPath
}

interface DocRow {
  path: string
  category: string
  filename: string
  ext: string | null
  sizeBytes: number | null
  md5: string | null
  originalSource: string | null
  year: number | null
  textPreview: string | null
  extractedText: string | null
  textChars: number
  extraction: ExtractionStatus
  needsOcr: boolean
  sensitivity: 'PUBLIC' | 'INTERNAL' | 'SENSITIVE'
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2))
  const archiveRoot = path.resolve(args.archiveDir)
  const indexCsv = path.join(archiveRoot, 'search_index.csv')
  const textJsonl = path.join(path.resolve(args.textDir), 'archive-text.jsonl')

  if (!fs.existsSync(indexCsv)) throw new Error(`no search_index.csv at ${indexCsv}`)
  if (!fs.existsSync(textJsonl)) throw new Error(`no archive-text.jsonl at ${textJsonl} — run extract-archive-text.py first`)

  const { rows } = parseCsv(fs.readFileSync(indexCsv, 'utf8'))
  const text = loadTextRecords(textJsonl)
  console.log(`  ${rows.length} files in search_index.csv; ${text.size} with extraction records`)

  const docs: DocRow[] = []
  for (const r of rows) {
    const relPath = r.path
    if (!relPath) continue
    const category = r.category ?? ''
    const t = text.get(relPath)
    docs.push({
      path: relPath,
      category,
      filename: r.filename ?? path.basename(relPath),
      ext: (r.ext || t?.ext || null) as string | null,
      sizeBytes: r.size_bytes ? Number(r.size_bytes) : null,
      md5: r.md5 || null,
      originalSource: r.original_source || null,
      year: parseArchiveYear(relPath),
      textPreview: r.text_preview?.trim() ? r.text_preview.trim() : null,
      extractedText: t?.extractedText ?? null,
      textChars: t?.textChars ?? 0,
      extraction: t?.extraction ?? 'PENDING',
      needsOcr: t?.needsOcr ?? false,
      sensitivity: classifySensitivity(relPath, category, t?.extractedText ?? null),
    })
  }

  // Drop the text of gated documents before anything is written. The raw
  // identifiers in the archive (SSNs on tax returns, account numbers on bank
  // records) live only in `extractedText`, so removing it here keeps them out
  // of the target database entirely rather than relying on a read-time guard.
  if (args.redactSensitiveText) {
    let redacted = 0
    for (const doc of docs) {
      if (doc.sensitivity === 'SENSITIVE' && doc.extractedText) {
        doc.extractedText = null
        doc.textChars = 0
        redacted++
      }
    }
    console.log(`\n--redact-sensitive-text: dropped the text of ${redacted} SENSITIVE documents`)
  }

  // Summary
  const bySensitivity = docs.reduce<Record<string, number>>((a, d) => ((a[d.sensitivity] = (a[d.sensitivity] ?? 0) + 1), a), {})
  const byExtraction = docs.reduce<Record<string, number>>((a, d) => ((a[d.extraction] = (a[d.extraction] ?? 0) + 1), a), {})
  const withText = docs.filter((d) => (d.extractedText?.length ?? 0) > 0).length
  const needsOcr = docs.filter((d) => d.needsOcr).length

  console.log(`\n${docs.length} documents`)
  console.log(`  with full text: ${withText}   flagged needs-OCR: ${needsOcr}`)
  console.log(`  by sensitivity: ${JSON.stringify(bySensitivity)}`)
  console.log(`  by extraction:  ${JSON.stringify(byExtraction)}`)

  if (!args.commit) {
    console.log('\ndry run — nothing written. re-run with --commit to upsert.')
    return
  }

  console.log(`\ntarget database: ${describeTarget()}`)
  const batchId = `archivedocs_${new Date().toISOString().slice(0, 10).replace(/-/g, '')}`
  const now = new Date()

  // Insert fresh rows in bulk; refresh existing ones (text/classification) with
  // bounded-concurrency updates so a re-run after re-extraction is cheap.
  const existingPaths = new Set(
    (await prisma.archiveDocument.findMany({ select: { path: true } })).map((d) => d.path)
  )
  const fresh = docs.filter((d) => !existingPaths.has(d.path))
  const stale = docs.filter((d) => existingPaths.has(d.path))
  console.log(`  ${fresh.length} new, ${stale.length} existing`)

  const shared = (d: DocRow) => ({
    category: d.category,
    filename: d.filename,
    ext: d.ext,
    sizeBytes: d.sizeBytes,
    md5: d.md5,
    originalSource: stripNul(d.originalSource),
    year: d.year,
    textPreview: stripNul(d.textPreview),
    extractedText: stripNul(d.extractedText),
    textChars: d.textChars,
    extraction: d.extraction,
    needsOcr: d.needsOcr,
    sensitivity: d.sensitivity,
    importBatchId: batchId,
    importedAt: now,
  })

  const BATCH = 300
  let created = 0
  for (let i = 0; i < fresh.length; i += BATCH) {
    const slice = fresh.slice(i, i + BATCH)
    const res = await prisma.archiveDocument.createMany({
      data: slice.map((d) => ({ path: stripNul(d.path), ...shared(d) })),
      skipDuplicates: true,
    })
    created += res.count
    console.log(`  created ${Math.min(i + BATCH, fresh.length)}/${fresh.length}`)
  }

  let updated = 0
  const CONCURRENCY = 12
  let cursor = 0
  await Promise.all(
    Array.from({ length: Math.min(CONCURRENCY, stale.length) }, async () => {
      while (cursor < stale.length) {
        const d = stale[cursor++]
        await prisma.archiveDocument.update({ where: { path: d.path }, data: shared(d) })
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
