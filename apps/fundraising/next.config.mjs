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
const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL?.trim() || 'https://www.josemadridsalsa.com').replace(/\/+$/, '')

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

/**
 * The 3D Battle Arena game (the battle-arena-3d repository), built to one file in
 * public/battle-arena/index.html and served at /battle-arena. Its page loads its
 * code inline and talks to the main site's /api/arena (sign-in, results,
 * leaderboards, game codes), the game's own deployment (fundraising teams), the
 * CDN its sounds live on and the PeerJS server that links online rooms, so it
 * gets its own Content-Security-Policy in place of the site-wide one.
 */
const BATTLE_ARENA_CSP = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline'",
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
  "font-src 'self' data: https://fonts.gstatic.com",
  "img-src 'self' data: blob:",
  "media-src 'self' data: blob:",
  "worker-src 'self' blob:",
  // The game calls www.josemadridsalsa.com by name, whatever NEXT_PUBLIC_SITE_URL says.
  `connect-src 'self' ${[...new Set(['https://www.josemadridsalsa.com', siteUrl])].join(' ')} https://battle-arena-3d-mauve.vercel.app https://d2ol7oe51mr4n9.cloudfront.net https://0.peerjs.com wss://0.peerjs.com`,
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
  ...(process.env.NODE_ENV === 'production' ? ['upgrade-insecure-requests'] : []),
].join('; ')

/** @type {import('next').NextConfig} */
const nextConfig = {
  outputFileTracingRoot: monorepoRoot,
  // The same security headers, image hosts and server packages as the main site.
  // Listed after the site-wide rule, the game's CSP wins on its own pages.
  headers: async () => [
    ...(await sharedHeaders()),
    {
      source: '/battle-arena/:path*',
      headers: [{ key: 'Content-Security-Policy', value: BATTLE_ARENA_CSP }],
    },
  ],
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
    // The game is a static page; /battle-arena (with any ?room= or ?t= invite) serves it.
    beforeFiles: [{ source: '/battle-arena', destination: '/battle-arena/index.html' }],
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
