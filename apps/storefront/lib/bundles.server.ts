import { Prisma } from '@prisma/client'

import prisma from '@/lib/prisma'
import { allocateBundlePrices } from '@/lib/bundles'

/**
 * Server-side resolution of the bundles in a checkout, kept in one place so the three online
 * checkout routes stay identical. The client sends only `{ bundleId, quantity }`: the server loads
 * the bundle definition, expands it into component order lines, and prorates the bundle's price
 * across them via {@link allocateBundlePrices}. Nothing about the price comes from the client — the
 * same anti-tamper posture as the fundraiser price overrides and the server-side shipping recompute.
 */
export interface BundleSelection {
  bundleId: string
  quantity: number
}

/** An order line ready to spread into `prisma.order.create({ data: { items: { create } } })`. */
export interface BundleOrderItem {
  productId: string
  quantity: number
  unitPrice: Prisma.Decimal
  unitCost?: Prisma.Decimal
  totalPrice: Prisma.Decimal
  productName: string
  productSku: string
  productImage?: string
  bundleId: string
  bundleName: string
}

export interface ResolvedBundles {
  /** Component order lines across all selected bundles, tagged with their bundle. */
  orderItems: BundleOrderItem[]
  /** What to reserve: one entry per component product with its total unit count. */
  reservations: Array<{ productId: string; quantity: number }>
  /** The bundle portion of the order subtotal, in dollars (exact sum of the line totals). */
  subtotal: number
}

/** A 400-worthy problem with the submitted bundles (missing, inactive, empty, unavailable product). */
export class BundleCheckoutError extends Error {
  status = 400
  constructor(message: string) {
    super(message)
    this.name = 'BundleCheckoutError'
  }
}

const toDecimal = (value: number) => new Prisma.Decimal(value.toFixed(2))

/**
 * Resolve the submitted bundle selections into order lines, reservations, and a subtotal. Repeated
 * selections of the same bundle are summed. Throws {@link BundleCheckoutError} when a bundle is
 * missing/inactive, has no products, or contains an inactive product — so checkout fails cleanly
 * rather than charging a wrong or partial bundle.
 */
export async function resolveBundleSelections(
  selections: BundleSelection[] | undefined
): Promise<ResolvedBundles> {
  if (!selections || selections.length === 0) {
    return { orderItems: [], reservations: [], subtotal: 0 }
  }

  // Sum quantities for repeated selections of the same bundle.
  const quantityByBundle = new Map<string, number>()
  for (const s of selections) {
    quantityByBundle.set(s.bundleId, (quantityByBundle.get(s.bundleId) ?? 0) + s.quantity)
  }

  const bundles = await prisma.bundle.findMany({
    where: { id: { in: [...quantityByBundle.keys()] }, isActive: true },
    include: {
      products: {
        orderBy: { sortOrder: 'asc' },
        include: { product: true },
      },
    },
  })
  const bundleMap = new Map(bundles.map((b) => [b.id, b]))

  const orderItems: BundleOrderItem[] = []
  const reservations: Array<{ productId: string; quantity: number }> = []
  let subtotal = 0

  for (const [bundleId, quantity] of quantityByBundle) {
    const bundle = bundleMap.get(bundleId)
    if (!bundle) throw new BundleCheckoutError('One or more bundles could not be found.')
    if (bundle.products.length === 0) {
      throw new BundleCheckoutError(`The "${bundle.name}" bundle is not available right now.`)
    }
    for (const bp of bundle.products) {
      if (!bp.product.isActive) {
        throw new BundleCheckoutError(`A product in the "${bundle.name}" bundle is no longer available.`)
      }
    }

    const componentByProduct = new Map(bundle.products.map((bp) => [bp.productId, bp]))
    const allocated = allocateBundlePrices(
      bundle.products.map((bp) => ({
        productId: bp.productId,
        basePrice: Number(bp.product.price),
        quantity: bp.quantity,
      })),
      Number(bundle.price),
      quantity
    )

    for (const line of allocated) {
      const product = componentByProduct.get(line.productId)!.product
      orderItems.push({
        productId: line.productId,
        quantity: line.quantity,
        unitPrice: toDecimal(line.unitPrice),
        // Snapshot cost like a normal line — null stays null, never zero.
        unitCost: product.costPrice ?? undefined,
        totalPrice: toDecimal(line.totalPrice),
        productName: product.name,
        productSku: product.sku,
        productImage: product.featuredImage ?? undefined,
        bundleId: bundle.id,
        bundleName: bundle.name,
      })
      reservations.push({ productId: line.productId, quantity: line.quantity })
      subtotal += line.totalPrice
    }
  }

  return { orderItems, reservations, subtotal: Math.round(subtotal * 100) / 100 }
}
