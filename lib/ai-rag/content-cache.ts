import { indexAllContent } from './indexer'

type CachedContent = {
  content: Awaited<ReturnType<typeof indexAllContent>>
  timestamp: number
} | null

const CACHE_TTL_MS = 5 * 60 * 1000

let cache: CachedContent = null

export async function getIndexedContent() {
  const now = Date.now()

  if (cache && now - cache.timestamp < CACHE_TTL_MS) {
    return cache.content
  }

  const content = await indexAllContent()
  cache = { content, timestamp: now }
  return content
}

export function invalidateIndexedContentCache() {
  cache = null
}
