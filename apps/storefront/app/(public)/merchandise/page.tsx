import { Metadata } from 'next'
import Image from 'next/image'
import Link from 'next/link'
import { ArrowRight } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { getMerchCatalog } from '@/lib/merchandise/catalog'
import { formatPriceRange } from '@/lib/merchandise/shared'
import { merchContactEmail, merchMediaShowcase } from '@/lib/merchandise/config'
import { createMetadata } from '@/lib/metadata'

export const revalidate = 300 // 5 minutes, matching the Printify catalog cache

export const metadata: Metadata = createMetadata({
  title: 'Merchandise - Jose Madrid Salsa',
  description:
    'Jose Madrid Salsa tour shirts, apparel and accessories, printed to order and shipped straight to your door.',
  pathname: '/merchandise',
})

export default async function MerchandisePage() {
  const catalog = await getMerchCatalog()
  const products = catalog.status === 'ok' ? catalog.products : []

  return (
    <main className="bg-background">
      <section className="relative overflow-hidden bg-gradient-to-br from-salsa-600 via-salsa-500 to-chile-500 py-16 text-white">
        <div className="container mx-auto px-4">
          <div className="max-w-3xl space-y-4">
            <p className="text-sm uppercase tracking-[0.3em] text-white/80">Official merchandise</p>
            <h1 className="font-serif text-4xl sm:text-5xl font-bold leading-tight">
              Wear the Jose Madrid heat everywhere
            </h1>
            <p className="text-lg text-white/90">
              Tour shirts, apparel and accessories, printed to order and shipped straight to your door.
            </p>
          </div>
        </div>
      </section>

      <section className="container mx-auto px-4 py-12 lg:py-16">
        {products.length > 0 ? (
          <ul className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {products.map((product) => {
              const image = product.images[0]
              return (
                <li key={product.id}>
                  <Link
                    href={`/merchandise/${product.id}`}
                    className="group flex h-full flex-col overflow-hidden rounded-2xl border border-border bg-card surface-shadow transition hover:-translate-y-1"
                  >
                    <div className="relative aspect-square w-full bg-muted">
                      {image ? (
                        <Image
                          src={image.src}
                          alt={product.title}
                          fill
                          className="object-cover transition group-hover:scale-[1.02]"
                          sizes="(min-width: 1280px) 25vw, (min-width: 1024px) 33vw, (min-width: 640px) 50vw, 100vw"
                        />
                      ) : null}
                    </div>
                    <div className="flex flex-1 flex-col gap-1 p-4">
                      <h2 className="font-semibold text-foreground">{product.title}</h2>
                      <p className="text-sm text-muted-foreground">{formatPriceRange(product)}</p>
                    </div>
                  </Link>
                </li>
              )
            })}
          </ul>
        ) : (
          <MerchComingSoon />
        )}
      </section>
    </main>
  )
}

function MerchComingSoon() {
  return (
    <div className="space-y-10">
      <div className="max-w-2xl space-y-3">
        <h2 className="font-serif text-3xl font-semibold text-foreground">New merch is on the way</h2>
        <p className="text-base text-muted-foreground">
          Our online merch shop is being restocked. Check back soon, or get in touch for team and fundraiser orders.
        </p>
        <Button asChild variant="outline" className="w-fit">
          <Link href={`mailto:${merchContactEmail}?subject=Jose%20Madrid%20Merch`}>
            Ask about merch
            <ArrowRight className="ml-2 h-4 w-4" />
          </Link>
        </Button>
      </div>
      <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {merchMediaShowcase.map((media) => (
          <figure
            key={media.id}
            className="flex flex-col overflow-hidden rounded-2xl border border-border bg-card surface-shadow"
          >
            <div className="relative aspect-[4/3] w-full bg-muted">
              <Image
                src={media.image}
                alt={media.title}
                fill
                className="object-cover"
                sizes="(min-width: 1024px) 33vw, (min-width: 640px) 50vw, 100vw"
              />
            </div>
            <figcaption className="space-y-1 px-4 pb-5 pt-3">
              <p className="text-sm font-semibold text-foreground">{media.title}</p>
              <p className="text-xs text-muted-foreground">{media.description}</p>
            </figcaption>
          </figure>
        ))}
      </div>
    </div>
  )
}
