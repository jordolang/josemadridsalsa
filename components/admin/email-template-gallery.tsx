'use client'

import { useMemo, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import type { NewsletterBlock, NewsletterTemplate } from '@/types/email'

type EmailTemplateGalleryProps = {
  templates: NewsletterTemplate[]
  blocks: NewsletterBlock[]
}

export function EmailTemplateGallery({ templates, blocks }: EmailTemplateGalleryProps) {
  const defaultTemplate = templates[0]
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>(defaultTemplate?.id ?? '')
  const [copiedTemplateId, setCopiedTemplateId] = useState<string | null>(null)
  const selectedTemplate = useMemo(
    () => templates.find((template) => template.id === selectedTemplateId) ?? defaultTemplate,
    [selectedTemplateId, templates, defaultTemplate],
  )

  const handleCopyTemplate = async () => {
    if (!selectedTemplate) {
      return
    }
    try {
      await navigator.clipboard.writeText(selectedTemplate.html)
      setCopiedTemplateId(selectedTemplate.id)
      window.setTimeout(() => setCopiedTemplateId(null), 2500)
    } catch (error) {
      console.error('Failed to copy template', error)
    }
  }

  const handleDownloadTemplate = () => {
    if (!selectedTemplate) {
      return
    }
    const blob = new Blob([selectedTemplate.html], { type: 'text/html' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `${selectedTemplate.id}.html`
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[0.92fr_1.08fr]">
      <div className="space-y-6">
        <div className="space-y-2">
          <h2 className="font-serif text-xl font-semibold text-foreground">Template library</h2>
          <p className="text-sm text-muted-foreground">
            Choose a ready-to-send template, copy the HTML, or download it for your ESP.
          </p>
        </div>
        <div className="space-y-3">
          {templates.map((template) => {
            const isActive = selectedTemplate?.id === template.id
            return (
              <button
                key={template.id}
                type="button"
                onClick={() => setSelectedTemplateId(template.id)}
                className={cn(
                  'w-full rounded-xl border px-4 py-3 text-left transition focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
                  isActive
                    ? 'border-primary bg-primary/5'
                    : 'border-border bg-card hover:border-input hover:bg-muted/50',
                )}
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="font-medium text-foreground">{template.name}</p>
                  <div className="flex flex-wrap gap-1">
                    {template.tags.map((tag) => (
                      <Badge key={`${template.id}-${tag}`} variant="outline" className="text-xs">
                        {tag}
                      </Badge>
                    ))}
                  </div>
                </div>
                <p className="mt-1 text-xs uppercase tracking-wide text-muted-foreground">{template.subject}</p>
                <p className="mt-2 text-sm text-muted-foreground">{template.description}</p>
              </button>
            )
          })}
        </div>
      </div>

      <div className="space-y-6">
        {selectedTemplate ? (
          <>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-xs uppercase tracking-[0.35em] text-muted-foreground">Preview</p>
                <h3 className="font-serif text-2xl font-semibold text-foreground">{selectedTemplate.name}</h3>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button variant="outline" size="sm" onClick={handleCopyTemplate}>
                  {copiedTemplateId === selectedTemplate.id ? 'Copied!' : 'Copy HTML'}
                </Button>
                <Button variant="outline" size="sm" onClick={handleDownloadTemplate}>
                  Download HTML
                </Button>
              </div>
            </div>
            <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
              <div
                key={selectedTemplate.id}
                className="max-h-[640px] overflow-auto bg-muted p-4"
                dangerouslySetInnerHTML={{ __html: selectedTemplate.html }}
              />
            </div>
          </>
        ) : null}

        <div className="space-y-4 rounded-2xl border border-border bg-card p-6 shadow-sm">
          <div>
            <h3 className="font-serif text-xl font-semibold text-foreground">Drag-and-drop blocks</h3>
            <p className="text-sm text-muted-foreground">
              Mix and match these HTML partials inside your ESP to build new newsletters quickly.
            </p>
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            {blocks.map((block) => (
              <div key={block.id} className="rounded-xl border border-border bg-muted/50 p-4">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-semibold text-foreground">{block.label}</p>
                  <Badge variant="outline" className="border-border text-xs capitalize text-primary">
                    {block.category}
                  </Badge>
                </div>
                <p className="mt-2 text-xs text-muted-foreground">{block.description}</p>
                <Button
                  variant="link"
                  size="sm"
                  className="mt-2 px-0"
                  onClick={() => navigator.clipboard?.writeText(block.html).catch(() => undefined)}
                >
                  Copy block markup
                </Button>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
