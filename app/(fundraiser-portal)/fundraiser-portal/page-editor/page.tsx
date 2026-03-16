'use client'

import { useEffect, useState, useCallback } from 'react'
import {
  type FundraiserPageConfig,
  type PageBlock,
  type BlockType,
  defaultPageConfig,
  blockTypeLabels,
  blockTypeDescriptions,
} from '@/lib/fundraiser-page-config'
import { Button } from '@/components/ui/button'

type BlockState = PageBlock & { _id: string }

function generateId() {
  return Math.random().toString(36).slice(2, 10)
}

function addIds(blocks: PageBlock[]): BlockState[] {
  return blocks.map((b) => ({ ...b, _id: generateId() }))
}

function stripIds(blocks: BlockState[]): PageBlock[] {
  return blocks.map(({ _id, ...rest }) => rest as PageBlock)
}

const allBlockTypes: BlockType[] = [
  'hero',
  'logo_banner',
  'mission_statement',
  'progress_bar',
  'product_showcase',
  'participant_leaderboard',
  'gallery',
  'custom_text',
  'contact_info',
  'how_it_works',
]

function createDefaultBlock(type: BlockType): PageBlock {
  switch (type) {
    case 'hero':
      return { type: 'hero', ctaLabel: 'Shop & Support' }
    case 'logo_banner':
      return { type: 'logo_banner' }
    case 'mission_statement':
      return { type: 'mission_statement', showGoalProgress: true }
    case 'progress_bar':
      return { type: 'progress_bar', showAmount: true, showPercentage: true }
    case 'product_showcase':
      return { type: 'product_showcase', pricePoints: [25, 50], columns: 3 }
    case 'participant_leaderboard':
      return { type: 'participant_leaderboard', topN: 5 }
    case 'gallery':
      return { type: 'gallery', imageUrls: [], columns: 3 }
    case 'custom_text':
      return { type: 'custom_text', content: '', alignment: 'center' }
    case 'contact_info':
      return { type: 'contact_info', showEmail: true, showPhone: true }
    case 'how_it_works':
      return { type: 'how_it_works' }
  }
}

export default function PageEditorPage() {
  const [blocks, setBlocks] = useState<BlockState[]>([])
  const [theme, setTheme] = useState<FundraiserPageConfig['theme']>('default')
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [saveMessage, setSaveMessage] = useState<string | null>(null)
  const [showAddBlock, setShowAddBlock] = useState(false)

  // Load current config
  useEffect(() => {
    async function loadConfig() {
      try {
        const res = await fetch('/api/fundraiser-portal/page-config')
        if (res.ok) {
          const data = await res.json()
          const config = data.pageConfig as FundraiserPageConfig | null
          if (config) {
            setBlocks(addIds(config.blocks))
            setTheme(config.theme)
          } else {
            setBlocks(addIds(defaultPageConfig.blocks))
            setTheme(defaultPageConfig.theme)
          }
        }
      } catch {
        setBlocks(addIds(defaultPageConfig.blocks))
      } finally {
        setIsLoading(false)
      }
    }
    loadConfig()
  }, [])

  const handleSave = useCallback(async () => {
    setIsSaving(true)
    setSaveMessage(null)
    try {
      const config: FundraiserPageConfig = {
        version: 1,
        theme,
        blocks: stripIds(blocks),
      }
      const res = await fetch('/api/fundraiser-portal/page-config', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pageConfig: config }),
      })
      if (res.ok) {
        setSaveMessage('Saved successfully!')
      } else {
        const err = await res.json()
        setSaveMessage(`Error: ${err.error || 'Failed to save'}`)
      }
    } catch {
      setSaveMessage('Error saving. Please try again.')
    } finally {
      setIsSaving(false)
      setTimeout(() => setSaveMessage(null), 3000)
    }
  }, [blocks, theme])

  const moveBlock = (index: number, direction: 'up' | 'down') => {
    const target = direction === 'up' ? index - 1 : index + 1
    if (target < 0 || target >= blocks.length) return
    setBlocks((prev) => {
      const next = [...prev]
      ;[next[index], next[target]] = [next[target], next[index]]
      return next
    })
  }

  const removeBlock = (index: number) => {
    setBlocks((prev) => prev.filter((_, i) => i !== index))
  }

  const addBlock = (type: BlockType) => {
    const newBlock = createDefaultBlock(type)
    setBlocks((prev) => [...prev, { ...newBlock, _id: generateId() }])
    setShowAddBlock(false)
  }

  if (isLoading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <p className="text-gray-500">Loading page editor...</p>
      </div>
    )
  }

  return (
    <div className="p-6 lg:p-8">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="font-serif text-2xl font-bold text-gray-900">
          Page Editor
        </h1>
        <div className="flex items-center gap-3">
          {saveMessage && (
            <span className={`text-sm ${saveMessage.startsWith('Error') ? 'text-red-600' : 'text-verde-600'}`}>
              {saveMessage}
            </span>
          )}
          <Button
            onClick={handleSave}
            disabled={isSaving}
            className="bg-salsa-500 hover:bg-salsa-600"
          >
            {isSaving ? 'Saving...' : 'Save Changes'}
          </Button>
        </div>
      </div>

      {/* Theme selector */}
      <div className="mb-6 rounded-lg border border-gray-200 bg-white p-4">
        <label className="mb-2 block text-sm font-medium text-gray-700">
          Page Theme
        </label>
        <div className="flex gap-3">
          {(['default', 'minimal', 'bold'] as const).map((t) => (
            <button
              key={t}
              onClick={() => setTheme(t)}
              className={`rounded-md border px-4 py-2 text-sm font-medium capitalize transition ${
                theme === t
                  ? 'border-salsa-500 bg-salsa-50 text-salsa-700'
                  : 'border-gray-200 text-gray-600 hover:border-gray-300'
              }`}
            >
              {t}
            </button>
          ))}
        </div>
      </div>

      {/* Block list */}
      <div className="space-y-3">
        {blocks.map((block, index) => (
          <div
            key={block._id}
            className="flex items-center gap-3 rounded-lg border border-gray-200 bg-white p-4"
          >
            {/* Move buttons */}
            <div className="flex flex-col gap-1">
              <button
                onClick={() => moveBlock(index, 'up')}
                disabled={index === 0}
                className="rounded p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600 disabled:opacity-30"
                title="Move up"
              >
                <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
                </svg>
              </button>
              <button
                onClick={() => moveBlock(index, 'down')}
                disabled={index === blocks.length - 1}
                className="rounded p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600 disabled:opacity-30"
                title="Move down"
              >
                <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </button>
            </div>

            {/* Block info */}
            <div className="flex-1">
              <p className="font-medium text-gray-900">
                {blockTypeLabels[block.type]}
              </p>
              <p className="text-sm text-gray-500">
                {blockTypeDescriptions[block.type]}
              </p>
            </div>

            {/* Remove */}
            <button
              onClick={() => removeBlock(index)}
              className="rounded p-2 text-gray-400 hover:bg-red-50 hover:text-red-600"
              title="Remove block"
            >
              <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
            </button>
          </div>
        ))}
      </div>

      {/* Add block */}
      <div className="mt-4">
        {showAddBlock ? (
          <div className="rounded-lg border border-dashed border-gray-300 bg-gray-50 p-4">
            <p className="mb-3 text-sm font-medium text-gray-700">Add a block:</p>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5">
              {allBlockTypes.map((type) => (
                <button
                  key={type}
                  onClick={() => addBlock(type)}
                  className="rounded-md border border-gray-200 bg-white px-3 py-2 text-left text-sm font-medium text-gray-700 transition hover:border-salsa-300 hover:bg-salsa-50"
                >
                  {blockTypeLabels[type]}
                </button>
              ))}
            </div>
            <button
              onClick={() => setShowAddBlock(false)}
              className="mt-3 text-sm text-gray-500 hover:text-gray-700"
            >
              Cancel
            </button>
          </div>
        ) : (
          <button
            onClick={() => setShowAddBlock(true)}
            className="w-full rounded-lg border-2 border-dashed border-gray-300 py-4 text-sm font-medium text-gray-500 transition hover:border-salsa-300 hover:text-salsa-600"
          >
            + Add Block
          </button>
        )}
      </div>

      {/* Reset to default */}
      <div className="mt-8 border-t border-gray-200 pt-6">
        <button
          onClick={() => {
            setBlocks(addIds(defaultPageConfig.blocks))
            setTheme(defaultPageConfig.theme)
          }}
          className="text-sm text-gray-500 hover:text-red-600"
        >
          Reset to default layout
        </button>
      </div>
    </div>
  )
}
