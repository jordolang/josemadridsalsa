import Image from 'next/image'
import { AddToCartButton } from '@/components/store/add-to-cart-button'
import { splitFundraiserProceeds } from '@/lib/fundraising/pricing'

/** One product as this fundraiser's store sells it: its price, not the retail one. */
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

export interface FundraiserStoreProps {
  /** Campaign slug. Travels onto every cart line so checkout prices the sale in this store. */
  slug: string
  name: string
  organizationName: string
  /** The group's share of merchandise, as a percentage. */
  commissionRate: number
  products: FundraiserStoreProduct[]
  /** Shown when the supporter arrived through a participant's link. */
  participantName?: string
  title?: string
  columns?: 2 | 3 | 4
  /** Extra line under the split, for a store with something of its own to say. */
  note?: string
  /** The campaign's colour, where it has one. Used for the price, not for text on white. */
  accentColor?: string
}

/**
 * A fundraiser's own storefront.
 *
 * Each campaign sells the same salsa at its own price and keeps its own share, so this is
 * deliberately not the retail `ProductGrid`: every line the customer adds is tagged with the
 * campaign, and checkout reprices and credits the whole cart through it. The campaign pages
 * used to link out to the retail product pages, which is how a jar quoted at ten dollars on
 * a school's page landed in the cart at nine and raised nothing for the school.
 */
export function FundraiserStore({
  slug,
  name,
  organizationName,
  commissionRate,
  products,
  participantName,
  title = 'Shop & Support',
  columns = 3,
  note,
  accentColor,
}: FundraiserStoreProps) {
  const gridCols =
    columns === 2
      ? 'sm:grid-cols-2'
      : columns === 4
        ? 'sm:grid-cols-2 lg:grid-cols-4'
        : 'sm:grid-cols-2 lg:grid-cols-3'

  if (products.length === 0) {
    return (
      <section id="products" className="rounded-xl border border-border bg-card p-8 text-center">
        <h2 className="mb-2 font-serif text-xl font-bold text-foreground">Products coming soon</h2>
        <p className="text-muted-foreground">
          We&apos;re setting up the salsa selection for {organizationName}.
        </p>
      </section>
    )
  }

  // Stated from the same numbers the money is credited with, on a single jar, so the promise
  // on the page and the split in `lib/fundraising/commission.ts` cannot drift apart.
  const example = products[0]
  const { toGroup } = splitFundraiserProceeds(example.price, commissionRate)

  return (
    <section id="products" className="space-y-6">
      <div className="text-center">
        <h2 className="font-serif text-2xl font-bold text-foreground sm:text-3xl">{title}</h2>
        <p className="mt-2 text-muted-foreground">
          Every jar is ${example.price.toFixed(2)} — ${toGroup.toFixed(2)} of it goes straight to{' '}
          {organizationName}. Shipping is charged at cost and pays only for getting your order
          to your door.
          {participantName ? ` Your order is credited to ${participantName}.` : ''}
        </p>
        {note && <p className="mt-2 text-sm font-medium text-foreground">{note}</p>}
      </div>

      <div className={`grid grid-cols-1 gap-6 ${gridCols}`}>
        {products.map((product) => (
          <div
            key={product.id}
            className="flex flex-col overflow-hidden rounded-xl border border-border bg-card shadow-sm"
          >
            <div className="relative aspect-square bg-muted">
              {product.featuredImage ? (
                <Image
                  src={product.featuredImage}
                  alt={product.name}
                  fill
                  sizes="(max-width: 640px) 100vw, 400px"
                  className="object-cover"
                />
              ) : (
                <div className="flex h-full items-center justify-center text-muted-foreground">
                  No image
                </div>
              )}
            </div>
            <div className="flex flex-1 flex-col gap-3 p-4">
              <div>
                <h3 className="font-semibold text-foreground">{product.name}</h3>
                {product.description && (
                  <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">
                    {product.description}
                  </p>
                )}
              </div>
              <div className="mt-auto flex items-center justify-between gap-3">
                <span
                  className="text-lg font-bold text-salsa-600"
                  style={accentColor ? { color: accentColor } : undefined}
                >
                  ${product.price.toFixed(2)}
                </span>
                <AddToCartButton product={product} store={{ slug, name }} />
              </div>
            </div>
          </div>
        ))}
      </div>
    </section>
  )
}
