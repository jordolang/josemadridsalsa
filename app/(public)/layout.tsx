import { Suspense } from 'react'
import { CartSidebar } from '@/components/store/cart-sidebar'
import { Toaster } from '@/components/ui/sonner'
import { Navigation } from '@/components/store/navigation'
import Footer from '@/components/ui/footer-column'
import { AiChatWidget } from '@/components/chat/ai-chat-widget'
import { AmplitudeAnalytics } from '@/components/analytics/amplitude-analytics'
import { GrowthBookAnnouncementBanner } from '@/components/growthbook/announcement-banner'
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
  const calendarEvents = await getCalendarEvents(20)

  return (
    <>
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
