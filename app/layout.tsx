import type { Metadata } from 'next'
import { Montserrat, Volkhov, Roboto_Mono } from 'next/font/google'
import { CartSidebar } from '@/components/store/cart-sidebar'
import { Toaster } from '@/components/ui/toaster'
import { Navigation } from '@/components/store/navigation'
import { Footer } from '@/components/store/footer'
import { AiChatWidget } from '@/components/chat/ai-chat-widget'
import { GoogleAnalytics } from '@/components/analytics/google-analytics'
import { getPublicGoogleAnalyticsMeasurementId } from '@/lib/google-analytics-config'
import { Analytics } from '@vercel/analytics/react'
import { Providers } from './providers'
import './globals.css'

const montserrat = Montserrat({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-montserrat',
})

const volkhov = Volkhov({
  subsets: ['latin'],
  weight: ['400', '700'],
  display: 'swap',
  variable: '--font-volkhov',
})

const robotoMono = Roboto_Mono({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-roboto-mono',
})

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://www.josemadrid.net'

export const metadata: Metadata = {
  title: {
    template: '%s | Jose Madrid Salsa',
    default: 'Jose Madrid Salsa - Premium Gourmet Salsa',
  },
  metadataBase: new URL(siteUrl),
  description: 'Premium gourmet salsas made with the finest ingredients. Order online for delivery or find us at local stores. Perfect for fundraising and wholesale.',
  keywords: ['salsa', 'gourmet', 'premium', 'mild', 'medium', 'hot', 'fundraising', 'wholesale', 'ohio'],
  authors: [{ name: 'Jose Madrid Salsa' }],
  creator: 'Jose Madrid Salsa',
  publisher: 'Jose Madrid Salsa',
  openGraph: {
    type: 'website',
    locale: 'en_US',
    url: 'https://josemadridsalsa.com',
    siteName: 'Jose Madrid Salsa',
    title: 'Jose Madrid Salsa - Premium Gourmet Salsa',
    description: 'Premium gourmet salsas made with the finest ingredients. Order online for delivery.',
    images: [
      {
        url: 'https://www.josemadrid.net/images/Opengraph/Home-Opengraph-Dark.png',
        width: 1200,
        height: 630,
        alt: 'Jose Madrid Salsa',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Jose Madrid Salsa - Premium Gourmet Salsa',
    description: 'Premium gourmet salsas made with the finest ingredients.',
    images: ['https://www.josemadrid.net/images/Opengraph/Home-Opengraph-Dark.png'],
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      'max-video-preview': -1,
      'max-image-preview': 'large',
      'max-snippet': -1,
    },
  },
}

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const measurementId = await getPublicGoogleAnalyticsMeasurementId()

  return (
    <html lang="en" className={`${montserrat.variable} ${volkhov.variable} ${robotoMono.variable}`}>
      <head>
        {/* Google Tag Manager */}
        <script dangerouslySetInnerHTML={{
          __html: `(function(w,d,s,l,i){w[l]=w[l]||[];w[l].push({'gtm.start':
          new Date().getTime(),event:'gtm.js'});var f=d.getElementsByTagName(s)[0],
          j=d.createElement(s),dl=l!='dataLayer'?'&l='+l:'';j.async=true;j.src=
          'https://www.googletagmanager.com/gtm.js?id='+i+dl;f.parentNode.insertBefore(j,f);
          })(window,document,'script','dataLayer','GTM-5KSQW4JJ');`
        }} />
        {/* End Google Tag Manager */}
      </head>
      <body className="font-sans antialiased bg-background text-foreground">
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
        <Providers>
          <div className="flex min-h-screen flex-col">
            <Navigation />
            <div className="flex-1">
              {children}
            </div>
            <Footer />
          </div>
          <CartSidebar />
          <Toaster />
          <AiChatWidget />
        </Providers>
        <Analytics />
      </body>
    </html>
  )
}
