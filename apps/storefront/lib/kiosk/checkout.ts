/**
 * Kiosk sales: the tablet sends flavors and quantities, never prices. The server prices
 * the cart from the booth sign (lib/kiosk/pricing) and hands it to the shared Square
 * Terminal checkout. Kiosk sales carry no sales tax: Ohio exempts grocery food like salsa.
 */
import { z } from 'zod'
import prisma from '@/lib/prisma'
import { KIOSK_FLAVORS, matchKioskProducts } from '@/lib/kiosk/catalog'
import { JAR_PRICE_CENTS, dealLabel, quoteJars } from '@/lib/kiosk/pricing'
import { TerminalCheckoutError, createTerminalCheckout } from '@/lib/pos/terminal-checkout'

const MAX_JARS = 120

export const KioskCartSchema = z.object({
  items: z
    .array(
      z.object({
        key: z.string().min(1).max(64),
        quantity: z.number().int().min(1).max(MAX_JARS),
      })
    )
    .min(1, 'Cart is empty')
    .max(KIOSK_FLAVORS.length),
})

export type KioskCart = z.infer<typeof KioskCartSchema>

export async function loadKioskCatalog() {
  const products = await prisma.product.findMany({
    where: { isActive: true },
    select: { id: true, name: true, sku: true, barcode: true, inventory: true, isActive: true },
  })
  return matchKioskProducts(products)
}

export async function startKioskCheckout(cart: KioskCart) {
  const { items: catalog } = await loadKioskCatalog()

  const quantities = new Map<string, number>()
  for (const line of cart.items) {
    quantities.set(line.key, (quantities.get(line.key) ?? 0) + line.quantity)
  }

  const lines = [...quantities].map(([key, quantity]) => {
    const flavor = catalog.find((f) => f.key === key)
    if (!flavor) throw new TerminalCheckoutError(`Unknown salsa: ${key}`, 400)
    if (!flavor.productId) throw new TerminalCheckoutError(`${flavor.name} isn't available at this kiosk`, 409)
    return { flavor, quantity }
  })

  const jars = lines.reduce((sum, l) => sum + l.quantity, 0)
  if (jars > MAX_JARS) throw new TerminalCheckoutError('That is more jars than the kiosk can ring up', 400)

  const quote = quoteJars(jars)
  const notes = ['Self-order kiosk', dealLabel(quote.deals), quote.freeChips ? `${quote.freeChips} free bag(s) of chips` : '']

  const checkout = await createTerminalCheckout({
    items: lines.map(({ flavor, quantity }) => ({
      productId: flavor.productId as string,
      name: flavor.name,
      sku: flavor.sku ?? undefined,
      unitPriceCents: JAR_PRICE_CENTS,
      quantity,
    })),
    discountCents: quote.savingsCents,
    totalCents: quote.totalCents,
    orderPrefix: 'KIOSK',
    adminNotes: notes.filter(Boolean).join(' · '),
  })

  return { ...checkout, quote }
}
