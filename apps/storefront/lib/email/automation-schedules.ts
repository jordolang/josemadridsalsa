/**
 * Time-based automation triggers: birthday, purchase anniversary and re-engagement.
 *
 * Nothing happens at the moment these become true, so there is no event to hang them on; the
 * email-automation cron calls `enrollScheduledAutomations` every tick instead. Every enrollment
 * carries a dedupe key naming the occasion (`BIRTHDAY:2026`, `REENGAGEMENT:<orderId>`), so
 * re-scanning the same day 288 times enrolls each person once.
 *
 * Days are business days in Eastern time, like every other date the business reasons about.
 */
import { prisma } from '@/lib/prisma'
import { PAID_PAYMENT_STATUSES } from '@/lib/payments/status'
import { businessCalendarDate, endOfBusinessDay, startOfBusinessDay } from '@/lib/timeclock'
import { enrollInAutomation } from './automation-engine'

const DAY_MS = 24 * 60 * 60 * 1000

/** How long since the last paid order before a customer counts as lapsed. */
export const REENGAGEMENT_AFTER_DAYS = 90

/**
 * Only customers who lapsed within this many days past the threshold are enrolled. Without it the
 * first run would mail every customer who has not ordered since the BigCommerce import; with it,
 * a cron outage of under a week still catches everyone.
 */
export const REENGAGEMENT_WINDOW_DAYS = 7

/** How far back a first order may be and still have its anniversary marked. */
const ANNIVERSARY_MAX_YEARS = 30

/** Cap per trigger per tick, so a backlog cannot turn one tick into a very long function. */
const SCAN_LIMIT = 500

function isLeapYear(year: number): boolean {
  return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0
}

/**
 * Whether a date of birth falls on `today`.
 *
 * `dateOfBirth` is a calendar date stored at UTC midnight, so it is read in UTC. A 29 February
 * birthday is celebrated on the 28th in years that have no 29th.
 */
export function isBirthdayOn(
  dateOfBirth: Date,
  today: { year: number; month: number; day: number }
): boolean {
  const month = dateOfBirth.getUTCMonth() + 1
  const day = dateOfBirth.getUTCDate()
  if (month === 2 && day === 29 && !isLeapYear(today.year)) {
    return today.month === 2 && today.day === 28
  }
  return month === today.month && day === today.day
}

function paidOrdersFor(email: string) {
  return {
    paymentStatus: { in: PAID_PAYMENT_STATUSES },
    OR: [
      { guestEmail: { equals: email, mode: 'insensitive' as const } },
      { user: { email: { equals: email, mode: 'insensitive' as const } } },
    ],
  }
}

function orderEmail(order: { guestEmail: string | null; user: { email: string } | null }) {
  return order.user?.email ?? order.guestEmail ?? null
}

/** Account holders whose birthday is today. Birth dates come from the account settings form. */
export async function enrollBirthdays(now: Date): Promise<number> {
  const today = businessCalendarDate(now)
  // ponytail: Prisma cannot filter on month/day without raw SQL, so every dated account is read
  // and filtered here. Fine at thousands of rows; add a stored birth month/day column past that.
  const users = await prisma.user.findMany({
    where: { dateOfBirth: { not: null } },
    select: { email: true, name: true, dateOfBirth: true },
  })

  let enrolled = 0
  for (const user of users) {
    if (!user.dateOfBirth || !isBirthdayOn(user.dateOfBirth, today)) continue
    await enrollInAutomation(
      'BIRTHDAY',
      user.email,
      { firstName: user.name?.split(' ')[0] ?? '' },
      `BIRTHDAY:${today.year}`
    )
    enrolled++
  }
  return enrolled
}

/**
 * Customers whose first paid order was placed on today's date in an earlier year.
 *
 * The first order, not `User.createdAt`: imported accounts carry the import date as their
 * creation date, and guests — most buyers — have no account at all.
 */
export async function enrollAnniversaries(now: Date): Promise<number> {
  const today = businessCalendarDate(now)

  const days = []
  for (let years = 1; years <= ANNIVERSARY_MAX_YEARS; years++) {
    const year = today.year - years
    // A 29 February first order simply has no anniversary in other years.
    if (today.month === 2 && today.day === 29 && !isLeapYear(year)) continue
    const date = { year, month: today.month, day: today.day }
    days.push({ createdAt: { gte: startOfBusinessDay(date), lte: endOfBusinessDay(date) } })
  }

  const orders = await prisma.order.findMany({
    where: { paymentStatus: { in: PAID_PAYMENT_STATUSES }, OR: days },
    select: { createdAt: true, guestEmail: true, user: { select: { email: true } } },
    take: SCAN_LIMIT,
  })

  let enrolled = 0
  const seen = new Set<string>()
  for (const order of orders) {
    const email = orderEmail(order)?.toLowerCase()
    if (!email || seen.has(email)) continue
    seen.add(email)

    const earlier = await prisma.order.count({
      where: { ...paidOrdersFor(email), createdAt: { lt: order.createdAt } },
    })
    if (earlier > 0) continue

    const years = today.year - businessCalendarDate(order.createdAt).year
    await enrollInAutomation(
      'ANNIVERSARY',
      email,
      { years: String(years), firstOrderDate: order.createdAt.toISOString() },
      `ANNIVERSARY:${today.year}`
    )
    enrolled++
  }
  return enrolled
}

/**
 * Customers whose last paid order is between 90 and 97 days old: lapsed, and lapsed recently.
 *
 * Keyed on that last order, so each lapse earns one series; ordering again and lapsing again
 * earns another.
 */
export async function enrollLapsedCustomers(now: Date): Promise<number> {
  const lapsedBefore = new Date(now.getTime() - REENGAGEMENT_AFTER_DAYS * DAY_MS)
  const windowStart = new Date(
    lapsedBefore.getTime() - REENGAGEMENT_WINDOW_DAYS * DAY_MS
  )

  // Paged through the whole window: a single capped read returns the same newest rows every
  // tick, and repeat orders or still-active customers could fill it while real candidates
  // further back aged out of the window unseen.
  const orders = []
  for (let skip = 0; ; skip += SCAN_LIMIT) {
    const page = await prisma.order.findMany({
      where: {
        paymentStatus: { in: PAID_PAYMENT_STATUSES },
        createdAt: { gte: windowStart, lte: lapsedBefore },
      },
      select: { id: true, createdAt: true, guestEmail: true, user: { select: { email: true } } },
      // Newest first, so the first order seen per address is its latest in the window.
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      skip,
      take: SCAN_LIMIT,
    })
    orders.push(...page)
    if (page.length < SCAN_LIMIT) break
  }

  let enrolled = 0
  const seen = new Set<string>()
  for (const order of orders) {
    const email = orderEmail(order)?.toLowerCase()
    if (!email || seen.has(email)) continue
    seen.add(email)

    const since = await prisma.order.count({
      where: { ...paidOrdersFor(email), createdAt: { gt: order.createdAt } },
    })
    if (since > 0) continue

    await enrollInAutomation(
      'REENGAGEMENT',
      email,
      { lastOrderDate: order.createdAt.toISOString() },
      `REENGAGEMENT:${order.id}`
    )
    enrolled++
  }
  return enrolled
}

/**
 * Run every time-based trigger an active automation is listening for.
 *
 * Triggers no active automation uses are skipped before any scan, so this costs one query a
 * tick until someone switches a birthday or re-engagement series on.
 */
export async function enrollScheduledAutomations(
  now: Date = new Date()
): Promise<Record<string, number>> {
  const active = await prisma.emailAutomation.findMany({
    where: { isActive: true, trigger: { in: ['BIRTHDAY', 'ANNIVERSARY', 'REENGAGEMENT'] } },
    select: { trigger: true },
    distinct: ['trigger'],
  })
  const triggers = new Set(active.map((a) => a.trigger))

  const result: Record<string, number> = {}
  if (triggers.has('BIRTHDAY')) result.birthday = await enrollBirthdays(now)
  if (triggers.has('ANNIVERSARY')) result.anniversary = await enrollAnniversaries(now)
  if (triggers.has('REENGAGEMENT')) result.reengagement = await enrollLapsedCustomers(now)
  return result
}
