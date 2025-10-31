import { Metadata } from 'next';
import Link from 'next/link';
import { MapPin, Truck, Calendar, Store, Users, Compass, Mountain, Building, Utensils } from 'lucide-react';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { GoogleScheduleMap } from './_components/GoogleScheduleMap';

export const metadata: Metadata = {
  title: 'Where is Jose? - Jose Madrid Salsa',
  description: 'Follow Jose Madrid Salsa from our Ohio home base to retail locations, farmers markets, and tables across the region. Discover where you can find our authentic flavors.',
  openGraph: {
    title: 'Where is Jose? - Jose Madrid Salsa',
    description: 'Discover where to find authentic Jose Madrid Salsa near you.',
    images: ['/og-where-jose.jpg'],
  },
};

const locations = [
  {
    title: "Home Base - Zanesville, Ohio",
    description: "Where it all began and where our authentic recipes are still crafted today",
    icon: Building,
    details: "The heart of Jose Madrid Salsa operations, where Mike Zakany first developed our signature recipes."
  },
  {
    title: "Retail Partners",
    description: "Specialty stores, grocery chains, and markets across the Midwest",
    icon: Store,
    details: "Find our products in carefully selected retail locations that appreciate authentic, quality food."
  },
  {
    title: "Farmers Markets",
    description: "Connecting directly with communities at seasonal markets",
    icon: Users,
    details: "Meet our team and taste our salsas fresh at local farmers markets throughout Ohio."
  },
  {
    title: "Restaurant Partners",
    description: "Fine dining and casual establishments featuring our salsas",
    icon: Utensils,
    details: "Restaurants and foodservice partners who trust our authentic flavor in their kitchens."
  }
];

const regions = [
  {
    name: "Ohio Valley",
    description: "Our strongest presence spans across southeastern Ohio and the Ohio Valley region",
    highlights: ["Zanesville", "Columbus", "Cincinnati", "Dayton", "Springfield"]
  },
  {
    name: "Midwest Expansion",
    description: "Growing presence throughout the Great Lakes states",
    highlights: ["Michigan", "Indiana", "Kentucky", "West Virginia", "Pennsylvania"]
  },
  {
    name: "Online Everywhere",
    description: "Direct-to-consumer shipping brings Jose Madrid to your door nationwide",
    highlights: ["All 50 States", "Direct Shipping", "Fundraising Programs", "Corporate Orders"]
  }
];

export default function WhereIsJosePage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-white via-chile-50/30 to-verde-50/30">
      {/* Hero Section */}
      <section className="relative bg-gradient-to-r from-chile-600 via-salsa-600 to-verde-600 text-white">
        <div className="absolute inset-0 bg-black/20"></div>
        <div className="relative container mx-auto px-4 py-20 lg:py-28">
          <div className="max-w-4xl mx-auto text-center">
            <Compass className="w-16 h-16 mx-auto mb-6 text-yellow-300" />
            <h1 className="text-4xl lg:text-6xl font-serif font-bold mb-6 text-shadow-lg">
              Where is Jose?
            </h1>
            <p className="text-xl lg:text-2xl text-chile-100 max-w-3xl mx-auto leading-relaxed">
              From our Ohio roots to tables across America, follow the journey of Jose Madrid Salsa and discover where authentic flavor lives.
            </p>
          </div>
        </div>
      </section>

      {/* On the Move Schedule */}
      <section className="py-16 bg-gradient-to-r from-white via-verde-50/40 to-chile-50/30">
        <div className="container mx-auto px-4">
          <div className="mx-auto max-w-6xl space-y-12">
            <div className="mx-auto max-w-3xl text-center">
              <div className="mb-4 flex items-center justify-center gap-3 text-salsa-700">
                <Truck className="h-6 w-6" />
                <Calendar className="h-6 w-6" />
              </div>
              <h2 className="text-3xl font-serif font-bold text-salsa-800">On the Move Schedule</h2>
              <p className="mt-4 text-lg text-gray-700">
                Track Jose&apos;s farmers markets, retail demos, and special events in real time.
                The map syncs directly from our Google Calendar—once your credentials are in place,
                every new booking will appear automatically.
              </p>
            </div>
            <GoogleScheduleMap />
          </div>
        </div>
      </section>

      {/* The Journey Begins */}
      <section className="py-16">
        <div className="container mx-auto px-4">
          <div className="max-w-4xl mx-auto">
            <div className="text-center mb-16">
              <h2 className="text-3xl lg:text-4xl font-serif font-bold text-salsa-800 mb-6">
                The Journey of Jose Madrid
              </h2>
              <p className="text-xl text-gray-700 max-w-2xl mx-auto">
                Every jar carries the spirit of José Madrid from Clovis, New Mexico to kitchens everywhere
              </p>
            </div>

            <div className="bg-gradient-to-r from-salsa-600 to-chile-600 rounded-2xl text-white p-8 lg:p-12 mb-16">
              <div className="grid lg:grid-cols-2 gap-8 items-center">
                <div>
                  <Mountain className="w-12 h-12 mb-4 text-yellow-300" />
                  <h3 className="text-2xl font-serif font-bold mb-4">From New Mexico Territory...</h3>
                  <p className="text-salsa-100 leading-relaxed mb-4">
                    José Madrid rode the ranges of early 1900s New Mexico, a legendary cowboy and marksman whose culinary traditions would inspire generations. His recipes and cooking culture became the foundation of our authentic flavors.
                  </p>
                </div>
                <div>
                  <Building className="w-12 h-12 mb-4 text-yellow-300" />
                  <h3 className="text-2xl font-serif font-bold mb-4">...To Ohio's Heart</h3>
                  <p className="text-salsa-100 leading-relaxed mb-4">
                    In 1987, Mike Zakany honored his grandfather's memory by naming our salsa after José Madrid. From Zak's Restaurant in Zanesville, Ohio, these authentic New Mexico-style recipes found their way into jars, and Jose Madrid Salsa was born.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Where You'll Find Jose */}
      <section className="py-16 bg-gradient-to-r from-verde-50 to-chile-50">
        <div className="container mx-auto px-4">
          <div className="max-w-6xl mx-auto">
            <div className="text-center mb-16">
              <h2 className="text-3xl lg:text-4xl font-serif font-bold text-salsa-800 mb-6">
                Where You'll Find Jose Today
              </h2>
              <p className="text-xl text-gray-700 max-w-3xl mx-auto">
                Jose Madrid Salsa has grown from a single restaurant to locations across the region and beyond
              </p>
            </div>

            <div className="grid md:grid-cols-2 gap-8">
              {locations.map((location, index) => (
                <Card key={index} className="bg-white border-0 shadow-lg hover:shadow-xl transition-shadow">
                  <CardHeader className="pb-4">
                    <div className="flex items-start gap-4">
                      <div className="w-12 h-12 bg-gradient-to-br from-salsa-500 to-chile-500 rounded-full flex items-center justify-center flex-shrink-0">
                        <location.icon className="w-6 h-6 text-white" />
                      </div>
                      <div>
                        <h3 className="text-xl font-bold text-salsa-800 mb-2">{location.title}</h3>
                        <p className="text-gray-600 text-sm">{location.description}</p>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <p className="text-gray-700 leading-relaxed">
                      {location.details}
                    </p>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Regional Presence */}
      <section className="py-16">
        <div className="container mx-auto px-4">
          <div className="max-w-6xl mx-auto">
            <div className="text-center mb-16">
              <MapPin className="w-12 h-12 mx-auto mb-4 text-salsa-600" />
              <h2 className="text-3xl lg:text-4xl font-serif font-bold text-salsa-800 mb-6">
                Our Growing Reach
              </h2>
              <p className="text-xl text-gray-700 max-w-3xl mx-auto">
                From our Ohio home base, Jose Madrid Salsa is spreading authentic flavor across America
              </p>
            </div>

            <div className="space-y-8">
              {regions.map((region, index) => (
                <Card key={index} className="bg-white border-0 shadow-lg">
                  <CardHeader>
                    <div className="flex items-center gap-3">
                      <div className="w-4 h-4 bg-gradient-to-r from-salsa-500 to-chile-500 rounded-full"></div>
                      <h3 className="text-2xl font-serif font-bold text-salsa-800">{region.name}</h3>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <p className="text-gray-700 leading-relaxed mb-6">{region.description}</p>
                    <div className="flex flex-wrap gap-2">
                      {region.highlights.map((highlight, i) => (
                        <span key={i} className="px-3 py-1 bg-gradient-to-r from-salsa-100 to-chile-100 text-salsa-700 rounded-full text-sm font-medium">
                          {highlight}
                        </span>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* On the Road */}
      <section className="py-16 bg-gradient-to-r from-salsa-600 to-chile-600 text-white">
        <div className="container mx-auto px-4">
          <div className="max-w-4xl mx-auto text-center">
            <Truck className="w-16 h-16 mx-auto mb-6 text-yellow-300" />
            <h2 className="text-3xl lg:text-4xl font-serif font-bold mb-8">
              Jose on the Move
            </h2>
            <p className="text-xl text-salsa-100 mb-12 max-w-2xl mx-auto">
              Look for us at special events, farmers markets, and food festivals throughout the year
            </p>

            <div className="grid md:grid-cols-2 gap-8 mb-12">
              <div className="bg-white/10 backdrop-blur rounded-2xl p-6">
                <Calendar className="w-10 h-10 mx-auto mb-4 text-yellow-300" />
                <h3 className="text-xl font-bold mb-2">Seasonal Markets</h3>
                <p className="text-salsa-100">
                  Find us at farmers markets throughout Ohio during growing season, connecting directly with our community.
                </p>
              </div>
              
              <div className="bg-white/10 backdrop-blur rounded-2xl p-6">
                <Users className="w-10 h-10 mx-auto mb-4 text-yellow-300" />
                <h3 className="text-xl font-bold mb-2">Special Events</h3>
                <p className="text-salsa-100">
                  Food festivals, county fairs, and community celebrations where you can taste our authentic flavors.
                </p>
              </div>
            </div>

            <p className="text-lg text-salsa-100 mb-8">
              Want to know when Jose is coming to your area?
            </p>
            <Button size="lg" className="bg-white text-salsa-700 hover:bg-salsa-50 font-semibold" asChild>
              <Link href="/find-us">
                Contact Us for Event Schedule
              </Link>
            </Button>
          </div>
        </div>
      </section>

      {/* Find Jose Near You */}
      <section className="py-16">
        <div className="container mx-auto px-4">
          <div className="max-w-4xl mx-auto">
            <div className="text-center mb-12">
              <h2 className="text-3xl lg:text-4xl font-serif font-bold text-salsa-800 mb-6">
                Find Jose Near You
              </h2>
              <p className="text-xl text-gray-700 max-w-2xl mx-auto mb-8">
                Looking for Jose Madrid Salsa in your area? Here are the best ways to track down our authentic flavors.
              </p>
            </div>

            <div className="grid md:grid-cols-3 gap-8">
              <Card className="text-center bg-gradient-to-br from-salsa-50 to-chile-50 border-0 shadow-lg">
                <CardHeader>
                  <Store className="w-12 h-12 mx-auto mb-4 text-salsa-600" />
                  <h3 className="text-xl font-bold text-salsa-800">Retail Locations</h3>
                </CardHeader>
                <CardContent>
                  <p className="text-gray-700 mb-4">Check with your local specialty food stores and independent grocers.</p>
                  <Button variant="outline" className="border-salsa-500 text-salsa-600 hover:bg-salsa-50" asChild>
                    <Link href="/wholesale">Become a Retailer</Link>
                  </Button>
                </CardContent>
              </Card>

              <Card className="text-center bg-gradient-to-br from-verde-50 to-salsa-50 border-0 shadow-lg">
                <CardHeader>
                  <Truck className="w-12 h-12 mx-auto mb-4 text-verde-600" />
                  <h3 className="text-xl font-bold text-salsa-800">Online Ordering</h3>
                </CardHeader>
                <CardContent>
                  <p className="text-gray-700 mb-4">Order directly from us with nationwide shipping available.</p>
                  <Button variant="outline" className="border-verde-500 text-verde-600 hover:bg-verde-50" asChild>
                    <Link href="/products">Shop Online</Link>
                  </Button>
                </CardContent>
              </Card>

              <Card className="text-center bg-gradient-to-br from-chile-50 to-salsa-50 border-0 shadow-lg">
                <CardHeader>
                  <Users className="w-12 h-12 mx-auto mb-4 text-chile-600" />
                  <h3 className="text-xl font-bold text-salsa-800">Fundraising</h3>
                </CardHeader>
                <CardContent>
                  <p className="text-gray-700 mb-4">Bring Jose to your organization through our fundraising program.</p>
                  <Button variant="outline" className="border-chile-500 text-chile-600 hover:bg-chile-50" asChild>
                    <Link href="/fundraising">Start Fundraising</Link>
                  </Button>
                </CardContent>
              </Card>
            </div>

            {/* Final Message */}
            <div className="mt-16 text-center bg-white rounded-2xl shadow-xl p-8">
              <h3 className="text-2xl font-serif font-bold text-salsa-800 mb-4">
                The Spirit of Jose Lives On
              </h3>
              <p className="text-gray-700 text-lg max-w-2xl mx-auto">
                Whether you find us in a country store in Ohio, at a farmers market, or delivered to your door—every jar of Jose Madrid Salsa carries the authentic spirit of the legendary cowboy who inspired it all. <em>¡Es la verdad!</em>
              </p>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
