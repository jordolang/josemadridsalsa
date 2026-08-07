import { redirect } from 'next/navigation'
import Link from 'next/link'
import type { Metadata } from 'next'
import { Car, FileText, HeartHandshake, Store } from 'lucide-react'

import { getCurrentUser, hasPermission } from '@/lib/rbac'
import prisma from '@/lib/prisma'
import { createMetadata } from '@/lib/metadata'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = createMetadata({
  title: 'Document Archive - Jose Madrid Salsa Admin',
  description: 'Browse the indexed business document archive.',
  pathname: '/admin/archive',
})

export default async function ArchiveHubPage() {
  const user = await getCurrentUser()
  if (!user) redirect('/auth/signin?callbackUrl=/admin/archive')
  if (!(await hasPermission(user, 'analytics:read'))) redirect('/admin')

  const [documents, sensitive, mileage, shows, fundraisers] = await Promise.all([
    prisma.archiveDocument.count(),
    prisma.archiveDocument.count({ where: { sensitivity: 'SENSITIVE' } }),
    prisma.mileageEntry.count(),
    prisma.archivedShowSale.count(),
    prisma.archivedFundraiser.count(),
  ])

  const sections = [
    {
      href: '/admin/archive/documents',
      icon: FileText,
      title: 'Documents',
      count: documents,
      description: `Every file in the archive, searchable by name, path and full text. ${sensitive.toLocaleString()} are gated as sensitive and their text is not stored here.`,
    },
    {
      href: '/admin/archive/fundraisers',
      icon: HeartHandshake,
      title: 'Fundraiser campaigns',
      count: fundraisers,
      description:
        'Historical campaigns recovered from the order forms, with jar totals and organizer contacts.',
    },
    {
      href: '/admin/archive/shows',
      icon: Store,
      title: 'Show & market sales',
      count: shows,
      description:
        "Per-event daily sales from the crew's own tallies. Historical record, not QuickBooks.",
    },
    {
      href: '/admin/archive/mileage',
      icon: Car,
      title: 'Mileage',
      count: mileage,
      description: 'Business trips recovered from the yearly mileage spreadsheets.',
    },
  ]

  return (
    <div className="space-y-6">
      <header className="space-y-2">
        <h1 className="text-3xl font-semibold text-foreground">Document archive</h1>
        <p className="max-w-3xl text-sm text-muted-foreground">
          A read-only index of the business document archive. Records here are recovered from
          spreadsheets and scans — they are a historical record, not the accounting source of
          truth.
        </p>
      </header>

      <div className="grid gap-4 sm:grid-cols-2">
        {sections.map((section) => {
          const Icon = section.icon
          return (
            <Link key={section.href} href={section.href} className="block">
              <Card className="h-full transition-colors hover:border-primary">
                <CardHeader className="flex flex-row items-start justify-between gap-4 space-y-0">
                  <div className="space-y-1">
                    <CardTitle className="flex items-center gap-2 text-lg">
                      <Icon className="h-5 w-5 text-muted-foreground" aria-hidden />
                      {section.title}
                    </CardTitle>
                    <CardDescription>{section.description}</CardDescription>
                  </div>
                  <span className="shrink-0 text-2xl font-semibold tabular-nums">
                    {section.count.toLocaleString()}
                  </span>
                </CardHeader>
              </Card>
            </Link>
          )
        })}
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">About sensitive records</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm text-muted-foreground">
          <p>
            Tax, payroll, HR and bank records are classified <strong>sensitive</strong>. Their
            metadata is indexed so you can find the file in the archive, but their extracted text
            is deliberately not stored in this database — those documents carry Social Security and
            account numbers.
          </p>
          <p>
            To read one, open the original file in the local <code>Documents/</code> archive using
            the path shown in the documents list.
          </p>
        </CardContent>
      </Card>
    </div>
  )
}
