import { Metadata } from 'next'
import Image from 'next/image'
import Link from 'next/link'
import { ArrowRight, CheckCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  merchCollections,
  merchHighlightIconMap,
  merchHighlights,
  merchSetupSteps,
  fulfillmentContact,
  merchMediaShowcase,
} from '@/lib/merchandise/config'
import { createMetadata } from '@/lib/metadata'

export const metadata: Metadata = createMetadata({
  title: 'Merchandise - Jose Madrid Salsa',
  description:
    'Represent Jose Madrid Salsa with premium apparel and accessories delivered straight from our print partner.',
  pathname: '/merchandise',
})

export default function MerchandisePage() {
  return (
    <main className="bg-background">
      <section className="relative overflow-hidden bg-gradient-to-br from-salsa-600 via-salsa-500 to-chile-500 py-20 text-white">
        <div className="container mx-auto px-4">
          <div className="max-w-3xl space-y-6">
            <p className="text-sm uppercase tracking-[0.3em] text-white/80">Official merchandise</p>
            <h1 className="font-serif text-4xl sm:text-5xl font-bold leading-tight">
              Merch that keeps the Jose Madrid heat with you everywhere
            </h1>
            <p className="text-lg text-white/90">
              We partner with {fulfillmentContact.partnerName} to print on demand, fulfil orders, and ship directly to your customers.
              Launch ready-made collections or design custom runs for fundraising and retail partners.
            </p>
            <div className="flex flex-col sm:flex-row gap-3">
              <Button
                asChild
                className="bg-white text-salsa-600 hover:bg-white/90 hover:text-salsa-700"
              >
                <Link
                  href={`mailto:${fulfillmentContact.email}?subject=Jose%20Madrid%20Merch%20Setup`}
                >
                  Request fulfillment setup
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Link>
              </Button>
              <Button
                variant="outline"
                className="border-white/60 text-white hover:bg-white/10"
                asChild
              >
                <Link href="/admin/merchandise">
                  Manage catalog
                </Link>
              </Button>
            </div>
            <p className="text-sm text-white/80">
              Need a custom bundle or fundraiser kit? Let us know and we&apos;ll help plan it with the printer.
            </p>
          </div>
        </div>
      </section>

      <section className="container mx-auto px-4 pb-12 pt-16 lg:pt-20">
        <div className="grid gap-10 lg:grid-cols-[0.9fr_1.1fr]">
          <div className="space-y-4">
            <p className="text-xs font-semibold uppercase tracking-[0.35em] text-salsa-500">Lookbook</p>
            <h2 className="font-serif text-3xl font-semibold text-foreground">Ready-to-print mockups</h2>
            <p className="text-base text-muted-foreground">
              Explore the latest Jose Madrid Salsa mockups for apparel, displays, and fundraising kits. Every asset is
              pre-sized for the {fulfillmentContact.partnerName} portal and ships within 72 hours once approved.
            </p>
            <Button asChild variant="outline" className="w-fit">
              <Link href={fulfillmentContact.portalUrl} target="_blank" rel="noopener noreferrer">
                View full gallery
                <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
            </Button>
          </div>
          <div className="grid gap-5 sm:grid-cols-2">
            {merchMediaShowcase.map((media) => (
              <figure
                key={media.id}
                className="flex flex-col overflow-hidden rounded-2xl border border-border bg-card surface-shadow"
              >
                <div className="relative aspect-[4/3] w-full bg-gray-100 dark:bg-gray-800">
                  <Image
                    src={media.image}
                    alt={media.title}
                    fill
                    className="object-cover"
                    sizes="(min-width: 1024px) 50vw, 100vw"
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
      </section>

      <section className="container mx-auto px-4 py-16 space-y-12">
        <div className="grid gap-8 lg:grid-cols-3">
          {merchCollections.map((collection) => (
            <article
              key={collection.id}
              className={`rounded-2xl border border-border bg-card surface-shadow transition hover:-translate-y-1 ${collection.accent ? `bg-gradient-to-br ${collection.accent}` : ''}`}
            >
              <div className="space-y-4 p-8">
                <h2 className="text-2xl font-serif font-semibold text-foreground">
                  {collection.title}
                </h2>
                <p className="text-sm text-muted-foreground">{collection.description}</p>
                <ul className="space-y-2 text-sm text-foreground/90">
                  {collection.items.map((item) => (
                    <li key={item} className="flex items-start gap-2">
                      <CheckCircle className="mt-0.5 h-4 w-4 text-salsa-500" />
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </article>
          ))}
        </div>
      </section>

      <section className="bg-card py-16">
        <div className="container mx-auto px-4">
          <div className="grid gap-10 lg:grid-cols-[1.1fr_0.9fr] items-start">
            <div className="space-y-6">
              <p className="text-xs font-semibold uppercase tracking-[0.35em] text-salsa-500">Fulfilment workflow</p>
              <h2 className="font-serif text-3xl sm:text-4xl font-bold text-foreground">
                Plug into a ready-to-run merch pipeline
              </h2>
              <p className="text-base text-muted-foreground">
                From storefront sync to shipping labels, {fulfillmentContact.partnerName} keeps the back office moving so you can focus on engaging customers and supporters.
              </p>
              <div className="space-y-4">
                {merchHighlights.map((highlight) => {
                  const Icon = merchHighlightIconMap[highlight.icon]
                  return (
                    <div
                      key={highlight.id}
                      className="flex gap-4 rounded-xl border border-border bg-muted p-5"
                    >
                      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-card text-salsa-500 shadow-inner">
                        <Icon className="h-6 w-6" />
                      </div>
                      <div className="space-y-1">
                        <h3 className="text-lg font-semibold text-foreground">{highlight.title}</h3>
                        <p className="text-sm text-muted-foreground">{highlight.description}</p>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
            <div className="rounded-3xl border border-salsa-200/50 bg-gradient-to-br from-salsa-50/10 via-card to-chile-50/10 p-8 surface-shadow">
              <h3 className="text-xl font-semibold text-salsa-700">How we get you live</h3>
              <ol className="mt-4 space-y-4 text-sm text-foreground/90">
                {merchSetupSteps.map((step, index) => (
                  <li key={step.id} className="flex gap-3">
                    <span className="flex h-7 w-7 items-center justify-center rounded-full bg-salsa-500 text-xs font-semibold text-white">
                      {index + 1}
                    </span>
                    <span>{step.label}</span>
                  </li>
                ))}
              </ol>
              <div className="mt-6 rounded-2xl border border-salsa-200 bg-card p-5 text-sm text-salsa-700">
                <p>
                  Have an existing printer? We can connect them instead—our merch module supports custom SFTP or API feeds for live inventory sync.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>
    </main>
  )
}
