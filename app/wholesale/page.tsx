import { Metadata } from 'next';
import Link from 'next/link';
import { Store, Package, TrendingUp, ExternalLink, Mail, Phone, CheckCircle, Users, Truck } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader } from '@/components/ui/card';

export const metadata: Metadata = {
  title: 'Wholesale - Jose Madrid Salsa',
  description: 'Interested in carrying Jose Madrid Salsa in your store? Learn about our wholesale program, pricing, and how to become a retail partner.',
  openGraph: {
    title: 'Wholesale - Jose Madrid Salsa',
    description: 'Partner with Jose Madrid Salsa for wholesale opportunities. Premium quality salsas for retail stores.',
    images: ['/og-wholesale.jpg'],
  },
};

const benefits = [
  {
    icon: TrendingUp,
    title: "Growing Brand",
    description: "Join a respected regional brand with over 35 years of authentic flavor and growing customer loyalty."
  },
  {
    icon: Package,
    title: "Premium Products",
    description: "25+ unique flavors of authentic New Mexico-style salsa, made with quality ingredients and traditional recipes."
  },
  {
    icon: Users,
    title: "Dedicated Support",
    description: "Personal customer service and support to help your business succeed with our products."
  },
  {
    icon: Truck,
    title: "Reliable Delivery",
    description: "Consistent inventory management and reliable shipping to keep your shelves stocked."
  }
];

const storeTypes = [
  {
    title: "Grocery Stores",
    description: "Regional and independent grocery chains looking to offer unique, authentic salsa options"
  },
  {
    title: "Specialty Food Stores",
    description: "Gourmet and specialty food retailers focused on quality, artisanal products"
  },
  {
    title: "Gift Shops",
    description: "Tourist destinations and gift shops featuring local and regional food specialties"
  },
  {
    title: "Restaurants",
    description: "Restaurants and foodservice establishments seeking authentic salsa for their menu"
  }
];

export default function WholesalePage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-white via-verde-50/30 to-salsa-50/30">
      {/* Hero Section */}
      <section className="relative bg-gradient-to-r from-salsa-600 via-chile-600 to-verde-600 text-white">
        <div className="absolute inset-0 bg-black/20"></div>
        <div className="relative container mx-auto px-4 py-20 lg:py-28">
          <div className="max-w-4xl mx-auto text-center">
            <h1 className="text-4xl lg:text-6xl font-serif font-bold mb-6 text-shadow-lg">
              Wholesale Partners
            </h1>
            <p className="text-xl lg:text-2xl text-salsa-100 max-w-3xl mx-auto leading-relaxed mb-8">
              Interested in carrying our product in your store? Partner with Jose Madrid Salsa to offer your customers authentic New Mexico-style flavor.
            </p>
            <div className="flex flex-wrap justify-center gap-4">
              <Button size="lg" className="bg-white text-salsa-700 hover:bg-salsa-50 font-semibold" asChild>
                <Link href="https://josemadridsalsa.faire.com" target="_blank" rel="noopener noreferrer">
                  <ExternalLink className="w-5 h-5 mr-2" />
                  Shop on Faire
                </Link>
              </Button>
              <Button size="lg" variant="outline" className="border-white text-white hover:bg-white/10" asChild>
                <Link href="#contact">
                  Contact Us Directly
                </Link>
              </Button>
            </div>
          </div>
        </div>
      </section>

      {/* Ordering Options */}
      <section className="py-16">
        <div className="container mx-auto px-4">
          <div className="max-w-6xl mx-auto">
            <div className="text-center mb-16">
              <h2 className="text-3xl lg:text-4xl font-serif font-bold text-salsa-800 mb-6">
                Two Ways to Order
              </h2>
              <p className="text-xl text-gray-700 max-w-3xl mx-auto">
                We make it easy for retailers to stock Jose Madrid Salsa with flexible ordering options
              </p>
            </div>

            <div className="grid lg:grid-cols-2 gap-12">
              {/* Faire Platform */}
              <Card className="bg-gradient-to-br from-salsa-50 to-chile-50 border-0 shadow-xl">
                <CardHeader className="text-center pb-4">
                  <div className="w-16 h-16 bg-gradient-to-br from-salsa-500 to-chile-500 rounded-full flex items-center justify-center mx-auto mb-4">
                    <Store className="w-8 h-8 text-white" />
                  </div>
                  <h3 className="text-2xl font-serif font-bold text-salsa-800">
                    Order Through Faire
                  </h3>
                </CardHeader>
                <CardContent className="space-y-4">
                  <p className="text-gray-700 leading-relaxed">
                    We have a selection of salsas available through Faire, the leading wholesale marketplace for independent retailers.
                  </p>
                  <ul className="space-y-3">
                    <li className="flex items-start gap-3">
                      <CheckCircle className="w-5 h-5 text-salsa-500 flex-shrink-0 mt-0.5" />
                      <span>Easy online ordering platform</span>
                    </li>
                    <li className="flex items-start gap-3">
                      <CheckCircle className="w-5 h-5 text-salsa-500 flex-shrink-0 mt-0.5" />
                      <span>Flexible payment terms</span>
                    </li>
                    <li className="flex items-start gap-3">
                      <CheckCircle className="w-5 h-5 text-salsa-500 flex-shrink-0 mt-0.5" />
                      <span>Competitive wholesale pricing</span>
                    </li>
                    <li className="flex items-start gap-3">
                      <CheckCircle className="w-5 h-5 text-salsa-500 flex-shrink-0 mt-0.5" />
                      <span>Free shipping on qualifying orders</span>
                    </li>
                  </ul>
                  <div className="pt-4">
                    <Button className="w-full bg-gradient-to-r from-salsa-600 to-chile-600 hover:from-salsa-700 hover:to-chile-700" asChild>
                      <Link href="https://josemadridsalsa.faire.com" target="_blank" rel="noopener noreferrer">
                        <ExternalLink className="w-5 h-5 mr-2" />
                        Visit Our Faire Store
                      </Link>
                    </Button>
                  </div>
                </CardContent>
              </Card>

              {/* Direct Contact */}
              <Card className="bg-gradient-to-br from-verde-50 to-salsa-50 border-0 shadow-xl">
                <CardHeader className="text-center pb-4">
                  <div className="w-16 h-16 bg-gradient-to-br from-verde-500 to-salsa-500 rounded-full flex items-center justify-center mx-auto mb-4">
                    <Users className="w-8 h-8 text-white" />
                  </div>
                  <h3 className="text-2xl font-serif font-bold text-salsa-800">
                    Contact Us Directly
                  </h3>
                </CardHeader>
                <CardContent className="space-y-4">
                  <p className="text-gray-700 leading-relaxed">
                    Prefer to work directly with our team? We welcome direct inquiries from retailers interested in carrying our products.
                  </p>
                  <ul className="space-y-3">
                    <li className="flex items-start gap-3">
                      <CheckCircle className="w-5 h-5 text-verde-500 flex-shrink-0 mt-0.5" />
                      <span>Personal service and support</span>
                    </li>
                    <li className="flex items-start gap-3">
                      <CheckCircle className="w-5 h-5 text-verde-500 flex-shrink-0 mt-0.5" />
                      <span>Custom pricing discussions</span>
                    </li>
                    <li className="flex items-start gap-3">
                      <CheckCircle className="w-5 h-5 text-verde-500 flex-shrink-0 mt-0.5" />
                      <span>Full product line access</span>
                    </li>
                    <li className="flex items-start gap-3">
                      <CheckCircle className="w-5 h-5 text-verde-500 flex-shrink-0 mt-0.5" />
                      <span>Marketing support materials</span>
                    </li>
                  </ul>
                  <div className="pt-4">
                    <Button variant="outline" className="w-full border-verde-500 text-verde-600 hover:bg-verde-50" asChild>
                      <Link href="#contact">
                        Get In Touch
                      </Link>
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      </section>

      {/* Why Partner With Us */}
      <section className="py-16 bg-gradient-to-r from-salsa-50 to-chile-50">
        <div className="container mx-auto px-4">
          <div className="max-w-6xl mx-auto">
            <div className="text-center mb-16">
              <h2 className="text-3xl lg:text-4xl font-serif font-bold text-salsa-800 mb-6">
                Why Partner with Jose Madrid Salsa?
              </h2>
              <p className="text-xl text-gray-700 max-w-3xl mx-auto">
                We're more than just a supplier—we're a partner committed to your success
              </p>
            </div>

            <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-8">
              {benefits.map((benefit, index) => (
                <Card key={index} className="bg-white border-0 shadow-lg text-center">
                  <CardHeader className="pb-4">
                    <div className="w-16 h-16 bg-gradient-to-br from-salsa-500 to-chile-500 rounded-full flex items-center justify-center mx-auto mb-4">
                      <benefit.icon className="w-8 h-8 text-white" />
                    </div>
                    <h3 className="text-xl font-bold text-salsa-800">
                      {benefit.title}
                    </h3>
                  </CardHeader>
                  <CardContent>
                    <p className="text-gray-700 leading-relaxed">
                      {benefit.description}
                    </p>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Perfect For */}
      <section className="py-16">
        <div className="container mx-auto px-4">
          <div className="max-w-6xl mx-auto">
            <div className="text-center mb-16">
              <h2 className="text-3xl lg:text-4xl font-serif font-bold text-salsa-800 mb-6">
                Perfect for Your Store Type
              </h2>
              <p className="text-xl text-gray-700 max-w-3xl mx-auto">
                Our authentic salsas are a great fit for various retail environments
              </p>
            </div>

            <div className="grid md:grid-cols-2 gap-8">
              {storeTypes.map((type, index) => (
                <Card key={index} className="bg-white border-0 shadow-lg">
                  <CardHeader>
                    <h3 className="text-xl font-bold text-salsa-800 flex items-center gap-3">
                      <div className="w-3 h-3 bg-gradient-to-r from-salsa-500 to-chile-500 rounded-full"></div>
                      {type.title}
                    </h3>
                  </CardHeader>
                  <CardContent>
                    <p className="text-gray-700 leading-relaxed">
                      {type.description}
                    </p>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Contact Section */}
      <section id="contact" className="py-16 bg-gradient-to-r from-salsa-600 to-chile-600 text-white">
        <div className="container mx-auto px-4">
          <div className="max-w-4xl mx-auto text-center">
            <h2 className="text-3xl lg:text-4xl font-serif font-bold mb-8">
              Ready to Get Started?
            </h2>
            <p className="text-xl text-salsa-100 mb-12 max-w-2xl mx-auto">
              Contact us today to discuss wholesale opportunities and how we can help grow your business together.
            </p>

            <div className="grid md:grid-cols-2 gap-8 mb-12">
              <div className="bg-white/10 backdrop-blur rounded-2xl p-8">
                <Mail className="w-12 h-12 mx-auto mb-4 text-chile-200" />
                <h3 className="text-xl font-bold mb-2">Email Us</h3>
                <p className="text-salsa-100 mb-4">Get in touch via email for detailed discussions</p>
                <a 
                  href="mailto:mike@josemadridsalsa.com"
                  className="text-yellow-300 hover:text-yellow-200 font-semibold transition-colors"
                >
                  mike@josemadridsalsa.com
                </a>
              </div>
              
              <div className="bg-white/10 backdrop-blur rounded-2xl p-8">
                <Phone className="w-12 h-12 mx-auto mb-4 text-chile-200" />
                <h3 className="text-xl font-bold mb-2">Call Us</h3>
                <p className="text-salsa-100 mb-4">Speak directly with our wholesale team</p>
                <a 
                  href="tel:740-521-4304"
                  className="text-yellow-300 hover:text-yellow-200 font-semibold transition-colors text-xl"
                >
                  740-521-4304
                </a>
              </div>
            </div>

            <div className="text-center">
              <h3 className="text-xl font-bold mb-4">Thanks!</h3>
              <p className="text-salsa-100 text-lg">
                We look forward to partnering with you and helping bring authentic Jose Madrid Salsa to your customers.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Bottom CTA */}
      <section className="py-12 bg-white">
        <div className="container mx-auto px-4 text-center">
          <div className="max-w-4xl mx-auto">
            <p className="text-gray-700 text-lg mb-6">
              Looking for our fundraising program instead?
            </p>
            <Button variant="outline" className="border-salsa-500 text-salsa-600 hover:bg-salsa-50" asChild>
              <Link href="/fundraising">
                Explore Fundraising Opportunities
              </Link>
            </Button>
          </div>
        </div>
      </section>
    </div>
  );
}