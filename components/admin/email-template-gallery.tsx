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
          <h2 className="font-serif text-xl font-semibold text-gray-900">Template library</h2>
          <p className="text-sm text-gray-600">
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
                  'w-full rounded-xl border px-4 py-3 text-left transition focus:outline-none focus-visible:ring-2 focus-visible:ring-salsa-500',
                  isActive
                    ? 'border-salsa-200 bg-salsa-50'
                    : 'border-gray-200 bg-white hover:border-salsa-200 hover:bg-salsa-50/40',
                )}
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="font-medium text-gray-900">{template.name}</p>
                  <div className="flex flex-wrap gap-1">
                    {template.tags.map((tag) => (
                      <Badge key={`${template.id}-${tag}`} variant="outline" className="border-salsa-200 text-xs text-salsa-600">
                        {tag}
                      </Badge>
                    ))}
                  </div>
                </div>
                <p className="mt-1 text-xs uppercase tracking-wide text-salsa-500">{template.subject}</p>
                <p className="mt-2 text-sm text-gray-600">{template.description}</p>
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
                <p className="text-xs uppercase tracking-[0.35em] text-salsa-500">Preview</p>
                <h3 className="font-serif text-2xl font-semibold text-gray-900">{selectedTemplate.name}</h3>
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
            <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
              <div
                key={selectedTemplate.id}
                className="max-h-[640px] overflow-auto bg-slate-100 p-4"
                dangerouslySetInnerHTML={{ __html: selectedTemplate.html }}
              />
            </div>
          </>
        ) : null}

        <div className="space-y-4 rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
          <div>
            <h3 className="font-serif text-xl font-semibold text-gray-900">Drag-and-drop blocks</h3>
            <p className="text-sm text-gray-600">
              Mix and match these HTML partials inside your ESP to build new newsletters quickly.
            </p>
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            {blocks.map((block) => (
              <div key={block.id} className="rounded-xl border border-gray-100 bg-gray-50 p-4">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-semibold text-gray-900">{block.label}</p>
                  <Badge variant="outline" className="border-salsa-200 text-xs capitalize text-salsa-600">
                    {block.category}
                  </Badge>
                </div>
                <p className="mt-2 text-xs text-gray-600">{block.description}</p>
                <Button
                  variant="link"
                  size="sm"
                  className="mt-2 px-0 text-salsa-600"
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
