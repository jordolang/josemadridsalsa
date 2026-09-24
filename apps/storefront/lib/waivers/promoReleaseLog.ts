import { list } from '@vercel/blob'
import { promoReleaseDayPrefix, type PromoReleaseLogEntry } from '@/lib/waivers/promoRelease'

const FETCH_CONCURRENCY = 8

function isLogEntry(value: unknown): value is PromoReleaseLogEntry {
  return (
    typeof value === 'object' &&
    value !== null &&
    'id' in value &&
    'submittedAt' in value &&
    'decision' in value &&
    typeof value.submittedAt === 'string'
  )
}

/**
 * Every waiver signed on one Eastern-time day, oldest first, read from the
 * JSON records in Blob. A day at a busy show is a few hundred small files.
 */
export async function listPromoReleaseEntries(dateKey: string, token: string): Promise<PromoReleaseLogEntry[]> {
  const prefix = promoReleaseDayPrefix(dateKey)
  const urls: string[] = []
  let cursor: string | undefined
  do {
    const page = await list({ prefix, cursor, limit: 1000, token })
    for (const blob of page.blobs) {
      if (blob.pathname.endsWith('.json')) urls.push(blob.url)
    }
    cursor = page.hasMore ? page.cursor : undefined
  } while (cursor)

  const entries: PromoReleaseLogEntry[] = []
  for (let index = 0; index < urls.length; index += FETCH_CONCURRENCY) {
    const batch = urls.slice(index, index + FETCH_CONCURRENCY)
    const results = await Promise.all(
      batch.map(async (url) => {
        try {
          const response = await fetch(url, { cache: 'no-store' })
          if (!response.ok) return null
          const data: unknown = await response.json()
          return isLogEntry(data) ? data : null
        } catch {
          return null
        }
      }),
    )
    for (const entry of results) if (entry) entries.push(entry)
  }

  return entries.sort((a, b) => a.submittedAt.localeCompare(b.submittedAt))
}

/** Accepts YYYY-MM-DD; anything else falls back to the given default. */
export function parseDateKey(value: string | string[] | undefined, fallback: string): string {
  const raw = Array.isArray(value) ? value[0] : value
  return raw && /^\d{4}-\d{2}-\d{2}$/.test(raw) && !Number.isNaN(Date.parse(raw)) ? raw : fallback
}
