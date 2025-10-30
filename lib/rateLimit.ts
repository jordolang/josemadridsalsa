type Bucket = { timestamps: number[] }

const buckets: Map<string, Bucket> = new Map()

export function rateLimit(key: string, limit: number, windowMs: number) {
  const now = Date.now()
  const bucket = buckets.get(key) || { timestamps: [] }
  // Remove old timestamps
  bucket.timestamps = bucket.timestamps.filter((t) => now - t < windowMs)

  if (bucket.timestamps.length >= limit) {
    const earliest = Math.min(...bucket.timestamps)
    const retryAfterMs = windowMs - (now - earliest)
    return { allowed: false, retryAfterMs }
  }

  bucket.timestamps.push(now)
  buckets.set(key, bucket)
  return { allowed: true, retryAfterMs: 0 }
}
