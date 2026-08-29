import prisma from '@/lib/prisma'

import { fundraiserUnitPrice } from './pricing'
import { getReferralFromCode } from './referral-tracker.server'

/**
 * One fundraiser's store, resolved server-side.
 *
 * A fundraiser is a self-contained shop: its own catalogue, its own price per jar and its own
 * share of the proceeds. Everything a request needs to price and attribute a sale under that
 * shop is resolved here, from the fundraiser's slug and (optionally) a participant's referral
 * code — never from anything the browser sent, for the same reason shipping and discounts are
 * recomputed at checkout.
 *
 * The store used to be reachable only through a participant's referral link. A supporter who
 * came to the campaign page itself carried no code, so checkout priced their cart from the
 * retail catalogue and recorded the sale against nobody.
 */

/** Raised when a store cannot be resolved for a cart that says it is shopping in one. */
export class FundraiserStoreUnavailableError extends Error {
  constructor() {
    super('This fundraiser store is unavailable right now. Please try again.')
    this.name = 'FundraiserStoreUnavailableError'
  }
}

export interface FundraiserStore {
  fundraiserId: string
  slug: string
  name: string
  organizationName: string
  /** The group's share of merchandise, as a percentage. */
  commissionRate: number
  /** What this store charges per jar absent a per-product price. */
  defaultUnitPrice: number
  /** Per-product prices, keyed by product id. Absent products sell at `defaultUnitPrice`. */
  prices: Map<string, number>
  /**
   * The products this store sells, or null when the fundraiser has not curated a list and
   * therefore sells the whole active catalogue at its store price.
   */
  productIds: Set<string> | null
  /** Set only when the supporter arrived through a participant's link. */
  participantId?: string
  participantName?: string
  referralCode?: string
}

/** The fundraiser columns every store lookup needs. */
const storeSelect = {
  id: true,
  slug: true,
  name: true,
  organizationName: true,
  isActive: true,
  status: true,
  commissionRate: true,
  defaultUnitPrice: true,
} as const

type StoreRow = {
  id: string
  slug: string
  name: string
  organizationName: string
  isActive: boolean
  status: string
  commissionRate: unknown
  defaultUnitPrice: unknown
}

async function buildStore(
  fundraiser: StoreRow,
  participant?: { id: string; name: string; referralCode: string }
): Promise<FundraiserStore> {
  const rows = await prisma.fundraiserProduct.findMany({
    where: { fundraiserId: fundraiser.id, isActive: true },
    select: { productId: true, price: true },
  })

  const defaultUnitPrice = Number(fundraiser.defaultUnitPrice)

  return {
    fundraiserId: fundraiser.id,
    slug: fundraiser.slug,
    name: fundraiser.name,
    organizationName: fundraiser.organizationName,
    commissionRate: Number(fundraiser.commissionRate),
    defaultUnitPrice,
    prices: new Map(
      rows.map((row) => [row.productId, fundraiserUnitPrice(defaultUnitPrice, row.price)])
    ),
    // An empty catalogue is not an empty shop. A fundraiser that has not picked products
    // sells everything, at its store price — which is what the campaign page has always
    // shown, except that it used to warn the sale would not benefit the group.
    productIds: rows.length > 0 ? new Set(rows.map((row) => row.productId)) : null,
    ...(participant
      ? {
          participantId: participant.id,
          participantName: participant.name,
          referralCode: participant.referralCode,
        }
      : {}),
  }
}

/** Whether a campaign is open for business. Draft, ended and cancelled campaigns are not. */
function isOpen(fundraiser: { isActive: boolean; status: string }): boolean {
  return (
    fundraiser.isActive &&
    fundraiser.status !== 'ENDED' &&
    fundraiser.status !== 'CANCELLED'
  )
}

/**
 * The store a request is shopping in.
 *
 * A referral code identifies both the participant and their fundraiser, so it wins when
 * present and agrees with the slug. A slug on its own still opens the store — the sale is
 * credited to the group with no individual attached.
 *
 * Returns null when neither identifies an open campaign, which is a retail sale.
 */
export async function resolveFundraiserStore(input: {
  fundraiserSlug?: string | null
  referralCode?: string | null
}): Promise<FundraiserStore | null> {
  const { fundraiserSlug, referralCode } = input
  if (!fundraiserSlug && !referralCode) return null

  try {
    if (referralCode) {
      const referral = await getReferralFromCode(referralCode)
      if (referral) {
        const fundraiser = await prisma.fundraiser.findUnique({
          where: { id: referral.fundraiserId },
          select: storeSelect,
        })
        // A code naming a different campaign than the page the cart was filled on is not a
        // code for this sale. Fall through to the slug rather than crediting the wrong group.
        const matchesPage = !fundraiserSlug || fundraiser?.slug === fundraiserSlug
        if (fundraiser && isOpen(fundraiser) && matchesPage) {
          return await buildStore(fundraiser, {
            id: referral.participantId,
            name: referral.participantName,
            referralCode: referral.referralCode,
          })
        }
      }
    }

    if (fundraiserSlug) {
      const fundraiser = await prisma.fundraiser.findUnique({
        where: { slug: fundraiserSlug },
        select: storeSelect,
      })
      if (fundraiser && isOpen(fundraiser)) {
        return await buildStore(fundraiser)
      }
    }

    return null
  } catch (error) {
    // A failed lookup must not take checkout down, but it must not quietly turn a fundraiser
    // sale into a retail one either — the group would go uncredited with nothing recording it.
    console.error('[FundraiserStore] Could not resolve store:', error)
    throw new FundraiserStoreUnavailableError()
  }
}

/**
 * What each line costs in this store, keyed by product id.
 *
 * Products the store does not carry are reported rather than silently priced: a cart holding
 * one is a cart assembled against a catalogue that has since changed, and charging retail for
 * it is exactly the bug this module exists to close.
 */
export function priceInStore(
  store: FundraiserStore,
  productIds: string[]
): { prices: Map<string, number>; unavailable: string[] } {
  const prices = new Map<string, number>()
  const unavailable: string[] = []

  for (const productId of productIds) {
    if (store.productIds && !store.productIds.has(productId)) {
      unavailable.push(productId)
      continue
    }
    prices.set(productId, store.prices.get(productId) ?? store.defaultUnitPrice)
  }

  return { prices, unavailable }
}

/** A product as one fundraiser's store sells it. */
export interface FundraiserStoreProduct {
  id: string
  name: string
  slug: string
  description: string | null
  price: number
  featuredImage: string | null
  heatLevel: string
  sku: string
  inventory: number
}

/**
 * What this store has on its shelves, at its prices.
 *
 * A fundraiser that has curated a catalogue sells exactly that; one that has not sells the
 * whole active catalogue at its store price. Either way the price the supporter is quoted is
 * the price `priceInStore` will charge, because both read the same store.
 */
export async function loadFundraiserStoreProducts(
  store: FundraiserStore
): Promise<FundraiserStoreProduct[]> {
  const products = await prisma.product.findMany({
    where: store.productIds
      ? { id: { in: Array.from(store.productIds) }, isActive: true }
      : { isActive: true },
    orderBy: { name: 'asc' },
    select: {
      id: true,
      name: true,
      slug: true,
      description: true,
      featuredImage: true,
      heatLevel: true,
      sku: true,
      inventory: true,
    },
  })

  return products.map((product) => ({
    ...product,
    heatLevel: String(product.heatLevel),
    price: store.prices.get(product.id) ?? store.defaultUnitPrice,
  }))
}
