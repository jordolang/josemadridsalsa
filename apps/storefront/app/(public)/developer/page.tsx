import { developerPageMetadata } from '@/lib/developer/metadata'
import { DeveloperHero } from '@/components/developer/developer-hero'
import { DeveloperPageSections } from '@/components/developer/developer-page-sections'
import { parseChangelog } from '@/lib/developer/parse-changelog'
import { getDeveloperPageContent } from '@/lib/developer/page-content'

export const revalidate = 3600

export const metadata = developerPageMetadata

// Structured data for SEO — static content, safe for inline rendering.
const jsonLd = {
  '@context': 'https://schema.org',
  '@type': 'ProfilePage',
  mainEntity: {
    '@type': 'Person',
    name: 'Jordan Lang',
    url: 'https://jlang.dev',
    jobTitle: 'Full-Stack Developer',
    description:
      'Builder of the Jose Madrid Salsa digital platform — designed, developed, and delivered completely free.',
    sameAs: ['https://jlang.dev'],
  },
}

export default async function DeveloperPage() {
  const [changelogVersions, content] = await Promise.all([
    parseChangelog(),
    getDeveloperPageContent(),
  ])

  return (
    <div className="min-h-screen bg-background">      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <DeveloperHero content={content} />
      <DeveloperPageSections changelogVersions={changelogVersions} content={content} />
    </div>
  )
}
