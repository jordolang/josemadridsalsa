import Link from 'next/link'
import { prisma } from '@/lib/prisma'
import { parseMetaCheckoutParams } from '@/lib/social/meta-checkout'
import { MetaCheckoutBootstrap } from '@/components/checkout/MetaCheckoutBootstrap'
import type { CartItem } from '@/lib/store/cart'

/**
 * Meta Commerce Manager checkout-URL landing page.
 *
 * Meta redirects Facebook/Instagram Shop buyers here as configured in
 * Commerce Manager's "Build checkout URL" step:
 *
 *   /checkout/start?products=<contentId>:<qty>,<contentId>:<qty>&coupon=<CODE>
 *
 * Our catalog feed emits each product's SKU as its content id, so refs are
 * normally SKUs; we resolve against SKU / id / slug to stay robust. Resolved
 * items hydrate the cart client-side, then the buyer is forwarded to the
 * normal `/checkout` flow.
 */

interface MetaCheckoutStartPageProps {
  searchParams: Promise<{ products?: string; coupon?: string }>
}

export const dynamic = 'force-dynamic'

export default async function MetaCheckoutStartPage({
  searchParams,
}: MetaCheckoutStartPageProps) {
  const { products, coupon } = await searchParams
  const parsed = parseMetaCheckoutParams(products, coupon)

  const refs = parsed.items.map((item) => item.ref)

  const matches =
    refs.length > 0
      ? await prisma.product.findMany({
          where: {
            isActive: true,
            OR: [{ sku: { in: refs } }, { id: { in: refs } }, { slug: { in: refs } }],
          },
        })
      : []

  // Index matches by every identifier so a ref can resolve by SKU, id, or slug.
  const productByRef = new Map<string, (typeof matches)[number]>()
  for (const product of matches) {
    productByRef.set(product.sku, product)
    productByRef.set(product.id, product)
    productByRef.set(product.slug, product)
  }

  const resolvedItems: CartItem[] = []
  const unresolvedRefs: string[] = []

  for (const item of parsed.items) {
    const product = productByRef.get(item.ref)
    if (!product) {
      unresolvedRefs.push(item.ref)
      continue
    }

    resolvedItems.push({
      id: product.id,
      name: product.name,
      slug: product.slug,
      price: Number(product.price),
      image: product.featuredImage || '/images/placeholder-salsa.jpg',
      sku: product.sku,
      heatLevel: product.heatLevel,
      quantity: Math.min(item.quantity, product.inventory > 0 ? product.inventory : item.quantity),
      maxQuantity: product.inventory,
    })
  }

  if (resolvedItems.length === 0) {
    return (
      <div className="container mx-auto px-4 py-16">
        <div className="max-w-xl mx-auto text-center">
          <h1 className="text-2xl font-bold mb-3">We couldn&apos;t load your cart</h1>
          <p className="text-muted-foreground mb-8">
            The items from your Facebook/Instagram Shop link are no longer available.
            Browse our salsas and add them to your cart directly.
          </p>
          <Link
            href="/products"
            className="inline-flex items-center justify-center rounded-md bg-primary px-6 py-3 text-primary-foreground font-medium"
          >
            Shop all salsas
          </Link>
        </div>
      </div>
    )
  }

  return (
    <MetaCheckoutBootstrap
      items={resolvedItems}
      coupon={parsed.coupon}
      unresolvedCount={unresolvedRefs.length}
    />
  )
}
