import { Metadata } from 'next';
import Link from 'next/link';
import {
  Factory,
  Flame,
  Leaf,
  Package,
  ShieldCheck,
  Truck,
  Utensils,
  Layers,
  MapPin,
  Mail,
  Phone,
  CheckCircle,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { createMetadata } from '@/lib/metadata';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = createMetadata({
  title: 'La Perla Ave - Tortilla Chip Manufacturer in Toledo, OH',
  description:
    'La Perla Ave is the Toledo, Ohio tortilla chip maker behind Jose Madrid Salsa. Learn about our chips, co-packing and private-label capabilities, and how to start a wholesale partnership.',
  pathname: '/la-perla-ave',
});

const capabilities = [
  {
    icon: Utensils,
    title: 'Stone-Ground Tortilla Chips',
    description:
      'Authentic corn tortilla chips made in small batches and fried to a sturdy, salsa-ready crunch — the perfect companion to Jose Madrid Salsa.',
  },
  {
    icon: Layers,
    title: 'Co-Packing',
    description:
      'Bring us your recipe and we handle production, bagging, and finishing. Flexible run sizes for emerging brands and established lines alike.',
  },
  {
    icon: Package,
    title: 'Private Label',
    description:
      'Launch your own branded chip line. We help with formulation, bag formats, and packaging so your product is shelf-ready.',
  },
  {
    icon: Flame,
    title: 'Custom Seasoning',
    description:
      'From classic salted to bold, spiced blends, we tailor seasoning profiles to match your brand and your customers.',
  },
];

const standards = [
  {
    icon: Leaf,
    title: 'Quality Ingredients',
    description:
      'Simple, recognizable ingredients sourced for consistent flavor and texture in every batch.',
  },
  {
    icon: ShieldCheck,
    title: 'Food-Safe Production',
    description:
      'Disciplined sanitation and quality-control practices on every line, every shift.',
  },
  {
    icon: Truck,
    title: 'Reliable Fulfillment',
    description:
      'Dependable lead times and shipping out of Toledo, Ohio to keep your shelves stocked.',
  },
  {
    icon: Factory,
    title: 'Made in Ohio',
    description:
      'Proudly produced in Toledo, supporting local jobs and the brands that partner with us.',
  },
];

const partnerTypes = [
  {
    title: 'Salsa & Dip Brands',
    description:
      'A crunchy, durable chip built to scoop and hold up to thick, chunky salsas like ours.',
  },
  {
    title: 'Grocery & Specialty Retail',
    description:
      'Private-label and branded chips for grocery, gourmet, and specialty food shelves.',
  },
  {
    title: 'Restaurants & Foodservice',
    description:
      'Bulk tortilla chips for restaurants, caterers, and concession operations.',
  },
  {
    title: 'Emerging Food Startups',
    description:
      'Approachable run sizes and hands-on support to help new brands get to market.',
  },
];

export default function LaPerlaAvePage() {
  return (
    <div className="min-h-screen bg-background">
      {/* Hero Section */}
      <section className="relative bg-gradient-to-r from-chile-600 via-salsa-600 to-verde-600 text-white">
        <div className="absolute inset-0 bg-black/20"></div>
        <div className="relative container mx-auto px-4 py-20 lg:py-28">
          <div className="max-w-4xl mx-auto text-center">
            <div className="inline-flex items-center gap-2 bg-white/15 backdrop-blur rounded-full px-4 py-1.5 mb-6 text-sm font-medium">
              <MapPin className="w-4 h-4" />
              Toledo, Ohio
            </div>
            <h1 className="text-4xl lg:text-6xl font-serif font-bold mb-6 text-shadow-lg">
              La Perla Ave
            </h1>
            <p className="text-xl lg:text-2xl text-salsa-100 max-w-3xl mx-auto leading-relaxed mb-8">
              The tortilla chip maker behind Jose Madrid Salsa. Crafting fresh,
              crunchy chips in Toledo, Ohio — and ready to make them for your
              brand too.
            </p>
            <div className="flex flex-wrap justify-center gap-4">
              <Button
                size="lg"
                className="bg-white text-salsa-700 hover:bg-salsa-50 font-semibold"
                asChild
              >
                <Link href="#capabilities">Our Capabilities</Link>
              </Button>
              <Button
                size="lg"
                variant="outline"
                className="border-white text-white hover:bg-white/10"
                asChild
              >
                <Link href="#contact">Start a Partnership</Link>
              </Button>
            </div>
          </div>
        </div>
      </section>

      {/* About */}
      <section className="py-16">
        <div className="container mx-auto px-4">
          <div className="max-w-4xl mx-auto">
            <div className="text-center mb-10">
              <h2 className="text-3xl lg:text-4xl font-serif font-bold text-foreground mb-6">
                The Chip Behind the Salsa
              </h2>
            </div>
            <div className="card surface-shadow p-8 lg:p-12">
              <p className="text-lg text-muted-foreground leading-relaxed mb-6">
                La Perla Ave is the Toledo, Ohio chip manufacturer that produces
                the tortilla chips paired with Jose Madrid Salsa. Great salsa
                deserves a great chip — sturdy enough to scoop, fresh enough to
                taste the corn, and crunchy from the first bite to the last.
              </p>
              <p className="text-lg text-muted-foreground leading-relaxed">
                Beyond supplying Jose Madrid Salsa, we partner with other food
                brands, retailers, and restaurants through co-packing and
                private-label production. Whether you need chips for your own
                label or a reliable manufacturing partner, La Perla Ave brings
                Midwestern craftsmanship to every batch.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Capabilities */}
      <section id="capabilities" className="py-16">
        <div className="container mx-auto px-4">
          <div className="max-w-6xl mx-auto">
            <div className="text-center mb-16">
              <h2 className="text-3xl lg:text-4xl font-serif font-bold text-foreground mb-6">
                What We Make
              </h2>
              <p className="text-xl text-muted-foreground max-w-3xl mx-auto">
                From our signature tortilla chips to full co-packing and
                private-label runs, we help brands put a great chip on the shelf.
              </p>
            </div>

            <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-8">
              {capabilities.map((item, index) => (
                <Card key={index} className="card surface-shadow text-center">
                  <CardHeader className="pb-4">
                    <div className="w-16 h-16 bg-gradient-to-br from-salsa-500 to-chile-500 rounded-full flex items-center justify-center mx-auto mb-4">
                      <item.icon className="w-8 h-8 text-white" />
                    </div>
                    <h3 className="text-xl font-bold text-foreground">
                      {item.title}
                    </h3>
                  </CardHeader>
                  <CardContent>
                    <p className="text-muted-foreground leading-relaxed">
                      {item.description}
                    </p>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Standards */}
      <section className="py-16 bg-gradient-to-r from-verde-600 to-salsa-600 text-white">
        <div className="container mx-auto px-4">
          <div className="max-w-6xl mx-auto">
            <div className="text-center mb-16">
              <ShieldCheck className="w-16 h-16 mx-auto mb-6 text-yellow-300" />
              <h2 className="text-3xl lg:text-4xl font-serif font-bold mb-6">
                How We Make It
              </h2>
              <p className="text-xl text-verde-100 max-w-3xl mx-auto">
                Quality you can taste, backed by production standards your brand
                can rely on.
              </p>
            </div>

            <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-8">
              {standards.map((item, index) => (
                <div
                  key={index}
                  className="bg-white/10 backdrop-blur rounded-2xl p-6 text-center"
                >
                  <item.icon className="w-10 h-10 mx-auto mb-4 text-yellow-300" />
                  <h3 className="text-lg font-bold mb-2">{item.title}</h3>
                  <p className="text-verde-100 leading-relaxed text-sm">
                    {item.description}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Who We Partner With */}
      <section className="py-16">
        <div className="container mx-auto px-4">
          <div className="max-w-6xl mx-auto">
            <div className="text-center mb-16">
              <h2 className="text-3xl lg:text-4xl font-serif font-bold text-foreground mb-6">
                Who We Work With
              </h2>
              <p className="text-xl text-muted-foreground max-w-3xl mx-auto">
                Our chips are a great fit for a range of partners across retail
                and foodservice.
              </p>
            </div>

            <div className="grid md:grid-cols-2 gap-8">
              {partnerTypes.map((type, index) => (
                <Card key={index} className="card surface-shadow">
                  <CardHeader>
                    <h3 className="text-xl font-bold text-foreground flex items-center gap-3">
                      <div className="w-3 h-3 bg-gradient-to-r from-salsa-500 to-chile-500 rounded-full"></div>
                      {type.title}
                    </h3>
                  </CardHeader>
                  <CardContent>
                    <p className="text-muted-foreground leading-relaxed">
                      {type.description}
                    </p>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Wholesale / Contact */}
      <section
        id="contact"
        className="py-16 bg-gradient-to-r from-salsa-600 to-chile-600 text-white"
      >
        <div className="container mx-auto px-4">
          <div className="max-w-4xl mx-auto text-center">
            <h2 className="text-3xl lg:text-4xl font-serif font-bold mb-6">
              Start a Wholesale Partnership
            </h2>
            <p className="text-xl text-salsa-100 mb-12 max-w-2xl mx-auto">
              Interested in co-packing, private-label chips, or carrying our
              product? Reach out and our team will help you get started.
            </p>

            <div className="grid md:grid-cols-3 gap-6 mb-12 text-left max-w-3xl mx-auto">
              <div className="flex items-start gap-3">
                <CheckCircle className="w-6 h-6 text-yellow-300 flex-shrink-0 mt-0.5" />
                <span className="text-salsa-50">
                  Co-packing &amp; private-label production
                </span>
              </div>
              <div className="flex items-start gap-3">
                <CheckCircle className="w-6 h-6 text-yellow-300 flex-shrink-0 mt-0.5" />
                <span className="text-salsa-50">
                  Custom seasoning &amp; bag formats
                </span>
              </div>
              <div className="flex items-start gap-3">
                <CheckCircle className="w-6 h-6 text-yellow-300 flex-shrink-0 mt-0.5" />
                <span className="text-salsa-50">
                  Reliable fulfillment from Toledo, OH
                </span>
              </div>
            </div>

            <div className="grid md:grid-cols-2 gap-8 mb-12">
              <div className="bg-white/10 backdrop-blur rounded-2xl p-8">
                <Mail className="w-12 h-12 mx-auto mb-4 text-chile-200" />
                <h3 className="text-xl font-bold mb-2">Email Us</h3>
                <p className="text-salsa-100 mb-4">
                  Send us details about your project or order
                </p>
                <a
                  href="mailto:mike@josemadrid.net"
                  className="text-yellow-300 hover:text-yellow-200 font-semibold transition-colors"
                >
                  mike@josemadrid.net
                </a>
              </div>

              <div className="bg-white/10 backdrop-blur rounded-2xl p-8">
                <Phone className="w-12 h-12 mx-auto mb-4 text-chile-200" />
                <h3 className="text-xl font-bold mb-2">Call Us</h3>
                <p className="text-salsa-100 mb-4">
                  Speak with our team about your needs
                </p>
                <a
                  href="tel:740-521-4304"
                  className="text-yellow-300 hover:text-yellow-200 font-semibold transition-colors text-xl"
                >
                  740-521-4304
                </a>
              </div>
            </div>

            <div className="inline-flex items-center gap-2 text-salsa-100">
              <MapPin className="w-5 h-5 text-yellow-300" />
              <span>La Perla Ave — Toledo, Ohio</span>
            </div>
          </div>
        </div>
      </section>

      {/* Bottom CTA */}
      <section className="py-12 bg-card">
        <div className="container mx-auto px-4 text-center">
          <div className="max-w-4xl mx-auto">
            <p className="text-muted-foreground text-lg mb-6">
              Tasting our chips with Jose Madrid Salsa?
            </p>
            <Button
              variant="outline"
              className="border-salsa-500 text-salsa-600 hover:bg-salsa-50"
              asChild
            >
              <Link href="/salsas">Shop Jose Madrid Salsa</Link>
            </Button>
          </div>
        </div>
      </section>
    </div>
  );
}
