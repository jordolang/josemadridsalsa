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
  readonly features?: readonly string[]
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
    image: 'https://can9pwc8drhj1bme.public.blob.vercel-storage.com/site/images/developer/IMG_0082.webp',
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
    image: 'https://can9pwc8drhj1bme.public.blob.vercel-storage.com/site/images/developer/IMG_0084.WEBP',
  },
  {
    id: 'phase-3-launch',
    date: '2025-11',
    title: 'Version 1.0 — Production Launch',
    description:
      'Launched josemadrid.net on November 6, 2025. Individual pages for every retail location with interactive Google Maps and Street View. Role-based access control with 5 user roles and 28 granular permissions. Vercel Analytics for performance monitoring. CSV product import with SKU tracking.',
    icon: 'Globe',
    tags: ['Production', 'Google Maps', 'RBAC', 'Vercel'],
    image: 'https://can9pwc8drhj1bme.public.blob.vercel-storage.com/site/images/developer/IMG_0085.WEBP',
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
    image: 'https://can9pwc8drhj1bme.public.blob.vercel-storage.com/site/images/developer/IMG_0086.WEBP',
  },
  {
    id: 'phase-5-intelligence',
    date: '2026-01',
    title: 'Analytics & Intelligence',
    description:
      'Real-time tax calculation via Stripe Tax API, AI-powered chat with auth and audit logging, Amplitude analytics with session replay, real-time inventory management, discount code system, ML-based product recommendations, loyalty rewards program, abandoned cart recovery with automated email sequences, and a block-based email template composer.',
    icon: 'Brain',
    tags: ['AI', 'Tax', 'Inventory', 'Loyalty', 'Recommendations'],
    image: 'https://can9pwc8drhj1bme.public.blob.vercel-storage.com/site/images/developer/IMG_0087.webp',
  },
  {
    id: 'phase-6-security',
    date: '2026-02',
    title: 'Security & Shipping',
    description:
      'AES-256-GCM encryption for sensitive data, real shipping cost calculator, admin credentials vault with encrypted storage and access control, full inventory admin UI, and a complete refund system with automatic inventory restoration. Fort Knox-level security.',
    icon: 'Shield',
    tags: ['Encryption', 'Shipping', 'Security', 'Refunds'],
    image: 'https://can9pwc8drhj1bme.public.blob.vercel-storage.com/site/images/developer/IMG_0088.webp',
  },
  {
    id: 'phase-7-fundraising',
    date: '2026-03',
    title: 'Fundraising Platform',
    description:
      'Dedicated fundraising portal with subdomain support, real-time participant tracking dashboards, page builder with file uploads and 10 block types, community message board with Google OAuth, advanced fundraiser profiles with custom CSS and team management, email campaign scraper for sports teams, and a competitive Battle Arena gamification system with signup and admin tools.',
    icon: 'Heart',
    tags: ['Fundraising', 'Page Builder', 'Battle Arena', 'Community'],
    image: 'https://can9pwc8drhj1bme.public.blob.vercel-storage.com/site/images/developer/IMG_0089.webp',
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
    image: 'https://can9pwc8drhj1bme.public.blob.vercel-storage.com/site/images/developer/IMG_0090.webp',
  },
  {
    id: 'phase-9-macos-desktop',
    date: '2026-09',
    title: 'macOS Desktop App',
    description:
      'A native macOS application for running the entire business without ever leaving the desktop. Manage orders, products, inventory, customers, purchase orders and invoices; run fundraisers, events and wholesale accounts; keep the books in Financials; and publish email campaigns, social posts, blog content, leads and reviews — all from one keyboard-driven window with ⌘K search, native menus and shortcuts, real printing, save dialogs for every export, and a persistent signed-in session. It reads the same live database as the website, so every new admin feature lands on the desktop the day it ships.',
    icon: 'Monitor',
    tags: ['macOS', 'SwiftUI', 'Desktop', 'Orders', 'Content'],
    image: '/images/developer/macos-desktop-app.webp',
    highlight: true,
    features: [
      'Dashboard — today\'s revenue and orders, live fundraisers, jars on hand, reorder alerts, and the next shows',
      'Orders — every order with channel, status and totals, plus returns & RMAs and shipping labels',
      'Products — the full catalog with retail price, unit cost and margin',
      'Inventory — on hand, reserved, available and reorder points, flagged when stock runs low',
      'Customers — ranked by lifetime value, with order counts and acquisition source',
      'Purchase Orders — inbound supply by supplier, with goods, freight and what is still outstanding',
      'Invoices — accounts receivable, with open and past-due balances',
      'Fundraisers — every campaign and participant, sales, group share, and the Battle Arena',
      'Events & Shows — a month calendar of every show with booth fees, takings and packing manifests',
      'Wholesale — trade accounts with discounts, minimums, terms and approval, plus the store locator',
      'Financials — the general ledger and reconciliation, with QuickBooks export state',
      'Email Marketing — campaigns, templates, automations, lists & subscribers, suppressions, send log and brand kit',
      'Social — scheduled and published posts, connected accounts, product feeds and reach',
      'Content & Blog — blog posts, pages, banners, FAQs, redirects and SEO',
      'Lead Generation — the prospecting pipeline and lead campaigns, with Google ratings behind each lead',
      'Reviews — moderation queue with average rating, plus customer forms',
      'Analytics — year-over-year revenue, channel mix, top products, retention, margin and attribution',
      'Media & Docs — media library, documents archive, mileage log and show archive',
      'Messages — one inbox for support, the contact form and live chat, plus notifications',
      'Users & Roles — staff accounts with role, two-factor state and last sign-in, plus the encrypted credential vault',
      'Audit Logs — who did what, most recent first',
      'Settings — store identity, checkout, payments, shipping and integrations',
      'Database Console — live row counts for the core tables',
      '⌘K command palette to jump to any of 58 pages by name, J/K keyboard navigation, table filtering and a detail inspector',
      'Resizable table columns remembered per window, light and dark appearance, native menus, real printing and save dialogs for every export',
      'Role-based access — each person only sees the sections their permissions allow',
    ],
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
