/**
 * Next.js settings every app that serves shared pages needs (apps/storefront,
 * apps/fundraising). Plain JavaScript because next.config.mjs cannot import TypeScript.
 */

/** Security headers applied to all routes */
export const sharedHeaders = async () => {
  const isProd = process.env.NODE_ENV === 'production'

  // Content Security Policy
  const csp = [
    "default-src 'self'",
    // Allow inline styles for Tailwind
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com https://vercel.live",
    // Next.js App Router requires 'unsafe-inline' for hydration scripts and RSC payloads.
    // 'unsafe-eval' is also needed in dev for HMR.
    isProd
      ? "script-src 'self' 'unsafe-inline' https://maps.googleapis.com https://maps.gstatic.com https://www.googletagmanager.com https://js.stripe.com https://va.vercel-scripts.com https://vercel.live"
      : "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://maps.googleapis.com https://maps.gstatic.com https://www.googletagmanager.com https://js.stripe.com https://va.vercel-scripts.com https://vercel.live",
    "worker-src 'self' blob:",
    // Allow Google Maps iframes, GTM noscript, Stripe checkout iframes,
    // YouTube/Vimeo video embeds used in blog (Heat Index) posts, and the
    // Facebook video plugin used by the /live page, and the Twitch player for
    // a fundraiser's live stream on /f/[subdomain].
    "frame-src https://www.google.com/maps/ https://maps.google.com https://www.googletagmanager.com https://js.stripe.com https://hooks.stripe.com https://vercel.live https://www.youtube-nocookie.com https://www.youtube.com https://player.vimeo.com https://www.facebook.com https://web.facebook.com https://player.twitch.tv",
    // Images from multiple CDNs and data URIs
    "img-src 'self' data: blob: https://utfs.io https://*.public.blob.vercel-storage.com https://images.unsplash.com https://*.googleapis.com https://maps.gstatic.com https://lh3.googleusercontent.com https://logo.clearbit.com https://www.google.com https://cdn11.bigcommerce.com https://www.nudgeprinting.com https://vercel.live https://vercel.com https://*.google-analytics.com https://*.googletagmanager.com",
    // Allow connections to self, external APIs used client-side, Sentry, and
    // the GA4 collect endpoints gtag uses (fundraiser pages load gtag.js).
    "connect-src 'self' https://*.sentry.io https://api.stripe.com https://r.stripe.com https://amplitude.com https://*.amplitude.com https://calendar.google.com https://maps.googleapis.com https://vercel.live wss://ws-us3.pusher.com https://*.google-analytics.com https://*.analytics.google.com https://*.googletagmanager.com",
    "font-src 'self' data: https://fonts.gstatic.com https://vercel.live https://assets.vercel.com",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
    // Production only: on http://localhost this upgrades every subresource to
    // https, which Safari applies to localhost and Chrome does not — leaving
    // dev pages unstyled with no assets in Safari.
    ...(isProd ? ['upgrade-insecure-requests'] : []),
  ].join('; ')

  const headers = [
    {
      key: 'Content-Security-Policy',
      value: csp,
    },
    {
      key: 'X-Frame-Options',
      value: 'DENY',
    },
    {
      key: 'X-Content-Type-Options',
      value: 'nosniff',
    },
    {
      key: 'Referrer-Policy',
      value: 'strict-origin-when-cross-origin',
    },
    {
      key: 'Permissions-Policy',
      value: 'camera=(), microphone=(), geolocation=()',
    },
  ]

  // Add HSTS only in production
  if (isProd) {
    headers.push({
      key: 'Strict-Transport-Security',
      value: 'max-age=31536000; includeSubDomains',
    })
  }

  return [
    {
      source: '/(.*)',
      headers,
    },
    {
      // The photo-release kiosk location-stamps each waiver, so it alone may
      // ask for GPS. Listed after the site-wide rule so this value wins.
      source: '/waiver',
      headers: [
        {
          key: 'Permissions-Policy',
          value: 'camera=(), microphone=(), geolocation=(self)',
        },
      ],
    },
  ]
}

export const sharedImages = {
  formats: ['image/webp'],
  deviceSizes: [640, 750, 828, 1080, 1200, 1920],
  imageSizes: [16, 32, 48, 64, 96, 128, 256, 384],
  minimumCacheTTL: 86400,
  remotePatterns: [
    {
      protocol: 'https',
      hostname: 'cdn11.bigcommerce.com',
      port: '',
      pathname: '/**',
    },
    {
      protocol: 'https',
      hostname: 'www.nudgeprinting.com',
      port: '',
      pathname: '/**',
    },
    {
      protocol: 'https',
      hostname: 'images.unsplash.com',
      port: '',
      pathname: '/**',
    },
    {
      protocol: 'https',
      hostname: 'maps.googleapis.com',
      port: '',
      pathname: '/**',
    },
    {
      protocol: 'https',
      hostname: 'lh3.googleusercontent.com',
      port: '',
      pathname: '/**',
    },
    {
      protocol: 'https',
      hostname: 'places.googleapis.com',
      port: '',
      pathname: '/**',
    },
    {
      protocol: 'https',
      hostname: 'logo.clearbit.com',
      port: '',
      pathname: '/**',
    },
    {
      protocol: 'https',
      hostname: 'www.google.com',
      port: '',
      pathname: '/s2/favicons/**',
    },
    {
      protocol: 'https',
      hostname: 'utfs.io',
      port: '',
      pathname: '/**',
    },
    {
      protocol: 'https',
      hostname: '*.public.blob.vercel-storage.com',
      port: '',
      pathname: '/**',
    },
  ],
}

// React Email packages need to be external for server components.
// Prisma is listed by Next.js as an external package, but keeping it explicit
// prevents serverless bundles from trying to load a traced package clone.
// @amplitude/ai needs node:async_hooks/module/crypto, so it must not be bundled.
export const sharedServerExternalPackages = ['@react-email/render', '@prisma/client', 'prisma', '@amplitude/ai']
// Bundle react-pdf to avoid Turbopack external module ID resolution issues
export const sharedTranspilePackages = ['@react-pdf/renderer']
