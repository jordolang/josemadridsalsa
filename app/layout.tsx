import type { Metadata, Viewport } from 'next'
import { Montserrat, Volkhov, Roboto_Mono } from 'next/font/google'
import Script from 'next/script'
import { SpeedInsights } from '@vercel/speed-insights/next'
import { Providers } from './providers'
import { CookieConsentBanner } from '@/components/ui/cookie-consent-banner'
import './globals.css'

// Optimize font loading with next/font/google
const montserrat = Montserrat({
  subsets: ['latin'],
  variable: '--font-montserrat',
  display: 'swap',
  preload: true,
})

const volkhov = Volkhov({
  weight: ['400', '700'],
  subsets: ['latin'],
  variable: '--font-volkhov',
  display: 'swap',
  preload: true,
})

const robotoMono = Roboto_Mono({
  subsets: ['latin'],
  variable: '--font-roboto-mono',
  display: 'swap',
  preload: false, // Only preload critical fonts
})

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://www.josemadridsalsa.com'

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
        url: 'https://www.josemadrid.net/images/Opengraph/josemadrid-hero.png',
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
    images: ['https://www.josemadrid.net/images/Opengraph/josemadrid-hero.png'],
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

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 5,
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" className={`${montserrat.variable} ${volkhov.variable} ${robotoMono.variable}`}>
      <head>
        <meta name="google-site-verification" content="E6ciztQzSgCnoZxkfE5GvfLE349LWqzal-VezMq3nRQ" />

        {/* Resource hints for external services */}
        <link rel="preconnect" href="https://www.googletagmanager.com" />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link rel="preconnect" href="https://js.stripe.com" />
        <link rel="dns-prefetch" href="https://www.google-analytics.com" />
        <link rel="dns-prefetch" href="https://vitals.vercel-insights.com" />

        <Script
          id="gtm-script"
          strategy="beforeInteractive"
          dangerouslySetInnerHTML={{
            __html: `(function(w,d,s,l,i){w[l]=w[l]||[];w[l].push({'gtm.start':
new Date().getTime(),event:'gtm.js'});var f=d.getElementsByTagName(s)[0],
j=d.createElement(s),dl=l!='dataLayer'?'&l='+l:'';j.async=true;j.src=
'https://www.googletagmanager.com/gtm.js?id='+i+dl;f.parentNode.insertBefore(j,f);
})(window,document,'script','dataLayer','GTM-NTWG6BQW');`,
          }}
        />
      </head>
      <body className="font-sans antialiased bg-background text-foreground">
        <noscript>
          <iframe
            src="https://www.googletagmanager.com/ns.html?id=GTM-NTWG6BQW"
            height="0"
            width="0"
            style={{ display: 'none', visibility: 'hidden' }}
          />
        </noscript>
        <Providers>
          {children}
        </Providers>
        <CookieConsentBanner />
        <SpeedInsights />
      </body>
    </html>
  )
}
