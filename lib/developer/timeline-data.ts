/**
 * Static timeline data for the Developer Page feature timeline.
 * Each entry represents a major development phase of the José Madrid Salsa project.
 */

export interface TimelineEntry {
  readonly id: string
  readonly date: string
  readonly title: string
  readonly description: string
  readonly icon: string
  readonly tags: readonly string[]
  readonly image?: string
  readonly highlight?: boolean
}

export const timelineEntries: readonly TimelineEntry[] = [
  {
    id: 'phase-1-foundation',
    date: '2025-10',
    title: 'Foundation',
    description:
      'Built the entire platform from scratch in 3 days — Next.js with TypeScript, PostgreSQL database via Prisma ORM, Radix UI + shadcn component system, product catalog with heat-level filtering, shopping cart, and authentication. The seed that would grow into a full e-commerce ecosystem.',
    icon: 'Rocket',
    tags: ['Next.js', 'TypeScript', 'Prisma', 'Tailwind CSS', 'Auth'],
    image: '/images/jose-madrid-salsa-logo.png',
    highlight: true,
  },
  {
    id: 'phase-2-ecommerce',
    date: '2025-11',
    title: 'Core E-Commerce',
    description:
      'Stripe checkout with 3D Secure, 16 database-backed recipes, transactional email system via Resend, full admin panel (products, orders, customers, settings), gift certificate system with custom themes, Google Analytics & Reviews integration, dark mode, store locator for 77+ retail locations, and WordPress bot protection.',
    icon: 'ShoppingCart',
    tags: ['Stripe', 'Admin Panel', 'Email', 'Gift Certificates', 'Analytics'],
    image: '/images/hero-image-10-jars-vegetables.png',
  },
  {
    id: 'phase-3-launch',
    date: '2025-11',
    title: 'Version 1.0 — Production Launch',
    description:
      'Launched josemadrid.net on November 6, 2025. Individual pages for every retail location with interactive Google Maps and Street View. Role-based access control with 5 user roles and 28 granular permissions. Vercel Analytics for performance monitoring. CSV product import with SKU tracking.',
    icon: 'Globe',
    tags: ['Production', 'Google Maps', 'RBAC', 'Vercel'],
    image: '/images/building-graphic-side.png',
    highlight: true,
  },
  {
    id: 'phase-4-business',
    date: '2025-12',
    title: 'Business Tools',
    description:
      '12 branded business form templates with logo letterhead, fundraiser order tally tracking sheets, full email template system with mass mailing capabilities, and campaign analytics settings. Tools built to run an actual business, not just a storefront.',
    icon: 'Briefcase',
    tags: ['Forms', 'Email Campaigns', 'Templates', 'Business'],
    image: '/images/Event-Display.png',
  },
  {
    id: 'phase-5-intelligence',
    date: '2026-01',
    title: 'Analytics & Intelligence',
    description:
      'Real-time tax calculation via Stripe Tax API, AI-powered chat with auth and audit logging, Amplitude analytics with session replay, real-time inventory management, discount code system, ML-based product recommendations, loyalty rewards program, abandoned cart recovery with automated email sequences, and a block-based email template composer.',
    icon: 'Brain',
    tags: ['AI', 'Tax', 'Inventory', 'Loyalty', 'Recommendations'],
  },
  {
    id: 'phase-6-security',
    date: '2026-02',
    title: 'Security & Shipping',
    description:
      'AES-256-GCM encryption for sensitive data, real shipping cost calculator, admin credentials vault with encrypted storage and access control, full inventory admin UI, and a complete refund system with automatic inventory restoration. Fort Knox-level security.',
    icon: 'Shield',
    tags: ['Encryption', 'Shipping', 'Security', 'Refunds'],
  },
  {
    id: 'phase-7-fundraising',
    date: '2026-03',
    title: 'Fundraising Platform',
    description:
      'Dedicated fundraising portal with subdomain support, real-time participant tracking dashboards, page builder with file uploads and 10 block types, community message board with Google OAuth, advanced fundraiser profiles with custom CSS and team management, email campaign scraper for sports teams, and a competitive Battle Arena gamification system with signup and admin tools.',
    icon: 'Heart',
    tags: ['Fundraising', 'Page Builder', 'Battle Arena', 'Community'],
    image: '/images/trade-show-vendor-display.png',
    highlight: true,
  },
  {
    id: 'phase-8-payments',
    date: '2026-04',
    title: 'Multi-Payment & Optimization',
    description:
      'PayPal, Square, and POS support alongside Stripe — true multi-payment provider architecture. Enhanced order analytics and reporting, shipping label generation, and Google API optimization reducing billable calls to max 1 per page load with server-side caching.',
    icon: 'CreditCard',
    tags: ['PayPal', 'Square', 'POS', 'Performance'],
  },
] as const

export const projectStats = {
  totalCommits: 894,
  linesOfCode: 165_781,
  totalFiles: 3_926,
  totalImages: 183,
  projectStartDate: '2025-10-10',
  productionLaunchDate: '2025-11-06',
  contributors: 3,
  retailLocations: 77,
  publicRoutes: 28,
  adminRoutes: 34,
  durationMonths: 6,
} as const
