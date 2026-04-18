import { Suspense } from 'react'
import Script from 'next/script'
import { CartSidebar } from '@/components/store/cart-sidebar'
import { Toaster } from '@/components/ui/sonner'
import { Navigation } from '@/components/store/navigation'
import Footer from '@/components/ui/footer-column'
import { AiChatWidget } from '@/components/chat/ai-chat-widget'
import { GoogleAnalytics } from '@/components/analytics/google-analytics'
import { AmplitudeAnalytics } from '@/components/analytics/amplitude-analytics'
import { GrowthBookAnnouncementBanner } from '@/components/growthbook/announcement-banner'
import { getPublicGoogleAnalyticsMeasurementId } from '@/lib/google-analytics-config'
import { Analytics } from '@vercel/analytics/react'
import { WishlistSyncProvider } from '@/components/providers/wishlist-sync-provider'
import { CompareFloatingButton, ProductComparison } from '@/components/store/product-comparison'
import { ComparisonURLHandler } from '@/components/store/comparison-url-handler'
import { NewsletterPopup } from '@/components/store/newsletter-popup'
import { EventTicker } from '@/components/store/event-ticker'
import { getCalendarEvents } from '@/lib/server/google-data'

export default async function PublicLayout({
  children,
}: {
  children: React.ReactNode
}) {
  // Fetch calendar events once for the entire layout — shared across EventTicker,
  // ScheduleMap, and any other component that needs it on this page tree.
  // Next.js deduplicates identical fetch() calls within the same render, so
  // even if child pages also call getCalendarEvents(), only one HTTP request fires.
  const [measurementId, calendarEvents] = await Promise.all([
    getPublicGoogleAnalyticsMeasurementId(),
    getCalendarEvents(20),
  ])

  return (
    <>
      {/* Google Tag Manager */}
      <Script
        id="gtm-script"
        strategy="afterInteractive"
        dangerouslySetInnerHTML={{
          __html: `(function(w,d,s,l,i){w[l]=w[l]||[];w[l].push({'gtm.start':
          new Date().getTime(),event:'gtm.js'});var f=d.getElementsByTagName(s)[0],
          j=d.createElement(s),dl=l!='dataLayer'?'&l='+l:'';j.async=true;j.src=
          'https://www.googletagmanager.com/gtm.js?id='+i+dl;f.parentNode.insertBefore(j,f);
          })(window,document,'script','dataLayer','GTM-5KSQW4JJ');`
        }}
      />
      {/* End Google Tag Manager */}
      {/* Google Tag Manager (noscript) */}
      <noscript>
        <iframe
          src="https://www.googletagmanager.com/ns.html?id=GTM-5KSQW4JJ"
          height="0"
          width="0"
          style={{ display: 'none', visibility: 'hidden' }}
        />
      </noscript>
      {/* End Google Tag Manager (noscript) */}
      {measurementId && <GoogleAnalytics measurementId={measurementId} />}
      <AmplitudeAnalytics />
      <WishlistSyncProvider />
      <Suspense fallback={null}>
        <ComparisonURLHandler />
      </Suspense>
      <div className="flex min-h-screen flex-col">
        <GrowthBookAnnouncementBanner />
        <Navigation />
        <EventTicker initialEvents={calendarEvents} />
        <div className="flex-1">
          {children}
        </div>
        <Footer />
      </div>
      <CartSidebar />
      <CompareFloatingButton />
      <ProductComparison />
      <Toaster />
      <AiChatWidget />
      <NewsletterPopup />
      <Analytics />
    </>
  )
}
