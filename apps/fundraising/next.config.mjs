const storefrontOrigin = process.env.LEGACY_STOREFRONT_ORIGIN ?? 'http://localhost:3000'
const backendOrigin = process.env.BACKEND_ORIGIN ?? 'http://localhost:3002'

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
        { source: '/fundraise/:path*', destination: `${storefrontOrigin}/fundraise/:path*` },
        { source: '/fundraiser-portal/:path*', destination: `${storefrontOrigin}/fundraiser-portal/:path*` },
        { source: '/fundraisers/:path*', destination: `${storefrontOrigin}/fundraisers/:path*` },
        { source: '/fundraising', destination: `${storefrontOrigin}/fundraising` },
        { source: '/f/:path*', destination: `${storefrontOrigin}/f/:path*` },
        { source: '/arena/:path*', destination: `${storefrontOrigin}/arena/:path*` }
      ],
      afterFiles: [],
      fallback: []
    }
  }
}

export default nextConfig
