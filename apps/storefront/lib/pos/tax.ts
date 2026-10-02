/**
 * Sales tax for in-person POS sales, via the same Stripe Tax path as web checkout.
 *
 * A counter sale is taxed where it happens, so the store (shipping origin) address is
 * the tax address, and salsa uses the packaged-food code like every web checkout route.
 */
import { calculateTax } from '@/lib/tax-calculator'
import { describeMissingOrigin, getShippingOrigin } from '@/lib/shipping/origin'

const PACKAGED_FOOD_TAX_CODE = 'txcd_30011000'

export class PosTaxError extends Error {}

export async function quotePosTaxCents(
  items: Array<{ productId: string; unitPriceCents: number; quantity: number }>,
): Promise<number> {
  if (items.length === 0) return 0

  const resolution = await getShippingOrigin()
  if (!resolution.ok) throw new PosTaxError(describeMissingOrigin(resolution.missing))
  const { origin } = resolution

  const result = await calculateTax({
    lineItems: items.map((item) => ({
      amount: item.unitPriceCents * item.quantity,
      reference: item.productId,
      taxCode: PACKAGED_FOOD_TAX_CODE,
    })),
    shippingAddress: {
      line1: origin.street1,
      city: origin.city,
      state: origin.state,
      postalCode: origin.zip,
      country: origin.country,
    },
  })
  return result.taxAmount
}
