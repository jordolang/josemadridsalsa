import Link from 'next/link'
import type { Metadata } from 'next'
import {
  ArrowRightLeft,
  FileText,
  Flame,
  HelpCircle,
  Image as ImageIcon,
  LayoutTemplate,
  Megaphone,
  Menu,
  PanelBottom,
  Vote,
  Search,
  Sparkles,
} from 'lucide-react'
import prisma from '@/lib/prisma'
import { requirePermission } from '@/lib/rbac'
import { createMetadata } from '@/lib/metadata'
import { isMissingTableError } from '@/lib/prisma-errors'
import { Card } from '@/components/ui/card'

export const metadata: Metadata = createMetadata({
  title: 'Content - Jose Madrid Salsa Admin',
  description: 'Manage everything visitors see on the website.',
  pathname: '/admin/content',
})

export const dynamic = 'force-dynamic'

interface Tile {
  href: string
  label: string
  icon: typeof FileText
  hint: string
  count?: number
}

async function counts() {
  try {
    const [pages, banners, announcements, faqs, sections, redirects, media, posts, polls] =
      await Promise.all([
        prisma.page.count(),
        prisma.banner.count(),
        prisma.announcement.count(),
        prisma.faqItem.count(),
        prisma.reusableSection.count(),
        prisma.redirect.count(),
        prisma.media.count(),
        prisma.blogPost.count(),
        prisma.poll.count(),
      ])
    return { pages, banners, announcements, faqs, sections, redirects, media, posts, polls }
  } catch (error) {
    if (!isMissingTableError(error)) {
      console.error('[cms] failed to load content counts:', error)
    }
    return null
  }
}

export default async function ContentHub() {
  await requirePermission('content:read')
  const stats = await counts()

  const tiles: Tile[] = [
    {
      href: '/admin/content/pages',
      label: 'Pages',
      icon: FileText,
      hint: 'Edit site pages and build landing pages',
      count: stats?.pages,
    },
    {
      href: '/admin/content/banners',
      label: 'Banners',
      icon: LayoutTemplate,
      hint: 'Promotional banners with images and buttons',
      count: stats?.banners,
    },
    {
      href: '/admin/content/announcements',
      label: 'Announcements',
      icon: Megaphone,
      hint: 'The message bar above the navigation',
      count: stats?.announcements,
    },
    {
      href: '/admin/content/faqs',
      label: 'FAQs',
      icon: HelpCircle,
      hint: 'Questions and answers shown across the site',
      count: stats?.faqs,
    },
    {
      href: '/admin/content/polls',
      label: 'Polls',
      icon: Vote,
      hint: 'Ask visitors a question — linked from the site footer',
      count: stats?.polls,
    },
    {
      href: '/admin/content/navigation',
      label: 'Navigation',
      icon: Menu,
      hint: 'The menu across the top of the site',
    },
    {
      href: '/admin/content/footer',
      label: 'Footer',
      icon: PanelBottom,
      hint: 'Footer blurb, contact details and link columns',
    },
    {
      href: '/admin/content/sections',
      label: 'Reusable sections',
      icon: Sparkles,
      hint: 'Content shared across several pages',
      count: stats?.sections,
    },
    {
      href: '/admin/content/redirects',
      label: 'Redirects',
      icon: ArrowRightLeft,
      hint: 'Send old URLs to new ones',
      count: stats?.redirects,
    },
    {
      href: '/admin/media',
      label: 'Media library',
      icon: ImageIcon,
      hint: 'Images used across the site',
      count: stats?.media,
    },
    {
      href: '/admin/blog',
      label: 'The Heat Index',
      icon: Flame,
      hint: 'Blog posts, series and categories',
      count: stats?.posts,
    },
    {
      href: '/admin/seo',
      label: 'SEO',
      icon: Search,
      hint: 'Site-wide meta templates, sitemap and structured data',
    },
  ]

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Content</h1>
        <p className="text-muted-foreground">
          Everything visitors see on the website. Changes go live as soon as you publish them.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {tiles.map((tile) => (
          <Link key={tile.href} href={tile.href} className="group">
            <Card className="h-full p-5 transition hover:border-primary hover:shadow-md">
              <div className="flex items-start justify-between gap-3">
                <tile.icon className="h-6 w-6 text-muted-foreground group-hover:text-primary" />
                {typeof tile.count === 'number' && (
                  <span className="text-2xl font-bold">{tile.count}</span>
                )}
              </div>
              <p className="mt-3 font-medium">{tile.label}</p>
              <p className="text-sm text-muted-foreground">{tile.hint}</p>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  )
}
