import Link from 'next/link'
import type { Metadata } from 'next'
import { FileText, Pencil } from 'lucide-react'
import prisma from '@/lib/prisma'
import { requirePermission } from '@/lib/rbac'
import { createMetadata } from '@/lib/metadata'
import { SYSTEM_PAGES } from '@/lib/cms/system-pages'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { NewLandingPageButton } from '@/components/admin/cms/new-landing-page-button'

export const metadata: Metadata = createMetadata({
  title: 'Pages - Jose Madrid Salsa Admin',
  description: 'Manage site pages and landing pages.',
  pathname: '/admin/content/pages',
})

export const dynamic = 'force-dynamic'

const STATUS_VARIANT: Record<string, 'default' | 'secondary' | 'outline' | 'destructive'> = {
  PUBLISHED: 'default',
  SCHEDULED: 'secondary',
  DRAFT: 'outline',
  ARCHIVED: 'destructive',
}

export default async function PagesIndex() {
  await requirePermission('content:read')

  const rows = await prisma.page.findMany({
    orderBy: { updatedAt: 'desc' },
    select: { id: true, slug: true, title: true, kind: true, status: true, updatedAt: true },
  })

  const bySlug = new Map(rows.map((row) => [row.slug, row]))
  const landingPages = rows.filter((row) => row.kind === 'LANDING')

  return (
    <div className="space-y-8">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold">Pages</h1>
          <p className="text-muted-foreground">
            Edit the content of existing site pages, or build new landing pages from scratch.
          </p>
        </div>
        <NewLandingPageButton />
      </div>

      <section className="space-y-3">
        <div>
          <h2 className="text-xl font-semibold">Site pages</h2>
          <p className="text-sm text-muted-foreground">
            Pages that already exist on the site. You can change their wording, images and
            section order — the layout stays as designed. Anything left blank keeps the current
            built-in copy.
          </p>
        </div>
        <Card>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Page</TableHead>
                <TableHead>URL</TableHead>
                <TableHead>Sections</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="w-20 text-right">Edit</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {SYSTEM_PAGES.map((definition) => {
                const saved = bySlug.get(definition.slug)
                return (
                  <TableRow key={definition.slug}>
                    <TableCell className="font-medium">{definition.title}</TableCell>
                    <TableCell className="text-muted-foreground">{definition.route}</TableCell>
                    <TableCell>{definition.sections.length}</TableCell>
                    <TableCell>
                      {saved ? (
                        <Badge variant={STATUS_VARIANT[saved.status] ?? 'outline'}>
                          {saved.status}
                        </Badge>
                      ) : (
                        <Badge variant="outline">Not customised</Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button asChild variant="ghost" size="sm">
                        <Link href={`/admin/content/pages/${definition.slug}`}>
                          <Pencil className="h-4 w-4" />
                          <span className="sr-only">Edit {definition.title}</span>
                        </Link>
                      </Button>
                    </TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        </Card>
      </section>

      <section className="space-y-3">
        <div>
          <h2 className="text-xl font-semibold">Landing pages</h2>
          <p className="text-sm text-muted-foreground">
            Pages you build here from scratch, section by section. They appear at their own URL.
          </p>
        </div>
        <Card>
          {landingPages.length === 0 ? (
            <div className="flex flex-col items-center gap-3 py-12 text-center">
              <FileText className="h-8 w-8 text-muted-foreground" />
              <p className="text-sm text-muted-foreground">
                No landing pages yet. Create one to build a campaign or promotional page.
              </p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Title</TableHead>
                  <TableHead>URL</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Last updated</TableHead>
                  <TableHead className="w-20 text-right">Edit</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {landingPages.map((row) => (
                  <TableRow key={row.id}>
                    <TableCell className="font-medium">{row.title}</TableCell>
                    <TableCell className="text-muted-foreground">/{row.slug}</TableCell>
                    <TableCell>
                      <Badge variant={STATUS_VARIANT[row.status] ?? 'outline'}>{row.status}</Badge>
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {row.updatedAt.toLocaleDateString()}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button asChild variant="ghost" size="sm">
                        <Link href={`/admin/content/pages/${row.slug}`}>
                          <Pencil className="h-4 w-4" />
                          <span className="sr-only">Edit {row.title}</span>
                        </Link>
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </Card>
      </section>
    </div>
  )
}
