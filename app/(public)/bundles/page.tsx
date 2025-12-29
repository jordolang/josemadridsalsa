import type { Metadata } from 'next'
import { GiftBoxSelector } from '@/components/store/gift-box-selector'
import { createMetadata } from '@/lib/metadata'

export const metadata: Metadata = createMetadata({
  title: 'Bundle Deals - Create Your Perfect Gift Box',
  description:
    'Mix and match your favorite Jose Madrid salsas! Choose from 3, 5, 6, or 12-pack gift boxes and create the perfect combination.',
  pathname: '/bundles',
})

export default function BundlesPage() {
  return (
    <main className="min-h-screen bg-background">
      {/* Hero Section */}
      <section className="hero-gradient relative overflow-hidden py-16">
        <div className="absolute inset-0 bg-black opacity-20"></div>
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h1 className="text-5xl lg:text-6xl font-bold font-serif text-white mb-6">
            Bundle <span className="text-chile-200">Deals</span>
          </h1>
          <p className="text-xl lg:text-2xl text-gray-100 max-w-3xl mx-auto">
            Create your perfect gift box by mixing and matching your favorite salsas.
            Choose from 3, 5, 6, or 12-pack options.
          </p>
        </div>
      </section>

      {/* Gift Box Selector */}
      <GiftBoxSelector />

      {/* Benefits Section */}
      <section className="py-20 bg-muted/50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div className="text-center">
              <div className="w-16 h-16 bg-salsa-100 dark:bg-salsa-900/30 rounded-full mx-auto mb-4 flex items-center justify-center">
                <span className="text-3xl">🎁</span>
              </div>
              <h3 className="text-xl font-bold mb-2">Perfect Gift</h3>
              <p className="text-muted-foreground">
                Create a custom gift box for any occasion. Perfect for holidays, birthdays, or thank you gifts.
              </p>
            </div>
            <div className="text-center">
              <div className="w-16 h-16 bg-verde-100 dark:bg-verde-900/30 rounded-full mx-auto mb-4 flex items-center justify-center">
                <span className="text-3xl">💰</span>
              </div>
              <h3 className="text-xl font-bold mb-2">Better Value</h3>
              <p className="text-muted-foreground">
                Save money when you buy in bulk. Bundle deals offer great value compared to individual jars.
              </p>
            </div>
            <div className="text-center">
              <div className="w-16 h-16 bg-chile-100 dark:bg-chile-900/30 rounded-full mx-auto mb-4 flex items-center justify-center">
                <span className="text-3xl">🎨</span>
              </div>
              <h3 className="text-xl font-bold mb-2">Your Choice</h3>
              <p className="text-muted-foreground">
                Mix mild, medium, hot, and fruit salsas. Create the perfect combination for your taste.
              </p>
            </div>
          </div>
        </div>
      </section>
    </main>
  )
}
