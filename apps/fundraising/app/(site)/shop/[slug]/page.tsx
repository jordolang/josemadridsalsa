import type { Metadata } from 'next'
import Image from 'next/image'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { ChevronLeft } from 'lucide-react'
import { FundraisingAddToCart } from '@/components/fundraising-site/add-to-cart'
import { formatPrice } from '@/components/fundraising-site/product-card'
import { getFundraisingProductBySlug, getFundraisingProducts } from '@/lib/fundraising-site/catalog'
import { sanitizeCmsHtml } from '@/lib/cms/sanitize'

export const revalidate = 300

type Params = { slug: string }

export async function generateStaticParams(): Promise<Params[]> {
  const products = await getFundraisingProducts().catch(() => [])
  return products.map((product) => ({ slug: product.slug }))
}

export async function generateMetadata({ params }: { params: Promise<Params> }): Promise<Metadata> {
  const { slug } = await params
  const product = await getFundraisingProductBySlug(slug).catch(() => null)
  if (!product) return {}
  return {
    title: product.seoTitle || product.name,
    description:
      product.seoDescription ||
      `${product.name} from Jose Madrid Salsa — $10 a jar, with $5 going to the fundraising group you support.`,
    alternates: { canonical: `/shop/${product.slug}` },
    openGraph: product.images[0] ? { images: [{ url: product.images[0].zoomUrl }] } : undefined,
  }
}

export default async function FundraisingProductPage({ params }: { params: Promise<Params> }) {
  const { slug } = await params
  const product = await getFundraisingProductBySlug(slug)
  if (!product) notFound()

  const [primary, ...rest] = product.images

  return (
    <div className="container mx-auto px-4 py-8">
      <Link href="/shop" className="mb-6 inline-flex items-center text-sm text-muted-foreground hover:text-foreground">
        <ChevronLeft className="mr-1 h-4 w-4" aria-hidden />
        All flavors
      </Link>

      <div className="grid gap-10 lg:grid-cols-2">
        <div>
          <div className="relative aspect-square overflow-hidden rounded-xl border border-border bg-white">
            {primary ? (
              <Image
                src={primary.zoomUrl}
                alt={primary.alt}
                fill
                priority
                sizes="(min-width: 1024px) 50vw, 100vw"
                className="object-contain p-6"
              />
            ) : null}
          </div>
          {rest.length > 0 && (
            <ul className="mt-4 grid grid-cols-4 gap-3">
              {rest.map((image) => (
                <li key={image.url} className="relative aspect-square overflow-hidden rounded-lg border border-border bg-white">
                  <Image src={image.url} alt={image.alt} fill sizes="25vw" className="object-contain p-2" />
                </li>
              ))}
            </ul>
          )}
        </div>

        <div>
          <h1 className="mb-3 font-serif text-3xl font-bold text-foreground lg:text-4xl">{product.name}</h1>
          <p className="mb-2 text-2xl font-bold text-salsa-600">{formatPrice(product.price)}</p>
          <p className="mb-6 text-sm text-muted-foreground">$5 of every jar goes to the group you choose in your cart.</p>
          <div className="mb-8 max-w-md">
            <FundraisingAddToCart
              withQuantity
              available={product.isPurchasable}
              product={{
                productId: product.id,
                name: product.name,
                price: product.price,
                image: primary?.thumbnailUrl ?? primary?.url ?? null,
                slug: product.slug,
              }}
            />
          </div>
          <div
            className="prose prose-neutral max-w-none dark:prose-invert"
            dangerouslySetInnerHTML={{ __html: sanitizeCmsHtml(product.descriptionHtml) }}
          />
        </div>
      </div>
    </div>
  )
}
