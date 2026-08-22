import type { Metadata } from 'next'
import Image from 'next/image'
import Link from 'next/link'
import { notFound } from 'next/navigation'

import { getBundleBySlug } from '@/lib/db/products'
import { allocateBundlePrices } from '@/lib/bundles'
import { AddBundleToCartButton } from '@/components/store/add-bundle-to-cart-button'

export const dynamic = 'force-dynamic'
export const revalidate = 0

interface PageProps {
  params: Promise<{ slug: string }>
}

const money = (value: number) =>
  `$${value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params
  // A genuinely missing bundle is null → "not found"; a DB/network error throws and surfaces as a
  // real 500 (not a fake 404), matching the page below so the two never disagree.
  const result = await getBundleBySlug(slug)
  if (!result) return { title: 'Bundle not found' }

  const { bundle } = result
  return {
    title: bundle.metaTitle || bundle.name,
    description: bundle.metaDescription || bundle.description || undefined,
    openGraph: bundle.ogImage ? { images: [bundle.ogImage] } : undefined,
  }
}

export default async function BundlePage({ params }: PageProps) {
  const { slug } = await params
  const result = await getBundleBySlug(slug)
  if (!result) notFound()

  const { bundle, components, available, retailTotal, savings } = result

  // Prorate the bundle price across components the same way checkout will, so the cart line and the
  // tax/shipping preview line up with the eventual (authoritative) server-side charge.
  const allocated = allocateBundlePrices(
    components.map((c) => ({ productId: c.product.id, basePrice: c.product.price, quantity: c.quantity })),
    bundle.price,
    1
  )
  const cartComponents = allocated.map((a) => ({
    productId: a.productId,
    quantity: components.find((c) => c.product.id === a.productId)!.quantity,
    unitPrice: a.unitPrice,
  }))

  // Most bundles buildable from current stock — the tightest component wins.
  const maxBundles = available
    ? Math.min(...components.map((c) => Math.floor(c.product.inventory / c.quantity)))
    : 0

  return (
    <div className="container mx-auto px-4 py-10">
      <div className="grid gap-10 lg:grid-cols-[1fr_1.3fr]">
        {bundle.image && (
          <div className="relative aspect-square overflow-hidden rounded-lg border bg-card">
            <Image
              src={bundle.image}
              alt={bundle.name}
              fill
              unoptimized
              className="object-cover"
              sizes="(max-width: 1024px) 100vw, 40vw"
            />
          </div>
        )}

        <div className={bundle.image ? '' : 'lg:col-span-2 max-w-2xl'}>
          <h1 className="text-3xl font-bold tracking-tight text-foreground">{bundle.name}</h1>
          {bundle.description && (
            <p className="mt-2 text-muted-foreground">{bundle.description}</p>
          )}

          <div className="mt-4 flex items-baseline gap-3">
            <span className="text-3xl font-bold text-salsa-600">{money(bundle.price)}</span>
            {savings > 0 && (
              <>
                <span className="text-lg text-muted-foreground line-through">{money(retailTotal)}</span>
                <span className="rounded bg-salsa-100 px-2 py-0.5 text-sm font-medium text-salsa-700">
                  Save {money(savings)}
                </span>
              </>
            )}
          </div>

          <div className="mt-6">
            <h2 className="mb-3 text-sm font-medium uppercase tracking-wide text-muted-foreground">
              What&apos;s inside
            </h2>
            <ul className="divide-y rounded-lg border">
              {components.map(({ product, quantity }) => (
                <li key={product.id} className="flex items-center gap-3 p-3">
                  <div className="relative h-12 w-12 shrink-0 overflow-hidden rounded bg-muted">
                    {product.featuredImage && (
                      <Image
                        src={product.featuredImage}
                        alt={product.name}
                        fill
                        unoptimized
                        className="object-cover"
                        sizes="48px"
                      />
                    )}
                  </div>
                  <div className="flex-1">
                    <Link href={`/products/${product.slug}`} className="font-medium hover:underline">
                      {product.name}
                    </Link>
                    {!product.isActive && (
                      <span className="ml-2 text-xs text-destructive">(unavailable)</span>
                    )}
                  </div>
                  <span className="text-sm text-muted-foreground">×{quantity}</span>
                </li>
              ))}
            </ul>
          </div>

          <div className="mt-6">
            <AddBundleToCartButton
              bundle={{
                id: bundle.id,
                name: bundle.name,
                slug: bundle.slug,
                price: bundle.price,
                image: bundle.image,
              }}
              components={cartComponents}
              maxBundles={maxBundles}
              available={available}
            />
            {available && maxBundles <= 0 && (
              <p className="mt-2 text-sm text-muted-foreground">
                This bundle is temporarily out of stock.
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
