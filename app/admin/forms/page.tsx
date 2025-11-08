import { redirect } from 'next/navigation'
import type { Metadata } from 'next'
import { getCurrentUser, hasPermission } from '@/lib/rbac'
import { prisma } from '@/lib/prisma'
import { Card } from '@/components/ui/card'
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
  })

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
    publicSlug: template.slug,
    status: template.status,
    version: template.version,
    source: 'saved' as const,
    updatedAt: template.updatedAt.toISOString(),
  }))

  const libraryTemplates = businessFormTemplates.map((template) => ({
    ...template,
    source: 'library' as const,
  }))

  const combinedTemplates = [...savedTemplateSummaries, ...libraryTemplates]

  const totalForms = combinedTemplates.length
  const fundraisingForms = combinedTemplates.filter((template) => template.categoryId === 'fundraising').length
  const operationalForms = combinedTemplates.filter((template) => template.categoryId === 'operations').length
  const savedCount = savedTemplateSummaries.length

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <div className="space-y-1">
          <p className="text-xs uppercase tracking-[0.35em] text-salsa-500">Operations</p>
          <h1 className="text-3xl font-serif font-semibold text-slate-900">Business forms studio</h1>
          <p className="max-w-3xl text-sm text-slate-600">
            Generate printable forms for wholesale orders, fundraisers, payroll, and day-to-day operations. Export as
            HTML, print on demand, or share the public link with partners.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Badge variant="outline" className="border-salsa-200 text-xs text-salsa-600">
            {totalForms} templates ({savedCount} saved)
          </Badge>
          <Badge variant="outline" className="border-salsa-200 text-xs text-salsa-600">
            {formBlockLibrary.length} reusable blocks
          </Badge>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card className="space-y-2 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-full bg-salsa-50 text-salsa-500">
              <FileText className="h-5 w-5" />
            </span>
            <div>
              <p className="text-xs uppercase text-slate-500">Templates ready</p>
              <p className="text-2xl font-semibold text-slate-900">{totalForms}</p>
            </div>
          </div>
          <p className="text-xs text-slate-500">Sales, fundraising, HR, finance, and operations workflows.</p>
        </Card>

        <Card className="space-y-2 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-full bg-amber-50 text-amber-600">
              <ClipboardList className="h-5 w-5" />
            </span>
            <div>
              <p className="text-xs uppercase text-slate-500">Fundraising coverage</p>
              <p className="text-2xl font-semibold text-slate-900">{fundraisingForms}</p>
            </div>
          </div>
          <p className="text-xs text-slate-500">Tally sheets, volunteer rosters, and marketing consent blocks.</p>
        </Card>

        <Card className="space-y-2 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-full bg-emerald-50 text-emerald-600">
              <Users className="h-5 w-5" />
            </span>
            <div>
              <p className="text-xs uppercase text-slate-500">Operational playbooks</p>
              <p className="text-2xl font-semibold text-slate-900">{operationalForms}</p>
            </div>
          </div>
          <p className="text-xs text-slate-500">Event sign-in sheets, inventory counts, and payroll timesheets.</p>
        </Card>
      </div>

      <FormTemplateBuilder
        templates={combinedTemplates}
        categories={businessFormCategories}
        blockLibrary={formBlockLibrary}
      />
    </div>
  )
}
