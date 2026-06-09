import type { Metadata } from 'next'
import { createMetadata } from '@/lib/metadata'

/**
 * Static metadata for the /developer page.
 * Uses the project's createMetadata pattern for consistent OG/Twitter cards.
 */
export const developerPageMetadata: Metadata = {
  ...createMetadata({
    title: 'Developer - Jordan Lang | Jose Madrid Salsa',
    description:
      'Meet Jordan Lang, the developer behind Jose Madrid Salsa. 200,000+ lines of code, 1,500+ hours, $250K–$750K fair-market value — delivered entirely free as originally promised. Soli Deo Gloria.',
    pathname: '/developer',
    keywords: [
      'Jordan Lang',
      'developer',
      'Jose Madrid Salsa',
      'web development',
      'Next.js',
      'full stack',
    ],
  }),
  alternates: {
    canonical: 'https://www.josemadrid.net/developer',
  },
  robots: {
    index: true,
    follow: true,
  },
}
