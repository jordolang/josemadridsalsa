/**
 * Static content for the merch pages. The products themselves come from Printify
 * (`lib/merchandise/catalog.ts`); these are the contact details and the mockups shown while
 * the Printify catalog is not connected or is empty.
 */

export const merchContactEmail = process.env.NEXT_PUBLIC_FULFILLMENT_EMAIL ?? 'mike@josemadridsalsa.com'

export const merchMediaShowcase = [
  {
    id: 'apparel-drop',
    title: 'Seasonal apparel drop',
    description: 'Garment-dyed tees with the 1982 Jose Madrid wordmark for superfans and team members.',
    image: '/images/merch/seasonal-apparel.png',
  },
  {
    id: 'event-booth',
    title: 'Event booth kit',
    description: 'Table runner, tasting flight, and banner ready for fundraising nights or store demos.',
    image: '/images/merch/event-display.png',
  },
  {
    id: 'retail-display',
    title: 'Retail display set',
    description: 'Shelf talkers, coasters, and hang tags to merchandise jars and swag together.',
    image: '/images/merch/retail-display.png',
  },
]
