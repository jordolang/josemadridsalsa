import type { Metadata } from 'next'
import Script from 'next/script'
import { Montserrat, Volkhov, Roboto_Mono } from 'next/font/google'
import { CartSidebar } from '@/components/store/cart-sidebar'
import { Toaster } from '@/components/ui/toaster'
import { Navigation } from '@/components/store/navigation'
import { Footer } from '@/components/store/footer'
import { AiChatWidget } from '@/components/chat/ai-chat-widget'
import { themeStorageKey } from '@/lib/constants/theme'
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
        url: '/og-image.jpg',
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
    images: ['/og-image.jpg'],
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
  const themeInitializer = `
    (function() {
      try {
        var storageKey = '${themeStorageKey}';
        var stored = localStorage.getItem(storageKey);
        var prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
        var theme = stored === 'light' || stored === 'dark' ? stored : (prefersDark ? 'dark' : 'light');
        document.documentElement.classList.toggle('dark', theme === 'dark');
        document.documentElement.style.colorScheme = theme;
      } catch (error) {
        console.warn('Unable to load saved theme preference', error);
      }
    })();
  `

  return (
    <html lang="en" suppressHydrationWarning className={`${montserrat.variable} ${volkhov.variable} ${robotoMono.variable}`}>
      <body className="font-sans antialiased bg-background text-foreground transition-colors duration-300">
        <Script id="theme-initializer" strategy="beforeInteractive">
          {themeInitializer}
        </Script>
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
      </body>
    </html>
  )
}
