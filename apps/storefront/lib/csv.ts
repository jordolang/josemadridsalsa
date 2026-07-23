import Papa from 'papaparse'

/**
 * Shared CSV helpers for admin import/export.
 *
 * `toCsv` exists because the hand-rolled admin exports wrap each cell in bare
 * quotes (`"${cell}"`) without escaping — a value containing a quote, comma, or
 * newline breaks the file and can't be re-imported. This doubles embedded
 * quotes so an export round-trips cleanly back through a parser.
 */

type Cell = string | number | boolean | null | undefined

function escapeCell(cell: Cell): string {
  const s = cell === null || cell === undefined ? '' : String(cell)
  return `"${s.replace(/"/g, '""')}"`
}

/** Serializes a header row + data rows to RFC-4180-style CSV text. */
export function toCsv(headers: string[], rows: Cell[][]): string {
  return [
    headers.map(escapeCell).join(','),
    ...rows.map((row) => row.map(escapeCell).join(',')),
  ].join('\r\n')
}

/** Header-keyed parse over PapaParse, trimming header whitespace. */
export function parseCsv(text: string): {
  headers: string[]
  rows: Record<string, string>[]
} {
  const result = Papa.parse<Record<string, string>>(text, {
    header: true,
    skipEmptyLines: 'greedy',
    transformHeader: (h) => h.trim(),
  })
  const headers = (result.meta.fields ?? []).filter((h) => h.length > 0)
  return { headers, rows: result.data ?? [] }
}

const normalizeHeader = (h: string) => h.toLowerCase().replace(/[^a-z0-9]/g, '')

/**
 * Best-guess header -> field mapping from a table of candidate aliases. A
 * header is claimed by at most one field so two fields can't read the same
 * column. Exact matches are resolved before looser contains-matches. Generalizes
 * the FestivalNet importer's detector for reuse by other mapped imports.
 */
export function detectMapping<F extends string>(
  headers: string[],
  aliases: Record<F, string[]>
): Partial<Record<F, string>> {
  const mapping: Partial<Record<F, string>> = {}
  const claimed = new Set<string>()

  for (const pass of ['exact', 'partial'] as const) {
    for (const field of Object.keys(aliases) as F[]) {
      if (mapping[field]) continue
      for (const alias of aliases[field]) {
        const hit = headers.find((h) => {
          if (claimed.has(h)) return false
          const n = normalizeHeader(h)
          return pass === 'exact' ? n === alias : n.includes(alias)
        })
        if (hit) {
          mapping[field] = hit
          claimed.add(hit)
          break
        }
      }
    }
  }

  return mapping
}

/** Trimmed cell value for a mapped column, or null when empty/unmapped. */
export function mappedCell(
  row: Record<string, string>,
  column: string | undefined
): string | null {
  if (!column) return null
  const v = row[column]
  if (v === undefined || v === null) return null
  const trimmed = String(v).trim()
  return trimmed.length > 0 ? trimmed : null
}
