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
      'Meet Jordan Lang, the developer behind Jose Madrid Salsa. Built entirely free as originally promised — Soli Deo Gloria. Explore the tech stack, feature timeline, and development blog.',
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
