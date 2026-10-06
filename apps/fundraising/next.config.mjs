import path from 'node:path'
import { existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
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
 * The main site (apps/storefront). Keep the default in step with
 * packages/core/lib/site-url.ts (this config cannot import TypeScript).
 */
const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL?.trim() || 'https://www.josemadrid.net').replace(/\/+$/, '')

/**
 * Main-site pages that shared components (cart, checkout, footer, sign-in)
 * link to with a relative URL. This app does not serve them, so they go to
 * the main site rather than the old-URL catch-all's 404.
 */
const MAIN_SITE_PATHS = [
  'about',
  'accessibility',
  'account',
  'admin',
  'bundles',
  'collections',
  'cookies',
  'deletemydata',
  'faq',
  'find-us',
  'gift-certificates',
  'heat-index',
  'laperla',
  'live',
  'merchandise',
  'my',
  'privacy',
  'products',
  'recipes',
  'refunds',
  'returns',
  'salsas',
  'terms',
  'track',
  'unsubscribe',
  'waiver',
  'where-is-jose',
  'wholesale',
  'wishlist',
]

/** @type {import('next').NextConfig} */
const nextConfig = {
  outputFileTracingRoot: monorepoRoot,
  // The same security headers, image hosts and server packages as the main site.
  headers: sharedHeaders,
  images: sharedImages,
  serverExternalPackages: sharedServerExternalPackages,
  transpilePackages: sharedTranspilePackages,
  experimental: {
    serverActions: {
      allowedOrigins: ['localhost:3001'],
    },
  },
  redirects: async () => [
    ...MAIN_SITE_PATHS.flatMap((segment) => [
      { source: `/${segment}`, destination: `${siteUrl}/${segment}`, permanent: false },
      { source: `/${segment}/:path*`, destination: `${siteUrl}/${segment}/:path*`, permanent: false },
    ]),
    // The fundraiser order forms were replaced by the 2026 kits.
    ...[25, 16, 9].map((flavors) => ({
      source: `/fundraising/downloads/${flavors}-flavor-fundraiser-forms.zip`,
      destination: `/fundraising/downloads/2026-Fundraiser-Kit-${flavors}-Flavors.zip`,
      permanent: true,
    })),
  ],
  rewrites: async () => ({
    beforeFiles: [],
    // Images that live only in the main site's public/ folder. Not a fallback
    // rewrite: the old-URL catch-all page would answer first.
    afterFiles: [{ source: '/images/:path*', destination: `${siteUrl}/images/:path*` }],
    fallback: [],
  }),
  outputFileTracingIncludes: {
    '/api/**/*': [
      './node_modules/.prisma/client/**/*',
      './node_modules/@prisma/client/**/*',
      '../../node_modules/.prisma/client/**/*',
      '../../node_modules/@prisma/client/**/*',
    ],
  },
  turbopack: {
    // Resolve hoisted workspace dependencies from the Turborepo root.
    root: monorepoRoot,
  },
}

export default nextConfig
