import { Metadata } from 'next';
import Image from 'next/image';
import Link from 'next/link';
import {
  Store,
  Flame,
  Leaf,
  Utensils,
  MapPin,
  Phone,
  Clock,
  CreditCard,
  Car,
  ExternalLink,
  Facebook,
  CheckCircle,
  ShoppingBag,
  Star,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { createMetadata } from '@/lib/metadata';

export const revalidate = 86400

export const metadata: Metadata = createMetadata({
  title: 'La Perla Tortilla Factory - Toledo, OH | Jose Madrid Chips',
  description:
    'La Perla Tortilla Factory in Toledo, Ohio makes the stone-ground white corn chips paired with Jose Madrid Salsa, plus fresh tortillas and Mexican ingredients.',
  pathname: '/laperla',
});

// Real business details from La Perla Tortilla Factory's listing.
const BUSINESS = {
  name: 'La Perla Tortilla Factory',
  street: '2742 Hill Ave',
  city: 'Toledo',
  state: 'OH',
  zip: '43607',
  phone: '(419) 534-2074',
  phoneHref: 'tel:+14195342074',
  mapsUrl:
    'https://www.google.com/maps/search/?api=1&query=La+Perla+Tortilla+Factory+2742+Hill+Ave+Toledo+OH+43607',
  // Google Business "write a review" dialog for La Perla Tortilla Factory.
  reviewUrl:
    'https://search.google.com/local/writereview?placeid=ChIJRcp3DJR4PIgR_uzQ8MR_NSI',
  facebookUrl: 'https://www.facebook.com/search/top?q=Laperla%20Tortilla%20Factory',
};

const products = [
  {
    icon: Utensils,
    title: 'Fresh Corn Tortillas',
    description:
      'Stone-ground corn tortillas made fresh at the Hill Avenue factory — the foundation of every great taco, enchilada, and quesadilla.',
  },
  {
    icon: Store,
    title: 'Tortilla Chips',
    description:
      'Crisp, sturdy tortilla chips fried for a salsa-ready crunch, including the stone-ground white corn chips paired with Jose Madrid Salsa.',
  },
  {
    icon: Leaf,
    title: 'Mexican Ingredients',
    description:
      'Authentic Mexican pantry staples and ingredients to round out your kitchen — sold right from the factory storefront.',
  },
  {
    icon: Flame,
    title: 'Made Fresh, Open to All',
    description:
      'A working Toledo tortilla factory that welcomes the public in to buy fresh-made tortillas, chips, and more.',
  },
];

const chipFacts = [
  { label: 'Net Weight', value: '11 oz (311.8g)' },
  { label: 'Serving Size', value: '1 oz (28g) — 11 per bag' },
  { label: 'Calories', value: '132 per serving' },
  { label: 'Total Fat', value: '3g (5% DV)' },
  { label: 'Sodium', value: '51mg (2% DV)' },
  { label: 'Total Carbohydrate', value: '22g (7% DV)' },
];

function StorefrontPostcard({ className = '' }: { className?: string }) {
  return (
    <figure className={`relative rotate-2 ${className}`}>
      {/* Weathered tape strip */}
      <div
        aria-hidden="true"
        className="absolute -top-2.5 left-1/2 -translate-x-1/2 -rotate-3 w-24 h-6 bg-amber-50/50 shadow-sm z-10"
      />
      <div className="bg-[#f6efdc] p-3 pb-2.5 rounded-sm shadow-2xl ring-1 ring-black/25">
        <div className="relative overflow-hidden rounded-[2px]">
          <Image
            src="https://can9pwc8drhj1bme.public.blob.vercel-storage.com/site/images/laperla/la-perla-storefront.webp"
            alt="The La Perla Tortilla Factory storefront at 2742 Hill Ave in Toledo, Ohio"
            width={915}
            height={885}
            className="w-full h-auto sepia-[.35] contrast-105 saturate-[.8]"
          />
          {/* Aged-photo vignette and warm wash */}
          <div
            aria-hidden="true"
            className="absolute inset-0 pointer-events-none shadow-[inset_0_0_45px_rgba(62,39,10,0.4)] bg-gradient-to-t from-amber-900/20 via-transparent to-amber-100/15 mix-blend-multiply"
          />
        </div>
        <figcaption className="pt-2 text-center">
          <span className="block font-serif italic text-sm text-stone-700">
            2742 Hill Ave — Toledo, Ohio
          </span>
          <span className="block text-[10px] tracking-[0.3em] uppercase text-stone-500 mt-0.5">
            41.63° N · 83.61° W
          </span>
        </figcaption>
      </div>
    </figure>
  );
}

export default function LaPerlaTortillaFactoryPage() {
  return (
    <div className="min-h-screen bg-background">
      {/* Hero Section */}
      <section className="relative bg-gradient-to-r from-chile-700 via-chile-600 to-verde-700 text-white">
        <div className="absolute inset-0 bg-black/25"></div>
        <div className="relative container mx-auto px-4 py-20 lg:py-28">
          <div className="max-w-6xl mx-auto grid lg:grid-cols-[auto_1fr_auto] items-center gap-10 lg:gap-12">
            <Image
              src="https://can9pwc8drhj1bme.public.blob.vercel-storage.com/site/images/laperla/la-perla-logo.webp"
              alt="La Perla Tortilla Factory — Open to Public"
              width={900}
              height={883}
              priority
              className="w-44 lg:w-56 h-auto mx-auto drop-shadow-2xl"
            />
            <div className="text-center lg:text-left">
              <div className="inline-flex items-center gap-2 bg-white/15 backdrop-blur rounded-full px-4 py-1.5 mb-6 text-sm font-medium">
                <MapPin className="w-4 h-4" />
                Toledo, Ohio
              </div>
              <h1 className="text-4xl lg:text-6xl font-serif font-bold mb-6 text-shadow-lg">
                La Perla Tortilla Factory
              </h1>
              <p className="text-xl lg:text-2xl text-salsa-100 max-w-3xl leading-relaxed mb-8">
                A working Toledo tortilla factory making fresh corn tortillas,
                tortilla chips, and Mexican ingredients — including the
                stone-ground white corn chips paired with Jose Madrid Salsa.
              </p>
              <div className="flex flex-wrap justify-center lg:justify-start gap-4">
                <Button
                  size="lg"
                  className="bg-white text-chile-700 hover:bg-salsa-50 font-semibold"
                  asChild
                >
                  <a
                    href={BUSINESS.reviewUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    <Star className="w-4 h-4 fill-current" />
                    Leave a Google Review
                  </a>
                </Button>
                <Button
                  size="lg"
                  variant="outline"
                  className="border-white text-white hover:bg-white/10"
                  asChild
                >
                  <Link href="#products">What They Make</Link>
                </Button>
              </div>
            </div>
            <StorefrontPostcard className="w-60 lg:w-64 mx-auto" />
          </div>
        </div>
      </section>

      {/* About */}
      <section className="py-16">
        <div className="container mx-auto px-4">
          <div className="max-w-4xl mx-auto">
            <div className="text-center mb-10">
              <h2 className="text-3xl lg:text-4xl font-serif font-bold text-foreground mb-6">
                A Toledo Tradition
              </h2>
            </div>
            <div className="card surface-shadow p-8 lg:p-12">
              <p className="text-lg text-muted-foreground leading-relaxed mb-6">
                Just off the road on Hill Avenue, the bright red &amp; green La
                Perla sign has welcomed Toledo neighbors for years with three
                simple words: <span className="font-semibold text-foreground">Open to the Public</span>.
                Inside, La Perla Tortilla Factory turns out fresh stone-ground
                corn tortillas, crisp tortilla chips, and the Mexican
                ingredients that bring a kitchen to life.
              </p>
              <p className="text-lg text-muted-foreground leading-relaxed">
                Great salsa deserves a great chip, and La Perla makes the
                stone-ground white corn tortilla chips paired with Jose Madrid
                Salsa — sturdy enough to scoop, fresh enough to taste the corn,
                and crunchy from the first bite to the last.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Products */}
      <section id="products" className="py-16">
        <div className="container mx-auto px-4">
          <div className="max-w-6xl mx-auto">
            <div className="text-center mb-16">
              <h2 className="text-3xl lg:text-4xl font-serif font-bold text-foreground mb-6">
                What They Make
              </h2>
              <p className="text-xl text-muted-foreground max-w-3xl mx-auto">
                Fresh from the factory floor and available right at the
                storefront in Toledo.
              </p>
            </div>

            <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-8">
              {products.map((item, index) => (
                <Card key={index} className="card surface-shadow text-center">
                  <CardHeader className="pb-4">
                    <div className="w-16 h-16 bg-gradient-to-br from-chile-500 to-verde-600 rounded-full flex items-center justify-center mx-auto mb-4">
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

      {/* The Chip Behind the Salsa */}
      <section className="py-16 bg-gradient-to-r from-verde-700 to-chile-600 text-white">
        <div className="container mx-auto px-4">
          <div className="max-w-5xl mx-auto grid lg:grid-cols-2 gap-10 items-center">
            <div>
              <ShoppingBag className="w-14 h-14 mb-6 text-yellow-300" />
              <h2 className="text-3xl lg:text-4xl font-serif font-bold mb-6">
                The Chip Behind the Salsa
              </h2>
              <p className="text-lg text-verde-50 leading-relaxed mb-6">
                La Perla bakes and fries the stone-ground{' '}
                <span className="font-semibold">White Corn Tortilla Chips</span>{' '}
                sold under the Jose Madrid Stone Ground label. Simple
                ingredients, real corn flavor, and a crunch built for thick,
                chunky salsa.
              </p>
              <p className="text-sm text-verde-100/90 mb-6">
                Ingredients: white corn, water, lime, sunflower oil and/or
                vegetable oil, and salt.
              </p>
              <Button
                className="bg-white text-chile-700 hover:bg-salsa-50 font-semibold"
                asChild
              >
                <Link href="/salsas">Shop Jose Madrid Salsa</Link>
              </Button>
            </div>
            <div className="bg-white/10 backdrop-blur rounded-2xl p-6 lg:p-8">
              <h3 className="text-lg font-bold mb-4 text-yellow-300">
                Nutrition at a Glance
              </h3>
              <dl className="divide-y divide-white/15">
                {chipFacts.map((fact) => (
                  <div
                    key={fact.label}
                    className="flex items-center justify-between py-2.5 text-sm"
                  >
                    <dt className="text-verde-50">{fact.label}</dt>
                    <dd className="font-semibold text-white text-right">
                      {fact.value}
                    </dd>
                  </div>
                ))}
              </dl>
            </div>
          </div>
        </div>
      </section>

      {/* Visit / Business Info */}
      <section id="visit" className="py-16">
        <div className="container mx-auto px-4">
          <div className="max-w-5xl mx-auto">
            <div className="text-center mb-12">
              <h2 className="text-3xl lg:text-4xl font-serif font-bold text-foreground mb-4">
                Visit the Factory
              </h2>
              <p className="text-xl text-muted-foreground max-w-3xl mx-auto">
                Open to the public — stop in for fresh tortillas, chips, and
                Mexican ingredients.
              </p>
            </div>

            <div className="grid md:grid-cols-2 gap-8">
              {/* Contact card */}
              <Card className="card surface-shadow">
                <CardContent className="p-8 space-y-6">
                  <div className="flex items-start gap-4">
                    <MapPin className="w-6 h-6 text-chile-600 flex-shrink-0 mt-1" />
                    <div>
                      <h3 className="font-bold text-foreground mb-1">Address</h3>
                      <p className="text-muted-foreground">
                        {BUSINESS.street}
                        <br />
                        {BUSINESS.city}, {BUSINESS.state} {BUSINESS.zip}
                      </p>
                      <a
                        href={BUSINESS.mapsUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 text-chile-600 hover:text-chile-700 font-semibold mt-2"
                      >
                        Get directions <ExternalLink className="w-4 h-4" />
                      </a>
                    </div>
                  </div>

                  <div className="flex items-start gap-4">
                    <Phone className="w-6 h-6 text-chile-600 flex-shrink-0 mt-1" />
                    <div>
                      <h3 className="font-bold text-foreground mb-1">Phone</h3>
                      <a
                        href={BUSINESS.phoneHref}
                        className="text-muted-foreground hover:text-chile-600 transition-colors"
                      >
                        {BUSINESS.phone}
                      </a>
                    </div>
                  </div>

                  <div className="flex items-start gap-4">
                    <Clock className="w-6 h-6 text-chile-600 flex-shrink-0 mt-1" />
                    <div>
                      <h3 className="font-bold text-foreground mb-1">Hours</h3>
                      <p className="text-muted-foreground">
                        Open to the public, opening at 9:00 AM. Call ahead to
                        confirm current hours.
                      </p>
                    </div>
                  </div>

                  <div className="flex items-start gap-4">
                    <Facebook className="w-6 h-6 text-chile-600 flex-shrink-0 mt-1" />
                    <div>
                      <h3 className="font-bold text-foreground mb-1">Follow</h3>
                      <a
                        href={BUSINESS.facebookUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 text-chile-600 hover:text-chile-700 font-semibold"
                      >
                        Laperla Tortilla Factory on Facebook{' '}
                        <ExternalLink className="w-4 h-4" />
                      </a>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Good to know card */}
              <Card className="card surface-shadow bg-gradient-to-br from-salsa-50 to-verde-50">
                <CardHeader>
                  <h3 className="text-xl font-bold text-foreground">
                    Good to Know
                  </h3>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex items-center gap-3">
                    <Store className="w-5 h-5 text-verde-700 flex-shrink-0" />
                    <span className="text-muted-foreground">
                      Open to the public — walk-ins welcome
                    </span>
                  </div>
                  <div className="flex items-center gap-3">
                    <CreditCard className="w-5 h-5 text-verde-700 flex-shrink-0" />
                    <span className="text-muted-foreground">
                      Accepts SNAP/EBT and credit cards
                    </span>
                  </div>
                  <div className="flex items-center gap-3">
                    <Car className="w-5 h-5 text-verde-700 flex-shrink-0" />
                    <span className="text-muted-foreground">
                      Validated parking available
                    </span>
                  </div>
                  <div className="flex items-center gap-3">
                    <CheckCircle className="w-5 h-5 text-verde-700 flex-shrink-0" />
                    <span className="text-muted-foreground">
                      Corn tortillas, tortilla chips &amp; Mexican ingredients
                    </span>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      </section>

      {/* Bottom CTA */}
      <section className="py-12 bg-card">
        <div className="container mx-auto px-4 text-center">
          <div className="max-w-4xl mx-auto">
            <p className="text-muted-foreground text-lg mb-6">
              Pairing La Perla chips with Jose Madrid Salsa?
            </p>
            <Button
              variant="outline"
              className="border-chile-500 text-chile-600 hover:bg-salsa-50"
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
