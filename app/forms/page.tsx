import Link from 'next/link'
import type { Metadata } from 'next'
import { ArrowRight, FileText, Sparkles } from 'lucide-react'
import { businessFormTemplates, businessFormCategories } from '@/lib/forms/templates'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { prisma } from '@/lib/prisma'
import type { BusinessFormTemplate } from '@/types/forms'
import { createMetadata } from '@/lib/metadata'

export const metadata: Metadata = createMetadata({
  title: 'Business Forms Library - Jose Madrid Salsa',
  description: 'Download printable order forms, fundraising tallies, payroll timesheets, and more from Jose Madrid Salsa.',
  pathname: '/forms',
})

type CatalogTemplate = BusinessFormTemplate & {
  source: 'library' | 'saved'
  updatedAt?: string
  status?: 'DRAFT' | 'PUBLISHED' | 'ARCHIVED'
}

const mapSavedTemplate = (template: any): CatalogTemplate => ({
  id: template.id,
  name: template.name,
  categoryId: template.category,
  description: template.description ?? '',
  tags: template.tags ?? [],
  estimatedCompletion: template.estimatedCompletion ?? '—',
  recommendedUses: template.recommendedUses ?? [],
  sections: Array.isArray((template.structure as any)?.sections) ? (template.structure as any).sections : [],
  publicSlug: template.slug,
  status: template.status,
  version: template.version,
  source: 'saved',
  updatedAt: template.updatedAt?.toISOString(),
})

const libraryTemplates = businessFormTemplates.map<CatalogTemplate>((template) => ({
  ...template,
  source: 'library',
  status: 'PUBLISHED',
}))

export default async function FormsLibraryPage() {
  let savedTemplates: any[] = []

  try {
    savedTemplates = await prisma.formTemplate.findMany({
      where: {
        status: 'PUBLISHED',
      },
      orderBy: { updatedAt: 'desc' },
    })
  } catch (error) {
    console.warn('Failed to fetch form templates from database, using library templates only:', error)
  }

  const savedMapped = savedTemplates.map(mapSavedTemplate)

  const templatesBySlug = new Map<string, CatalogTemplate>()
  libraryTemplates.forEach((template) => templatesBySlug.set(template.publicSlug, template))
  savedMapped.forEach((template) => templatesBySlug.set(template.publicSlug, template))

  const combinedTemplates = Array.from(templatesBySlug.values())
  const totalForms = combinedTemplates.length

  return (
    <main className="bg-slate-50 pb-16">
      <section className="relative overflow-hidden bg-gradient-to-br from-salsa-600 via-salsa-500 to-chile-500 py-20 text-white">
        <div className="container mx-auto px-4">
          <div className="max-w-3xl space-y-6">
            <p className="text-xs uppercase tracking-[0.35em] text-white/80">Printable resources</p>
            <h1 className="font-serif text-4xl font-bold leading-tight sm:text-5xl">
              Ready-to-use Jose Madrid Salsa business forms
            </h1>
            <p className="text-base text-white/90">
              Download our most requested order forms, fundraising tallies, payroll sheets, and event checklists. Each template
              is optimized for quick printing and easy record keeping.
            </p>
            <div className="flex flex-wrap gap-3">
              <Button asChild className="bg-white text-salsa-600 hover:bg-white/90">
                <Link href="#forms">
                  Browse forms
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Link>
              </Button>
              <Button asChild variant="outline" className="border-white/70 text-white hover:bg-white/10">
                <Link href="/admin/forms">
                  Manage in admin
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Link>
              </Button>
            </div>
          </div>
        </div>
      </section>

      <section className="container mx-auto -mt-12 px-4">
        <div className="grid gap-4 md:grid-cols-3">
          {businessFormCategories.map((category) => {
            const count = combinedTemplates.filter((template) => template.categoryId === category.id).length
            return (
              <div
                key={category.id}
                className="rounded-2xl border border-white/70 bg-white p-6 shadow-sm"
              >
                <div className="flex items-center gap-3">
                  <span className="flex h-10 w-10 items-center justify-center rounded-full bg-salsa-50 text-salsa-500">
                    <FileText className="h-5 w-5" />
                  </span>
                  <div>
                    <p className="text-sm font-semibold text-slate-900">{category.label}</p>
                    <p className="text-xs text-slate-500">{count} template{count === 1 ? '' : 's'}</p>
                  </div>
                </div>
                <p className="mt-3 text-sm text-slate-600">{category.description}</p>
              </div>
            )
          })}
        </div>
      </section>

      <section id="forms" className="container mx-auto px-4 py-16">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <div className="flex items-center gap-2 text-salsa-600">
              <Sparkles className="h-4 w-4" />
              <span className="text-xs uppercase tracking-[0.35em]">Featured library</span>
            </div>
            <h2 className="mt-2 font-serif text-3xl font-semibold text-slate-900">
              Download {totalForms}+ versatile business forms
            </h2>
            <p className="text-sm text-slate-600">
              Forms render in your browser for quick printing or editing. Use them for wholesale, fundraisers, and operations.
            </p>
          </div>
        </div>

        <div className="mt-8 grid gap-6 md:grid-cols-2 xl:grid-cols-3">
          {combinedTemplates.map((template) => (
            <article
              key={template.id}
              className="flex flex-col gap-4 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm transition hover:-translate-y-1 hover:shadow-lg"
            >
              <div className="space-y-2">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h3 className="text-xl font-semibold text-slate-900">{template.name}</h3>
                  <div className="flex flex-wrap gap-2">
                    {template.estimatedCompletion ? (
                      <Badge variant="outline" className="border-slate-200 text-xs text-slate-600">
                        {template.estimatedCompletion}
                      </Badge>
                    ) : null}
                    <Badge
                      variant="outline"
                      className={`border-slate-200 text-xs capitalize ${
                        template.source === 'saved' ? 'text-emerald-600 border-emerald-200' : 'text-slate-500'
                      }`}
                    >
                      {template.source === 'saved' ? 'Saved' : 'Library'}
                    </Badge>
                  </div>
                </div>
                <p className="text-sm text-slate-600">{template.description}</p>
                {template.updatedAt ? (
                  <p className="text-xs text-slate-400">
                    Updated {new Date(template.updatedAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}
                  </p>
                ) : null}
              </div>
              <ul className="space-y-1 text-xs text-slate-500">
                {template.recommendedUses.map((use) => (
                  <li key={use}>• {use}</li>
                ))}
              </ul>
              <div className="flex flex-wrap gap-2">
                {template.tags.map((tag) => (
                  <Badge key={tag} variant="outline" className="border-slate-200 text-xs text-slate-600">
                    {tag}
                  </Badge>
                ))}
              </div>
              <Button asChild>
                <Link href={`/forms/${template.publicSlug}`}>
                  View &amp; print
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Link>
              </Button>
            </article>
          ))}
        </div>
      </section>
    </main>
  )
}
