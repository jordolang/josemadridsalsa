import { Metadata } from 'next';
import Link from 'next/link';
import { Heart, Award, Users, Leaf, Calendar, Target, Star, CheckCircle } from 'lucide-react';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

export const metadata: Metadata = {
  title: 'Our Story - Jose Madrid Salsa',
  description: 'Discover the story behind Jose Madrid Salsa - from a family restaurant in Ohio to a regional favorite. Learn about our mission, values, and commitment to authentic flavors.',
  openGraph: {
    title: 'Our Story - Jose Madrid Salsa',
    description: 'The story behind authentic Jose Madrid Salsa - family tradition, quality ingredients, and New Mexico-style flavor.',
    images: ['/og-story.jpg'],
  },
};

const timeline = [
  {
    year: "1942",
    title: "Family Business Begins",
    description: "Mike's paternal grandparents opened a butcher shop and grocery store in Zanesville, Ohio, starting the family's food business tradition.",
    icon: Calendar
  },
  {
    year: "1976",
    title: "Zak's Restaurant Opens",
    description: "Mike Zakany and his brother opened Zak's Restaurant in downtown Zanesville, serving New Mexico-style Mexican cuisine.",
    icon: Users
  },
  {
    year: "1987",
    title: "Jose Madrid Salsa Born",
    description: "Named after Mike's legendary grandfather from Clovis, New Mexico, Jose Madrid Salsa was created to meet growing demand.",
    icon: Star
  },
  {
    year: "1988",
    title: "First Commercial Sales",
    description: "Jose Madrid Salsa made its debut in gourmet and grocery stores during the Christmas season.",
    icon: Award
  },
  {
    year: "Today",
    title: "25+ Flavors & Growing",
    description: "From our Ohio base, we continue to grow with 25+ unique flavors, serving customers across America through retail, online, and fundraising.",
    icon: Target
  }
];

const values = [
  {
    icon: Heart,
    title: "Family Tradition",
    description: "Every recipe honors the culinary heritage passed down from José Madrid, keeping family traditions alive in every jar."
  },
  {
    icon: Leaf,
    title: "Quality Ingredients",
    description: "We use only premium ingredients, from California Pear tomatoes to authentic New Mexico chiles, ensuring exceptional flavor."
  },
  {
    icon: Users,
    title: "Community First",
    description: "Supporting local communities through fundraising programs, farmer partnerships, and direct customer relationships."
  },
  {
    icon: Award,
    title: "Authentic Flavor",
    description: "True to our New Mexico roots, we maintain the complex, authentic flavors that made José Madrid's cooking legendary."
  }
];

const achievements = [
  "First four-pepper salsa in the United States",
  "Award-winning fruit salsa line with national recognition",
  "35+ years of continuous family operation",
  "Hundreds of successful fundraising partnerships",
  "Growing retail presence across the Midwest",
  "Thousands of satisfied customers nationwide"
];

export default function OurStoryPage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-white via-salsa-50/30 to-verde-50/30">
      {/* Hero Section */}
      <section className="relative bg-gradient-to-r from-verde-600 via-salsa-600 to-chile-600 text-white">
        <div className="absolute inset-0 bg-black/20"></div>
        <div className="relative container mx-auto px-4 py-20 lg:py-28">
          <div className="max-w-4xl mx-auto text-center">
            <h1 className="text-4xl lg:text-6xl font-serif font-bold mb-6 text-shadow-lg">
              Our Story
            </h1>
            <p className="text-xl lg:text-2xl text-verde-100 max-w-3xl mx-auto leading-relaxed">
              A tale of family tradition, authentic flavor, and the legendary cowboy who started it all
            </p>
          </div>
        </div>
      </section>

      {/* Mission Statement */}
      <section className="py-16">
        <div className="container mx-auto px-4">
          <div className="max-w-4xl mx-auto">
            <div className="bg-gradient-to-r from-salsa-600 to-chile-600 rounded-2xl text-white p-8 lg:p-12 text-center">
              <Heart className="w-16 h-16 mx-auto mb-6 text-yellow-300" />
              <h2 className="text-3xl font-serif font-bold mb-6">Our Mission</h2>
              <p className="text-xl text-salsa-100 leading-relaxed mb-6">
                To honor the legacy of José Madrid by crafting authentic New Mexico-style salsas that bring families and communities together around the table, one jar at a time.
              </p>
              <p className="text-lg text-chile-200">
                We believe that great food creates lasting memories, builds relationships, and celebrates the rich traditions that make us who we are.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Timeline */}
      <section className="py-16 bg-gradient-to-r from-salsa-50 to-chile-50">
        <div className="container mx-auto px-4">
          <div className="max-w-6xl mx-auto">
            <div className="text-center mb-16">
              <h2 className="text-3xl lg:text-4xl font-serif font-bold text-salsa-800 mb-6">
                Our Journey Through Time
              </h2>
              <p className="text-xl text-gray-700 max-w-3xl mx-auto">
                From a small-town restaurant to a beloved regional brand, every step of our journey has been guided by family values and authentic flavor
              </p>
            </div>

            <div className="space-y-8">
              {timeline.map((milestone, index) => (
                <Card key={index} className="bg-white border-0 shadow-lg">
                  <CardContent className="p-8">
                    <div className="flex items-start gap-6">
                      <div className="flex-shrink-0">
                        <div className="w-16 h-16 bg-gradient-to-br from-salsa-500 to-chile-500 rounded-full flex items-center justify-center">
                          <milestone.icon className="w-8 h-8 text-white" />
                        </div>
                      </div>
                      <div className="flex-grow">
                        <div className="flex items-center gap-4 mb-3">
                          <span className="text-2xl font-bold text-salsa-600">{milestone.year}</span>
                          <div className="h-px bg-gradient-to-r from-salsa-300 to-transparent flex-grow"></div>
                        </div>
                        <h3 className="text-2xl font-serif font-bold text-salsa-800 mb-3">
                          {milestone.title}
                        </h3>
                        <p className="text-gray-700 leading-relaxed">
                          {milestone.description}
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Our Values */}
      <section className="py-16">
        <div className="container mx-auto px-4">
          <div className="max-w-6xl mx-auto">
            <div className="text-center mb-16">
              <h2 className="text-3xl lg:text-4xl font-serif font-bold text-salsa-800 mb-6">
                What We Stand For
              </h2>
              <p className="text-xl text-gray-700 max-w-3xl mx-auto">
                Our values guide everything we do, from recipe development to customer service
              </p>
            </div>

            <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-8">
              {values.map((value, index) => (
                <Card key={index} className="bg-white border-0 shadow-lg text-center hover:shadow-xl transition-shadow">
                  <CardHeader className="pb-4">
                    <div className="w-16 h-16 bg-gradient-to-br from-salsa-500 to-chile-500 rounded-full flex items-center justify-center mx-auto mb-4">
                      <value.icon className="w-8 h-8 text-white" />
                    </div>
                    <h3 className="text-xl font-bold text-salsa-800">
                      {value.title}
                    </h3>
                  </CardHeader>
                  <CardContent>
                    <p className="text-gray-700 leading-relaxed">
                      {value.description}
                    </p>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Quality Commitment */}
      <section className="py-16 bg-gradient-to-r from-verde-600 to-salsa-600 text-white">
        <div className="container mx-auto px-4">
          <div className="max-w-4xl mx-auto text-center">
            <Leaf className="w-16 h-16 mx-auto mb-6 text-yellow-300" />
            <h2 className="text-3xl lg:text-4xl font-serif font-bold mb-8">
              Our Commitment to Quality
            </h2>
            <div className="grid md:grid-cols-2 gap-8 mb-12">
              <div className="bg-white/10 backdrop-blur rounded-2xl p-6">
                <h3 className="text-xl font-bold mb-4">Premium Ingredients</h3>
                <p className="text-verde-100">
                  California Pear tomatoes, authentic New Mexico chiles, and carefully sourced spices create our complex, authentic flavors.
                </p>
              </div>
              
              <div className="bg-white/10 backdrop-blur rounded-2xl p-6">
                <h3 className="text-xl font-bold mb-4">Traditional Methods</h3>
                <p className="text-verde-100">
                  We honor José Madrid's culinary traditions while using modern techniques to ensure consistency and quality in every batch.
                </p>
              </div>
            </div>
            <p className="text-lg text-salsa-100">
              Every jar represents our unwavering commitment to the authentic flavors and quality that made José Madrid's cooking legendary.
            </p>
          </div>
        </div>
      </section>

      {/* Achievements */}
      <section className="py-16">
        <div className="container mx-auto px-4">
          <div className="max-w-4xl mx-auto">
            <div className="text-center mb-16">
              <h2 className="text-3xl lg:text-4xl font-serif font-bold text-salsa-800 mb-6">
                Proud Achievements
              </h2>
              <p className="text-xl text-gray-700 max-w-2xl mx-auto">
                Milestones that reflect our dedication to quality, innovation, and community
              </p>
            </div>

            <div className="bg-white rounded-2xl shadow-xl p-8">
              <div className="grid md:grid-cols-2 gap-6">
                {achievements.map((achievement, index) => (
                  <div key={index} className="flex items-start gap-3">
                    <CheckCircle className="w-6 h-6 text-salsa-500 flex-shrink-0 mt-0.5" />
                    <span className="text-gray-700 leading-relaxed">{achievement}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Looking Forward */}
      <section className="py-16 bg-gradient-to-r from-salsa-50 to-chile-50">
        <div className="container mx-auto px-4">
          <div className="max-w-4xl mx-auto text-center">
            <h2 className="text-3xl lg:text-4xl font-serif font-bold text-salsa-800 mb-8">
              Looking to the Future
            </h2>
            <p className="text-xl text-gray-700 leading-relaxed mb-12 max-w-2xl mx-auto">
              As we continue to grow, we remain committed to the values and traditions that have guided us from the beginning. José Madrid's legacy lives on in every jar, and we're excited to share his authentic flavors with even more families and communities.
            </p>

            <div className="grid md:grid-cols-3 gap-8 mb-12">
              <Card className="bg-white border-0 shadow-lg">
                <CardContent className="p-6 text-center">
                  <div className="w-12 h-12 bg-gradient-to-br from-salsa-500 to-chile-500 rounded-full flex items-center justify-center mx-auto mb-4">
                    <Target className="w-6 h-6 text-white" />
                  </div>
                  <h3 className="font-bold text-salsa-800 mb-2">Innovation</h3>
                  <p className="text-gray-700 text-sm">Developing new flavors while honoring traditional recipes</p>
                </CardContent>
              </Card>

              <Card className="bg-white border-0 shadow-lg">
                <CardContent className="p-6 text-center">
                  <div className="w-12 h-12 bg-gradient-to-br from-verde-500 to-salsa-500 rounded-full flex items-center justify-center mx-auto mb-4">
                    <Users className="w-6 h-6 text-white" />
                  </div>
                  <h3 className="font-bold text-salsa-800 mb-2">Community</h3>
                  <p className="text-gray-700 text-sm">Expanding partnerships with schools, organizations, and retailers</p>
                </CardContent>
              </Card>

              <Card className="bg-white border-0 shadow-lg">
                <CardContent className="p-6 text-center">
                  <div className="w-12 h-12 bg-gradient-to-br from-chile-500 to-salsa-500 rounded-full flex items-center justify-center mx-auto mb-4">
                    <Heart className="w-6 h-6 text-white" />
                  </div>
                  <h3 className="font-bold text-salsa-800 mb-2">Family</h3>
                  <p className="text-gray-700 text-sm">Keeping family traditions alive for future generations</p>
                </CardContent>
              </Card>
            </div>

            <div className="bg-gradient-to-r from-salsa-600 to-chile-600 rounded-2xl text-white p-8">
              <h3 className="text-2xl font-serif font-bold mb-4">Join Our Story</h3>
              <p className="text-salsa-100 mb-6 text-lg">
                Whether you're a longtime customer or discovering us for the first time, you become part of the Jose Madrid Salsa family with every jar.
              </p>
              <div className="flex flex-wrap justify-center gap-4">
                <Button size="lg" className="bg-white text-salsa-700 hover:bg-salsa-50 font-semibold" asChild>
                  <Link href="/products">
                    Taste Our Story
                  </Link>
                </Button>
                <Button size="lg" variant="outline" className="border-white text-white hover:bg-white/10" asChild>
                  <Link href="/find-us">
                    Connect With Us
                  </Link>
                </Button>
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}