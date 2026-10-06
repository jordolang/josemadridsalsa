import Image from 'next/image'
import Link from 'next/link'
import type { FundraisingProduct } from '@/lib/fundraising-site/catalog'
import { FundraisingAddToCart } from './add-to-cart'

export const formatPrice = (value: number) =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(value)

export function FundraisingProductCard({ product }: { product: FundraisingProduct }) {
  const image = product.images[0]
  return (
    <article className="flex flex-col overflow-hidden rounded-xl border border-border bg-card shadow-sm transition-shadow hover:shadow-md">
      <Link href={`/shop/${product.slug}`} className="relative block aspect-square bg-white">
        {image ? (
          <Image
            src={image.url}
            alt={image.alt}
            fill
            sizes="(min-width: 1024px) 25vw, (min-width: 640px) 33vw, 50vw"
            className="object-contain p-4"
          />
        ) : (
          <span className="flex h-full items-center justify-center text-sm text-muted-foreground">No photo</span>
        )}
      </Link>
      <div className="flex flex-1 flex-col gap-3 p-4">
        <h3 className="font-serif text-base font-bold leading-snug text-foreground">
          <Link href={`/shop/${product.slug}`} className="hover:text-salsa-600">
            {product.name}
          </Link>
        </h3>
        <p className="mt-auto text-lg font-bold text-salsa-600">{formatPrice(product.price)}</p>
        <FundraisingAddToCart
          available={product.isPurchasable}
          product={{
            productId: product.id,
            name: product.name,
            price: product.price,
            image: image?.thumbnailUrl ?? image?.url ?? null,
            slug: product.slug,
          }}
        />
      </div>
    </article>
  )
}
