/**
 * Monthly time series, bucketed in TypeScript.
 *
 * These replace `prisma.$queryRaw` template literals that used `date_trunc` and
 * `generate_series`. CLAUDE.md's "never build raw SQL" rule is the reason, and the old queries
 * had a second problem worth recording: because they grouped rows that exist, **a month with no
 * orders was absent from the result** rather than present as a zero. A chart drawn from that
 * series silently joins November to January and shows a trend that never happened.
 *
 * Bucketing here always emits every month in the window, in order, zeros included.
 */

export interface MonthBucket {
  /** Sort key, `YYYY-MM`. */
  key: string
  /** `Mon` — for a narrow six-month chart axis. */
  shortLabel: string
  /** `Mon YYYY` — for anything spanning a year boundary. */
  label: string
  start: Date
  end: Date
}

/**
 * The last `count` calendar months, oldest first, ending with the month containing `now`.
 *
 * `count` months means `count` buckets: asking for 12 gives the current month plus the eleven
 * before it, which is what "the last 12 months" means to a reader looking at a chart.
 */
export function lastMonths(count: number, now: Date = new Date()): MonthBucket[] {
  const buckets: MonthBucket[] = []

  for (let offset = count - 1; offset >= 0; offset -= 1) {
    const start = new Date(now.getFullYear(), now.getMonth() - offset, 1)
    start.setHours(0, 0, 0, 0)
    // Day 0 of the following month is the last day of this one, which avoids month-length and
    // year-boundary arithmetic entirely.
    const end = new Date(start.getFullYear(), start.getMonth() + 1, 0)
    end.setHours(23, 59, 59, 999)

    buckets.push({
      key: `${start.getFullYear()}-${String(start.getMonth() + 1).padStart(2, '0')}`,
      shortLabel: start.toLocaleDateString('en-US', { month: 'short' }),
      label: start.toLocaleDateString('en-US', { month: 'short', year: 'numeric' }),
      start,
      end,
    })
  }

  return buckets
}

/** The instant the oldest bucket begins, for the query's lower bound. */
export function seriesStart(buckets: MonthBucket[]): Date {
  return buckets[0]?.start ?? new Date()
}

/** Which bucket a date falls in, or null when it is outside the window. */
export function monthKeyOf(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
}

export interface DatedAmount {
  createdAt: Date
  /** The value to sum. Counts still pass 0 and read the row count instead. */
  amount: number
}

export interface MonthlyTotal {
  month: string
  label: string
  total: number
  count: number
}

/**
 * Sum and count rows into monthly buckets.
 *
 * Rows outside the window are ignored rather than folded into the nearest bucket, so a stray
 * timestamp cannot inflate the first or last month.
 */
export function bucketByMonth(
  rows: DatedAmount[],
  buckets: MonthBucket[],
  labelStyle: 'short' | 'long' = 'long'
): MonthlyTotal[] {
  const totals = new Map<string, { total: number; count: number }>()
  for (const bucket of buckets) {
    totals.set(bucket.key, { total: 0, count: 0 })
  }

  for (const row of rows) {
    const entry = totals.get(monthKeyOf(row.createdAt))
    if (!entry) continue
    entry.total += row.amount
    entry.count += 1
  }

  return buckets.map((bucket) => {
    const entry = totals.get(bucket.key)!
    return {
      month: labelStyle === 'short' ? bucket.shortLabel : bucket.label,
      label: bucket.label,
      total: entry.total,
      count: entry.count,
    }
  })
}

export interface MonthlyCustomerCount {
  month: string
  label: string
  newCustomers: number
  totalCustomers: number
}

/**
 * New sign-ups per month, plus the running total at the end of each month.
 *
 * The old SQL ran a correlated subquery per month to get the cumulative figure — twelve
 * `COUNT(*)` scans of `users` for one chart. Counting the rows before the window once and
 * accumulating gives the same numbers for one scan.
 */
export function bucketCustomerGrowth(
  signups: Date[],
  buckets: MonthBucket[],
  priorCustomerCount: number,
  labelStyle: 'short' | 'long' = 'long'
): MonthlyCustomerCount[] {
  const perMonth = new Map<string, number>()
  for (const bucket of buckets) perMonth.set(bucket.key, 0)

  for (const signup of signups) {
    const key = monthKeyOf(signup)
    if (!perMonth.has(key)) continue
    perMonth.set(key, perMonth.get(key)! + 1)
  }

  let running = priorCustomerCount

  return buckets.map((bucket) => {
    const newCustomers = perMonth.get(bucket.key)!
    running += newCustomers
    return {
      month: labelStyle === 'short' ? bucket.shortLabel : bucket.label,
      label: bucket.label,
      newCustomers,
      totalCustomers: running,
    }
  })
}
