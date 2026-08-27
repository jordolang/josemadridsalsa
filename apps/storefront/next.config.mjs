import path from 'node:path'
import { existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { withSentryConfig } from '@sentry/nextjs'
const projectRoot = path.dirname(fileURLToPath(import.meta.url))
const workspaceRoot = path.resolve(projectRoot, '../..')
const monorepoRoot = existsSync(path.join(workspaceRoot, 'turbo.json'))
  ? workspaceRoot
  : projectRoot

/** @type {import('next').NextConfig} */
const nextConfig = {
  outputFileTracingRoot: monorepoRoot,
  // Self-contained server build for the Docker image (Dockerfile). Gated so the
  // Vercel build path stays exactly as it was.
  ...(process.env.DOCKER_BUILD === '1' ? { output: 'standalone' } : {}),
  // Force cache invalidation for Vercel builds
  generateBuildId: async () => {
    return `build-${Date.now()}`
  },
  // Permanent redirect from the old La Perla page URL
  redirects: async () => [
    {
      source: '/la-perla-ave',
      destination: '/laperla',
      permanent: true,
    },
  ],
  // Security headers applied to all routes
  headers: async () => {
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
      // Facebook video plugin used by the /live page.
      "frame-src https://www.google.com/maps/ https://maps.google.com https://www.googletagmanager.com https://js.stripe.com https://hooks.stripe.com https://vercel.live https://www.youtube-nocookie.com https://www.youtube.com https://player.vimeo.com https://www.facebook.com https://web.facebook.com",
      // Images from multiple CDNs and data URIs
      "img-src 'self' data: blob: https://utfs.io https://*.public.blob.vercel-storage.com https://images.unsplash.com https://*.googleapis.com https://maps.gstatic.com https://lh3.googleusercontent.com https://logo.clearbit.com https://www.google.com https://cdn11.bigcommerce.com https://www.nudgeprinting.com https://vercel.live https://vercel.com",
      // Allow connections to self, external APIs used client-side, and Sentry
      "connect-src 'self' https://*.sentry.io https://api.stripe.com https://r.stripe.com https://amplitude.com https://*.amplitude.com https://calendar.google.com https://maps.googleapis.com https://vercel.live wss://ws-us3.pusher.com",
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
  // React Email packages need to be external for server components.
  // Prisma is listed by Next.js as an external package, but keeping it explicit
  // prevents serverless bundles from trying to load a traced package clone.
  serverExternalPackages: ['@react-email/render', '@prisma/client', 'prisma'],
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
    /**
     * The Salsadocs importer routes walk the repository for Markdown at runtime
     * (lib/developer/repo-docs.ts), which makes the file tracer pull the entire
     * app — including the ~340 MB public/ tree — into the function and blow past
     * the serverless size limit. These functions never serve static assets, so
     * exclude public/ here (the page-level image-optimization concern that keeps
     * public/images/** in the global trace does not apply to them).
     */
    '/api/developer/admin/salsadocs/**/*': [
      'public/**',
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
    // The Salsadocs importer reads repository markdown at runtime
    '/api/developer/admin/salsadocs/**/*': [
      './*.md',
      '../../*.md',
      '../../apps/*/*.md',
      '../../packages/**/*.md',
    ],
    // The public /developer page reads the monorepo-root CHANGELOG.md at runtime
    '/developer': [
      './CHANGELOG.md',
      '../../CHANGELOG.md',
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
    '/heat-index/**/*': [
      './node_modules/.prisma/client/**/*',
      './node_modules/@prisma/client/**/*',
    ],
  },
  turbopack: {
    // Resolve hoisted workspace dependencies from the Turborepo root.
    root: monorepoRoot,
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
