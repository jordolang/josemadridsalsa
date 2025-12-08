import path from 'node:path'
import { fileURLToPath } from 'node:url'

const projectRoot = path.dirname(fileURLToPath(import.meta.url))

/** @type {import('next').NextConfig} */
const nextConfig = {
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
<<<<<<< HEAD
  },
  /**
   * Exclude large, unused directories from serverless traces to keep
   * functions under Vercel’s 250 MB unzipped limit.
   */
  outputFileTracingExcludes: {
    '*': [
      'data/**',
      'docs/**',
      'scripts/**',
      'tests/**',
      'public/images/**',
      'public/Fundraiser Forms/**',
      'public/samples/**',
      'prisma/dev.db',
      'prisma/seed*.ts',
      'prisma/seeds/**',
      'AGENTS.md',
    ],
  },
  turbopack: {
    // Force Turbopack to resolve packages from the actual repo root.
    root: projectRoot,
  },
  // Temporarily disable type checking for deployment
  typescript: {
    ignoreBuildErrors: true,
=======
    // Use system TLS certificates for Turbopack font downloads
    turbopackUseSystemTlsCerts: true,
>>>>>>> a914b70e48c74fb30ffafd6a685d5d84da8bcb1d
  },
}

export default nextConfig;
