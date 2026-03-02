import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { businessFormTemplates } from '@/lib/forms/templates'
import { renderFormHtml } from '@/lib/forms/render'
import { Badge } from '@/components/ui/badge'
import { FormPublicToolbar } from '@/components/forms/form-public-toolbar'
import { Sparkles } from 'lucide-react'
import { prisma } from '@/lib/prisma'
import type { BusinessFormTemplate } from '@/types/forms'
import { createMetadata } from '@/lib/metadata'

type FormPageProps = {
  params: Promise<{
    slug: string
  }>
}

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

const findTemplate = async (slug: string): Promise<CatalogTemplate | null> => {
  try {
    const saved = await prisma.formTemplate.findFirst({
      where: { slug, status: 'PUBLISHED' },
    })

    if (saved) {
      return mapSavedTemplate(saved)
    }
  } catch (error) {
    console.warn(`Could not load published form template "${slug}" from Prisma, checking library fallback.`, error)
  }

  const library = businessFormTemplates.find((template) => template.publicSlug === slug)
  if (library) {
    return {
      ...library,
      source: 'library',
      status: 'PUBLISHED',
    }
  }

  return null
}

export async function generateMetadata({ params }: FormPageProps): Promise<Metadata> {
  const { slug } = await params;
  const template = await findTemplate(slug);

  if (!template) {
    return createMetadata({
      title: 'Business Form - Jose Madrid Salsa',
      description: 'Download Jose Madrid Salsa business form templates.',
      pathname: `/forms/${slug}`,
    })
  }

  return createMetadata({
    title: `${template.name} – Jose Madrid Salsa`,
    description: template.description,
    pathname: `/forms/${slug}`,
  })
}

export default async function FormDetailPage({ params }: FormPageProps) {
  const { slug } = await params;
  const template = await findTemplate(slug);

  if (!template) {
    notFound()
  }

  const html = renderFormHtml(template, {
    title: template.name,
    includeBranding: true,
  })

  const updatedLabel = template.updatedAt
    ? `Updated ${new Date(template.updatedAt).toLocaleDateString(undefined, {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      })}`
    : null

  return (
    <main className="bg-slate-50 pb-16">
      <section className="border-b border-slate-200 bg-white">
        <div className="container mx-auto px-4 py-10">
          <p className="text-xs uppercase tracking-[0.35em] text-salsa-500">Printable template</p>
          <div className="mt-4 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div className="space-y-3">
              <h1 className="font-serif text-3xl font-semibold text-slate-900 lg:text-4xl">{template.name}</h1>
              <p className="max-w-2xl text-sm text-slate-600">{template.description}</p>
              <div className="flex flex-wrap gap-2">
                <Badge
                  variant="outline"
                  className={`border-slate-200 text-xs capitalize ${
                    template.source === 'saved' ? 'text-emerald-600 border-emerald-200' : 'text-slate-500'
                  }`}
                >
                  {template.source === 'saved' ? 'Saved template' : 'Library template'}
                </Badge>
                {updatedLabel ? (
                  <Badge variant="outline" className="border-slate-200 text-xs text-slate-500">
                    {updatedLabel}
                  </Badge>
                ) : null}
                {template.tags.map((tag) => (
                  <Badge key={tag} variant="outline" className="border-slate-200 text-xs text-slate-600">
                    {tag}
                  </Badge>
                ))}
              </div>
            </div>
            <FormPublicToolbar html={html} title={template.name} />
          </div>
        </div>
      </section>

      <section className="container mx-auto px-4 py-8">
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="flex items-center gap-2 text-sm font-semibold text-slate-700">
            <Sparkles className="h-4 w-4 text-slate-500" />
            Recommended uses
          </h2>
          <ul className="mt-3 list-disc space-y-2 pl-5 text-sm text-slate-600">
            {template.recommendedUses.map((use) => (
              <li key={use}>{use}</li>
            ))}
          </ul>
        </div>
      </section>

      <section className="container mx-auto px-4">
        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
          <iframe
            title={`${template.name} preview`}
            srcDoc={html}
            className="h-[900px] w-full border-0"
          />
        </div>
        <p className="mt-4 text-xs text-slate-500">
          Need edits or branded variations? Sign in to the admin panel to adjust sections, add blocks, and export updated HTML.
        </p>
      </section>
    </main>
  )
}
