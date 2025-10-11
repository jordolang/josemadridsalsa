import { Metadata } from 'next';
import Link from 'next/link';
import { Heart, Users, DollarSign, Truck, Download, ExternalLink, Quote, Star, Calendar } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader } from '@/components/ui/card';

export const metadata: Metadata = {
  title: 'Fundraising - Jose Madrid Salsa',
  description: 'Partner with Jose Madrid Salsa for your fundraising goals! Earn 50% profit with free shipping, online and pre-sell options available.',
  openGraph: {
    title: 'Fundraising - Jose Madrid Salsa',
    description: 'Healthy fundraising option with 50% profit and free shipping. Perfect for schools, sports teams, and organizations.',
    images: ['/og-fundraising.jpg'],
  },
};

const testimonials = [
  {
    organization: "Indian River Students Against Destructive Decisions",
    date: "February 2021",
    content: "Thank you again for a wonderful fundraiser. I was not sure if people would support our salsa sales during this difficult time. We underestimated the support our SADD club has and we were able to have a successful fundraiser. Your company makes this fundraiser so easy to do. Thank you for helping us get the word out that teens need to make good decisions!",
    author: "Linda Elcsisin"
  },
  {
    organization: "Ana Lobé Ballet Academy",
    date: "January 2021",
    content: "This is our third year working with you and it is the best fundraiser ever. You have created a great, delicious product and we will continue buying from you. Our parents love your SALSA!",
    author: "Ana Lobé"
  },
  {
    organization: "Live Oaks Career Campus - National Technical Honor Society",
    date: "December 2020",
    content: "I used the Jose Madrid salsa fundraiser for the first time this year, in large part due to COVID restrictions on other forms of fundraising. The option to have an in-house sale as well as an online sale provided flexibility that worked in these more challenging times. The 50% fundraising profit was a big selling point.",
    author: "NTHS Representative"
  },
  {
    organization: "Sheffield Middle High School",
    date: "January 2019",
    content: "It was easy to do, ordering was simple, and the customer service was outstanding. I would also like to thank you for providing samples that we could give out during our basketball tournaments. It generated interest and allowed people to try new flavors.",
    author: "Jeff Lindquist"
  },
  {
    organization: "River View Cross Country Team",
    date: "2018",
    content: "The salsa was easy to sell and we expect it to be even easier the next time once people try it. Everybody absolutely loves it. We are completely self funded and the 50% profit on every jar was perfect. Thank you for being a member of our TEAM.",
    author: "Jon Hardesty"
  }
];

export default function FundraisingPage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-white via-verde-50/30 to-salsa-50/30">
      {/* Hero Section */}
      <section className="relative bg-gradient-to-r from-verde-600 via-salsa-600 to-chile-600 text-white">
        <div className="absolute inset-0 bg-black/20"></div>
        <div className="relative container mx-auto px-4 py-20 lg:py-28">
          <div className="max-w-4xl mx-auto text-center">
            <h1 className="text-4xl lg:text-6xl font-serif font-bold mb-6 text-shadow-lg">
              Fundraise With Jose!
            </h1>
            <p className="text-xl lg:text-2xl text-verde-100 max-w-3xl mx-auto leading-relaxed mb-8">
              José Madrid Salsa offers a <strong className="text-yellow-300">healthy option</strong> to your fundraising goals!
            </p>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 max-w-4xl mx-auto">
              <div className="bg-white/10 backdrop-blur rounded-lg p-4">
                <DollarSign className="w-8 h-8 mx-auto mb-2 text-yellow-300" />
                <p className="font-bold text-lg">50% Profit</p>
              </div>
              <div className="bg-white/10 backdrop-blur rounded-lg p-4">
                <Truck className="w-8 h-8 mx-auto mb-2 text-yellow-300" />
                <p className="font-bold text-lg">Free Shipping</p>
              </div>
              <div className="bg-white/10 backdrop-blur rounded-lg p-4">
                <Users className="w-8 h-8 mx-auto mb-2 text-yellow-300" />
                <p className="font-bold text-lg">Pre-sell</p>
              </div>
              <div className="bg-white/10 backdrop-blur rounded-lg p-4">
                <Heart className="w-8 h-8 mx-auto mb-2 text-yellow-300" />
                <p className="font-bold text-lg">Online</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-12 bg-white">
        <div className="container mx-auto px-4 text-center">
          <div className="max-w-4xl mx-auto">
            <h2 className="text-2xl lg:text-3xl font-serif font-bold text-salsa-800 mb-6">
              Ready to Get Started?
            </h2>
            <p className="text-gray-700 text-lg mb-8">
              Visit our fundraising website for complete details or contact us directly.
            </p>
            <div className="flex flex-wrap justify-center gap-4">
              <Button size="lg" className="bg-gradient-to-r from-salsa-600 to-chile-600 hover:from-salsa-700 hover:to-chile-700" asChild>
                <Link href="https://josemadridsalsafundraising.com/start-your-fundraiser/" target="_blank" rel="noopener noreferrer">
                  <ExternalLink className="w-5 h-5 mr-2" />
                  Start Your Fundraiser
                </Link>
              </Button>
              <Button size="lg" variant="outline" className="border-salsa-500 text-salsa-600 hover:bg-salsa-50" asChild>
                <Link href="/find-us">
                  Contact Us
                </Link>
              </Button>
            </div>
          </div>
        </div>
      </section>

      {/* Program Details */}
      <section className="py-16">
        <div className="container mx-auto px-4">
          <div className="max-w-6xl mx-auto">
            <div className="text-center mb-16">
              <h2 className="text-3xl lg:text-4xl font-serif font-bold text-salsa-800 mb-6">
                How Our Fundraising Program Works
              </h2>
              <p className="text-xl text-gray-700 max-w-3xl mx-auto">
                Our goal is to make your fundraiser as easy and profitable as possible!
              </p>
            </div>

            <div className="grid lg:grid-cols-2 gap-12 mb-16">
              {/* Online Fundraising */}
              <Card className="bg-gradient-to-br from-salsa-50 to-chile-50 border-0 shadow-xl">
                <CardHeader className="text-center pb-4">
                  <div className="w-16 h-16 bg-gradient-to-br from-salsa-500 to-chile-500 rounded-full flex items-center justify-center mx-auto mb-4">
                    <Heart className="w-8 h-8 text-white" />
                  </div>
                  <h3 className="text-2xl font-serif font-bold text-salsa-800">
                    Online Fundraising
                  </h3>
                </CardHeader>
                <CardContent className="space-y-4">
                  <p className="text-gray-700">
                    For online sales, we'll add your group to our website with ordering instructions for friends, family, co-workers, and social media supporters.
                  </p>
                  <ul className="space-y-2">
                    <li className="flex items-start gap-3">
                      <div className="w-2 h-2 bg-salsa-500 rounded-full mt-2"></div>
                      <span>Choose from all 28 flavors</span>
                    </li>
                    <li className="flex items-start gap-3">
                      <div className="w-2 h-2 bg-salsa-500 rounded-full mt-2"></div>
                      <span>Direct shipping to customers</span>
                    </li>
                    <li className="flex items-start gap-3">
                      <div className="w-2 h-2 bg-salsa-500 rounded-full mt-2"></div>
                      <span>$4.00 profit per jar</span>
                    </li>
                    <li className="flex items-start gap-3">
                      <div className="w-2 h-2 bg-salsa-500 rounded-full mt-2"></div>
                      <span>Payment sent after completion</span>
                    </li>
                  </ul>
                </CardContent>
              </Card>

              {/* Community Fundraising */}
              <Card className="bg-gradient-to-br from-verde-50 to-salsa-50 border-0 shadow-xl">
                <CardHeader className="text-center pb-4">
                  <div className="w-16 h-16 bg-gradient-to-br from-verde-500 to-salsa-500 rounded-full flex items-center justify-center mx-auto mb-4">
                    <Users className="w-8 h-8 text-white" />
                  </div>
                  <h3 className="text-2xl font-serif font-bold text-salsa-800">
                    Community Fundraising
                  </h3>
                </CardHeader>
                <CardContent className="space-y-4">
                  <p className="text-gray-700">
                    Download our forms and distribute to your group. Run for 2-3 weeks, tally totals, and place your bulk order.
                  </p>
                  <ul className="space-y-2">
                    <li className="flex items-start gap-3">
                      <div className="w-2 h-2 bg-verde-500 rounded-full mt-2"></div>
                      <span>Pre-set forms: 25, 16, or 9 flavors</span>
                    </li>
                    <li className="flex items-start gap-3">
                      <div className="w-2 h-2 bg-verde-500 rounded-full mt-2"></div>
                      <span>Free shipping on 96+ jars</span>
                    </li>
                    <li className="flex items-start gap-3">
                      <div className="w-2 h-2 bg-verde-500 rounded-full mt-2"></div>
                      <span>50% profit margin</span>
                    </li>
                    <li className="flex items-start gap-3">
                      <div className="w-2 h-2 bg-verde-500 rounded-full mt-2"></div>
                      <span>Ships within 10 days</span>
                    </li>
                  </ul>
                </CardContent>
              </Card>
            </div>

            {/* Resources */}
            <div className="bg-white rounded-2xl shadow-xl p-8 mb-16">
              <h3 className="text-2xl font-serif font-bold text-salsa-800 mb-6 text-center">
                Fundraising Resources
              </h3>
              <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
                <div className="text-center">
                  <div className="w-12 h-12 bg-gradient-to-br from-salsa-500 to-chile-500 rounded-lg flex items-center justify-center mx-auto mb-3">
                    <Download className="w-6 h-6 text-white" />
                  </div>
                  <h4 className="font-bold text-salsa-800 mb-2">Sample Flier</h4>
                  <p className="text-sm text-gray-600 mb-3">Professional marketing materials ready to print</p>
                  <Button size="sm" variant="outline" className="text-xs">
                    Download PDF
                  </Button>
                </div>
                <div className="text-center">
                  <div className="w-12 h-12 bg-gradient-to-br from-verde-500 to-salsa-500 rounded-lg flex items-center justify-center mx-auto mb-3">
                    <ExternalLink className="w-6 h-6 text-white" />
                  </div>
                  <h4 className="font-bold text-salsa-800 mb-2">Online Sign-up</h4>
                  <p className="text-sm text-gray-600 mb-3">Register your organization for online fundraising</p>
                  <Button size="sm" variant="outline" className="text-xs">
                    Register Now
                  </Button>
                </div>
                <div className="text-center">
                  <div className="w-12 h-12 bg-gradient-to-br from-chile-500 to-salsa-500 rounded-lg flex items-center justify-center mx-auto mb-3">
                    <Download className="w-6 h-6 text-white" />
                  </div>
                  <h4 className="font-bold text-salsa-800 mb-2">Order Forms</h4>
                  <p className="text-sm text-gray-600 mb-3">Pre-made forms for 9, 16, or 25 flavor options</p>
                  <Button size="sm" variant="outline" className="text-xs">
                    Download Forms
                  </Button>
                </div>
                <div className="text-center">
                  <div className="w-12 h-12 bg-gradient-to-br from-salsa-500 to-verde-500 rounded-lg flex items-center justify-center mx-auto mb-3">
                    <Heart className="w-6 h-6 text-white" />
                  </div>
                  <h4 className="font-bold text-salsa-800 mb-2">Support</h4>
                  <p className="text-sm text-gray-600 mb-3">We're always happy to help with questions</p>
                  <Button size="sm" variant="outline" className="text-xs">
                    Contact Us
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Testimonials */}
      <section className="py-16 bg-gradient-to-r from-salsa-50 to-chile-50">
        <div className="container mx-auto px-4">
          <div className="max-w-6xl mx-auto">
            <div className="text-center mb-16">
              <h2 className="text-3xl lg:text-4xl font-serif font-bold text-salsa-800 mb-6">
                Success Stories
              </h2>
              <p className="text-xl text-gray-700 max-w-3xl mx-auto">
                See how organizations across the country have achieved their fundraising goals with Jose Madrid Salsa
              </p>
            </div>

            <div className="grid lg:grid-cols-2 gap-8">
              {testimonials.map((testimonial, index) => (
                <Card key={index} className="bg-white border-0 shadow-lg hover:shadow-xl transition-shadow">
                  <CardHeader className="pb-4">
                    <div className="flex items-start justify-between">
                      <div>
                        <h3 className="font-bold text-salsa-800 text-lg leading-tight">
                          {testimonial.organization}
                        </h3>
                        <div className="flex items-center gap-2 mt-1">
                          <Calendar className="w-4 h-4 text-gray-500" />
                          <span className="text-sm text-gray-600">{testimonial.date}</span>
                        </div>
                      </div>
                      <Quote className="w-8 h-8 text-salsa-300 flex-shrink-0" />
                    </div>
                  </CardHeader>
                  <CardContent>
                    <p className="text-gray-700 leading-relaxed mb-4 italic">
                      "{testimonial.content}"
                    </p>
                    <div className="flex items-center justify-between">
                      <p className="font-semibold text-salsa-700">
                        - {testimonial.author}
                      </p>
                      <div className="flex items-center gap-1">
                        {[...Array(5)].map((_, i) => (
                          <Star key={i} className="w-4 h-4 fill-yellow-400 text-yellow-400" />
                        ))}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>

            {/* Bottom Quote */}
            <div className="mt-16 text-center bg-gradient-to-r from-salsa-600 to-chile-600 rounded-2xl text-white p-8">
              <Quote className="w-12 h-12 mx-auto mb-4 text-white/70" />
              <p className="text-xl font-medium italic mb-4">
                "Jose Madrid is a wonderful product that sells itself. Not only is it easy to sell, it is an amazing product as well. Jose Madrid Salsa is easy, no hassle and you get to enjoy the funds from the fundraising immediately - there is no wait time."
              </p>
              <p className="text-chile-200">
                - Satisfied Fundraiser Organizer, October 2020
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Final CTA */}
      <section className="py-16 bg-white">
        <div className="container mx-auto px-4">
          <div className="max-w-4xl mx-auto text-center">
            <h2 className="text-3xl font-serif font-bold text-salsa-800 mb-6">
              Ready to Start Your Fundraiser?
            </h2>
            <p className="text-xl text-gray-700 mb-8 max-w-2xl mx-auto">
              Join hundreds of successful organizations who have raised funds with our delicious, authentic salsa. We're looking forward to working with you!
            </p>
            <div className="flex flex-wrap justify-center gap-6">
              <Button size="lg" className="bg-gradient-to-r from-salsa-600 to-chile-600 hover:from-salsa-700 hover:to-chile-700" asChild>
                <Link href="https://josemadridsalsafundraising.com/start-your-fundraiser/" target="_blank" rel="noopener noreferrer">
                  <ExternalLink className="w-5 h-5 mr-2" />
                  Start Your Fundraiser Today
                </Link>
              </Button>
              <Button size="lg" variant="outline" className="border-verde-500 text-verde-600 hover:bg-verde-50" asChild>
                <Link href="/find-us">
                  Have Questions? Contact Us
                </Link>
              </Button>
            </div>
            <p className="text-gray-600 mt-6">
              Questions? Call us at <a href="tel:740-521-4304" className="font-semibold text-salsa-600 hover:text-salsa-700">740-521-4304</a> or email{' '}
              <a href="mailto:fundraising@josemadridsalsa.com" className="font-semibold text-salsa-600 hover:text-salsa-700">fundraising@josemadridsalsa.com</a>
            </p>
          </div>
        </div>
      </section>
    </div>
  );
}