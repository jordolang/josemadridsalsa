import type { Metadata } from 'next'
import { Providers } from './providers'
import { CookieConsentBanner } from '@/components/ui/cookie-consent-banner'
import './globals.css'

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

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <head>
        <meta name="google-site-verification" content="E6ciztQzSgCnoZxkfE5GvfLE349LWqzal-VezMq3nRQ" />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Montserrat:wght@100..900&family=Volkhov:wght@400;700&family=Roboto+Mono:wght@100..700&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="font-sans antialiased bg-background text-foreground">
        <Providers>
          {children}
        </Providers>
        <CookieConsentBanner />
      </body>
    </html>
  )
}
