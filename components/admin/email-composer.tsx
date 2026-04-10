'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Plus,
  Trash2,
  MoveUp,
  MoveDown,
  Eye,
  Code,
  Save,
  Loader2
} from 'lucide-react'
import type { EmailBlock } from '@/lib/email/blocks'

interface EmailComposerProps {
  templateId: string
  onSave?: (composition: any) => void
}

export function EmailComposer({ templateId, onSave }: EmailComposerProps) {
  const [blocks, setBlocks] = useState<EmailBlock[]>([])
  const [selectedBlocks, setSelectedBlocks] = useState<EmailBlock[]>([])
  const [availableBlocks, setAvailableBlocks] = useState<{
    header: EmailBlock[]
    hero: EmailBlock[]
    content: EmailBlock[]
    products: EmailBlock[]
    cta: EmailBlock[]
    socialFooter: EmailBlock[]
    special: EmailBlock[]
  } | null>(null)
  const [activeCategory, setActiveCategory] = useState<string>('header')
  const [previewMode, setPreviewMode] = useState<'edit' | 'preview'>('edit')
  const [isSaving, setIsSaving] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Load available blocks
  useEffect(() => {
    const loadBlocks = async () => {
      try {
        const response = await fetch('/api/admin/email-blocks')
        if (!response.ok) throw new Error('Failed to fetch blocks')

        const data = await response.json()
        setAvailableBlocks(data.blocks)

        // Load existing composition if it exists
        const compResponse = await fetch(`/api/admin/email-templates/${templateId}/composition`)
        if (compResponse.ok) {
          const compData = await compResponse.json()
          setSelectedBlocks(compData.composition.blocks)
        }
      } catch (err) {
        setError('Failed to load blocks')
        console.error(err)
      } finally {
        setIsLoading(false)
      }
    }

    loadBlocks()
  }, [templateId])

  const addBlock = (block: EmailBlock) => {
    setSelectedBlocks([...selectedBlocks, { ...block, id: `${block.id}-${Date.now()}` }])
  }

  const removeBlock = (index: number) => {
    setSelectedBlocks(selectedBlocks.filter((_, i) => i !== index))
  }

  const moveBlockUp = (index: number) => {
    if (index === 0) return
    const newBlocks = [...selectedBlocks]
    ;[newBlocks[index - 1], newBlocks[index]] = [newBlocks[index], newBlocks[index - 1]]
    setSelectedBlocks(newBlocks)
  }

  const moveBlockDown = (index: number) => {
    if (index === selectedBlocks.length - 1) return
    const newBlocks = [...selectedBlocks]
    ;[newBlocks[index], newBlocks[index + 1]] = [newBlocks[index + 1], newBlocks[index]]
    setSelectedBlocks(newBlocks)
  }

  const saveComposition = async () => {
    setIsSaving(true)
    setError(null)

    try {
      const response = await fetch(`/api/admin/email-templates/${templateId}/composition`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          blocks: selectedBlocks,
          globalStyles: {},
        }),
      })

      if (!response.ok) {
        // Try POST if PUT fails (composition doesn't exist yet)
        const createResponse = await fetch(`/api/admin/email-templates/${templateId}/composition`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            blocks: selectedBlocks,
            globalStyles: {},
          }),
        })

        if (!createResponse.ok) throw new Error('Failed to save composition')
      }

      onSave?.(selectedBlocks)
    } catch (err) {
      setError('Failed to save composition')
      console.error(err)
    } finally {
      setIsSaving(false)
    }
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (!availableBlocks) {
    return (
      <Card className="p-6">
        <p className="text-destructive">Failed to load email blocks</p>
      </Card>
    )
  }

  const categories = Object.keys(availableBlocks) as Array<keyof typeof availableBlocks>

  return (
    <div className="space-y-6">
      {error && (
        <Card className="p-4 bg-destructive/10 border-destructive/30">
          <p className="text-sm text-destructive">{error}</p>
        </Card>
      )}

      <div className="flex items-center justify-between">
        <div className="flex gap-2">
          <Button
            variant={previewMode === 'edit' ? 'default' : 'outline'}
            onClick={() => setPreviewMode('edit')}
            size="sm"
          >
            <Code className="h-4 w-4 mr-2" />
            Edit
          </Button>
          <Button
            variant={previewMode === 'preview' ? 'default' : 'outline'}
            onClick={() => setPreviewMode('preview')}
            size="sm"
          >
            <Eye className="h-4 w-4 mr-2" />
            Preview
          </Button>
        </div>

        <Button onClick={saveComposition} disabled={isSaving} size="sm">
          {isSaving ? (
            <>
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              Saving...
            </>
          ) : (
            <>
              <Save className="h-4 w-4 mr-2" />
              Save Composition
            </>
          )}
        </Button>
      </div>

      <div className="grid grid-cols-4 gap-6">
        {/* Block Library */}
        <div className="col-span-1">
          <Card className="p-4">
            <h3 className="font-semibold mb-4">Block Library</h3>

            <div className="space-y-2 mb-4">
              {categories.map((category) => (
                <button
                  key={category}
                  onClick={() => setActiveCategory(category)}
                  className={`w-full text-left px-3 py-2 rounded-md text-sm transition-colors ${
                    activeCategory === category
                      ? 'bg-blue-50 text-blue-700 font-medium'
                      : 'hover:bg-muted/50'
                  }`}
                >
                  {category.charAt(0).toUpperCase() + category.slice(1)}
                </button>
              ))}
            </div>

            <div className="border-t pt-4 space-y-2">
              {availableBlocks[activeCategory as keyof typeof availableBlocks]?.map((block) => (
                <div key={block.id} className="border rounded-lg p-3">
                  <div className="flex items-start justify-between mb-2">
                    <div>
                      <p className="font-medium text-sm">{block.name}</p>
                      <p className="text-xs text-muted-foreground">{block.description}</p>
                    </div>
                  </div>
                  <Button
                    onClick={() => addBlock(block)}
                    size="sm"
                    variant="outline"
                    className="w-full"
                  >
                    <Plus className="h-3 w-3 mr-1" />
                    Add
                  </Button>
                </div>
              ))}
            </div>
          </Card>
        </div>

        {/* Composition Area */}
        <div className="col-span-3">
          <Card className="p-6">
            <h3 className="font-semibold mb-4">Email Composition</h3>

            {selectedBlocks.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <p>No blocks added yet</p>
                <p className="text-sm mt-2">Select blocks from the library to build your email</p>
              </div>
            ) : (
              <div className="space-y-3">
                {selectedBlocks.map((block, index) => (
                  <div key={`${block.id}-${index}`} className="border rounded-lg p-4">
                    <div className="flex items-center justify-between mb-2">
                      <div>
                        <p className="font-medium">{block.name}</p>
                        <p className="text-xs text-muted-foreground">{block.category}</p>
                      </div>
                      <div className="flex items-center gap-1">
                        <Button
                          onClick={() => moveBlockUp(index)}
                          disabled={index === 0}
                          size="sm"
                          variant="ghost"
                        >
                          <MoveUp className="h-4 w-4" />
                        </Button>
                        <Button
                          onClick={() => moveBlockDown(index)}
                          disabled={index === selectedBlocks.length - 1}
                          size="sm"
                          variant="ghost"
                        >
                          <MoveDown className="h-4 w-4" />
                        </Button>
                        <Button
                          onClick={() => removeBlock(index)}
                          size="sm"
                          variant="ghost"
                          className="text-destructive hover:text-destructive"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>

                    {/* Block preview */}
                    <div className="mt-3 p-3 bg-muted/50 rounded border text-xs font-mono overflow-x-auto">
                      <div dangerouslySetInnerHTML={{ __html: block.html.substring(0, 200) + '...' }} />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Card>
        </div>
      </div>
    </div>
  )
}
