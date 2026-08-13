/**
 * Cohort retention and repeat-purchase rate.
 *
 * Two questions about whether customers come back: what share of buyers ever place a second
 * order, and — grouped by the month they were first acquired — how many keep ordering in the
 * months that follow. The second is the classic retention triangle.
 *
 * **Buyer identity** is resolved by the caller and handed in as an opaque `buyerKey` (a signed-in
 * user's id, or a guest's normalised email). Orders with neither are not attributable to a person
 * and are excluded upstream rather than each counted as its own one-time buyer, which would deflate
 * every retention figure.
 *
 * **Two honesty rules, because a retention grid is easy to misread:**
 *  - A cohort's first month is offset 0 and is 100% by definition — everyone ordered the month they
 *    were acquired. Retention is the *later* columns.
 *  - A cell the data cannot see yet is **null, never zero**. A cohort acquired last month has no
 *    "three months later" column, and printing 0% there would read as total churn instead of "not
 *    observable yet". Observable offsets are bounded per cohort by how long ago it was acquired.
 *
 * The month a buyer is assigned to is their earliest order **in the supplied set**, so over a
 * bounded window this is "buyers first seen in the period" — a buyer whose true first purchase
 * predates the window is a new cohort member here. The caller states the window; this module is
 * honest about only knowing what it was given.
 */

export interface BuyerOrder {
  /** Stable identity for the person: a user id, or a normalised guest email. */
  buyerKey: string
  date: Date
}

export interface RepeatPurchaseSummary {
  totalBuyers: number
  /** Buyers with two or more orders in the set. */
  repeatBuyers: number
  /** repeatBuyers ÷ totalBuyers, or null when there are no buyers. */
  repeatRate: number | null
  totalOrders: number
  /** Mean orders per buyer, or null when there are no buyers. */
  ordersPerBuyer: number | null
}

export interface CohortRow {
  /** Acquisition month, `YYYY-MM`. */
  cohort: string
  /** Buyers first seen in this month. */
  cohortSize: number
  /**
   * Retention by month offset from acquisition. Index 0 is the acquisition month (always 1).
   * A later index is the fraction of the cohort that ordered in that month, or **null** when the
   * offset is still in the future for this cohort and cannot be observed yet.
   */
  retentionByOffset: Array<number | null>
  /** The same as counts rather than fractions; index 0 equals `cohortSize`. */
  returnedByOffset: Array<number | null>
}

export interface CohortAnalysis {
  repeat: RepeatPurchaseSummary
  cohorts: CohortRow[]
  /** Widest observable offset across all cohorts — the column count for a rectangular grid. */
  maxOffset: number
}

/** `YYYY-MM` for a date, in UTC so a month boundary does not shift with the server's timezone. */
export function monthKey(date: Date): string {
  const year = date.getUTCFullYear()
  const month = String(date.getUTCMonth() + 1).padStart(2, '0')
  return `${year}-${month}`
}

/** Whole months from one `YYYY-MM` to another. Negative if `to` precedes `from`. */
export function monthOffset(from: string, to: string): number {
  const [fy, fm] = from.split('-').map(Number)
  const [ty, tm] = to.split('-').map(Number)
  return (ty - fy) * 12 + (tm - fm)
}

interface BuyerFacts {
  orderCount: number
  /** Distinct months this buyer ordered in. */
  activeMonths: Set<string>
  firstMonth: string
}

function collectBuyers(orders: BuyerOrder[]): Map<string, BuyerFacts> {
  const buyers = new Map<string, BuyerFacts>()

  for (const order of orders) {
    const month = monthKey(order.date)
    const existing = buyers.get(order.buyerKey)

    if (!existing) {
      buyers.set(order.buyerKey, {
        orderCount: 1,
        activeMonths: new Set([month]),
        firstMonth: month,
      })
      continue
    }

    existing.orderCount += 1
    existing.activeMonths.add(month)
    if (monthOffset(existing.firstMonth, month) < 0) existing.firstMonth = month
  }

  return buyers
}

function summariseRepeat(buyers: Map<string, BuyerFacts>): RepeatPurchaseSummary {
  let totalOrders = 0
  let repeatBuyers = 0

  for (const facts of buyers.values()) {
    totalOrders += facts.orderCount
    if (facts.orderCount >= 2) repeatBuyers += 1
  }

  const totalBuyers = buyers.size

  return {
    totalBuyers,
    repeatBuyers,
    repeatRate: totalBuyers > 0 ? repeatBuyers / totalBuyers : null,
    totalOrders,
    ordersPerBuyer: totalBuyers > 0 ? totalOrders / totalBuyers : null,
  }
}

/**
 * Full analysis: repeat-purchase summary plus the retention triangle.
 *
 * `now` fixes "today" so the observable-offset boundary is deterministic and testable — a cell is
 * observable only if the month it refers to has already begun by `now`.
 */
export function analyseCohorts(orders: BuyerOrder[], now: Date): CohortAnalysis {
  const buyers = collectBuyers(orders)
  const repeat = summariseRepeat(buyers)

  // Group buyers into their acquisition-month cohorts.
  const cohortMembers = new Map<string, BuyerFacts[]>()
  for (const facts of buyers.values()) {
    const members = cohortMembers.get(facts.firstMonth)
    if (members) members.push(facts)
    else cohortMembers.set(facts.firstMonth, [facts])
  }

  const nowMonth = monthKey(now)
  const cohortKeys = [...cohortMembers.keys()].sort()

  // The widest offset any cohort could observe is from the earliest cohort to the current month.
  const maxOffset = cohortKeys.length > 0 ? monthOffset(cohortKeys[0], nowMonth) : 0

  const cohorts: CohortRow[] = cohortKeys.map((cohort) => {
    const members = cohortMembers.get(cohort) ?? []
    const cohortSize = members.length
    // How many offsets this cohort can actually see: acquisition month through the current month.
    const observable = monthOffset(cohort, nowMonth)

    const returned = new Array<number>(observable + 1).fill(0)
    for (const facts of members) {
      for (const month of facts.activeMonths) {
        const offset = monthOffset(cohort, month)
        if (offset >= 0 && offset <= observable) returned[offset] += 1
      }
    }

    const returnedByOffset: Array<number | null> = []
    const retentionByOffset: Array<number | null> = []
    for (let offset = 0; offset <= maxOffset; offset += 1) {
      if (offset > observable) {
        // Future for this cohort — not yet observable, so null rather than a misleading zero.
        returnedByOffset.push(null)
        retentionByOffset.push(null)
      } else {
        const count = returned[offset]
        returnedByOffset.push(count)
        retentionByOffset.push(cohortSize > 0 ? count / cohortSize : null)
      }
    }

    return { cohort, cohortSize, returnedByOffset, retentionByOffset }
  })

  return { repeat, cohorts, maxOffset }
}

/** "42.0%", or an em dash for a cell that is null (not yet observable) or has no buyers. */
export function formatRetention(ratio: number | null): string {
  return ratio === null ? '—' : `${(ratio * 100).toFixed(1)}%`
}

/** `2024-03` → `Mar 2024` for a column/row header. */
export function formatCohortMonth(cohort: string): string {
  const [year, month] = cohort.split('-').map(Number)
  const date = new Date(Date.UTC(year, month - 1, 1))
  return date.toLocaleDateString('en-US', { month: 'short', year: 'numeric', timeZone: 'UTC' })
}
