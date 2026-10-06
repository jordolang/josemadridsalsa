import { z } from 'zod'
import { bigCommerceFetch } from '@/lib/bigcommerce/client'
import { getBigCommerceProducts, type BigCommerceProduct } from '@/lib/bigcommerce/catalog'
import { BigCommerceCartError, type BigCommerceLineItem } from '@/lib/bigcommerce/cart'
import {
  findGroupOption,
  getFundraisingCheckoutFields,
  type FundraisingCheckoutFields,
  type FundraisingGroupOption,
} from '@/lib/fundraising-site/checkout-fields'

/**
 * Hands a fundraising-site cart to the BigCommerce fundraising store's hosted
 * checkout. BigCommerce prices the order, charges shipping, takes payment and
 * sends the emails; this site only builds the cart and, where BigCommerce
 * accepts it, fills in the group and salesperson so the buyer need not pick
 * them twice.
 */

export const fundraisingCheckoutRequestSchema = z.object({
  items: z
    .array(
      z.object({
        productId: z.number().int().positive(),
        quantity: z.number().int().min(1).max(200),
      }),
    )
    .min(1)
    .max(50),
  group: z.string().trim().min(1).max(200),
  seller: z.string().trim().min(1).max(120),
})

export type FundraisingCheckoutRequest = z.infer<typeof fundraisingCheckoutRequestSchema>

/** The fundraising store has a single storefront channel. */
const FUNDRAISING_CHANNEL_ID = 1

/** Merges repeat lines and refuses anything the store is not selling right now. */
export function buildFundraisingLineItems(
  items: FundraisingCheckoutRequest['items'],
  products: BigCommerceProduct[],
): BigCommerceLineItem[] {
  const merged = new Map<number, BigCommerceLineItem>()
  for (const item of items) {
    const product = products.find((candidate) => candidate.id === item.productId)
    if (!product || !product.isPurchasable) {
      throw new BigCommerceCartError(`${product?.name ?? 'An item in your cart'} is not available right now.`)
    }
    const existing = merged.get(product.id)
    if (existing) existing.quantity += item.quantity
    else merged.set(product.id, { product_id: product.id, quantity: item.quantity })
  }
  return [...merged.values()]
}

export function requireGroup(fields: FundraisingCheckoutFields, name: string): FundraisingGroupOption {
  const group = findGroupOption(fields.groups, name)
  if (!group) {
    throw new BigCommerceCartError(
      `"${name}" is not taking online orders right now. Please choose your group from the list.`,
    )
  }
  return group
}

type CreateCartResponse = { data: { id: string; redirect_urls?: { checkout_url?: string } } }

/**
 * Pre-fills the checkout's group and salesperson answers. Best effort: the
 * buyer is asked for both at checkout anyway (they are required fields), so a
 * rejection here costs them a click, never a mis-credited sale.
 */
async function prefillAttribution(
  cartId: string,
  fields: FundraisingCheckoutFields,
  group: FundraisingGroupOption,
  seller: string,
): Promise<boolean> {
  const customFields = [
    { field_id: fields.groupFieldId, field_value: group.value },
    ...(fields.sellerFieldId ? [{ field_id: fields.sellerFieldId, field_value: seller }] : []),
  ]
  try {
    await bigCommerceFetch('fundraising', `v3/checkouts/${cartId}/billing-address`, {
      method: 'POST',
      body: { country_code: 'US', custom_fields: customFields },
    })
    return true
  } catch {
    return false
  }
}

export async function createFundraisingCheckout(
  request: FundraisingCheckoutRequest,
): Promise<{ cartId: string; checkoutUrl: string; prefilled: boolean }> {
  const [products, fields] = await Promise.all([
    getBigCommerceProducts('fundraising'),
    getFundraisingCheckoutFields(),
  ])
  const group = requireGroup(fields, request.group)
  const lineItems = buildFundraisingLineItems(request.items, products)

  const res = await bigCommerceFetch<CreateCartResponse>('fundraising', 'v3/carts', {
    method: 'POST',
    query: { include: 'redirect_urls' },
    body: { channel_id: FUNDRAISING_CHANNEL_ID, line_items: lineItems },
  })
  const cartId = res?.data?.id
  const checkoutUrl = res?.data?.redirect_urls?.checkout_url
  if (!cartId || !checkoutUrl) throw new Error('BigCommerce created a fundraising cart without a checkout URL')

  const prefilled = await prefillAttribution(cartId, fields, group, request.seller)
  return { cartId, checkoutUrl, prefilled }
}
