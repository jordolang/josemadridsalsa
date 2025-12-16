import { MetadataRoute } from 'next'
import { prisma } from '@/lib/prisma'

export default async function robots(): Promise<MetadataRoute.Robots> {
  const seoConfig = await prisma.seoConfiguration.findFirst()

  if (seoConfig?.robotsTxt) {
    const lines = seoConfig.robotsTxt.split('\n')
    const parsed: MetadataRoute.Robots = {
      rules: [],
    }

    let currentRule: any = {}
    for (const line of lines) {
      if (line.startsWith('User-agent:')) {
        if (currentRule.userAgent) {
          parsed.rules.push(currentRule)
        }
        currentRule = { userAgent: line.split(':')[1].trim() }
      } else if (line.startsWith('Allow:')) {
        currentRule.allow = currentRule.allow || []
        currentRule.allow.push(line.split(':')[1].trim())
      } else if (line.startsWith('Disallow:')) {
        currentRule.disallow = currentRule.disallow || []
        currentRule.disallow.push(line.split(':')[1].trim())
      } else if (line.startsWith('Sitemap:')) {
        parsed.sitemap = line.split(':')[1].trim()
      }
    }

    if (currentRule.userAgent) {
      parsed.rules.push(currentRule)
    }

    return parsed
  }

  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        disallow: ['/admin/', '/api/'],
      },
    ],
    sitemap: `${seoConfig?.siteUrl || 'https://www.josemadrid.net'}/sitemap.xml`,
  }
}
