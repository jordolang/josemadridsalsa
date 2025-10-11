import { Metadata } from 'next';
import { Mail, Phone, MapPin, Clock, Send } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';

export const metadata: Metadata = {
  title: 'Find Us - Jose Madrid Salsa',
  description: 'Get in touch with Jose Madrid Salsa. Contact us for questions, wholesale inquiries, or just to share your love for authentic New Mexico-style salsa.',
  openGraph: {
    title: 'Find Us - Jose Madrid Salsa',
    description: 'Contact Jose Madrid Salsa for questions, wholesale inquiries, or just to share your love for authentic salsa.',
    images: ['/og-contact.jpg'],
  },
};

export default function FindUsPage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-white via-verde-50/30 to-salsa-50/30">
      {/* Hero Section */}
      <section className="relative bg-gradient-to-r from-verde-600 via-salsa-600 to-chile-600 text-white">
        <div className="absolute inset-0 bg-black/20"></div>
        <div className="relative container mx-auto px-4 py-20 lg:py-28">
          <div className="max-w-4xl mx-auto text-center">
            <h1 className="text-4xl lg:text-6xl font-serif font-bold mb-6 text-shadow-lg">
              Find Us
            </h1>
            <p className="text-xl lg:text-2xl text-verde-100 max-w-2xl mx-auto leading-relaxed">
              We'd love to hear from you! Get in touch with questions, feedback, or wholesale opportunities
            </p>
          </div>
        </div>
      </section>

      <section className="py-16">
        <div className="container mx-auto px-4">
          <div className="max-w-6xl mx-auto">
            <div className="grid lg:grid-cols-2 gap-12">
              {/* Contact Information */}
              <div className="space-y-8">
                <div className="bg-white rounded-2xl shadow-xl p-8">
                  <h2 className="text-3xl font-serif font-bold text-salsa-800 mb-8">
                    Get In Touch
                  </h2>
                  <p className="text-gray-700 leading-relaxed mb-8 text-lg">
                    To contact us please fill in the inquiry form and one of our team members will be in touch shortly! Or feel free to call or email directly.
                  </p>

                  {/* Contact Methods */}
                  <div className="space-y-6">
                    <div className="flex items-center gap-4 p-4 bg-gradient-to-r from-salsa-50 to-chile-50 rounded-xl">
                      <div className="w-12 h-12 bg-gradient-to-br from-salsa-500 to-chile-500 rounded-full flex items-center justify-center">
                        <Mail className="w-6 h-6 text-white" />
                      </div>
                      <div>
                        <p className="font-semibold text-salsa-800">Email Us</p>
                        <a 
                          href="mailto:mike@josemadridsalsa.com"
                          className="text-salsa-600 hover:text-salsa-700 transition-colors font-medium"
                        >
                          mike@josemadridsalsa.com
                        </a>
                      </div>
                    </div>

                    <div className="flex items-center gap-4 p-4 bg-gradient-to-r from-verde-50 to-salsa-50 rounded-xl">
                      <div className="w-12 h-12 bg-gradient-to-br from-verde-500 to-salsa-500 rounded-full flex items-center justify-center">
                        <Phone className="w-6 h-6 text-white" />
                      </div>
                      <div>
                        <p className="font-semibold text-salsa-800">Call Us</p>
                        <a 
                          href="tel:740-521-4304"
                          className="text-salsa-600 hover:text-salsa-700 transition-colors font-medium text-lg"
                        >
                          740-521-4304
                        </a>
                      </div>
                    </div>

                    <div className="flex items-center gap-4 p-4 bg-gradient-to-r from-chile-50 to-salsa-50 rounded-xl">
                      <div className="w-12 h-12 bg-gradient-to-br from-chile-500 to-salsa-500 rounded-full flex items-center justify-center">
                        <MapPin className="w-6 h-6 text-white" />
                      </div>
                      <div>
                        <p className="font-semibold text-salsa-800">Based In</p>
                        <p className="text-gray-700">Zanesville, Ohio</p>
                      </div>
                    </div>

                    <div className="flex items-center gap-4 p-4 bg-gradient-to-r from-salsa-50 to-verde-50 rounded-xl">
                      <div className="w-12 h-12 bg-gradient-to-br from-salsa-500 to-verde-500 rounded-full flex items-center justify-center">
                        <Clock className="w-6 h-6 text-white" />
                      </div>
                      <div>
                        <p className="font-semibold text-salsa-800">Response Time</p>
                        <p className="text-gray-700">Usually within 24 hours</p>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Additional Info */}
                <div className="bg-gradient-to-br from-salsa-600 to-chile-600 rounded-2xl text-white p-8">
                  <h3 className="text-2xl font-serif font-bold mb-4">
                    What Can We Help You With?
                  </h3>
                  <ul className="space-y-3 text-salsa-100">
                    <li className="flex items-center gap-3">
                      <div className="w-2 h-2 bg-chile-300 rounded-full"></div>
                      Product questions and recommendations
                    </li>
                    <li className="flex items-center gap-3">
                      <div className="w-2 h-2 bg-chile-300 rounded-full"></div>
                      Wholesale and retail opportunities
                    </li>
                    <li className="flex items-center gap-3">
                      <div className="w-2 h-2 bg-chile-300 rounded-full"></div>
                      Fundraising program inquiries
                    </li>
                    <li className="flex items-center gap-3">
                      <div className="w-2 h-2 bg-chile-300 rounded-full"></div>
                      Recipe suggestions and cooking tips
                    </li>
                    <li className="flex items-center gap-3">
                      <div className="w-2 h-2 bg-chile-300 rounded-full"></div>
                      Event partnership opportunities
                    </li>
                  </ul>
                </div>
              </div>

              {/* Contact Form */}
              <div className="bg-white rounded-2xl shadow-xl p-8">
                <h2 className="text-3xl font-serif font-bold text-salsa-800 mb-8">
                  Send Us a Message
                </h2>
                
                <form className="space-y-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                      <label htmlFor="firstName" className="block text-sm font-semibold text-gray-700 mb-2">
                        First Name
                      </label>
                      <Input
                        id="firstName"
                        name="firstName"
                        type="text"
                        placeholder="Your first name"
                        className="border-gray-300 focus:border-salsa-500 focus:ring-salsa-500"
                        required
                      />
                    </div>
                    <div>
                      <label htmlFor="lastName" className="block text-sm font-semibold text-gray-700 mb-2">
                        Last Name
                      </label>
                      <Input
                        id="lastName"
                        name="lastName"
                        type="text"
                        placeholder="Your last name"
                        className="border-gray-300 focus:border-salsa-500 focus:ring-salsa-500"
                        required
                      />
                    </div>
                  </div>

                  <div>
                    <label htmlFor="email" className="block text-sm font-semibold text-gray-700 mb-2">
                      Email Address
                    </label>
                    <Input
                      id="email"
                      name="email"
                      type="email"
                      placeholder="your.email@example.com"
                      className="border-gray-300 focus:border-salsa-500 focus:ring-salsa-500"
                      required
                    />
                  </div>

                  <div>
                    <label htmlFor="phone" className="block text-sm font-semibold text-gray-700 mb-2">
                      Phone Number (Optional)
                    </label>
                    <Input
                      id="phone"
                      name="phone"
                      type="tel"
                      placeholder="(555) 123-4567"
                      className="border-gray-300 focus:border-salsa-500 focus:ring-salsa-500"
                    />
                  </div>

                  <div>
                    <label htmlFor="subject" className="block text-sm font-semibold text-gray-700 mb-2">
                      Subject
                    </label>
                    <Input
                      id="subject"
                      name="subject"
                      type="text"
                      placeholder="What's this about?"
                      className="border-gray-300 focus:border-salsa-500 focus:ring-salsa-500"
                      required
                    />
                  </div>

                  <div>
                    <label htmlFor="message" className="block text-sm font-semibold text-gray-700 mb-2">
                      Message
                    </label>
                    <Textarea
                      id="message"
                      name="message"
                      placeholder="Tell us more about your inquiry..."
                      rows={6}
                      className="border-gray-300 focus:border-salsa-500 focus:ring-salsa-500 resize-none"
                      required
                    />
                  </div>

                  <Button 
                    type="submit" 
                    size="lg"
                    className="w-full bg-gradient-to-r from-salsa-600 to-chile-600 hover:from-salsa-700 hover:to-chile-700 text-white font-semibold py-3 px-6 rounded-lg transition-all duration-300 transform hover:scale-[1.02]"
                  >
                    <Send className="w-5 h-5 mr-2" />
                    Send Message
                  </Button>
                </form>

                <div className="mt-8 pt-6 border-t border-gray-200 text-center">
                  <p className="text-gray-600">
                    <strong>Thanks!</strong> We appreciate you taking the time to reach out.
                  </p>
                </div>
              </div>
            </div>

            {/* Bottom CTA */}
            <div className="mt-16 bg-gradient-to-r from-verde-50 to-chile-50 rounded-2xl p-8 text-center">
              <h3 className="text-2xl font-serif font-bold text-salsa-800 mb-4">
                Looking for Something Specific?
              </h3>
              <div className="flex flex-wrap justify-center gap-4">
                <Button variant="outline" className="border-salsa-500 text-salsa-600 hover:bg-salsa-50" asChild>
                  <a href="/wholesale">Wholesale Inquiries</a>
                </Button>
                <Button variant="outline" className="border-verde-500 text-verde-600 hover:bg-verde-50" asChild>
                  <a href="/fundraising">Fundraising Program</a>
                </Button>
                <Button variant="outline" className="border-chile-500 text-chile-600 hover:bg-chile-50" asChild>
                  <a href="/products">Browse Products</a>
                </Button>
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}