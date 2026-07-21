import { redirect } from 'next/navigation'
import type { Metadata } from 'next'
import { getCurrentUser, hasPermission } from '@/lib/rbac'
import { prisma } from '@/lib/prisma'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import {
  businessFormTemplates,
  businessFormCategories,
  formBlockLibrary,
} from '@/lib/forms/templates'
import { FormTemplateBuilder } from '@/components/admin/form-template-builder'
import { ClipboardList, FileText, Users } from 'lucide-react'
import { createMetadata } from '@/lib/metadata'

export const metadata: Metadata = createMetadata({
  title: 'Business Forms - Jose Madrid Salsa Admin',
  description: 'Build downloadable business forms for wholesale, fundraising, and operations.',
  pathname: '/admin/forms',
})

export default async function AdminFormsPage() {
  const user = await getCurrentUser()

  if (!user || !(await hasPermission(user, 'content:read'))) {
    redirect('/admin')
  }

  const savedTemplates = await prisma.formTemplate.findMany({
    orderBy: { updatedAt: 'desc' },
    include: {
      versions: {
        orderBy: { version: 'desc' },
        take: 10,
        select: {
          version: true,
          createdAt: true,
          createdById: true,
          changelogNotes: true,
        },
      },
    },
  })

  const userIds = new Set<string>()
  savedTemplates.forEach((template) => {
    if (template.createdById) userIds.add(template.createdById)
    if (template.updatedById) userIds.add(template.updatedById)
    template.versions.forEach((version) => {
      if (version.createdById) userIds.add(version.createdById)
    })
  })

  const users = userIds.size
    ? await prisma.user.findMany({
        where: { id: { in: Array.from(userIds) } },
        select: { id: true, name: true, email: true },
      })
    : []

  const userDirectory = Object.fromEntries(users.map((owner) => [owner.id, owner]))

  const savedTemplateSummaries = savedTemplates.map((template) => ({
    id: template.id,
    name: template.name,
    categoryId: template.category,
    description: template.description ?? '',
    tags: template.tags ?? [],
    estimatedCompletion: template.estimatedCompletion ?? '—',
    recommendedUses: template.recommendedUses ?? [],
    sections: Array.isArray((template.structure as any)?.sections)
      ? (template.structure as any).sections
      : [],
    density: (template.structure as any)?.density,
    publicSlug: template.slug,
    status: template.status,
    version: template.version,
    source: 'saved' as const,
    updatedAt: template.updatedAt.toISOString(),
    history: template.versions.map((version) => ({
      version: version.version,
      createdAt: version.createdAt.toISOString(),
      changelogNotes: version.changelogNotes,
      authorName: version.createdById ? userDirectory[version.createdById]?.name ?? null : null,
      authorEmail: version.createdById ? userDirectory[version.createdById]?.email ?? null : null,
      authorId: version.createdById,
    })),
  }))

  const libraryTemplates = businessFormTemplates.map((template) => ({
    ...template,
    source: 'library' as const,
    history: [],
  }))

  const combinedTemplates = [...savedTemplateSummaries, ...libraryTemplates]

  const totalForms = combinedTemplates.length
  const fundraisingForms = combinedTemplates.filter((template) => template.categoryId === 'fundraising').length
  const operationalForms = combinedTemplates.filter((template) => template.categoryId === 'operations').length
  const savedCount = savedTemplateSummaries.length

  const overviewCards = [
    {
      label: 'Templates ready',
      value: totalForms,
      icon: FileText,
      blurb: 'Sales, fundraising, HR, finance, and operations workflows.',
    },
    {
      label: 'Fundraising coverage',
      value: fundraisingForms,
      icon: ClipboardList,
      blurb: 'Tally sheets, volunteer rosters, and marketing consent blocks.',
    },
    {
      label: 'Operational playbooks',
      value: operationalForms,
      icon: Users,
      blurb: 'Event sign-in sheets, inventory counts, and payroll timesheets.',
    },
  ]

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <div className="space-y-1">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Operations
          </p>
          <h1 className="text-2xl font-bold tracking-tight">
            Business forms studio
          </h1>
          <p className="max-w-3xl text-sm text-muted-foreground">
            Generate printable forms for wholesale orders, fundraisers,
            payroll, and day-to-day operations. Export as HTML, print on
            demand, or share the public link with partners.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Badge variant="outline">
            {totalForms} templates ({savedCount} saved)
          </Badge>
          <Badge variant="outline">
            {formBlockLibrary.length} reusable blocks
          </Badge>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        {overviewCards.map((card) => {
          const Icon = card.icon
          return (
            <Card key={card.label}>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardDescription className="text-xs font-medium uppercase tracking-wide">
                  {card.label}
                </CardDescription>
                <Icon className="size-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <CardTitle className="text-2xl font-bold tabular-nums">
                  {card.value}
                </CardTitle>
                <p className="mt-2 text-xs text-muted-foreground">
                  {card.blurb}
                </p>
              </CardContent>
            </Card>
          )
        })}
      </div>

      <FormTemplateBuilder
        templates={combinedTemplates}
        categories={businessFormCategories}
        blockLibrary={formBlockLibrary}
        currentUser={{ id: user.id, name: user.name ?? null, email: user.email ?? null }}
      />
    </div>
  )
}
