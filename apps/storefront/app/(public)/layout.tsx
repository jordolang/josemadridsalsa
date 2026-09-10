import { Suspense } from 'react'
import { CartSidebar } from '@/components/store/cart-sidebar'
import { Toaster } from '@/components/ui/sonner'
import { Navigation } from '@/components/store/navigation'
import Footer from '@/components/ui/footer-column'
import { AiChatWidget } from '@/components/chat/ai-chat-widget'
import { AmplitudeAnalytics } from '@/components/analytics/amplitude-analytics'
import { AttributionTracker } from '@/components/analytics/attribution-tracker'
import { AnnouncementBar } from '@/components/store/announcement-bar'
import { Analytics } from '@vercel/analytics/react'
import { WishlistSyncProvider } from '@/components/providers/wishlist-sync-provider'
import { CompareFloatingButton, ProductComparison } from '@/components/store/product-comparison'
import { ComparisonURLHandler } from '@/components/store/comparison-url-handler'
import { NewsletterPopup } from '@/components/store/newsletter-popup'
import { EventTicker } from '@/components/store/event-ticker'
import { getCalendarEvents } from '@/lib/server/google-data'
import { getHeaderGroups } from '@/lib/cms/navigation'
import { getFooterOverrides } from '@/lib/cms/footer'

// No route segment config here on purpose. `dynamic = 'force-dynamic'` on this
// layout used to cascade to every public route and override each page's own
// `revalidate`, which disabled ISR site-wide. The three fetches below all catch
// their own errors and fall back to empty data, so prerendering this layout is
// safe. Each page declares its own `revalidate` (or `force-dynamic`).

export default async function PublicLayout({
  children,
}: {
  children: React.ReactNode
}) {
  // Fetch calendar events once for the entire layout — shared across EventTicker,
  // ScheduleMap, and any other component that needs it on this page tree.
  // Next.js deduplicates identical fetch() calls within the same render, so
  // even if child pages also call getCalendarEvents(), only one HTTP request fires.
  const [calendarEvents, headerGroups, footerOverrides] = await Promise.all([
    getCalendarEvents(20),
    getHeaderGroups(),
    getFooterOverrides(),
  ])
  const enableVercelAnalytics = process.env.NEXT_PUBLIC_VERCEL_ANALYTICS_ENABLED === 'true'

  return (
    <>
      <AmplitudeAnalytics />
      <AttributionTracker />
      <WishlistSyncProvider />
      <Suspense fallback={null}>
        <ComparisonURLHandler />
      </Suspense>
      <div className="flex min-h-screen flex-col">
        <AnnouncementBar />
        <Navigation groups={headerGroups} />
        <EventTicker initialEvents={calendarEvents} />
        <div className="flex-1">
          {children}
        </div>
        <Footer overrides={footerOverrides} />
      </div>
      <CartSidebar />
      <CompareFloatingButton />
      <ProductComparison />
      <Toaster />
      <AiChatWidget />
      <NewsletterPopup />
      {enableVercelAnalytics && <Analytics />}
    </>
  )
}
