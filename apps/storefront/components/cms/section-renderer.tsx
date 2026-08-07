import Link from 'next/link'
import Image from 'next/image'
import { Button } from '@/components/ui/button'
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion'
import { FeaturedProductsSection } from '@/components/store/featured-products-section'
import { FeaturedHeatIndexSection } from '@/components/store/featured-heat-index-section'
import { FooterNewsletterSignup } from '@/components/store/footer-newsletter-signup'
import { getFaqs } from '@/lib/cms/queries'
import { sanitizeCmsHtml } from '@/lib/cms/sanitize'
import type { ResolvedSection } from '@/lib/cms/queries'

/**
 * Renders CMS blocks on the public site.
 *
 * Only used by free-form LANDING pages — the hard-coded SYSTEM pages keep
 * their own markup and read individual fields through `getPageContent()`
 * instead, so their design is untouched.
 */

const ALIGNMENT: Record<string, string> = {
  left: 'text-left',
  center: 'text-center mx-auto',
  right: 'text-right ml-auto',
}

function str(data: Record<string, unknown>, key: string): string {
  const value = data[key]
  return typeof value === 'string' ? value : ''
}

function num(data: Record<string, unknown>, key: string, fallback: number): number {
  const value = data[key]
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback
}

function Section({ children }: { children: React.ReactNode }) {
  return <section className="py-12 md:py-16">{children}</section>
}

function Container({ children }: { children: React.ReactNode }) {
  return <div className="container mx-auto px-4">{children}</div>
}

/**
 * Body copy is authored in the admin so editors can use basic formatting.
 * It is sanitised against an allowlist before rendering — see
 * `lib/cms/sanitize.ts`.
 */
function RichBody({ html, className }: { html: string; className?: string }) {
  if (!html) return null
  return (
    <div
      className={`prose prose-neutral max-w-none dark:prose-invert ${className ?? ''}`}
      // eslint-disable-next-line react/no-danger -- sanitised by sanitizeCmsHtml
      dangerouslySetInnerHTML={{ __html: sanitizeCmsHtml(html) }}
    />
  )
}

function CtaButtons({ data }: { data: Record<string, unknown> }) {
  const text = str(data, 'ctaText')
  const href = str(data, 'ctaHref')
  const secondaryText = str(data, 'secondaryCtaText')
  const secondaryHref = str(data, 'secondaryCtaHref')
  if (!text && !secondaryText) return null

  return (
    <div className="mt-6 flex flex-wrap gap-3">
      {text && href && (
        <Button asChild size="lg">
          <Link href={href}>{text}</Link>
        </Button>
      )}
      {secondaryText && secondaryHref && (
        <Button asChild size="lg" variant="outline">
          <Link href={secondaryHref}>{secondaryText}</Link>
        </Button>
      )}
    </div>
  )
}

async function FaqBlock({ data }: { data: Record<string, unknown> }) {
  const items = await getFaqs(str(data, 'categorySlug') || undefined, num(data, 'limit', 10))
  if (items.length === 0) return null

  return (
    <Section>
      <Container>
        <div className="mx-auto max-w-3xl">
          <h2 className="mb-6 text-3xl font-bold">{str(data, 'heading')}</h2>
          <Accordion type="single" collapsible>
            {items.map((item) => (
              <AccordionItem key={item.id} value={item.id}>
                <AccordionTrigger className="text-left">{item.question}</AccordionTrigger>
                <AccordionContent>
                  <RichBody html={item.answer} />
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </div>
      </Container>
    </Section>
  )
}

async function ProductGridBlock({ data }: { data: Record<string, unknown> }) {
  const heading = str(data, 'heading')
  const subheading = str(data, 'subheading')

  // `featured` reuses the storefront's existing section so a landing page and
  // the homepage show products identically.
  return (
    <Section>
      <Container>
        {heading && <h2 className="mb-2 text-3xl font-bold">{heading}</h2>}
        {subheading && <p className="mb-6 text-muted-foreground">{subheading}</p>}
      </Container>
      <FeaturedProductsSection limit={num(data, 'limit', 8)} />
    </Section>
  )
}

function HeroBlock({ data }: { data: Record<string, unknown> }) {
  const imageUrl = str(data, 'imageUrl')
  const alignment = ALIGNMENT[str(data, 'alignment')] ?? ALIGNMENT.center

  return (
    <section className="relative overflow-hidden">
      {imageUrl && (
        <div className="absolute inset-0">
          <Image
            src={imageUrl}
            alt={str(data, 'imageAlt')}
            fill
            priority
            sizes="100vw"
            className="object-cover"
          />
          <div className="absolute inset-0 bg-black/45" />
        </div>
      )}
      <Container>
        <div
          className={`relative max-w-2xl py-24 md:py-32 ${alignment} ${
            imageUrl ? 'text-white' : ''
          }`}
        >
          <h1 className="text-4xl font-bold md:text-5xl">{str(data, 'headline')}</h1>
          {str(data, 'subheadline') && (
            <p className="mt-4 text-lg opacity-90">{str(data, 'subheadline')}</p>
          )}
          <CtaButtons data={data} />
        </div>
      </Container>
    </section>
  )
}

function VideoHeroBlock({ data }: { data: Record<string, unknown> }) {
  const videoUrl = str(data, 'videoUrl')
  return (
    <section className="relative overflow-hidden">
      {videoUrl && (
        <video
          className="absolute inset-0 h-full w-full object-cover"
          src={videoUrl}
          poster={str(data, 'posterUrl') || undefined}
          autoPlay
          muted
          loop
          playsInline
        />
      )}
      <div className="absolute inset-0 bg-black/45" />
      <Container>
        <div className="relative max-w-2xl py-24 text-white md:py-32">
          <h1 className="text-4xl font-bold md:text-5xl">{str(data, 'headline')}</h1>
          {str(data, 'subheadline') && (
            <p className="mt-4 text-lg opacity-90">{str(data, 'subheadline')}</p>
          )}
          <CtaButtons data={data} />
        </div>
      </Container>
    </section>
  )
}

function ImageTextBlock({ data }: { data: Record<string, unknown> }) {
  const imageUrl = str(data, 'imageUrl')
  const imageFirst = str(data, 'imagePosition') !== 'right'

  return (
    <Section>
      <Container>
        <div className="grid items-center gap-10 md:grid-cols-2">
          {imageUrl && (
            <div className={`relative aspect-[4/3] ${imageFirst ? '' : 'md:order-2'}`}>
              <Image
                src={imageUrl}
                alt={str(data, 'imageAlt')}
                fill
                sizes="(min-width: 768px) 50vw, 100vw"
                className="rounded-lg object-cover"
              />
            </div>
          )}
          <div>
            {str(data, 'heading') && (
              <h2 className="mb-4 text-3xl font-bold">{str(data, 'heading')}</h2>
            )}
            <RichBody html={str(data, 'body')} />
            <CtaButtons data={data} />
          </div>
        </div>
      </Container>
    </Section>
  )
}

function RichTextBlock({ data }: { data: Record<string, unknown> }) {
  const alignment = ALIGNMENT[str(data, 'alignment')] ?? ALIGNMENT.left
  return (
    <Section>
      <Container>
        <div className={`max-w-3xl ${alignment}`}>
          {str(data, 'heading') && (
            <h2 className="mb-4 text-3xl font-bold">{str(data, 'heading')}</h2>
          )}
          <RichBody html={str(data, 'body')} />
        </div>
      </Container>
    </Section>
  )
}

const CTA_VARIANTS: Record<string, string> = {
  primary: 'bg-primary text-primary-foreground',
  muted: 'bg-muted',
  accent: 'bg-amber-500 text-black',
}

function CtaBlock({ data }: { data: Record<string, unknown> }) {
  const variant = CTA_VARIANTS[str(data, 'variant')] ?? CTA_VARIANTS.primary
  return (
    <Section>
      <Container>
        <div className={`rounded-xl px-8 py-12 text-center ${variant}`}>
          <h2 className="text-3xl font-bold">{str(data, 'heading')}</h2>
          {str(data, 'body') && <p className="mx-auto mt-3 max-w-2xl">{str(data, 'body')}</p>}
          {str(data, 'ctaText') && str(data, 'ctaHref') && (
            <Button asChild size="lg" variant="secondary" className="mt-6">
              <Link href={str(data, 'ctaHref')}>{str(data, 'ctaText')}</Link>
            </Button>
          )}
        </div>
      </Container>
    </Section>
  )
}

interface Testimonial {
  quote?: string
  author?: string
  role?: string
}

function TestimonialsBlock({ data }: { data: Record<string, unknown> }) {
  const items = Array.isArray(data.items) ? (data.items as Testimonial[]) : []
  if (items.length === 0) return null

  return (
    <Section>
      <Container>
        {str(data, 'heading') && (
          <h2 className="mb-8 text-center text-3xl font-bold">{str(data, 'heading')}</h2>
        )}
        <div className="grid gap-6 md:grid-cols-3">
          {items.map((item, index) => (
            <figure key={index} className="rounded-lg border bg-card p-6">
              <blockquote className="text-sm">{item.quote}</blockquote>
              <figcaption className="mt-4 text-sm font-medium">
                {item.author}
                {item.role && (
                  <span className="block font-normal text-muted-foreground">{item.role}</span>
                )}
              </figcaption>
            </figure>
          ))}
        </div>
      </Container>
    </Section>
  )
}

function NewsletterBlock({ data }: { data: Record<string, unknown> }) {
  return (
    <Section>
      <Container>
        <div className="mx-auto max-w-xl text-center">
          {str(data, 'heading') && (
            <h2 className="mb-2 text-3xl font-bold">{str(data, 'heading')}</h2>
          )}
          {str(data, 'body') && <p className="mb-6 text-muted-foreground">{str(data, 'body')}</p>}
          <FooterNewsletterSignup />
        </div>
      </Container>
    </Section>
  )
}

async function HeatIndexBlock({ data }: { data: Record<string, unknown> }) {
  return (
    <Section>
      <Container>
        {str(data, 'heading') && (
          <h2 className="mb-2 text-3xl font-bold">{str(data, 'heading')}</h2>
        )}
        {str(data, 'subheading') && (
          <p className="mb-6 text-muted-foreground">{str(data, 'subheading')}</p>
        )}
      </Container>
      <FeaturedHeatIndexSection />
    </Section>
  )
}

/** Render one CMS section. Unknown block types render nothing. */
export async function SectionRenderer({ section }: { section: ResolvedSection }) {
  const { block, data } = section

  switch (block) {
    case 'hero':
      return <HeroBlock data={data} />
    case 'videoHero':
      return <VideoHeroBlock data={data} />
    case 'richText':
      return <RichTextBlock data={data} />
    case 'imageText':
      return <ImageTextBlock data={data} />
    case 'productGrid':
      return <ProductGridBlock data={data} />
    case 'faq':
      return <FaqBlock data={data} />
    case 'cta':
      return <CtaBlock data={data} />
    case 'testimonials':
      return <TestimonialsBlock data={data} />
    case 'heatIndex':
      return <HeatIndexBlock data={data} />
    case 'newsletter':
      return <NewsletterBlock data={data} />
    default:
      return null
  }
}
