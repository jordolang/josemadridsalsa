import { Metadata } from 'next';
import Link from 'next/link';
import { ExternalLink } from 'lucide-react';

export const metadata: Metadata = {
  title: 'About Jose - Jose Madrid Salsa',
  description: 'Learn about Jose Madrid, the inspiration behind our authentic New Mexico-style salsas, and the rich family history that started it all in Zanesville, Ohio.',
  openGraph: {
    title: 'About Jose - Jose Madrid Salsa',
    description: 'Learn about Jose Madrid, the inspiration behind our authentic New Mexico-style salsas.',
    images: ['/og-about.jpg'],
  },
};

export default function AboutPage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-white via-salsa-50/30 to-chile-50/30">
      {/* Hero Section */}
      <section className="relative bg-gradient-to-r from-salsa-600 via-salsa-700 to-chile-600 text-white">
        <div className="absolute inset-0 bg-black/20"></div>
        <div className="relative container mx-auto px-4 py-20 lg:py-28">
          <div className="max-w-4xl mx-auto text-center">
            <h1 className="text-4xl lg:text-6xl font-serif font-bold mb-6 text-shadow-lg">
              About Jose Madrid
            </h1>
            <p className="text-xl lg:text-2xl text-salsa-100 max-w-2xl mx-auto leading-relaxed">
              The legendary cowboy and beloved grandfather who inspired our authentic New Mexico-style salsa recipes
            </p>
          </div>
        </div>
      </section>

      {/* Media Coverage */}
      <section className="py-12 bg-white">
        <div className="container mx-auto px-4">
          <div className="max-w-4xl mx-auto text-center">
            <div className="inline-flex items-center gap-3 bg-gradient-to-r from-salsa-100 to-chile-100 px-6 py-3 rounded-full mb-8">
              <ExternalLink className="w-5 h-5 text-salsa-600" />
              <p className="text-salsa-800 font-medium">
                Featured in{' '}
                <Link 
                  href="https://spectrumnews1.com/columbus/news/2021/07/28/jose-madrid-salsa?firebaseString=true&cid=app_share"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-bold hover:text-salsa-600 transition-colors underline"
                >
                  Spectrum News 1
                </Link>
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Main Content */}
      <section className="py-16">
        <div className="container mx-auto px-4">
          <div className="max-w-4xl mx-auto">
            {/* The Beginning */}
            <div className="prose prose-lg max-w-none mb-16">
              <div className="bg-white rounded-2xl shadow-xl p-8 lg:p-12">
                <h2 className="text-3xl font-serif font-bold text-salsa-800 mb-6">
                  The Restaurant That Started It All
                </h2>
                <p className="text-gray-700 leading-relaxed mb-6">
                  In 1976, Mike Zakany and his brother started a restaurant in downtown Zanesville, Ohio. After months of planning and building, Zak's Restaurant was a reality. The contemporary casual restaurant was a welcome addition to the small urban center and was quite successful from the beginning.
                </p>
                <p className="text-gray-700 leading-relaxed mb-6">
                  It was clear that the emerging ethnic food market was a logical niche for the Zakany brothers as their own Mexican heritage had a huge influence in the family kitchen. Estelle Zakany, the family matriarch, helped her sons integrate more authentic Mexican cuisine into the menu and life of the restaurant.
                </p>
              </div>
            </div>

            {/* Family Legacy */}
            <div className="grid lg:grid-cols-2 gap-12 items-center mb-16">
              <div className="bg-gradient-to-br from-verde-50 to-salsa-50 rounded-2xl p-8 lg:p-10">
                <h3 className="text-2xl font-serif font-bold text-salsa-800 mb-6">
                  A Family of Entrepreneurs
                </h3>
                <p className="text-gray-700 leading-relaxed mb-4">
                  The Zakany family has always had a rich history as entrepreneurs. Mike's paternal grandparents opened a butcher shop and grocery store in Zanesville in 1942.
                </p>
                <p className="text-gray-700 leading-relaxed">
                  Mike's father, uncle and entire family worked very hard to continue to grow the family business over the years. Zak's Restaurant was a natural extension of the Zakany's involvement and love for the food business.
                </p>
              </div>
              <div className="bg-white rounded-2xl shadow-xl p-8 lg:p-10">
                <h3 className="text-2xl font-serif font-bold text-salsa-800 mb-6">
                  Finding Their Niche
                </h3>
                <p className="text-gray-700 leading-relaxed mb-4">
                  The restaurant quickly developed a strong clientele. People clearly loved the "New Mexico" style food, and the phenomenal increase in "to go" food sales confirmed their niche.
                </p>
                <p className="text-gray-700 leading-relaxed">
                  The demand for salsa was a key part of the complete menu—salsa enhanced the flavors of all the dishes served. It then became time to develop the salsa to meet the demand.
                </p>
              </div>
            </div>

            {/* The Research */}
            <div className="bg-gradient-to-r from-chile-600 to-salsa-600 rounded-2xl text-white p-8 lg:p-12 mb-16">
              <h3 className="text-3xl font-serif font-bold mb-6">
                The Quest for Perfect Flavor
              </h3>
              <p className="text-chile-100 leading-relaxed mb-6 text-lg">
                Mike started an extensive marketing study that examined all kinds of spices and chili peppers. He read with great interest about the migration patterns of the European Spaniards to Mexico and the influence America's native people had on the newcomer's cuisine.
              </p>
              <p className="text-chile-100 leading-relaxed text-lg">
                Mike continued to work on the salsa recipes based on his research and experimentation. The restaurant customers were the critics for the salsa formulas born from Mike's hard work in the kitchen.
              </p>
            </div>

            {/* Jose Madrid Legend */}
            <div className="bg-white rounded-2xl shadow-xl p-8 lg:p-12 mb-16">
              <h3 className="text-3xl font-serif font-bold text-salsa-800 mb-8 text-center">
                The Legend of José Madrid
              </h3>
              <div className="grid lg:grid-cols-3 gap-8 mb-8">
                <div className="text-center">
                  <div className="w-16 h-16 bg-gradient-to-br from-salsa-500 to-chile-500 rounded-full flex items-center justify-center mx-auto mb-4">
                    <span className="text-white font-bold text-2xl">🤠</span>
                  </div>
                  <h4 className="font-bold text-salsa-800 mb-2">Master Horseman</h4>
                  <p className="text-gray-600 text-sm">He could ride a horse better than anyone else in the unsettled New Mexico Territory</p>
                </div>
                <div className="text-center">
                  <div className="w-16 h-16 bg-gradient-to-br from-verde-500 to-salsa-500 rounded-full flex items-center justify-center mx-auto mb-4">
                    <span className="text-white font-bold text-2xl">🎯</span>
                  </div>
                  <h4 className="font-bold text-salsa-800 mb-2">Expert Marksman</h4>
                  <p className="text-gray-600 text-sm">His shooting skills were legendary throughout the early 1900s frontier</p>
                </div>
                <div className="text-center">
                  <div className="w-16 h-16 bg-gradient-to-br from-chile-500 to-salsa-500 rounded-full flex items-center justify-center mx-auto mb-4">
                    <span className="text-white font-bold text-2xl">👨‍👩‍👧‍👦</span>
                  </div>
                  <h4 className="font-bold text-salsa-800 mb-2">Family Cornerstone</h4>
                  <p className="text-gray-600 text-sm">José was the reason the family rallied together for summer vacations and reunions in Clovis</p>
                </div>
              </div>
              <p className="text-gray-700 leading-relaxed text-center text-lg">
                Eventually, the "favorite" blend of spices, chili peppers and herbs were developed. These recipes came from the direct influence of Mike's maternal grandfather's cooking culture. In 1987, José Madrid Salsa became a reality, named after the family icon and beloved grandfather from Clovis, New Mexico.
              </p>
            </div>

            {/* Modern Legacy */}
            <div className="grid lg:grid-cols-2 gap-8 mb-16">
              <div className="bg-gradient-to-br from-salsa-50 to-chile-50 rounded-2xl p-8">
                <h3 className="text-2xl font-serif font-bold text-salsa-800 mb-6">
                  The Perfect Namesake
                </h3>
                <p className="text-gray-700 leading-relaxed mb-4">
                  Mike Zakany's tribute to his grandfather celebrates his childhood memories of the larger than life man. José Madrid was the perfect namesake for the unique New Mexico style of salsa.
                </p>
              </div>
              <div className="bg-gradient-to-br from-verde-50 to-salsa-50 rounded-2xl p-8">
                <h3 className="text-2xl font-serif font-bold text-salsa-800 mb-6">
                  First Sales & Growth
                </h3>
                <p className="text-gray-700 leading-relaxed mb-4">
                  José Madrid Salsa made its first sales in gourmet and grocery stores during the Christmas season of 1988. The legend of José Madrid lives on and continues to grow with a line of twenty five different salsas and more in development.
                </p>
              </div>
            </div>

            {/* Closing */}
            <div className="text-center bg-gradient-to-r from-salsa-600 to-chile-600 rounded-2xl text-white p-12">
              <h3 className="text-3xl font-serif font-bold mb-6">
                <em>Es la verdad!</em>
              </h3>
              <p className="text-salsa-100 text-lg max-w-2xl mx-auto">
                The spirit of José Madrid—cowboy, marksman, and family patriarch—lives on in every jar of our authentic New Mexico-style salsa.
              </p>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}