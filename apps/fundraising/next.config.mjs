const storefrontOrigin = process.env.LEGACY_STOREFRONT_ORIGIN ?? 'http://localhost:3000'
const backendOrigin = process.env.BACKEND_ORIGIN ?? 'http://localhost:3002'
const legacyFundraisingRoute = (path) => `${storefrontOrigin}${path}?fundraising-app-proxy=1`

/** @type {import('next').NextConfig} */
const nextConfig = {
  async rewrites() {
    return {
      beforeFiles: [
        { source: '/api/:path*', destination: `${backendOrigin}/api/:path*` },
        { source: '/_next/:path*', destination: `${storefrontOrigin}/_next/:path*` },
        { source: '/images/:path*', destination: `${storefrontOrigin}/images/:path*` },
        { source: '/game-icons/:path*', destination: `${storefrontOrigin}/game-icons/:path*` },
        { source: '/auth/:path*', destination: `${storefrontOrigin}/auth/:path*` },
        { source: '/fundraise/:path*', destination: legacyFundraisingRoute('/fundraise/:path*') },
        { source: '/fundraiser-portal/:path*', destination: legacyFundraisingRoute('/fundraiser-portal/:path*') },
        { source: '/fundraisers/:path*', destination: legacyFundraisingRoute('/fundraisers/:path*') },
        { source: '/fundraising', destination: legacyFundraisingRoute('/fundraising') },
        { source: '/f/:path*', destination: legacyFundraisingRoute('/f/:path*') },
        { source: '/arena/:path*', destination: legacyFundraisingRoute('/arena/:path*') }
      ],
      afterFiles: [],
      fallback: []
    }
  }
}

export default nextConfig
