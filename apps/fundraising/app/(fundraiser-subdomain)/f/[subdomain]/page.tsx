import { cache } from 'react'
import { notFound } from 'next/navigation'
import prisma from '@/lib/prisma'
import {
  defaultPageConfig,
  validatePageConfig,
} from '@/lib/fundraiser-page-config'
import { BlockRenderer } from '@/components/fundraiser-portal/block-renderer'
import {
  loadFundraiserStoreProducts,
  resolveFundraiserStore,
} from '@/lib/fundraising/store.server'
import { FundraiserSocialBoard } from '@/components/social/fundraiser-board'
import type { Metadata } from 'next'
import { headers } from 'next/headers'
import Script from 'next/script'
import { SITE_URL } from '@/lib/site-url'
import { customCssScopeClass, sanitizeCustomCss } from '@/lib/fundraising/custom-css'
import { normalizeSeoKeywords } from '@/lib/fundraising/seo-keywords'
import {
  normalizeGaMeasurementId,
  toGooglePlaceUrl,
  toLiveStream,
  toTikTokProfileUrl,
  toYouTubeEmbedUrl,
  type LiveStream,
} from '@/lib/fundraising/public-page-settings'

type Props = {
  params: Promise<{ subdomain: string }>
}

const getFundraiserBySubdomain = cache(async function getFundraiserBySubdomain(subdomain: string) {
  const fundraiser = await prisma.fundraiser.findUnique({
    where: { subdomain },
    include: {
      profile: true,
      analytics: true,
      participants: {
        where: { status: 'ACTIVE' },
        orderBy: { totalRevenue: 'desc' },
        take: 50,
        select: {
          id: true,
          name: true,
          totalOrders: true,
          totalRevenue: true,
          referralCode: true,
        },
      },
    },
  })

  return fundraiser
})

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { subdomain } = await params
  const fundraiser = await getFundraiserBySubdomain(subdomain)

  if (!fundraiser) {
    return { title: 'Fundraiser Not Found' }
  }

  const keywords = normalizeSeoKeywords(fundraiser.analytics?.seoKeywords)

  return {
    title: `${fundraiser.name} | Jose Madrid Salsa Fundraiser`,
    ...(keywords.length > 0 ? { keywords } : {}),
    description:
      fundraiser.missionStatement ||
      fundraiser.description ||
      `Support ${fundraiser.organizationName} by purchasing delicious handcrafted salsa.`,
    openGraph: {
      title: fundraiser.name,
      description:
        fundraiser.missionStatement ||
        fundraiser.description ||
        `Support ${fundraiser.organizationName}`,
      images: fundraiser.coverPhotoUrl ? [fundraiser.coverPhotoUrl] : [],
    },
  }
}

export default async function FundraiserSubdomainPage({ params }: Props) {
  const { subdomain } = await params
  const fundraiser = await getFundraiserBySubdomain(subdomain)

  if (!fundraiser) {
    notFound()
  }

  // Show ended page if fundraiser is inactive
  if (!fundraiser.isActive || fundraiser.status === 'ENDED' || fundraiser.status === 'CANCELLED') {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center px-4 text-center">
        <div className="max-w-md">
          {fundraiser.logoUrl && (
            <img
              src={fundraiser.logoUrl}
              alt={fundraiser.organizationName}
              className="mx-auto mb-6 h-24 w-24 rounded-full object-cover"
            />
          )}
          <h1 className="mb-4 font-serif text-3xl font-bold text-gray-900">
            {fundraiser.name}
          </h1>
          <p className="mb-2 text-lg text-gray-600">
            This fundraiser has ended.
          </p>
          <p className="text-sm text-gray-500">
            Thank you to everyone who supported {fundraiser.organizationName}!
          </p>
        </div>
      </div>
    )
  }

  // Parse page config or use default
  const configValidation = validatePageConfig(fundraiser.pageConfig)
  const pageConfig = configValidation.success ? configValidation.data : defaultPageConfig

  // The campaign's own shop, priced and stocked by the campaign. A fundraiser that has not
  // curated a catalogue sells the whole active one at its store price, so there is no longer
  // a fallback shelf warning supporters that their purchase benefits nobody.
  const store = await resolveFundraiserStore({ fundraiserSlug: fundraiser.slug })
  const storeProducts = store ? await loadFundraiserStoreProducts(store) : []

  // Determine URL for sharing
  const headersList = await headers()
  const host = headersList.get('host') || 'www.josemadridsalsa.com'
  const protocol = headersList.get('x-forwarded-proto') || 'https'
  const currentUrl = `${protocol}://${host}/f/${subdomain}`

  // Advanced-profile extras only show once the fundraiser switches advanced mode on.
  const profile = fundraiser.profile?.isAdvancedMode ? fundraiser.profile : null
  const scopeClass = customCssScopeClass(fundraiser.id)
  const customCss = sanitizeCustomCss(profile?.customCss, scopeClass)
  const youTubeEmbedUrl = toYouTubeEmbedUrl(profile?.youtubeVideoUrl)
  const liveStream = toLiveStream(profile?.liveStreamUrl, host)
  const tikTokUrl = toTikTokProfileUrl(profile?.tiktokFeedUrl)
  const gaMeasurementId = normalizeGaMeasurementId(fundraiser.analytics?.googleMeasurementId)
  const googlePlaceUrl = toGooglePlaceUrl(fundraiser.analytics?.googleMyBusinessId, fundraiser.organizationName)

  const fundraiserWithStore = {
    ...fundraiser,
    commissionRate: Number(fundraiser.commissionRate),
    storeProducts,
  }

  return (
    <div className="min-h-screen">
      {gaMeasurementId && (
        <>
          <Script
            src={`https://www.googletagmanager.com/gtag/js?id=${gaMeasurementId}`}
            strategy="afterInteractive"
          />
          <Script id="fundraiser-gtag" strategy="afterInteractive">
            {`window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments);}gtag('js',new Date());gtag('config','${gaMeasurementId}');`}
          </Script>
        </>
      )}

      {/* Sanitised and @scope-d to this container, so it can't style the rest of the page.
          `<` is stripped by the sanitiser, so the CSS can't close the <style> element. */}
      {customCss && <style dangerouslySetInnerHTML={{ __html: customCss }} />}

      <div className={scopeClass}>
        {pageConfig.blocks.map((block, index) => (
          <BlockRenderer
            key={`${block.type}-${index}`}
            block={block}
            blockIndex={index}
            fundraiser={fundraiserWithStore}
          />
        ))}

        <FundraiserMedia
          name={fundraiser.name}
          youTubeEmbedUrl={youTubeEmbedUrl}
          liveStream={liveStream}
          tikTokUrl={tikTokUrl}
          googlePlaceUrl={googlePlaceUrl}
        />

        {/* Render the interactive social progress board if enabled */}
        <div className="max-w-7xl mx-auto px-4">
          <FundraiserSocialBoard fundraiserSlug={fundraiser.slug} currentUrl={currentUrl} />
        </div>
      </div>

      {/* Footer */}
      <footer className="border-t border-gray-200 bg-gray-50 px-4 py-8 text-center text-sm text-gray-500 mt-12">
        <p>
          Powered by{' '}
          <a
            href={SITE_URL}
            className="text-salsa-600 hover:text-salsa-700 font-medium"
            target="_blank"
            rel="noopener noreferrer"
          >
            Jose Madrid Salsa
          </a>
        </p>
      </footer>
    </div>
  )
}

function FundraiserMedia({
  name,
  youTubeEmbedUrl,
  liveStream,
  tikTokUrl,
  googlePlaceUrl,
}: {
  name: string
  youTubeEmbedUrl: string | null
  liveStream: LiveStream | null
  tikTokUrl: string | null
  googlePlaceUrl: string | null
}) {
  const liveIframe = liveStream?.kind === 'iframe' ? liveStream : null
  const liveLink = liveStream?.kind === 'link' ? liveStream : null
  if (!youTubeEmbedUrl && !liveStream && !tikTokUrl && !googlePlaceUrl) return null

  return (
    <section className="fundraiser-media mx-auto max-w-5xl space-y-8 px-4 py-12">
      {liveIframe && (
        <div>
          <h2 className="mb-4 font-serif text-2xl font-bold text-gray-900">Watch Live</h2>
          <div className="aspect-video overflow-hidden rounded-lg bg-black">
            <iframe
              src={liveIframe.src}
              title={`${name} live stream on ${liveIframe.provider}`}
              className="h-full w-full"
              allow="autoplay; encrypted-media; fullscreen; picture-in-picture"
              allowFullScreen
              loading="lazy"
            />
          </div>
        </div>
      )}

      {youTubeEmbedUrl && (
        <div>
          <h2 className="mb-4 font-serif text-2xl font-bold text-gray-900">Video</h2>
          <div className="aspect-video overflow-hidden rounded-lg bg-black">
            <iframe
              src={youTubeEmbedUrl}
              title={`${name} video`}
              className="h-full w-full"
              allow="accelerometer; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
              allowFullScreen
              loading="lazy"
              referrerPolicy="strict-origin-when-cross-origin"
            />
          </div>
        </div>
      )}

      {(liveLink || tikTokUrl || googlePlaceUrl) && (
        <div className="flex flex-wrap justify-center gap-3">
          {liveLink && (
            <a href={liveLink.href} target="_blank" rel="noopener noreferrer nofollow" className="rounded-full border border-gray-300 px-5 py-2 text-sm font-semibold text-gray-800 hover:bg-gray-50">
              Watch live on {liveLink.provider}
            </a>
          )}
          {tikTokUrl && (
            <a href={tikTokUrl} target="_blank" rel="noopener noreferrer nofollow" className="rounded-full border border-gray-300 px-5 py-2 text-sm font-semibold text-gray-800 hover:bg-gray-50">
              Follow us on TikTok
            </a>
          )}
          {googlePlaceUrl && (
            <a href={googlePlaceUrl} target="_blank" rel="noopener noreferrer nofollow" className="rounded-full border border-gray-300 px-5 py-2 text-sm font-semibold text-gray-800 hover:bg-gray-50">
              Find us on Google
            </a>
          )}
        </div>
      )}
    </section>
  )
}
