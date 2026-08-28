import { MetadataRoute } from 'next'
import { prisma } from '@/lib/prisma'

export default async function robots(): Promise<MetadataRoute.Robots> {
  let seoConfig = null

  try {
    seoConfig = await prisma.seoConfiguration.findFirst()
  } catch (error) {
    console.error('Failed to fetch SEO config for robots.txt, using defaults:', error)
  }

  if (seoConfig?.robotsTxt) {
    const lines = seoConfig.robotsTxt.split('\n')
    const parsed: MetadataRoute.Robots = {
      rules: [],
    }

    // Everything after the first colon (URLs and paths may themselves contain colons)
    const valueOf = (line: string) => line.slice(line.indexOf(':') + 1).trim()

    let currentRule: { userAgent?: string | string[]; allow?: string | string[]; disallow?: string | string[]; crawlDelay?: number } = {}
    for (const line of lines) {
      if (line.startsWith('User-agent:')) {
        if (currentRule.userAgent) {
          (parsed.rules as any[]).push(currentRule)
        }
        currentRule = { userAgent: valueOf(line) }
      } else if (line.startsWith('Allow:')) {
        if (!currentRule.allow) {
          currentRule.allow = []
        }
        if (Array.isArray(currentRule.allow)) {
          currentRule.allow.push(valueOf(line))
        }
      } else if (line.startsWith('Disallow:')) {
        if (!currentRule.disallow) {
          currentRule.disallow = []
        }
        if (Array.isArray(currentRule.disallow)) {
          currentRule.disallow.push(valueOf(line))
        }
      } else if (line.startsWith('Sitemap:')) {
        parsed.sitemap = valueOf(line)
      }
    }

    if (currentRule.userAgent) {
      (parsed.rules as any[]).push(currentRule)
    }

    return parsed
  }

  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        // `/admin-desktop` is the desktop app's window onto the same data. It
        // sits outside `/admin/` so it can escape that layout, so it needs its
        // own line here rather than being covered by the prefix above.
        disallow: ['/admin/', '/admin-desktop', '/api/'],
      },
    ],
    sitemap: `${seoConfig?.siteUrl || 'https://www.josemadrid.net'}/sitemap.xml`,
  }
}
