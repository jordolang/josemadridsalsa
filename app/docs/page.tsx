import Link from 'next/link'

export default function DocsPage() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-white">
      <div className="mx-auto max-w-4xl px-4 py-16 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="mb-12 text-center">
          <h1 className="text-4xl font-bold tracking-tight text-gray-900 sm:text-5xl">
            Documentation
          </h1>
          <p className="mt-4 text-lg text-gray-600">
            Complete guide to the José Madrid Salsa platform
          </p>
        </div>

        {/* Quick Links Grid */}
        <div className="grid gap-8 md:grid-cols-2 lg:grid-cols-3 mb-16">
          {/* Getting Started */}
          <Link
            href="/docs/getting-started"
            className="group rounded-lg border border-gray-200 p-6 hover:border-gray-300 hover:shadow-lg transition-all"
          >
            <div className="mb-3 text-2xl">🚀</div>
            <h3 className="text-lg font-semibold text-gray-900 group-hover:text-blue-600">
              Getting Started
            </h3>
            <p className="mt-2 text-sm text-gray-600">
              Set up your environment and get running in minutes
            </p>
          </Link>

          {/* API */}
          <Link
            href="/docs/api"
            className="group rounded-lg border border-gray-200 p-6 hover:border-gray-300 hover:shadow-lg transition-all"
          >
            <div className="mb-3 text-2xl">🔌</div>
            <h3 className="text-lg font-semibold text-gray-900 group-hover:text-blue-600">
              API Reference
            </h3>
            <p className="mt-2 text-sm text-gray-600">
              REST API endpoints and integration guide
            </p>
          </Link>

          {/* Features */}
          <Link
            href="/docs/features"
            className="group rounded-lg border border-gray-200 p-6 hover:border-gray-300 hover:shadow-lg transition-all"
          >
            <div className="mb-3 text-2xl">⚡</div>
            <h3 className="text-lg font-semibold text-gray-900 group-hover:text-blue-600">
              Features
            </h3>
            <p className="mt-2 text-sm text-gray-600">
              Explore core features and functionality
            </p>
          </Link>

          {/* Integrations */}
          <Link
            href="/docs/integrations"
            className="group rounded-lg border border-gray-200 p-6 hover:border-gray-300 hover:shadow-lg transition-all"
          >
            <div className="mb-3 text-2xl">🔗</div>
            <h3 className="text-lg font-semibold text-gray-900 group-hover:text-blue-600">
              Integrations
            </h3>
            <p className="mt-2 text-sm text-gray-600">
              Third-party service integrations
            </p>
          </Link>

          {/* Deployment */}
          <Link
            href="/docs/deployment"
            className="group rounded-lg border border-gray-200 p-6 hover:border-gray-300 hover:shadow-lg transition-all"
          >
            <div className="mb-3 text-2xl">🌐</div>
            <h3 className="text-lg font-semibold text-gray-900 group-hover:text-blue-600">
              Deployment
            </h3>
            <p className="mt-2 text-sm text-gray-600">
              Production deployment guide
            </p>
          </Link>

          {/* Configuration */}
          <Link
            href="/docs/configuration"
            className="group rounded-lg border border-gray-200 p-6 hover:border-gray-300 hover:shadow-lg transition-all"
          >
            <div className="mb-3 text-2xl">⚙️</div>
            <h3 className="text-lg font-semibold text-gray-900 group-hover:text-blue-600">
              Configuration
            </h3>
            <p className="mt-2 text-sm text-gray-600">
              System configuration and setup
            </p>
          </Link>

          {/* Guides */}
          <Link
            href="/docs/guides"
            className="group rounded-lg border border-gray-200 p-6 hover:border-gray-300 hover:shadow-lg transition-all"
          >
            <div className="mb-3 text-2xl">📖</div>
            <h3 className="text-lg font-semibold text-gray-900 group-hover:text-blue-600">
              How-To Guides
            </h3>
            <p className="mt-2 text-sm text-gray-600">
              Step-by-step guides and best practices
            </p>
          </Link>
        </div>

        {/* Platform Overview */}
        <div className="rounded-lg border border-gray-200 bg-white p-8">
          <h2 className="text-2xl font-bold text-gray-900 mb-6">Platform Overview</h2>
          <div className="grid gap-6 md:grid-cols-2">
            <div>
              <h3 className="font-semibold text-gray-900 mb-3">E-Commerce</h3>
              <ul className="space-y-2 text-sm text-gray-600">
                <li>• Complete product catalog system</li>
                <li>• Shopping cart and checkout</li>
                <li>• Order management and tracking</li>
                <li>• Inventory management</li>
              </ul>
            </div>
            <div>
              <h3 className="font-semibold text-gray-900 mb-3">Payments & Shipping</h3>
              <ul className="space-y-2 text-sm text-gray-600">
                <li>• Multiple payment gateways</li>
                <li>• Automated shipping calculation</li>
                <li>• Tax computation</li>
                <li>• Payment history</li>
              </ul>
            </div>
            <div>
              <h3 className="font-semibold text-gray-900 mb-3">Admin & Marketing</h3>
              <ul className="space-y-2 text-sm text-gray-600">
                <li>• Comprehensive admin dashboard</li>
                <li>• Email marketing campaigns</li>
                <li>• Advanced analytics</li>
                <li>• Lead generation system</li>
              </ul>
            </div>
            <div>
              <h3 className="font-semibold text-gray-900 mb-3">Integrations</h3>
              <ul className="space-y-2 text-sm text-gray-600">
                <li>• Stripe, PayPal, Square payments</li>
                <li>• Google Maps & Places</li>
                <li>• Shopify sync</li>
                <li>• Email & authentication</li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
