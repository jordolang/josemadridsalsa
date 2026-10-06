import type { Metadata } from 'next'
import Link from 'next/link'
import { Quote } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { PageHero } from '../_components/page-hero'

export const metadata: Metadata = {
  title: 'Fundraiser Testimonials',
  description:
    'Schools, teams, clubs and churches share how their Jose Madrid Salsa fundraisers went: easy to run, quick to ship, and 50% profit on every jar.',
  alternates: { canonical: '/testimonials' },
}

interface Testimonial {
  organization: string
  author?: string
  date?: string
  quote: string[]
}

const TESTIMONIALS: readonly Testimonial[] = [
  {
    organization: 'Indian River Students Against Destructive Decisions',
    author: 'Linda Elcsisin',
    date: 'February 2021',
    quote: [
      'Thank you again for a wonderful fundraiser. I was not sure if people would support our salsa sales during this difficult time. We underestimated the support our SADD club has and we were able to have a successful fundraiser. Indian River SADD is using our profits to have a “Make Good Decisions” week in March, buying prizes for students who take part.',
      'Your company makes this fundraiser so easy to do. Thank you for helping us get the word out that teens need to make good decisions. We will be back in the fall for another salsa sale.',
    ],
  },
  {
    organization: 'Ana Lobé Ballet Academy',
    author: 'Ana Lobé',
    date: 'January 2021',
    quote: [
      'Thank you, muchas gracias Mike, Matt & Jose Madrid Salsa for another successful fundraiser. This is our third year working with you and it is the best fundraiser ever. You have created a great, delicious product and we will continue buying from you. Our parents love your salsa! ¡Gracias!',
    ],
  },
  {
    organization: 'Live Oaks Career Campus — National Technical Honor Society',
    date: 'December 2020',
    quote: [
      'I used the Jose Madrid salsa fundraiser for the first time this year, in large part due to COVID restrictions on other forms of fundraising. The option to have an in-house sale as well as an online sale provided flexibility that worked in these more challenging times. The 50% fundraising profit was a big selling point because those who ordered knew they were supporting our organization, but also going to get to enjoy a delicious product.',
    ],
  },
  {
    organization: 'Fundraiser organizer',
    date: 'October 2020',
    quote: [
      'Jose Madrid is a wonderful product that sells itself. If you have not tried it, you will keep coming back once you do. Not only is it easy to sell, it is an amazing product as well. Jose Madrid Salsa is easy, no hassle, and you get to enjoy the funds from the fundraising immediately — there is no wait time. Highly recommended!',
    ],
  },
  {
    organization: 'Sheffield Middle High School',
    author: 'Jeff Lindquist, History Instructor',
    date: 'January 2019',
    quote: [
      'I wanted to take a moment to thank you for providing such a great fundraiser. It was easy to do, ordering was simple, and the customer service was outstanding. Thank you also for providing samples we could give out during our basketball tournaments. It generated interest and let people try flavors they may have been hesitant to order a full jar of.',
    ],
  },
  {
    organization: 'School in Simsbury, Connecticut',
    date: 'March 2018',
    quote: [
      'As a small school, we are often faced with the challenge of meeting the minimum sales targets required by many fundraising programs, and tiered profit structures make it difficult to meet fundraising goals. With no minimum sales required (only a minimum for free shipping) and a 50% profit on every jar sold, Jose Madrid Salsa seemed like the perfect fundraiser for our school.',
      'From the beginning, Matt was extremely responsive, flexible and easy to work with. People were happy to be selling something new and different. We sold more jars than we ever imagined and far exceeded our fundraising expectations. The ordering process was simple and we received our shipment in about a week.',
    ],
  },
  {
    organization: 'River View Cross Country Team',
    author: 'Jon Hardesty, Booster Representative',
    quote: [
      'We are constantly looking for new ideas to help us raise money and Jose Madrid Salsa was a perfect fit. The salsa was easy to sell and we expect it to be even easier next time once people try it. Everybody absolutely loves it. The order forms were easy for the athletes to use and it was so easy to place our order. We received our order in less than a week, and the personal service from both Matt and Mike was amazing.',
      'We are completely self-funded and responsible for the thousands of dollars it takes to operate our team each season, and the 50% profit on every jar was perfect. Thank you for being a member of our TEAM.',
    ],
  },
  {
    organization: 'West Middle School, Taylor, Michigan',
    quote: [
      'Families were very impressed by how well it sold and they are excited for the amounts to be applied to their Washington, DC trip. They loved that it wasn’t the usual cookie dough and candy fundraiser. Each student fundraises for their own account, and one student raised over $100 for her trip. Teachers in the building were buying to use with chicken recipes!',
    ],
  },
  {
    organization: 'Clyffeside Food Pantry',
    date: 'July 2018',
    quote: [
      'As I am typing this, I am eating the Peach Mild salsa. It is unbelievable! I was looking for a way to raise money for our church’s food pantry and someone recommended Jose Madrid. At first I thought nobody would want salsa, but I decided to give it a try — and now I am working on my second fundraiser with them.',
      'My first order was 110 jars and my second was over 50. The guys are great to work with, especially Mike, who stayed in constant contact with me. I would highly recommend this company to anyone looking for a fundraiser.',
    ],
  },
]

export default function TestimonialsPage() {
  return (
    <>
      <PageHero eyebrow="Testimonials" title="What our fundraising groups say">
        <p>Schools, teams, clubs and churches across the country have raised money with Jose Madrid Salsa.</p>
      </PageHero>

      <section className="py-14">
        <div className="container mx-auto grid gap-6 px-4 lg:grid-cols-2">
          {TESTIMONIALS.map((item) => (
            <figure key={item.organization} className="card surface-shadow p-6">
              <Quote className="mb-3 h-8 w-8 text-salsa-300" aria-hidden />
              <blockquote className="space-y-3 italic leading-relaxed text-foreground/90">
                {item.quote.map((paragraph) => (
                  <p key={paragraph.slice(0, 32)}>“{paragraph}”</p>
                ))}
              </blockquote>
              <figcaption className="mt-4 border-t border-border pt-4">
                <p className="font-bold text-foreground">{item.organization}</p>
                {item.author || item.date ? (
                  <p className="text-sm text-muted-foreground">{[item.author, item.date].filter(Boolean).join(' · ')}</p>
                ) : null}
              </figcaption>
            </figure>
          ))}
        </div>
      </section>

      <section className="bg-card py-14">
        <div className="container mx-auto px-4 text-center">
          <h2 className="font-serif text-2xl font-bold text-foreground">Finished a fundraiser with us?</h2>
          <p className="mt-2 text-muted-foreground">Tell us how it went — with your permission, we may share your comments here.</p>
          <div className="mt-6 flex flex-wrap justify-center gap-4">
            <Button variant="outline" className="border-salsa-500 text-salsa-600 hover:bg-salsa-50" asChild>
              <Link href="/survey">Take the survey</Link>
            </Button>
            <Button className="bg-gradient-to-r from-salsa-600 to-chile-600 hover:from-salsa-700 hover:to-chile-700" asChild>
              <Link href="/start">Start your fundraiser</Link>
            </Button>
          </div>
        </div>
      </section>
    </>
  )
}
