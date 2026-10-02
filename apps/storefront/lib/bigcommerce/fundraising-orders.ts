import { Prisma, type OrderStatus, type PaymentStatus } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { slugify } from '@/lib/collections'
import { normalizeGroupName } from '@/lib/fundraising-site/checkout-fields'
import { applyPurchaseDamage } from '@/lib/arena/damage'

/**
 * Crediting BigCommerce fundraising-store orders to their groups.
 *
 * The fundraising store (josemadridsalsafundraising.com) has no notion of a
 * campaign: every buyer answers two custom checkout questions — which group
 * they are supporting, and who sold to them — and those answers are the only
 * attribution a sale has. The order mirror turns the group answer into a
 * `Fundraiser` row here, one per distinct group name, so campaign totals can
 * be read on this site the same way as a native campaign's.
 *
 * Those fundraisers are records, not stores: they are created inactive and
 * already closed, with both coordinator emails marked sent, so no lifecycle
 * sweep, launch announcement or closing summary ever fires for them.
 */

/** The fundraising store's inbox, the contact until a real coordinator is known. */
export const BIGCOMMERCE_FUNDRAISER_CONTACT_EMAIL = 'fundraising@josemadridsalsa.com'

type FormField = { name?: unknown; value?: unknown }
type WithFormFields = { form_fields?: FormField[] | null } | null | undefined

// The labels have been reworded over the years: "Fundraiser Group", "Fundraiser Group ",
// "Fundraising Group name ", and "Sales Person" / "Salesperson".
const GROUP_FIELD = /fundrais\w*\s+group/i
const SELLER_FIELD = /sales\s*person/i

function fieldValue(addresses: WithFormFields[], label: RegExp): string | null {
  for (const address of addresses) {
    for (const field of address?.form_fields ?? []) {
      if (typeof field?.name !== 'string' || !label.test(field.name.trim())) continue
      const raw = Array.isArray(field.value) ? field.value.join(', ') : field.value
      const value = typeof raw === 'string' || typeof raw === 'number' ? String(raw).trim() : ''
      if (value) return value
    }
  }
  return null
}

export type FundraisingAttribution = { group: string | null; seller: string | null }

/**
 * The group and salesperson a buyer named at checkout. Read from the billing
 * address first, then any shipping address — BigCommerce has stored the
 * answers on either over the years.
 */
export function extractFundraisingAttribution(
  billing: WithFormFields,
  shipping: WithFormFields[] = [],
): FundraisingAttribution {
  const addresses = [billing, ...shipping]
  return { group: fieldValue(addresses, GROUP_FIELD), seller: fieldValue(addresses, SELLER_FIELD) }
}

function isUniqueViolation(error: unknown): boolean {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002'
}

async function availableSlug(label: string): Promise<string> {
  const base = slugify(label) || 'fundraiser'
  const taken = new Set(
    (await prisma.fundraiser.findMany({ where: { slug: { startsWith: base } }, select: { slug: true } })).map(
      (row) => row.slug,
    ),
  )
  if (!taken.has(base)) return base
  for (let n = 2; ; n++) {
    const candidate = `${base}-${n}`
    if (!taken.has(candidate)) return candidate
  }
}

export type BigCommerceFundraiserRef = { id: string; commissionRate: number; created: boolean }

/**
 * The fundraiser for a fundraising-store group, created the first time the
 * group is seen. Keyed on the normalized group name, so "Harper Creek band
 * Boosters" and "Harper Creek Band Boosters " are one campaign while
 * "Theta Phi Alpha" and "Theta Phi Alpha 2023" stay two. The campaign's
 * dates stretch to cover every order credited to it.
 */
export async function ensureBigCommerceFundraiser(
  groupLabel: string,
  orderDate: Date,
): Promise<BigCommerceFundraiserRef> {
  const key = normalizeGroupName(groupLabel)
  const select = { id: true, commissionRate: true, startDate: true, endDate: true } as const

  for (let attempt = 0; ; attempt++) {
    const existing = await prisma.fundraiser.findUnique({ where: { bigCommerceGroup: key }, select })
    if (existing) {
      // Conditional writes, so two orders mirrored at once can only ever widen the range.
      if (orderDate < existing.startDate) {
        await prisma.fundraiser.updateMany({
          where: { id: existing.id, startDate: { gt: orderDate } },
          data: { startDate: orderDate },
        })
      }
      if (orderDate > existing.endDate) {
        await prisma.fundraiser.updateMany({
          where: { id: existing.id, endDate: { lt: orderDate } },
          data: { endDate: orderDate },
        })
      }
      return { id: existing.id, commissionRate: Number(existing.commissionRate), created: false }
    }

    const name = groupLabel.replace(/\s+/g, ' ').trim()
    const now = new Date()
    try {
      const created = await prisma.fundraiser.create({
        data: {
          name,
          organizationName: name,
          slug: await availableSlug(name),
          bigCommerceGroup: key,
          contactEmail: BIGCOMMERCE_FUNDRAISER_CONTACT_EMAIL,
          startDate: orderDate,
          endDate: orderDate,
          commissionRate: 50,
          defaultUnitPrice: 10,
          // A record of a campaign run on the BigCommerce store, not a store of its own here:
          // inactive so it is never listed or sold from, ENDED so the lifecycle sweep never
          // announces or closes it, and both coordinator emails marked sent so neither can go.
          isActive: false,
          status: 'ENDED',
          launchEmailSentAt: now,
          summaryEmailSentAt: now,
          description: 'Tracked from the BigCommerce fundraising store.',
        },
        select: { id: true, commissionRate: true },
      })
      return { id: created.id, commissionRate: Number(created.commissionRate), created: true }
    } catch (error) {
      // A webhook and the sweep can meet the same new group at once, or two groups can want
      // the same slug; the loser looks again.
      if (!isUniqueViolation(error) || attempt >= 2) throw error
    }
  }
}

const COUNTED_PAYMENT: PaymentStatus[] = ['PAID', 'PARTIALLY_REFUNDED']
const UNCOUNTED_STATUS: OrderStatus[] = ['CANCELLED', 'REFUNDED']

/** Whether a paid order counts toward its campaign: paid, and not since cancelled or refunded. */
export function countsTowardCampaign(status: OrderStatus, paymentStatus: PaymentStatus): boolean {
  return COUNTED_PAYMENT.includes(paymentStatus) && !UNCOUNTED_STATUS.includes(status)
}

/**
 * Rewrites a fundraiser's rollups from its orders. Revenue is the full order
 * value and commission the recorded group share, matching what
 * `creditFundraiserCommission` accumulates for a native campaign.
 */
export async function recomputeFundraiserTotals(fundraiserId: string): Promise<void> {
  const totals = await prisma.order.aggregate({
    where: { fundraiserId, paymentStatus: { in: COUNTED_PAYMENT }, status: { notIn: UNCOUNTED_STATUS } },
    _count: { _all: true },
    _sum: { total: true, fundraiserCommission: true },
  })
  await prisma.fundraiser.update({
    where: { id: fundraiserId },
    data: {
      totalOrders: totals._count._all,
      totalRevenue: totals._sum.total ?? new Prisma.Decimal(0),
      totalCommission: totals._sum.fundraiserCommission ?? new Prisma.Decimal(0),
    },
  })
}

export type BigCommerceArenaSale = {
  /** This site's copy of the order; `applyPurchaseDamage`'s idempotency key. */
  orderId: string
  fundraiserId: string
  orderDate: Date
  /** Merchandise less discounts, the same base commission is taken from. */
  saleAmount: number
  donorEmail: string | null
}

/**
 * Battle-arena damage for a counted fundraising-store order, when its group is an arena team.
 * Callers pass only orders `countsTowardCampaign` accepts.
 *
 * Replay-safe the same way `payment.completed` is: the order id lands in the unique
 * `FundraiserSaleEvent.orderId`, so the hourly sweep and re-delivered webhooks strike once.
 * Orders placed before the team existed (a history backfill) never strike. A failure is logged,
 * not thrown — the copy is already saved, and the next sweep of the order tries again.
 */
export async function dealBigCommerceArenaDamage(sale: BigCommerceArenaSale): Promise<void> {
  if (sale.saleAmount <= 0) return
  const team = await prisma.fundraiserTeam.findUnique({
    where: { fundraiserId: sale.fundraiserId },
    select: { id: true, status: true, createdAt: true },
  })
  if (!team || team.status !== 'ACTIVE' || sale.orderDate < team.createdAt) {
    if (team) console.info('[bigcommerce] fundraising order not dealt arena damage', { orderId: sale.orderId, teamId: team.id })
    return
  }
  try {
    await applyPurchaseDamage({
      sellingTeamId: team.id,
      saleAmount: sale.saleAmount,
      orderId: sale.orderId,
      donor: { email: sale.donorEmail },
    })
  } catch (error) {
    console.error('[bigcommerce] arena damage failed for fundraising order', { orderId: sale.orderId, error })
  }
}
