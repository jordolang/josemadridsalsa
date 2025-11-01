import Link from 'next/link'
import { redirect } from 'next/navigation'
import { FileText, Plus, Search } from 'lucide-react'
import { prisma } from '@/lib/prisma'
import { getCurrentUser, hasAnyPermission } from '@/lib/rbac'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'

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

export default async function EmailTemplatesPage({ searchParams }: { searchParams: SearchParams }) {
  const user = await getCurrentUser()

  if (!user || !(await hasAnyPermission(user, ['content:read', 'content:write']))) {
    redirect('/admin')
  }

  const canEdit = await hasAnyPermission(user, ['content:write'])

  const { templates, total } = await getEmailTemplates(searchParams)

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-3xl font-bold">Email Templates</h1>
          <p className="text-slate-600">
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
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <Input
              type="search"
              name="q"
              placeholder="Search templates by name, key, or subject"
              defaultValue={searchParams.q}
              className="pl-9"
            />
          </div>
          <div className="flex gap-2">
            <Button type="submit" variant="outline">
              Search
            </Button>
            {searchParams.q && (
              <Button asChild variant="ghost">
                <Link href="/admin/emails">Clear</Link>
              </Button>
            )}
          </div>
        </form>
      </Card>

      <Card>
        <div className="border-b px-6 py-4">
          <p className="text-sm text-slate-600">
            {total === 0
              ? 'No templates yet.'
              : `${total.toLocaleString()} template${total === 1 ? '' : 's'} available.`}
          </p>
        </div>

        {templates.length === 0 ? (
          <div className="py-12 text-center text-sm text-slate-500">
            Create your first email template to streamline communications.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px]">
              <thead className="border-b bg-slate-50 text-sm text-slate-600">
                <tr>
                  <th className="px-4 py-3 text-left font-medium">Name</th>
                  <th className="px-4 py-3 text-left font-medium">Key</th>
                  <th className="px-4 py-3 text-left font-medium">Subject</th>
                  <th className="px-4 py-3 text-left font-medium">Last Updated</th>
                  <th className="px-4 py-3 text-right font-medium">Actions</th>
                </tr>
              </thead>
              <tbody className="text-sm">
                {templates.map((template) => (
                  <tr key={template.id} className="border-b last:border-0">
                    <td className="px-4 py-4">
                      <div className="flex items-center gap-2">
                        <FileText className="h-4 w-4 text-slate-400" />
                        <div>
                          <p className="font-medium text-slate-900">{template.name}</p>
                          <p className="text-xs text-slate-500">ID: {template.id}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-4 text-slate-600">{template.key}</td>
                    <td className="px-4 py-4 text-slate-600">{template.subject}</td>
                    <td className="px-4 py-4 text-slate-600">
                      {template.updatedAt.toLocaleString()}
                    </td>
                    <td className="px-4 py-4 text-right">
                      <Link
                        href={`/admin/emails/${template.id}`}
                        className="text-sm font-medium text-blue-600 hover:underline"
                      >
                        View
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  )
}
