import { z } from 'zod'
import { bigCommerceFetch } from './client'
import { findBigCommerceProductBySlug, getBigCommerceProducts, type BigCommerceProduct } from './catalog'
import { BIGCOMMERCE_BUNDLE_PRODUCT_IDS } from './product-map'

/**
 * Hands a storefront cart to BigCommerce: builds a BigCommerce cart from the
 * shopper's lines and returns BigCommerce's hosted checkout URL. Payment, tax,
 * shipping, order emails and the order itself all happen in BigCommerce.
 */

/** A cart line as the browser sends it. Prices are never sent; BigCommerce reprices. */
export const bigCommerceCheckoutRequestSchema = z.object({
  items: z
    .array(
      z.object({
        slug: z.string().min(1).max(200),
        /** Lets a product missing from the product map match BigCommerce by name. */
        name: z.string().min(1).max(200).optional(),
        quantity: z.number().int().min(1).max(99),
        bundleId: z.string().max(50).optional(),
        bundleGroupId: z.string().max(100).optional(),
      }),
    )
    .min(1)
    .max(100),
  /** The fundraiser referral cookie, if any. See the checkout route. */
  referralCode: z.string().min(1).max(100).optional(),
})

export type BigCommerceCheckoutLine = z.infer<typeof bigCommerceCheckoutRequestSchema>['items'][number]

export type BigCommerceLineItem = {
  product_id: number
  quantity: number
  option_selections?: Array<{ option_id: number; option_value: number | string }>
}

/** A cart BigCommerce cannot sell as-is. The message is safe to show the shopper. */
export class BigCommerceCartError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'BigCommerceCartError'
  }
}

/** What the required order-notes field gets when the shopper left no note. */
export const DEFAULT_BUNDLE_NOTE = 'No special requests'

const normalizeLabel = (value: string) => value.toLowerCase().replace(/[^a-z0-9]/g, '')

function requirePurchasable(product: BigCommerceProduct | null, what: string): BigCommerceProduct {
  if (!product) throw new BigCommerceCartError(`${what} is not sold online right now.`)
  if (!product.isPurchasable) throw new BigCommerceCartError(`${product.name} is out of stock.`)
  return product
}

function packLineItem(
  bundleId: string,
  jars: BigCommerceCheckoutLine[],
  products: BigCommerceProduct[],
): BigCommerceLineItem {
  const packProductId = BIGCOMMERCE_BUNDLE_PRODUCT_IDS[bundleId]
  const pack = requirePurchasable(
    products.find((product) => product.id === packProductId) ?? null,
    'That mix-and-match pack',
  )

  const slots = pack.modifiers.filter((modifier) => modifier.type === 'dropdown')
  // One slot per jar: a salsa picked twice fills two slots.
  const picked = jars.flatMap((jar) => Array.from({ length: jar.quantity }, () => jar))
  if (picked.length !== slots.length) {
    throw new BigCommerceCartError(`${pack.name} holds ${slots.length} jars, but ${picked.length} were chosen.`)
  }

  const selections: NonNullable<BigCommerceLineItem['option_selections']> = picked.map((jar, index) => {
    const salsa = findBigCommerceProductBySlug(products, jar.slug, jar.name)
    if (!salsa) throw new BigCommerceCartError(`One of the salsas in ${pack.name} is not sold online right now.`)
    const value = slots[index].values.find((choice) => normalizeLabel(choice.label) === normalizeLabel(salsa.name))
    if (!value) throw new BigCommerceCartError(`${salsa.name} is not available in ${pack.name}.`)
    return { option_id: slots[index].id, option_value: value.id }
  })

  for (const modifier of pack.modifiers) {
    if (modifier.type === 'text' && modifier.required) {
      selections.push({ option_id: modifier.id, option_value: DEFAULT_BUNDLE_NOTE })
    }
  }

  return { product_id: pack.id, quantity: 1, option_selections: selections }
}

/**
 * Translates storefront cart lines into BigCommerce line items. Loose jars of
 * the same salsa merge into one line; each pack instance becomes one pack
 * product with its jars chosen in the "Jar N" dropdowns.
 */
export function buildBigCommerceLineItems(
  lines: BigCommerceCheckoutLine[],
  products: BigCommerceProduct[],
): BigCommerceLineItem[] {
  const loose = new Map<number, BigCommerceLineItem>()
  const packs = new Map<string, { bundleId: string; jars: BigCommerceCheckoutLine[] }>()

  for (const line of lines) {
    if (line.bundleGroupId) {
      if (!line.bundleId) throw new BigCommerceCartError('A mix-and-match pack in your cart is incomplete.')
      const pack = packs.get(line.bundleGroupId) ?? { bundleId: line.bundleId, jars: [] }
      if (pack.bundleId !== line.bundleId) {
        throw new BigCommerceCartError('A mix-and-match pack in your cart is incomplete.')
      }
      pack.jars.push(line)
      packs.set(line.bundleGroupId, pack)
      continue
    }

    const product = requirePurchasable(findBigCommerceProductBySlug(products, line.slug, line.name), 'An item in your cart')
    const existing = loose.get(product.id)
    if (existing) existing.quantity += line.quantity
    else loose.set(product.id, { product_id: product.id, quantity: line.quantity })
  }

  return [
    ...loose.values(),
    ...Array.from(packs.values(), (pack) => packLineItem(pack.bundleId, pack.jars, products)),
  ]
}

/**
 * The BigCommerce channel carts are created in. Channel 1 is the existing
 * storefront, whose checkout lives on josemadridsalsa.com today; after the
 * domain moves to this site, point this at the headless channel whose checkout
 * domain is a subdomain.
 */
export function getBigCommerceChannelId(): number {
  const parsed = Number(process.env.BIGCOMMERCE_CHANNEL_ID)
  return Number.isInteger(parsed) && parsed > 0 ? parsed : 1
}

type CreateCartResponse = {
  data: { id: string; redirect_urls?: { checkout_url?: string } }
}

export async function createBigCommerceCheckout(
  lines: BigCommerceCheckoutLine[],
): Promise<{ cartId: string; checkoutUrl: string }> {
  const lineItems = buildBigCommerceLineItems(lines, await getBigCommerceProducts('main'))

  const res = await bigCommerceFetch<CreateCartResponse>('main', 'v3/carts', {
    method: 'POST',
    query: { include: 'redirect_urls' },
    body: { channel_id: getBigCommerceChannelId(), line_items: lineItems },
  })

  const checkoutUrl = res?.data?.redirect_urls?.checkout_url
  if (!res?.data?.id || !checkoutUrl) {
    throw new Error('BigCommerce created a cart without a checkout URL')
  }
  return { cartId: res.data.id, checkoutUrl }
}
