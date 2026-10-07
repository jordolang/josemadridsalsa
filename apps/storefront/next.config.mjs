import path from 'node:path'
import { existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { withSentryConfig } from '@sentry/nextjs'
import { bigCommerceRedirects } from './bigcommerce-redirects.mjs'
import { domainRedirects } from './domain-redirects.mjs'
import {
  sharedHeaders,
  sharedImages,
  sharedServerExternalPackages,
  sharedTranspilePackages,
} from '../../packages/core/next-config.mjs'
const projectRoot = path.dirname(fileURLToPath(import.meta.url))
const workspaceRoot = path.resolve(projectRoot, '../..')
const monorepoRoot = existsSync(path.join(workspaceRoot, 'turbo.json'))
  ? workspaceRoot
  : projectRoot

/**
 * The fundraising site (apps/fundraising). Keep the default in step with
 * lib/fundraising-site/host.ts (this config cannot import TypeScript).
 */
const fundraisingSiteUrl = (process.env.NEXT_PUBLIC_FUNDRAISING_SITE_URL?.trim() || 'https://fundraising.josemadridsalsa.com').replace(/\/+$/, '')

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
  redirects: async () => [
    // josemadrid.net and the bare domain land on www.josemadridsalsa.com
    ...domainRedirects(),
    // Permanent redirect from the old La Perla page URL
    {
      source: '/la-perla-ave',
      destination: '/laperla',
      permanent: true,
    },
    // Old BigCommerce storefront URLs, for when josemadridsalsa.com points here
    ...bigCommerceRedirects(),
    // The fundraiser kits and fliers moved to the fundraising site with its pages.
    // proxy.ts redirects the pages; static files skip the proxy, so they go here.
    ...['/fundraising/downloads/:file*', '/game-icons/:file*'].map((source) => ({
      source,
      destination: `${fundraisingSiteUrl}${source}`,
      permanent: true,
    })),
  ],
  // Security headers, image hosts and server packages, shared with apps/fundraising
  headers: sharedHeaders,
  images: {
    ...sharedImages,
    // Merch photos come straight from Printify (lib/printify). Storefront-only, so the
    // fundraising site's image config stays as it is.
    remotePatterns: [
      ...sharedImages.remotePatterns,
      { protocol: 'https', hostname: 'images-api.printify.com', port: '', pathname: '/**' },
      { protocol: 'https', hostname: 'images.printify.com', port: '', pathname: '/**' },
    ],
  },
  serverExternalPackages: sharedServerExternalPackages,
  transpilePackages: sharedTranspilePackages,
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
