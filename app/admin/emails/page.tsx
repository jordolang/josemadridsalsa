import Link from 'next/link'
import { redirect } from 'next/navigation'
import { FileText, Plus, Search } from 'lucide-react'
import { prisma } from '@/lib/prisma'
import { getCurrentUser, hasAnyPermission } from '@/lib/rbac'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'

type SearchParams = {
  q?: string
}

async function getEmailTemplates(searchParams: SearchParams) {
  const where: any = {}
  if (searchParams.q) {
    where.OR = [
      { name: { contains: searchParams.q, mode: 'insensitive' } },
      { key: { contains: searchParams.q, mode: 'insensitive' } },
      { subject: { contains: searchParams.q, mode: 'insensitive' } },
    ]
  }

  const templates = await prisma.emailTemplate.findMany({
    where,
    orderBy: { updatedAt: 'desc' },
  })

  return {
    templates,
    total: templates.length,
  }
}

export default async function EmailTemplatesPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const params = await searchParams;
  const user = await getCurrentUser()

  if (!user || !(await hasAnyPermission(user, ['content:read', 'content:write']))) {
    redirect('/admin')
  }

  const canEdit = await hasAnyPermission(user, ['content:write'])

  const { templates, total } = await getEmailTemplates(params)

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-3xl font-bold">Email Templates</h1>
          <p className="text-muted-foreground">
            Manage automated notifications and marketing communications.
          </p>
        </div>
        {canEdit && (
          <Button asChild>
            <Link href="/admin/emails/new">
              <Plus className="mr-2 h-4 w-4" />
              New Template
            </Link>
          </Button>
        )}
      </div>

      <Card className="p-4">
        <form className="flex flex-col gap-4 sm:flex-row" method="get">
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              type="search"
              name="q"
              placeholder="Search templates by name, key, or subject"
              defaultValue={params.q}
              className="pl-9"
            />
          </div>
          <div className="flex gap-2">
            <Button type="submit" variant="outline">
              Search
            </Button>
            {params.q && (
              <Button asChild variant="ghost">
                <Link href="/admin/emails">Clear</Link>
              </Button>
            )}
          </div>
        </form>
      </Card>

      <Card>
        <div className="border-b px-6 py-4">
          <p className="text-sm text-muted-foreground">
            {total === 0
              ? 'No templates yet.'
              : `${total.toLocaleString()} template${total === 1 ? '' : 's'} available.`}
          </p>
        </div>

        {templates.length === 0 ? (
          <div className="py-12 text-center text-sm text-muted-foreground">
            Create your first email template to streamline communications.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <Table className="min-w-[640px]">
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Key</TableHead>
                  <TableHead>Subject</TableHead>
                  <TableHead>Last Updated</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {templates.map((template) => (
                  <TableRow key={template.id}>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <FileText className="h-4 w-4 text-muted-foreground" />
                        <div>
                          <p className="font-medium text-foreground">{template.name}</p>
                          <p className="text-xs text-muted-foreground">ID: {template.id}</p>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="text-muted-foreground">{template.key}</TableCell>
                    <TableCell className="text-muted-foreground">{template.subject}</TableCell>
                    <TableCell className="text-muted-foreground">
                      {template.updatedAt.toLocaleString()}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button variant="link" size="sm" asChild className="h-auto p-0">
                        <Link href={`/admin/emails/${template.id}`}>View</Link>
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </Card>
    </div>
  )
}
