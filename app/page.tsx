import Image from 'next/image'
import Link from 'next/link'

export default function Home() {
  return (
    <main className="min-h-screen">
      {/* Hero Section */}
      <section className="hero-gradient relative overflow-hidden">
        <div className="absolute inset-0 bg-black opacity-20"></div>
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-24 lg:py-32">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
            <div className="text-white animate-slide-up">
              <h1 className="text-5xl lg:text-6xl font-bold font-serif mb-6">
                Premium Gourmet 
                <span className="block text-chile-200">Salsa</span>
              </h1>
              <p className="text-xl lg:text-2xl mb-8 text-gray-100 leading-relaxed">
                Made with the finest ingredients in Ohio. From mild to fiery hot, 
                discover the perfect salsa for every taste.
              </p>
              <div className="flex flex-col sm:flex-row gap-4">
                <Link href="/salsas" className="btn-primary text-lg px-8 py-4">
                  Shop Now
                </Link>
                <Link href="/about" className="btn-secondary text-lg px-8 py-4 bg-white/10 border-white/20 text-white hover:bg-white/20">
                  Our Story
                </Link>
              </div>
            </div>
            <div className="relative animate-slide-up animation-delay-200">
              <div className="relative w-full h-96 lg:h-[500px]">
                <Image
                  src="/images/products/Hero-image.webp"
                  alt="Fresh salsa with chips"
                  fill
                  className="object-cover object-center rounded-2xl shadow-2xl"
                  priority
                />
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Product Categories */}
      <section className="py-20 bg-gray-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-bold font-serif text-gray-900 mb-4">
              Find Your Perfect <span className="text-gradient">Heat Level</span>
            </h2>
            <p className="text-xl text-gray-600 max-w-3xl mx-auto">
              From those who like it mild to the heat seekers, we have the perfect salsa for everyone.
            </p>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {/* Mild Salsa */}
            <div className="card p-8 text-center group hover:scale-105 transition-transform duration-300">
              <div className="w-20 h-20 bg-verde-100 rounded-full mx-auto mb-6 flex items-center justify-center">
                <span className="text-3xl">🌿</span>
              </div>
              <h3 className="text-2xl font-bold mb-4 text-gray-900">Mild</h3>
              <p className="text-gray-600 mb-6">
                Perfect for those who enjoy flavor without the heat. Great for kids and mild palates.
              </p>
              <Link href="/salsas?heat=mild" className="btn-secondary w-full">
                Shop Mild
              </Link>
            </div>

            {/* Medium Salsa */}
            <div className="card p-8 text-center group hover:scale-105 transition-transform duration-300">
              <div className="w-20 h-20 bg-chile-100 rounded-full mx-auto mb-6 flex items-center justify-center">
                <span className="text-3xl">🌶️</span>
              </div>
              <h3 className="text-2xl font-bold mb-4 text-gray-900">Medium</h3>
              <p className="text-gray-600 mb-6">
                The perfect balance of flavor and heat. Our most popular choice for everyday enjoyment.
              </p>
              <Link href="/salsas?heat=medium" className="btn-secondary w-full">
                Shop Medium
              </Link>
            </div>

            {/* Hot Salsa */}
            <div className="card p-8 text-center group hover:scale-105 transition-transform duration-300">
              <div className="w-20 h-20 bg-salsa-100 rounded-full mx-auto mb-6 flex items-center justify-center">
                <span className="text-3xl">🔥</span>
              </div>
              <h3 className="text-2xl font-bold mb-4 text-gray-900">Hot</h3>
              <p className="text-gray-600 mb-6">
                For those who love the heat! Bold flavors with a serious kick that builds with each bite.
              </p>
              <Link href="/salsas?heat=hot" className="btn-secondary w-full">
                Shop Hot
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="py-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
            <div>
              <h2 className="text-4xl font-bold font-serif text-gray-900 mb-6">
                More Than Just Great Taste
              </h2>
              <div className="space-y-8">
                <div className="flex items-start space-x-4">
                  <div className="w-12 h-12 bg-salsa-100 rounded-lg flex items-center justify-center flex-shrink-0">
                    <span className="text-salsa-600 text-xl">🏪</span>
                  </div>
                  <div>
                    <h3 className="text-xl font-semibold text-gray-900 mb-2">Fundraising Made Easy</h3>
                    <p className="text-gray-600">
                      Perfect for schools, churches, and organizations. High-profit margins and products people actually want.
                    </p>
                  </div>
                </div>
                
                <div className="flex items-start space-x-4">
                  <div className="w-12 h-12 bg-verde-100 rounded-lg flex items-center justify-center flex-shrink-0">
                    <span className="text-verde-600 text-xl">🏭</span>
                  </div>
                  <div>
                    <h3 className="text-xl font-semibold text-gray-900 mb-2">Wholesale Options</h3>
                    <p className="text-gray-600">
                      Stock our premium salsas in your store. Competitive pricing with excellent support.
                    </p>
                  </div>
                </div>
                
                <div className="flex items-start space-x-4">
                  <div className="w-12 h-12 bg-chile-100 rounded-lg flex items-center justify-center flex-shrink-0">
                    <span className="text-chile-600 text-xl">📍</span>
                  </div>
                  <div>
                    <h3 className="text-xl font-semibold text-gray-900 mb-2">Local Presence</h3>
                    <p className="text-gray-600">
                      Find us at local stores throughout Ohio, or order online for delivery anywhere.
                    </p>
                  </div>
                </div>
              </div>
            </div>
            
            <div className="relative">
              <div className="relative w-full h-96 lg:h-[500px]">
                <Image
                  src="/images/salsa-bowl.png"
                  alt="Fresh ingredients for salsa"
                  fill
                  className="object-contain rounded-2xl"
                />
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20 bg-salsa-600">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="text-4xl font-bold text-white mb-6">
            Ready to Taste the Difference?
          </h2>
          <p className="text-xl text-salsa-100 mb-8 max-w-2xl mx-auto">
            Join thousands of satisfied customers who have made Jose Madrid Salsa their go-to choice.
          </p>
          <Link href="/salsas" className="btn-secondary text-lg px-8 py-4 bg-white text-salsa-600 hover:bg-gray-100">
            Shop All Salsas
          </Link>
        </div>
      </section>
    </main>
  )
}
