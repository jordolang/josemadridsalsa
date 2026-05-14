'use client'

import { useEffect, useMemo, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Card } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { cn } from '@/lib/utils'
import { renderFormHtml } from '@/lib/forms/render'
import type {
  BusinessFormCategory,
  BusinessFormTemplate,
  BusinessFormSection,
} from '@/types/forms'
import type { FormBlockLibraryItem } from '@/lib/forms/templates'
import { Download, FileType2, History, Layers, Printer, Sparkles, Wand2 } from 'lucide-react'
import { toast } from 'sonner'
import { createFormTemplate, updateFormTemplate } from '@/app/admin/forms/actions'

type TemplateSource = NonNullable<BusinessFormTemplate['source']>

type TemplateHistoryEntry = {
  version: number
  createdAt: string
  changelogNotes?: string | null
  authorName?: string | null
  authorEmail?: string | null
  authorId?: string | null
}

type BuilderTemplate = BusinessFormTemplate & {
  source: TemplateSource
  status?: 'DRAFT' | 'PUBLISHED' | 'ARCHIVED'
  version?: number
  updatedAt?: string
  history?: TemplateHistoryEntry[]
}

type FormTemplateBuilderProps = {
  templates: BuilderTemplate[]
  categories: BusinessFormCategory[]
  blockLibrary: FormBlockLibraryItem[]
  currentUser: {
    id: string
    name?: string | null
    email?: string | null
  }
}

const ensureSource = (template: BuilderTemplate): BuilderTemplate => ({
  ...template,
  source: template.source ?? 'library',
})

const defaultSectionSelection = (template: BuilderTemplate) =>
  template.source === 'saved'
    ? template.sections.map((section) => section.id)
    : template.sections
        .filter((section) => section.defaultIncluded !== false)
        .map((section) => section.id)

export function FormTemplateBuilder({ templates, categories, blockLibrary, currentUser }: FormTemplateBuilderProps) {
  const router = useRouter()
  const [isSaving, startSaving] = useTransition()

  const initialTemplates = useMemo(() => templates.map(ensureSource), [templates])
  const defaultTemplate = initialTemplates[0]

  const [templateList, setTemplateList] = useState<BuilderTemplate[]>(initialTemplates)
  const [activeCategory, setActiveCategory] = useState<string>('all')
  const [activeSource, setActiveSource] = useState<'all' | TemplateSource>('all')
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>(defaultTemplate?.id ?? '')
  const [customTitle, setCustomTitle] = useState<string>(defaultTemplate?.name ?? '')
  const [selectedSections, setSelectedSections] = useState<string[]>(
    defaultTemplate ? defaultSectionSelection(defaultTemplate) : [],
  )
  const [activeBlocks, setActiveBlocks] = useState<string[]>([])
  const [includeBranding, setIncludeBranding] = useState<boolean>(true)
  const [notes, setNotes] = useState<string>('')
  const [changelogNotes, setChangelogNotes] = useState<string>('')
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    setTemplateList(initialTemplates)
  }, [initialTemplates])

  const filteredTemplates = useMemo(() => {
    return templateList.filter((template) => {
      const categoryMatch = activeCategory === 'all' || template.categoryId === activeCategory
      const sourceMatch = activeSource === 'all' || template.source === activeSource
      return categoryMatch && sourceMatch
    })
  }, [templateList, activeCategory, activeSource])

  useEffect(() => {
    if (filteredTemplates.some((template) => template.id === selectedTemplateId)) {
      return
    }
    const fallbackId = filteredTemplates[0]?.id ?? templateList[0]?.id
    if (fallbackId) {
      setSelectedTemplateId(fallbackId)
    }
  }, [filteredTemplates, templateList, selectedTemplateId])

  const selectedTemplate = useMemo(
    () => templateList.find((template) => template.id === selectedTemplateId) ?? defaultTemplate,
    [templateList, selectedTemplateId, defaultTemplate],
  )

  useEffect(() => {
    if (!selectedTemplate) {
      return
    }
    setCustomTitle(selectedTemplate.name)
    setSelectedSections(defaultSectionSelection(selectedTemplate))
    setActiveBlocks([])
    setNotes('')
    setChangelogNotes('')
  }, [selectedTemplate])

  const blockMap = useMemo(
    () => Object.fromEntries(blockLibrary.map((block) => [block.id, block])),
    [blockLibrary],
  )

  const combinedSections = useMemo(() => {
    if (!selectedTemplate) {
      return []
    }
    const blockSections = activeBlocks
      .map((blockId) => blockMap[blockId]?.section)
      .filter(Boolean) as BusinessFormSection[]
    return [...selectedTemplate.sections, ...blockSections]
  }, [selectedTemplate, activeBlocks, blockMap])

  const includeSectionsList = useMemo(
    () => Array.from(new Set(selectedSections)),
    [selectedSections],
  )

  const previewHtml = useMemo(() => {
    if (!selectedTemplate) {
      return ''
    }
    const sectionsToRender = combinedSections.filter((section) => includeSectionsList.includes(section.id))
    return renderFormHtml(
      {
        ...selectedTemplate,
        sections: sectionsToRender,
      },
      {
        title: customTitle.trim() || selectedTemplate.name,
        includeSections: includeSectionsList,
        includeBranding,
        notes: notes.trim() || undefined,
      },
    )
  }, [selectedTemplate, combinedSections, includeSectionsList, customTitle, includeBranding, notes])

  const versionHistory = selectedTemplate?.history ?? []

  const formatHistoryTimestamp = (iso: string) =>
    new Date(iso).toLocaleString(undefined, {
      dateStyle: 'medium',
      timeStyle: 'short',
    })

  const resolveHistoryAuthor = (entry: TemplateHistoryEntry) => {
    if (entry.authorName) {
      return entry.authorName
    }
    if (entry.authorEmail) {
      return entry.authorEmail
    }
    if (entry.authorId && entry.authorId === currentUser?.id) {
      return currentUser.name ?? currentUser.email ?? 'You'
    }
    return 'Unknown author'
  }

  const normalizeHistoryEntries = (history?: unknown[]): TemplateHistoryEntry[] => {
    if (!Array.isArray(history)) {
      return []
    }
    return history.map((entry: unknown) => {
      const record = entry as Record<string, unknown>
      return {
        version: Number(record.version) || 1,
        createdAt:
          typeof record.createdAt === 'string'
            ? record.createdAt
            : record.createdAt instanceof Date
              ? record.createdAt.toISOString()
              : new Date((record.createdAt as string | number | undefined) ?? Date.now()).toISOString(),
        changelogNotes: (record.changelogNotes as string | null | undefined) ?? null,
        authorName: (record.authorName as string | null | undefined) ?? null,
        authorEmail: (record.authorEmail as string | null | undefined) ?? null,
        authorId: (record.authorId ?? (record as { createdById?: unknown }).createdById) as string | null | undefined ?? null,
      }
    })
  }

  const transformTemplateFromServer = (template: unknown): BuilderTemplate => {
    const t = template as Record<string, unknown>
    const structure = t.structure as { sections?: unknown[] } | undefined
    return {
      id: t.id as string,
      name: t.name as string,
      categoryId: t.category as string,
      description: (t.description as string | undefined) ?? '',
      tags: Array.isArray(t.tags) ? t.tags as string[] : [],
      estimatedCompletion: (t.estimatedCompletion as string | undefined) ?? '',
      recommendedUses: Array.isArray(t.recommendedUses) ? t.recommendedUses as string[] : [],
      sections: Array.isArray(structure?.sections) ? structure.sections as BusinessFormSection[] : [],
      publicSlug: (t.slug as string | undefined) ?? '',
      status: t.status as 'DRAFT' | 'PUBLISHED' | 'ARCHIVED' | undefined,
      version: t.version as number | undefined,
      source: 'saved',
      updatedAt: (t.updatedAt as string | undefined) ?? new Date().toISOString(),
      history: normalizeHistoryEntries((t.history ?? (t as { versions?: unknown[] }).versions) as unknown[]),
    }
  }

  const persistTemplate = (status: 'DRAFT' | 'PUBLISHED') => {
    if (!selectedTemplate) {
      toast.error('Select a template', {
        description: 'Choose a template before saving.',
      })
      return
    }

    const sectionsToPersist = combinedSections.filter((section) => includeSectionsList.includes(section.id))
    if (sectionsToPersist.length === 0) {
      toast.error('Select at least one section', {
        description: 'Choose the sections you want to include before saving.',
      })
      return
    }

    startSaving(async () => {
      try {
        const payload = {
          id: selectedTemplate.source === 'saved' ? selectedTemplate.id : undefined,
          slug: selectedTemplate.source === 'saved' ? selectedTemplate.publicSlug : undefined,
          name: customTitle.trim() || selectedTemplate.name,
          description: selectedTemplate.description,
          categoryId: selectedTemplate.categoryId,
          tags: selectedTemplate.tags,
          estimatedCompletion: selectedTemplate.estimatedCompletion,
          recommendedUses: selectedTemplate.recommendedUses,
          sections: sectionsToPersist.map((section) => ({
            ...section,
            fields: section.fields ?? [],
          })) as BusinessFormSection[],
          status,
          changelogNotes:
            status === 'PUBLISHED' && changelogNotes.trim().length > 0 ? changelogNotes.trim() : undefined,
        }

        const result =
          selectedTemplate.source === 'saved'
            ? await updateFormTemplate(selectedTemplate.id, payload)
            : await createFormTemplate(payload)

        const mapped = transformTemplateFromServer(result)

        setTemplateList((prev) => {
          const withoutCurrent = prev.filter((template) => template.id !== mapped.id)
          return [mapped, ...withoutCurrent]
        })
        setSelectedTemplateId(mapped.id)
        setSelectedSections(mapped.sections.map((section) => section.id))
        if (status === 'PUBLISHED') {
          setChangelogNotes('')
        }

        toast.success(
          status === 'PUBLISHED' ? 'Template published' : 'Draft saved',
          { description: `${mapped.name} is now ${status.toLowerCase()}.` }
        )

        router.refresh()
      } catch (error) {
        const message = error instanceof Error ? error.message : 'An unexpected error occurred.'
        toast.error('Save failed', { description: message })
      }
    })
  }

  const handleCopyTemplate = async () => {
    if (!previewHtml) {
      return
    }
    try {
      await navigator.clipboard.writeText(previewHtml)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 2500)
    } catch {
      setCopied(false)
    }
  }

  const handleDownloadTemplate = () => {
    if (!previewHtml || !selectedTemplate) {
      return
    }
    const blob = new Blob([previewHtml], { type: 'text/html' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    const safeTitle = (customTitle || selectedTemplate.name).toLowerCase().replace(/[^a-z0-9]+/g, '-')
    link.href = url
    link.download = `${safeTitle}.html`
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)
  }

  const handlePrintPreview = () => {
    if (!previewHtml) {
      return
    }
    const printWindow = window.open('', '_blank', 'noopener,noreferrer,width=960,height=800')
    if (!printWindow) {
      return
    }
    printWindow.document.open()
    printWindow.document.write(previewHtml)
    printWindow.document.close()
    printWindow.focus()
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[0.9fr_1.1fr]">
      <div className="space-y-4">
        <Card className="space-y-4 p-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-xs uppercase tracking-[0.3em] text-primary">Templates</p>
              <h2 className="font-serif text-xl font-semibold text-foreground">Form library</h2>
            </div>
            <div className="flex gap-2">
              <Select value={activeSource} onValueChange={(value: 'all' | TemplateSource) => setActiveSource(value)}>
                <SelectTrigger className="w-[150px]">
                  <SelectValue placeholder="Filter by source" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All sources</SelectItem>
                  <SelectItem value="library">Library</SelectItem>
                  <SelectItem value="saved">Saved</SelectItem>
                </SelectContent>
              </Select>
              <Select value={activeCategory} onValueChange={setActiveCategory}>
                <SelectTrigger className="w-[150px]">
                  <SelectValue placeholder="Filter by category" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All categories</SelectItem>
                  {categories.map((category) => (
                    <SelectItem key={category.id} value={category.id}>
                      {category.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="space-y-3">
            {filteredTemplates.map((template) => {
              const isActive = selectedTemplate?.id === template.id
              return (
                <button
                  key={template.id}
                  type="button"
                  className={cn(
                    'w-full rounded-xl border px-4 py-3 text-left transition focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
                    isActive
                      ? 'border-primary bg-primary/5'
                      : 'border-border bg-card hover:border-input hover:bg-muted/50',
                  )}
                  onClick={() => setSelectedTemplateId(template.id)}
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="text-sm font-semibold text-foreground">{template.name}</p>
                    <div className="flex flex-wrap gap-1">
                      <Badge variant="outline" className="border-border text-xs text-muted-foreground">
                        {categories.find((category) => category.id === template.categoryId)?.label ?? template.categoryId}
                      </Badge>
                      {template.estimatedCompletion ? (
                        <Badge variant="outline" className="border-border text-xs text-muted-foreground">
                          {template.estimatedCompletion}
                        </Badge>
                      ) : null}
                      <Badge
                        variant="outline"
                        className={cn(
                          'border-border text-xs capitalize',
                          template.source === 'saved' ? 'text-primary border-border' : 'text-muted-foreground',
                        )}
                      >
                        {template.source === 'saved' ? 'Saved' : 'Library'}
                      </Badge>
                    </div>
                  </div>
                  <p className="mt-1 text-xs uppercase tracking-wide text-muted-foreground">{template.tags.join(' · ')}</p>
                  <p className="mt-2 text-sm text-muted-foreground">{template.description}</p>
                  {template.source === 'saved' ? (
                    <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                      {template.status ? (
                        <Badge
                          variant="outline"
                          className={cn(
                            'border-border text-xs capitalize',
                            template.status === 'PUBLISHED'
                              ? 'text-primary border-border'
                              : template.status === 'ARCHIVED'
                                ? 'text-muted-foreground border-border'
                                : 'text-muted-foreground border-border',
                          )}
                        >
                          {template.status.toLowerCase()}
                        </Badge>
                      ) : null}
                      {template.version ? <span>v{template.version}</span> : null}
                      {template.updatedAt ? (
                        <span>
                          Updated{' '}
                          {new Date(template.updatedAt).toLocaleDateString(undefined, {
                            month: 'short',
                            day: 'numeric',
                            year: 'numeric',
                          })}
                        </span>
                      ) : null}
                    </div>
                  ) : null}
                </button>
              )
            })}
          </div>
        </Card>

        <Card className="space-y-4 p-5">
          <div className="flex items-center gap-2">
            <Layers className="h-4 w-4 text-muted-foreground" />
            <h3 className="font-serif text-lg font-semibold text-foreground">Sections</h3>
          </div>
          <div className="space-y-3">
            {combinedSections.map((section) => {
              const included = includeSectionsList.includes(section.id)
              return (
                <Label
                  key={section.id}
                  htmlFor={`section-${section.id}`}
                  className={cn(
                    'flex cursor-pointer items-start gap-3 rounded-xl border px-3 py-3 font-normal transition',
                    included ? 'border-primary bg-primary/5' : 'border-border bg-card hover:border-input',
                  )}
                >
                  <Checkbox
                    id={`section-${section.id}`}
                    checked={included}
                    onCheckedChange={() =>
                      setSelectedSections((prev) =>
                        prev.includes(section.id) ? prev.filter((id) => id !== section.id) : [...prev, section.id],
                      )
                    }
                    className="mt-1"
                  />
                  <div>
                    <p className="text-sm font-semibold text-foreground">{section.label}</p>
                    {section.description ? (
                      <p className="mt-1 text-xs text-muted-foreground">{section.description}</p>
                    ) : null}
                  </div>
                </Label>
              )
            })}
          </div>
        </Card>

        <Card className="space-y-4 p-5">
          <div className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-muted-foreground" />
            <h3 className="font-serif text-lg font-semibold text-foreground">Blocks</h3>
          </div>
          <p className="text-sm text-muted-foreground">
            Drop reusable blocks into any template: terms, payment receipts, marketing consent, and more.
          </p>
          <div className="space-y-3">
            {blockLibrary.map((block) => {
              const isActive = activeBlocks.includes(block.id)
              return (
                <div key={block.id} className="rounded-xl border border-border bg-card px-3 py-3">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold text-foreground">{block.label}</p>
                      <p className="text-xs text-muted-foreground">{block.description}</p>
                    </div>
                    <Button
                      variant={isActive ? 'outline' : 'default'}
                      size="sm"
                      onClick={() =>
                        setActiveBlocks((prev) => (isActive ? prev.filter((id) => id !== block.id) : [...prev, block.id]))
                      }
                    >
                      {isActive ? 'Remove' : 'Add'}
                    </Button>
                  </div>
                </div>
              )
            })}
          </div>
        </Card>
      </div>

      <div className="space-y-4">
        <Card className="space-y-5 p-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-xs uppercase tracking-[0.3em] text-muted-foreground">Builder</p>
              <h2 className="font-serif text-2xl font-semibold text-foreground">
                {selectedTemplate?.name ?? 'Select a template'}
              </h2>
              <p className="text-xs text-muted-foreground">
                {selectedTemplate?.source === 'saved'
                  ? `Version ${selectedTemplate.version ?? 1}`
                  : 'Library template'}
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" size="sm" onClick={handleCopyTemplate}>
                <FileType2 className="mr-2 h-4 w-4" />
                {copied ? 'Copied!' : 'Copy HTML'}
              </Button>
              <Button variant="outline" size="sm" onClick={handleDownloadTemplate}>
                <Download className="mr-2 h-4 w-4" />
                Download
              </Button>
              <Button variant="default" size="sm" onClick={handlePrintPreview}>
                <Printer className="mr-2 h-4 w-4" />
                Print preview
              </Button>
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="form-title">Form title</Label>
              <Input
                id="form-title"
                value={customTitle}
                onChange={(event) => setCustomTitle(event.target.value)}
                placeholder="Wholesale order form"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="branding-toggle">Branding</Label>
              <Button
                type="button"
                id="branding-toggle"
                variant={includeBranding ? 'default' : 'outline'}
                onClick={() => setIncludeBranding((prev) => !prev)}
                className="h-10 w-full"
              >
                {includeBranding ? 'Branding enabled' : 'Branding hidden'}
              </Button>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="form-notes">Notes for the footer (optional)</Label>
            <Textarea
              id="form-notes"
              value={notes}
              onChange={(event) => setNotes(event.target.value)}
              rows={3}
              placeholder="Add instructions for volunteers, accounting notes, or pickup reminders."
            />
          </div>

          {selectedTemplate?.source === 'saved' ? (
            <div className="space-y-2">
              <Label htmlFor="changelog-notes">Changelog notes (optional)</Label>
              <Textarea
                id="changelog-notes"
                value={changelogNotes}
                onChange={(event) => setChangelogNotes(event.target.value)}
                rows={3}
                placeholder="Summarize what changed for auditing and rollbacks."
              />
              <p className="text-xs text-muted-foreground">Visible to staff reviewing version history.</p>
            </div>
          ) : null}

          {selectedTemplate ? (
            <div className="rounded-2xl border border-border bg-muted/50 p-4">
              <h3 className="flex items-center gap-2 text-sm font-semibold text-foreground">
                <Wand2 className="h-4 w-4 text-muted-foreground" />
                Recommended uses
              </h3>
              <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-muted-foreground">
                {selectedTemplate.recommendedUses.map((use) => (
                  <li key={use}>{use}</li>
                ))}
              </ul>
            </div>
          ) : null}

          <div className="flex flex-wrap gap-2">
            <Button
              onClick={() => persistTemplate('DRAFT')}
              disabled={isSaving}
              className="bg-foreground hover:bg-foreground/90"
            >
              {isSaving ? 'Saving…' : 'Save draft'}
            </Button>
            <Button onClick={() => persistTemplate('PUBLISHED')} disabled={isSaving}>
              {isSaving ? 'Publishing…' : 'Publish'}
            </Button>
          </div>
        </Card>

        {selectedTemplate?.source === 'saved' ? (
          <Card className="space-y-4 p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs uppercase tracking-[0.3em] text-muted-foreground">Version history</p>
                <h3 className="font-serif text-lg font-semibold text-foreground">Recent changes</h3>
              </div>
              <History className="h-4 w-4 text-muted-foreground" />
            </div>
            {versionHistory.length === 0 ? (
              <p className="text-sm text-muted-foreground">Publish updates to start building a changelog.</p>
            ) : (
              <ol className="space-y-3">
                {versionHistory.map((entry) => (
                  <li key={entry.version} className="rounded-2xl border border-border bg-card p-3">
                    <div className="flex items-center justify-between text-sm font-semibold text-foreground">
                      <span>v{entry.version}</span>
                      <span className="text-xs font-normal text-muted-foreground">{formatHistoryTimestamp(entry.createdAt)}</span>
                    </div>
                    <p className="text-xs text-muted-foreground">{resolveHistoryAuthor(entry)}</p>
                    {entry.changelogNotes ? (
                      <p className="mt-2 text-sm text-foreground">{entry.changelogNotes}</p>
                    ) : null}
                  </li>
                ))}
              </ol>
            )}
          </Card>
        ) : null}

        <Card className="overflow-hidden border border-border">
          <div className="border-b border-border bg-muted/50 px-5 py-3">
            <h3 className="text-sm font-semibold text-foreground">Live preview</h3>
            <p className="text-xs text-muted-foreground">Scroll to review the printable layout exactly as it will export.</p>
          </div>
          <div className="max-h-[760px] overflow-auto bg-muted">
            <div className="min-h-[640px] bg-card" dangerouslySetInnerHTML={{ __html: previewHtml }} />
          </div>
        </Card>
      </div>
    </div>
  )
}
