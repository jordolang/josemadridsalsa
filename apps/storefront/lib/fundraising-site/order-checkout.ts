import 'server-only'
import { bigCommerceFetch } from '@/lib/bigcommerce/client'
import { requireGroup } from './checkout'
import { getFundraisingCheckoutFields } from './checkout-fields'
import { DUE_PER_JAR, type OrderSubmission } from './order-submission'

/**
 * Card payment for a /submit final order, through the fundraising store's own
 * hosted checkout (the same one online supporters use). The cart holds the
 * order's jars at the group's price — DUE_PER_JAR, not the $10 retail price —
 * so BigCommerce charges exactly what the group owes plus the store's own
 * shipping, takes the card, and records the order against the group.
 */

/** Kit flavor id → fundraising store product id (josemadridsalsafundraising.com catalog). */
export const FUNDRAISING_PRODUCT_IDS: Record<string, number> = {
  'original-mild': 112,
  'clovis-medium': 113,
  'original-hot': 114,
  'original-x-hot': 115,
  'ghost-of-clovis': 116,
  raspberry: 117,
  peach: 118,
  pineapple: 119,
  mango: 120,
  cherry: 121,
  'cherry-chocolate': 122,
  'mango-habanero': 123,
  'roasted-pineapple-habanero': 124,
  'raspberry-bbq-chipotle': 125,
  'garden-fresh-cilantro-mild': 126,
  'garden-fresh-cilantro-hot': 127,
  'black-bean-corn-poblano': 128,
  'roasted-garlic-olives': 129,
  'chipotle-con-queso': 130,
  'chipotle-hot': 131,
  'jamaican-jerk': 132,
  strawberry: 133,
  'spanish-verde-mild': 134,
  'spanish-verde-hot': 135,
  'spanish-verde-xx-hot': 136,
}

const FUNDRAISING_CHANNEL_ID = 1

type CartResponse = {
  data: {
    id: string
    redirect_urls?: { checkout_url?: string }
    line_items?: { physical_items?: Array<{ id: string; quantity: number }> }
  }
}
type ConsignmentResponse = {
  data: { consignments?: Array<{ id: string; available_shipping_options?: Array<{ id: string }> }> }
}
type CheckoutResponse = { data: { grand_total?: number } }

function splitName(name: string): { first_name: string; last_name: string } {
  const [first, ...rest] = name.trim().split(/\s+/)
  return { first_name: first, last_name: rest.join(' ') || first }
}

/** The shared address both prefills use. BigCommerce wants the 2-letter code for US states. */
function addressOf(order: OrderSubmission, name: string) {
  const state = order.shipState.trim()
  return {
    ...splitName(name),
    email: order.email.toLowerCase(),
    company: order.organizationName,
    phone: order.phone,
    address1: order.shipStreet,
    city: order.shipCity,
    ...(/^[a-z]{2}$/i.test(state) ? { state_or_province_code: state.toUpperCase() } : { state_or_province: state }),
    postal_code: order.shipZip,
    country_code: 'US',
  }
}

/** Swallows a prefill failure: the buyer can still type it at checkout. */
async function attempt<T>(label: string, run: () => Promise<T>): Promise<T | null> {
  try {
    return await run()
  } catch (error) {
    console.warn(`[fundraising-order-checkout] ${label} failed`, error instanceof Error ? error.message : error)
    return null
  }
}

export async function createOrderPaymentCheckout(
  order: OrderSubmission,
  reference: string | null,
): Promise<{ checkoutUrl: string; amountDue: number | null }> {
  const fields = await getFundraisingCheckoutFields()
  const group = requireGroup(fields, order.group ?? '')

  const lineItems = Object.entries(order.quantities)
    .filter(([, quantity]) => quantity > 0)
    .map(([flavorId, quantity]) => {
      const productId = FUNDRAISING_PRODUCT_IDS[flavorId]
      if (!productId) throw new Error(`No fundraising store product for flavor "${flavorId}"`)
      return { product_id: productId, quantity, list_price: DUE_PER_JAR }
    })

  const cart = await bigCommerceFetch<CartResponse>('fundraising', 'v3/carts', {
    method: 'POST',
    query: { include: 'redirect_urls' },
    body: { channel_id: FUNDRAISING_CHANNEL_ID, line_items: lineItems },
  })
  const cartId = cart?.data?.id
  const checkoutUrl = cart?.data?.redirect_urls?.checkout_url
  if (!cartId || !checkoutUrl) throw new Error('BigCommerce created a fundraising cart without a checkout URL')

  const customFields = [
    { field_id: fields.groupFieldId, field_value: group.value },
    ...(fields.sellerFieldId ? [{ field_id: fields.sellerFieldId, field_value: `Order form – ${order.contactName}` }] : []),
  ]
  const billed = await attempt('billing address', () =>
    bigCommerceFetch('fundraising', `v3/checkouts/${cartId}/billing-address`, {
      method: 'POST',
      body: { ...addressOf(order, order.contactName), custom_fields: customFields },
    }),
  )
  if (!billed) {
    // Same fallback as the online cart: at least credit the group.
    await attempt('billing attribution', () =>
      bigCommerceFetch('fundraising', `v3/checkouts/${cartId}/billing-address`, {
        method: 'POST',
        body: { country_code: 'US', email: order.email.toLowerCase(), custom_fields: customFields },
      }),
    )
  }

  const items = cart.data.line_items?.physical_items ?? []
  const consignment = await attempt('shipping address', () =>
    bigCommerceFetch<ConsignmentResponse>('fundraising', `v3/checkouts/${cartId}/consignments`, {
      method: 'POST',
      query: { include: 'consignments.available_shipping_options' },
      body: [
        {
          address: addressOf(order, order.shipName),
          line_items: items.map((item) => ({ item_id: item.id, quantity: item.quantity })),
        },
      ],
    }),
  )
  const shipping = consignment?.data?.consignments?.[0]
  const option = shipping?.available_shipping_options?.[0]
  if (shipping && option) {
    await attempt('shipping option', () =>
      bigCommerceFetch('fundraising', `v3/checkouts/${cartId}/consignments/${shipping.id}`, {
        method: 'PUT',
        body: { shipping_option_id: option.id },
      }),
    )
  }

  await attempt('order note', () =>
    bigCommerceFetch('fundraising', `v3/checkouts/${cartId}`, {
      method: 'PUT',
      body: {
        customer_message: `Community fundraiser final order${reference ? ` ${reference}` : ''} from /submit — the same order as the submission email; fill it once.`,
      },
    }),
  )

  const checkout = await attempt('checkout total', () =>
    bigCommerceFetch<CheckoutResponse>('fundraising', `v3/checkouts/${cartId}`),
  )
  return { checkoutUrl, amountDue: checkout?.data?.grand_total ?? null }
}
