/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  swcMinify: true,
  transpilePackages: [],
  experimental: {
    optimizePackageImports: [
      'react',
      'react-dom'
    ],
  },
  images: {
    remotePatterns: [],
  },
}

export default nextConfig
