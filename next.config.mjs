import path from 'node:path'
import { fileURLToPath } from 'node:url'

const projectRoot = path.dirname(fileURLToPath(import.meta.url))

/** @type {import('next').NextConfig} */
const nextConfig = {
  // Force cache invalidation for Vercel builds
  generateBuildId: async () => {
    return `build-${Date.now()}`
  },
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'cdn11.bigcommerce.com',
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
    ],
  },
  experimental: {
    serverActions: {
      allowedOrigins: ['localhost:3000'],
    },
    // Use system TLS certificates for Turbopack font downloads
    turbopackUseSystemTlsCerts: true,
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
    '/find-us': [
      './public/find-us-locally/**/*',
    ],
  },
  turbopack: {
    // Force Turbopack to resolve packages from the actual repo root.
    root: projectRoot,
  },
}

export default nextConfig;
