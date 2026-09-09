import { Suspense } from 'react'
import { GiftBoxSelector } from '@/components/store/gift-box-selector'
import { Package, Heart, Users, Sparkles, CheckCircle2, HelpCircle } from 'lucide-react'
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion'
import { Badge } from '@/components/ui/badge'
import { SocialShare } from '@/components/ui/social-share'
import { generateHashtags } from '@/lib/sharing/metadata-extractor'
import type { ShareContent } from '@/types/sharing'
import { ScrollToTopButton } from './scroll-to-top-button'

export const dynamic = 'force-dynamic'

export const revalidate = 300

export default async function BundlesPage() {
  const shareContent: ShareContent = {
    title: 'Bundle Deals - Create Your Perfect Gift Box',
    description: 'Mix and match your favorite Jose Madrid salsas! Choose from 3, 5, 6, or 12-pack gift boxes.',
    url: 'https://www.josemadrid.net/bundles',
    contentType: 'page',
    hashtags: generateHashtags('product'),
    via: 'josemadridsalsa',
  }

  return (
    <main className="min-h-screen bg-background">
      {/* Hero Section */}
      <section className="hero-gradient relative overflow-hidden py-16">
        <div className="absolute inset-0 bg-black opacity-20"></div>
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <Badge className="mb-4 bg-white/20 text-white border-white/30">
            <Sparkles className="w-3 h-3 mr-1" />
            Mix & Match Your Favorites
          </Badge>
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
      <Suspense fallback={<div className="min-h-[400px]" />}>
        <GiftBoxSelector />
      </Suspense>

      {/* How It Works Section */}
      <section className="py-20 bg-background">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-bold font-serif text-foreground mb-4">
              How It <span className="text-gradient">Works</span>
            </h2>
            <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
              Creating your custom gift box is easy! Follow these simple steps.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
            <div className="text-center relative">
              <div className="w-16 h-16 bg-salsa-100 dark:bg-salsa-900/30 rounded-full mx-auto mb-4 flex items-center justify-center">
                <span className="text-2xl font-bold text-salsa-600">1</span>
              </div>
              <h3 className="text-xl font-bold mb-2">Choose Box Size</h3>
              <p className="text-muted-foreground">
                Select from 3, 5, 6, or 12-pack options based on your needs.
              </p>
              {/* Connector line (hidden on mobile) */}
              <div className="hidden md:block absolute top-8 left-[calc(50%+2rem)] w-[calc(100%-4rem)] h-0.5 bg-gradient-to-r from-salsa-200 to-transparent"></div>
            </div>

            <div className="text-center relative">
              <div className="w-16 h-16 bg-verde-100 dark:bg-verde-900/30 rounded-full mx-auto mb-4 flex items-center justify-center">
                <span className="text-2xl font-bold text-verde-600">2</span>
              </div>
              <h3 className="text-xl font-bold mb-2">Pick Your Salsas</h3>
              <p className="text-muted-foreground">
                Choose your favorite flavors from our complete collection.
              </p>
              <div className="hidden md:block absolute top-8 left-[calc(50%+2rem)] w-[calc(100%-4rem)] h-0.5 bg-gradient-to-r from-verde-200 to-transparent"></div>
            </div>

            <div className="text-center relative">
              <div className="w-16 h-16 bg-chile-100 dark:bg-chile-900/30 rounded-full mx-auto mb-4 flex items-center justify-center">
                <span className="text-2xl font-bold text-chile-600">3</span>
              </div>
              <h3 className="text-xl font-bold mb-2">Add to Cart</h3>
              <p className="text-muted-foreground">
                Review your selection and add it to your shopping cart.
              </p>
              <div className="hidden md:block absolute top-8 left-[calc(50%+2rem)] w-[calc(100%-4rem)] h-0.5 bg-gradient-to-r from-chile-200 to-transparent"></div>
            </div>

            <div className="text-center">
              <div className="w-16 h-16 bg-amber-100 dark:bg-amber-900/30 rounded-full mx-auto mb-4 flex items-center justify-center">
                <span className="text-2xl font-bold text-amber-600">4</span>
              </div>
              <h3 className="text-xl font-bold mb-2">Enjoy!</h3>
              <p className="text-muted-foreground">
                Receive your custom gift box and enjoy delicious salsas.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Benefits Section */}
      <section className="py-20 bg-muted/50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div className="text-center">
              <div className="w-16 h-16 bg-salsa-100 dark:bg-salsa-900/30 rounded-full mx-auto mb-4 flex items-center justify-center">
                <Heart className="w-8 h-8 text-salsa-600" />
              </div>
              <h3 className="text-xl font-bold mb-2">Perfect Gift</h3>
              <p className="text-muted-foreground">
                Create a custom gift box for any occasion. Perfect for holidays, birthdays, or thank you gifts.
              </p>
            </div>
            <div className="text-center">
              <div className="w-16 h-16 bg-verde-100 dark:bg-verde-900/30 rounded-full mx-auto mb-4 flex items-center justify-center">
                <Package className="w-8 h-8 text-verde-600" />
              </div>
              <h3 className="text-xl font-bold mb-2">Better Value</h3>
              <p className="text-muted-foreground">
                Save money when you buy in bulk. Bundle deals offer great value compared to individual jars.
              </p>
            </div>
            <div className="text-center">
              <div className="w-16 h-16 bg-chile-100 dark:bg-chile-900/30 rounded-full mx-auto mb-4 flex items-center justify-center">
                <Users className="w-8 h-8 text-chile-600" />
              </div>
              <h3 className="text-xl font-bold mb-2">Your Choice</h3>
              <p className="text-muted-foreground">
                Mix mild, medium, hot, and fruit salsas. Create the perfect combination for your taste.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Popular Bundles Section */}
      <section className="py-20 bg-background">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-bold font-serif text-foreground mb-4">
              Popular <span className="text-gradient">Combinations</span>
            </h2>
            <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
              Need inspiration? Here are some of our customers' favorite bundle combinations.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div className="card p-6">
              <Badge className="mb-4 bg-salsa-500">Best Seller</Badge>
              <h3 className="text-xl font-bold mb-3">Heat Lover's Pack</h3>
              <ul className="space-y-2 mb-6">
                <li className="flex items-start gap-2">
                  <CheckCircle2 className="w-5 h-5 text-green-500 flex-shrink-0 mt-0.5" />
                  <span className="text-muted-foreground">Jose's Hot Salsa</span>
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle2 className="w-5 h-5 text-green-500 flex-shrink-0 mt-0.5" />
                  <span className="text-muted-foreground">Extra Hot Salsa</span>
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle2 className="w-5 h-5 text-green-500 flex-shrink-0 mt-0.5" />
                  <span className="text-muted-foreground">Habanero Salsa</span>
                </li>
              </ul>
              <p className="text-sm text-muted-foreground">
                Perfect for spice enthusiasts who can handle the heat!
              </p>
            </div>

            <div className="card p-6">
              <Badge className="mb-4 bg-verde-500">Family Favorite</Badge>
              <h3 className="text-xl font-bold mb-3">Variety Pack</h3>
              <ul className="space-y-2 mb-6">
                <li className="flex items-start gap-2">
                  <CheckCircle2 className="w-5 h-5 text-green-500 flex-shrink-0 mt-0.5" />
                  <span className="text-muted-foreground">Mild Salsa</span>
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle2 className="w-5 h-5 text-green-500 flex-shrink-0 mt-0.5" />
                  <span className="text-muted-foreground">Medium Salsa</span>
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle2 className="w-5 h-5 text-green-500 flex-shrink-0 mt-0.5" />
                  <span className="text-muted-foreground">Hot Salsa</span>
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle2 className="w-5 h-5 text-green-500 flex-shrink-0 mt-0.5" />
                  <span className="text-muted-foreground">Raspberry Chipotle</span>
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle2 className="w-5 h-5 text-green-500 flex-shrink-0 mt-0.5" />
                  <span className="text-muted-foreground">Strawberry Salsa</span>
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle2 className="w-5 h-5 text-green-500 flex-shrink-0 mt-0.5" />
                  <span className="text-muted-foreground">Pineapple Salsa</span>
                </li>
              </ul>
              <p className="text-sm text-muted-foreground">
                Something for everyone in the family to enjoy!
              </p>
            </div>

            <div className="card p-6">
              <Badge className="mb-4 bg-chile-500">Fruit Fusion</Badge>
              <h3 className="text-xl font-bold mb-3">Sweet & Savory</h3>
              <ul className="space-y-2 mb-6">
                <li className="flex items-start gap-2">
                  <CheckCircle2 className="w-5 h-5 text-green-500 flex-shrink-0 mt-0.5" />
                  <span className="text-muted-foreground">Raspberry Chipotle</span>
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle2 className="w-5 h-5 text-green-500 flex-shrink-0 mt-0.5" />
                  <span className="text-muted-foreground">Strawberry Salsa</span>
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle2 className="w-5 h-5 text-green-500 flex-shrink-0 mt-0.5" />
                  <span className="text-muted-foreground">Pineapple Salsa</span>
                </li>
              </ul>
              <p className="text-sm text-muted-foreground">
                Explore our unique fruit-based salsas with a kick!
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* FAQ Section */}
      <section className="py-20 bg-muted/50">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <HelpCircle className="w-12 h-12 mx-auto mb-4 text-salsa-600" />
            <h2 className="text-4xl font-bold font-serif text-foreground mb-4">
              Frequently Asked <span className="text-gradient">Questions</span>
            </h2>
            <p className="text-xl text-muted-foreground">
              Got questions? We've got answers!
            </p>
          </div>

          <Accordion type="single" collapsible className="space-y-4">
            <AccordionItem value="item-1" className="card px-6">
              <AccordionTrigger className="text-left font-semibold">
                Can I mix different heat levels in one box?
              </AccordionTrigger>
              <AccordionContent className="text-muted-foreground">
                Absolutely! That's the whole point of our bundle deals. Mix mild, medium, hot, and fruit salsas to create your perfect combination. You have complete control over your selection.
              </AccordionContent>
            </AccordionItem>

            <AccordionItem value="item-2" className="card px-6">
              <AccordionTrigger className="text-left font-semibold">
                How much do I save with bundle deals?
              </AccordionTrigger>
              <AccordionContent className="text-muted-foreground">
                Bundle deals offer better value compared to buying individual jars. The more you buy, the more you save! Our 12-pack offers the best per-jar price.
              </AccordionContent>
            </AccordionItem>

            <AccordionItem value="item-3" className="card px-6">
              <AccordionTrigger className="text-left font-semibold">
                Are the bundles pre-packaged or can I customize them?
              </AccordionTrigger>
              <AccordionContent className="text-muted-foreground">
                All bundles are fully customizable! You choose exactly which salsas go into your box. We don't offer pre-set combinations because we believe you should get exactly what you want.
              </AccordionContent>
            </AccordionItem>

            <AccordionItem value="item-4" className="card px-6">
              <AccordionTrigger className="text-left font-semibold">
                Can I choose the same salsa multiple times?
              </AccordionTrigger>
              <AccordionContent className="text-muted-foreground">
                Yes! If you have a favorite salsa, you can fill your entire box with it. Or mix and match however you like. The choice is completely yours.
              </AccordionContent>
            </AccordionItem>

            <AccordionItem value="item-5" className="card px-6">
              <AccordionTrigger className="text-left font-semibold">
                Do bundles make good gifts?
              </AccordionTrigger>
              <AccordionContent className="text-muted-foreground">
                Absolutely! Our gift boxes are perfect for any occasion - holidays, birthdays, thank you gifts, or corporate events. You can customize the selection to match the recipient's taste preferences.
              </AccordionContent>
            </AccordionItem>

            <AccordionItem value="item-6" className="card px-6">
              <AccordionTrigger className="text-left font-semibold">
                What's the shelf life of the salsas?
              </AccordionTrigger>
              <AccordionContent className="text-muted-foreground">
                All our salsas have a shelf life of 12-18 months when unopened. Once opened, refrigerate and consume within 2-3 weeks for best quality. Check individual jar labels for specific dates.
              </AccordionContent>
            </AccordionItem>
          </Accordion>
        </div>
      </section>

      {/* Social Sharing Section */}
      <section className="py-20 bg-background">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="card p-8 text-center">
            <h2 className="text-3xl font-bold font-serif text-foreground mb-4">
              Share the <span className="text-gradient">Love</span>
            </h2>
            <p className="text-lg text-muted-foreground mb-8">
              Know someone who would love our bundle deals? Share this page with them!
            </p>
            <div className="flex justify-center">
              <SocialShare
                content={shareContent}
                size="md"
                showLabels={false}
                orientation="horizontal"
              />
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20 bg-gradient-to-r from-salsa-500 to-chile-500">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="text-4xl font-bold font-serif text-white mb-4">
            Ready to Create Your Bundle?
          </h2>
          <p className="text-xl text-white/90 mb-8">
            Scroll up and start building your perfect gift box today!
          </p>
          <ScrollToTopButton />
        </div>
      </section>
    </main>
  )
}
