import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { withSentryConfig } from '@sentry/nextjs'
const projectRoot = path.dirname(fileURLToPath(import.meta.url))

/** @type {import('next').NextConfig} */
const nextConfig = {
  // Force cache invalidation for Vercel builds
  generateBuildId: async () => {
    return `build-${Date.now()}`
  },
  // Security headers applied to all routes
  headers: async () => {
    const isProd = process.env.NODE_ENV === 'production'

    // Content Security Policy
    const csp = [
      "default-src 'self'",
      // Allow inline styles for Tailwind
      "style-src 'self' 'unsafe-inline'",
      // Next.js App Router requires 'unsafe-inline' for hydration scripts and RSC payloads.
      // 'unsafe-eval' is also needed in dev for HMR.
      isProd
        ? "script-src 'self' 'unsafe-inline' https://maps.googleapis.com https://www.googletagmanager.com https://js.stripe.com https://va.vercel-scripts.com"
        : "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://maps.googleapis.com https://www.googletagmanager.com https://js.stripe.com https://va.vercel-scripts.com",
      "worker-src 'self' blob:",
      // Allow Google Maps iframes, GTM noscript, and Stripe checkout iframes
      "frame-src https://www.google.com/maps/ https://www.googletagmanager.com https://js.stripe.com https://hooks.stripe.com",
      // Images from multiple CDNs and data URIs
      "img-src 'self' data: blob: https://utfs.io https://*.public.blob.vercel-storage.com https://images.unsplash.com https://*.googleapis.com https://lh3.googleusercontent.com https://logo.clearbit.com https://www.google.com https://cdn11.bigcommerce.com https://www.nudgeprinting.com",
      // Allow connections to self, external APIs used client-side, and Sentry
      "connect-src 'self' https://*.sentry.io https://api.growthbook.io https://cdn.growthbook.io https://api.stripe.com https://r.stripe.com https://amplitude.com https://*.amplitude.com https://calendar.google.com https://maps.googleapis.com",
      "font-src 'self' data:",
      "object-src 'none'",
      "base-uri 'self'",
      "form-action 'self'",
      "frame-ancestors 'none'",
      "upgrade-insecure-requests",
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
    ]
  },
  images: {
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
  },
  // React Email packages need to be external for server components
  serverExternalPackages: ['@react-email/render'],
  // Bundle react-pdf to avoid Turbopack external module ID resolution issues
  transpilePackages: ['@react-pdf/renderer'],
  experimental: {
    serverActions: {
      allowedOrigins: ['localhost:3000'],
    },
  },
  /**
   * Exclude large, unused directories from serverless traces to keep
   * functions under Vercel's 250 MB unzipped limit.
   * Note: Do NOT exclude public/images/** as it prevents Next.js Image Optimization from working
   */
  outputFileTracingExcludes: {
    '*': [
      'data/**',
      'docs/**',
      'scripts/**',
      'tests/**',
      'public/Fundraiser Forms/**',
      'public/samples/**',
      'prisma/dev.db',
      'prisma/seed*.ts',
      'prisma/seeds/**',
      'AGENTS.md',
    ],
  },
  /**
   * Explicitly include required files in serverless function traces
   * This ensures they are bundled with Vercel functions
   */
  outputFileTracingIncludes: {
    '/api/**/*': [
      './node_modules/.prisma/client/**/*',
      './node_modules/@prisma/client/**/*',
    ],
    '/find-us/**/*': [
      './public/find-us-locally/**/*',
    ],
    '/recipes/**/*': [
      './node_modules/.prisma/client/**/*',
      './node_modules/@prisma/client/**/*',
    ],
    '/products/**/*': [
      './node_modules/.prisma/client/**/*',
      './node_modules/@prisma/client/**/*',
    ],
  },
  turbopack: {
    // Force Turbopack to resolve packages from the actual repo root.
    root: projectRoot,
  },
}

// Sentry configuration options
// For all available options, see: https://github.com/getsentry/sentry-webpack-plugin#options
const sentryWebpackPluginOptions = {
  // Suppresses source map uploading logs during build
  silent: true,
  org: process.env.SENTRY_ORG,
  project: process.env.SENTRY_PROJECT,
  authToken: process.env.SENTRY_AUTH_TOKEN,
}

// Additional Sentry config options
const sentryOptions = {
  // For all available options, see:
  // https://docs.sentry.io/platforms/javascript/guides/nextjs/manual-setup/

  // Upload a larger set of source maps for prettier stack traces (increases build time)
  widenClientFileUpload: true,

  // Automatically tree-shake Sentry logger statements to reduce bundle size
  disableLogger: true,

  // Hides source maps from generated client bundles
  hideSourceMaps: true,

  // Route browser requests to Sentry through a Next.js rewrite to circumvent ad-blockers
  tunnelRoute: '/monitoring',

  // Automatically instrument server components
  automaticVercelMonitors: true,
}

export default withSentryConfig(nextConfig, {
  // For all available options, see:
  // https://www.npmjs.com/package/@sentry/webpack-plugin#options

  org: "josemadridsalsa",

  project: "javascript-nextjs",

  // Only print logs for uploading source maps in CI
  silent: !process.env.CI,

  // For all available options, see:
  // https://docs.sentry.io/platforms/javascript/guides/nextjs/manual-setup/

  // Upload a larger set of source maps for prettier stack traces (increases build time)
  widenClientFileUpload: true,

  // Route browser requests to Sentry through a Next.js rewrite to circumvent ad-blockers.
  // This can increase your server load as well as your hosting bill.
  // Note: Check that the configured route will not match with your Next.js middleware, otherwise reporting of client-
  // side errors will fail.
  tunnelRoute: "/monitoring",

  webpack: {
    // Enables automatic instrumentation of Vercel Cron Monitors. (Does not yet work with App Router route handlers.)
    // See the following for more information:
    // https://docs.sentry.io/product/crons/
    // https://vercel.com/docs/cron-jobs
    automaticVercelMonitors: true,

    // Tree-shaking options for reducing bundle size
    treeshake: {
      // Automatically tree-shake Sentry logger statements to reduce bundle size
      removeDebugLogging: true,
    },
  },
});
