import { notFound } from 'next/navigation'
import type { Metadata } from 'next'
import { getLandingPage } from '@/lib/cms/queries'
import { SectionRenderer } from '@/components/cms/section-renderer'
import { createMetadata } from '@/lib/metadata'

/**
 * Public renderer for CMS landing pages.
 *
 * This is a dynamic segment at the root of the public route group, so it only
 * runs when no hard-coded route matched — static segments always win in the
 * App Router. That gives editors clean URLs (/summer-sale) without any risk of
 * shadowing an existing page.
 */

export const dynamic = 'force-dynamic'

type Props = { params: Promise<{ slug: string }> }

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params
  const page = await getLandingPage(slug)
  if (!page) return {}

  const metadata = createMetadata({
    title: page.seo.seoTitle ?? page.title,
    description: page.seo.seoDescription ?? page.title,
    pathname: `/${slug}`,
    ...(page.seo.ogImage ? { imageOverride: page.seo.ogImage } : {}),
  })

  if (page.seo.canonicalUrl) {
    metadata.alternates = { ...metadata.alternates, canonical: page.seo.canonicalUrl }
  }
  if (page.seo.noIndex) {
    metadata.robots = { index: false, follow: false }
  }
  return metadata
}

export default async function CmsLandingPage({ params }: Props) {
  const { slug } = await params
  const page = await getLandingPage(slug)
  if (!page) notFound()

  return (
    <main>
      {page.sections.map((section) => (
        <SectionRenderer key={section.key} section={section} />
      ))}
    </main>
  )
}
