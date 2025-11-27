import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { DocsBody, DocsPage } from 'fumadocs-ui/page'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { docSource } from '@/lib/docs/source'
import { resolveDocAccess } from '@/lib/docs/service'
import { getCurrentUser, isStaff } from '@/lib/rbac'

export const dynamic = 'force-dynamic'

interface PageProps {
  params: Promise<{
    slug?: string[]
  }>
}

export async function generateStaticParams() {
  return docSource.generateParams()
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params
  const result = await resolveDocAccess(slug, false)

  if (!result) {
    return {
      title: 'Documentation',
    }
  }

  const title = result.page.data.title ?? 'Documentation'
  const description =
    result.page.data.description ??
    'Jose Madrid Salsa storefront, admin, and integration reference materials.'

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      url: `/docs/${result.slug}`,
    },
  }
}

export default async function DocumentationPage({ params }: PageProps) {
  const user = await getCurrentUser()
  const canViewPrivate = isStaff(user)
  const { slug } = await params
  
  console.log('[DocumentationPage] Slug parts:', slug, 'canViewPrivate:', canViewPrivate)
  
  const result = await resolveDocAccess(slug, canViewPrivate)
  
  console.log('[DocumentationPage] Result:', result ? 'found' : 'null')

  if (!result) {
    console.log('[DocumentationPage] Not found, calling notFound()')
    notFound()
  }

  const MDXContent = result.page.data.body

  return (
    <DocsPage toc={result.page.data.toc}>
      {!result.isPublished && (
        <Alert variant="destructive" className="mb-6">
          <AlertTitle>Unpublished document</AlertTitle>
          <AlertDescription>
            This page is hidden from the public site. Only authenticated staff can see it until you publish from the admin
            panel.
          </AlertDescription>
        </Alert>
      )}
      {result.visibility === 'developer' && (
        <Alert className="mb-6">
          <AlertTitle>Developer visibility</AlertTitle>
          <AlertDescription>
            This document is tagged for developer-only access. Public visitors will receive a 404 even when it is published.
          </AlertDescription>
        </Alert>
      )}
      <DocsBody>
        <MDXContent />
      </DocsBody>
    </DocsPage>
  )
}
