import type { Metadata, Viewport } from 'next'
import { Montserrat, Volkhov, Roboto_Mono } from 'next/font/google'
import Script from 'next/script'
import { SpeedInsights } from '@vercel/speed-insights/next'
import { Providers } from './providers'
import { CookieConsentBanner } from '@/components/ui/cookie-consent-banner'
import { CartDrawer } from '@/components/cart/cart-drawer'
import './globals.css'
import { SITE_URL } from '@/lib/site-url'

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

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? SITE_URL

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
    url: siteUrl,
    siteName: 'Jose Madrid Salsa',
    title: 'Jose Madrid Salsa - Premium Gourmet Salsa',
    description: 'Premium gourmet salsas made with the finest ingredients. Order online for delivery.',
    images: [
      {
        url: 'https://can9pwc8drhj1bme.public.blob.vercel-storage.com/site/images/opengraph/josemadridhome.png',
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
    images: ['https://can9pwc8drhj1bme.public.blob.vercel-storage.com/site/images/opengraph/josemadridhome.png'],
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
          strategy="afterInteractive"
          dangerouslySetInnerHTML={{
            __html: `(function(w,d,s,l,i){w[l]=w[l]||[];w[l].push({'gtm.start':
new Date().getTime(),event:'gtm.js'});var f=d.getElementsByTagName(s)[0],
j=d.createElement(s),dl=l!='dataLayer'?'&l='+l:'';j.async=true;j.src=
'https://www.googletagmanager.com/gtm.js?id='+i+dl;f.parentNode.insertBefore(j,f);
})(window,document,'script','dataLayer','GTM-NTWG6BQW');`,
          }}
        />
        <Script
          id="tiktok-pixel"
          strategy="afterInteractive"
          dangerouslySetInnerHTML={{
            __html: `!function (w, d, t) {
  w.TiktokAnalyticsObject=t;var ttq=w[t]=w[t]||[];ttq.methods=["page","track","identify","instances","debug","on","off","once","ready","alias","group","enableCookie","disableCookie","holdConsent","revokeConsent","grantConsent"],ttq.setAndDefer=function(t,e){t[e]=function(){t.push([e].concat(Array.prototype.slice.call(arguments,0)))}};for(var i=0;i<ttq.methods.length;i++)ttq.setAndDefer(ttq,ttq.methods[i]);ttq.instance=function(t){for(
var e=ttq._i[t]||[],n=0;n<ttq.methods.length;n++)ttq.setAndDefer(e,ttq.methods[n]);return e},ttq.load=function(e,n){var r="https://analytics.tiktok.com/i18n/pixel/events.js",o=n&&n.partner;ttq._i=ttq._i||{},ttq._i[e]=[],ttq._i[e]._u=r,ttq._t=ttq._t||{},ttq._t[e]=+new Date,ttq._o=ttq._o||{},ttq._o[e]=n||{};n=document.createElement("script")
;n.type="text/javascript",n.async=!0,n.src=r+"?sdkid="+e+"&lib="+t;e=document.getElementsByTagName("script")[0];e.parentNode.insertBefore(n,e)};

  ttq.load('D8OEDO3C77U56UIVDE3G');
  ttq.page();
}(window, document, 'ttq');`,
          }}
        />
        <Script
          id="meta-pixel"
          strategy="afterInteractive"
          dangerouslySetInnerHTML={{
            __html: `!function(f,b,e,v,n,t,s)
{if(f.fbq)return;n=f.fbq=function(){n.callMethod?
n.callMethod.apply(n,arguments):n.queue.push(arguments)};
if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';
n.queue=[];t=b.createElement(e);t.async=!0;
t.src=v;s=b.getElementsByTagName(e)[0];
s.parentNode.insertBefore(t,s)}(window, document,'script',
'https://connect.facebook.net/en_US/fbevents.js');
fbq('init', '2546527762445636');
fbq('init', '1398300505576315');
fbq('track', 'PageView');`,
          }}
        />
        {/* Google Customer Reviews merchant badge widget */}
        <Script
          id="merchantWidgetScript"
          src="https://www.gstatic.com/shopping/merchant/merchantwidget.js"
          strategy="afterInteractive"
        />
        <Script
          id="merchant-widget-init"
          strategy="afterInteractive"
          dangerouslySetInnerHTML={{
            __html: `(function(){function start(){if(window.merchantwidget){window.merchantwidget.start({merchant_id:731675578});}}var s=document.getElementById('merchantWidgetScript');if(window.merchantwidget){start();}else if(s){s.addEventListener('load',start);}})();`,
          }}
        />
        {/* Notifuse web analytics */}
        <Script
          id="notifuse-analytics-config"
          strategy="afterInteractive"
          dangerouslySetInnerHTML={{
            __html: `window.NotifuseAnalyticsConfig = { workspace_id: "zanesvillecloud", endpoint: "https://mail.zanesville.cloud" };`,
          }}
        />
        <Script
          id="notifuse-analytics"
          src="https://mail.zanesville.cloud/na.js"
          strategy="afterInteractive"
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
        <noscript>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            height="1"
            width="1"
            style={{ display: 'none' }}
            src="https://www.facebook.com/tr?id=2546527762445636&ev=PageView&noscript=1"
            alt=""
          />
        </noscript>
        <noscript>
          {/* eslint-disable-next-line @next/next/no-img-element */}
        <img height="1" width="1" style={{ display: 'none' }} src="https://www.facebook.com/tr?id=1398300505576315&ev=PageView&noscript=1" alt="" />
        </noscript>
        <Providers>
          {children}
        </Providers>
        <CartDrawer />
        <CookieConsentBanner />
        <SpeedInsights />
      </body>
    </html>
  )
}
