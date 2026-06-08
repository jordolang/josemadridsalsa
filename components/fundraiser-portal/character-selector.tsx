'use client'

import { FormEvent, useCallback, useEffect, useState } from 'react'
import {
  Check,
  ChevronLeft,
  ChevronRight,
  Loader2,
  Search,
  Sparkles,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'

const PAGE_SIZE = 100

type GameIcon = {
  name: string
  path: string
  tags: string[]
}

type CatalogResponse = {
  icons: GameIcon[]
  page: number
  pageSize: number
  total: number
  totalPages: number
}

export function CharacterSelector() {
  const [catalog, setCatalog] = useState<CatalogResponse | null>(null)
  const [page, setPage] = useState(1)
  const [queryInput, setQueryInput] = useState('')
  const [query, setQuery] = useState('')
  const [similarTo, setSimilarTo] = useState('')
  const [selectedPath, setSelectedPath] = useState('')
  const [savedPath, setSavedPath] = useState('')
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')

  useEffect(() => {
    async function loadSelection() {
      try {
        const response = await fetch('/api/fundraiser-portal/assets')
        if (!response.ok) return
        const assets = (await response.json()) as { logoUrl?: string | null }
        if (assets.logoUrl?.startsWith('/game-icons/')) {
          setSelectedPath(assets.logoUrl)
          setSavedPath(assets.logoUrl)
        }
      } catch {
        // The catalog remains usable if the current selection cannot be loaded.
      }
    }

    void loadSelection()
  }, [])

  const loadCatalog = useCallback(async () => {
    setIsLoading(true)
    setError('')

    const params = new URLSearchParams({ page: String(page), pageSize: String(PAGE_SIZE) })
    if (query) params.set('query', query)
    if (similarTo) params.set('similarTo', similarTo)

    try {
      const response = await fetch(`/api/fundraiser-portal/game-icons?${params.toString()}`)
      const data = (await response.json()) as CatalogResponse & { error?: string }
      if (!response.ok) throw new Error(data.error || 'Unable to load team characters')
      setCatalog(data)
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Unable to load team characters')
    } finally {
      setIsLoading(false)
    }
  }, [page, query, similarTo])

  useEffect(() => {
    void loadCatalog()
  }, [loadCatalog])

  function handleSearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setPage(1)
    setSimilarTo('')
    setQuery(queryInput.trim())
  }

  function clearFilters() {
    setPage(1)
    setQueryInput('')
    setQuery('')
    setSimilarTo('')
  }

  function findSimilar() {
    if (!selectedPath) return
    setPage(1)
    setQueryInput('')
    setQuery('')
    setSimilarTo(selectedPath)
  }

  async function saveSelection() {
    if (!selectedPath) return
    setIsSaving(true)
    setError('')
    setMessage('')

    try {
      const response = await fetch('/api/fundraiser-portal/assets', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ logoUrl: selectedPath }),
      })
      const data = (await response.json()) as { error?: string }
      if (!response.ok) throw new Error(data.error || 'Unable to save team character')
      setSavedPath(selectedPath)
      setMessage('Team character saved.')
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Unable to save team character')
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <div className="space-y-5 p-4 sm:p-6 lg:p-8">
      <div className="flex flex-col gap-4 border-b border-gray-200 pb-5 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="font-serif text-2xl font-bold text-gray-950">Team Character</h1>
          <p className="mt-1 text-sm text-gray-600">
            Choose the sprite that represents your fundraising team.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button type="button" variant="outline" onClick={findSimilar} disabled={!selectedPath}>
            <Sparkles className="h-4 w-4" />
            Find similar
          </Button>
          <Button
            type="button"
            onClick={saveSelection}
            disabled={!selectedPath || selectedPath === savedPath || isSaving}
          >
            {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
            Save character
          </Button>
        </div>
      </div>

      <form className="flex gap-2" onSubmit={handleSearch}>
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
          <Input
            value={queryInput}
            onChange={(event) => setQueryInput(event.target.value)}
            placeholder="Search character names, styles, or folders"
            className="pl-9"
          />
        </div>
        <Button type="submit">Search</Button>
        {(query || similarTo) && (
          <Button type="button" variant="outline" onClick={clearFilters}>
            Clear
          </Button>
        )}
      </form>

      <div className="flex flex-wrap items-center justify-between gap-2 text-sm text-gray-600">
        <span>
          {catalog ? `${catalog.total.toLocaleString()} characters` : 'Loading characters'}
          {similarTo ? ' similar to your selection' : query ? ` matching “${query}”` : ''}
        </span>
        {catalog && <span>Page {catalog.page} of {catalog.totalPages}</span>}
      </div>

      {error && <p className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</p>}
      {message && <p className="rounded-md border border-green-200 bg-green-50 p-3 text-sm text-green-700">{message}</p>}

      {isLoading ? (
        <div className="flex min-h-64 items-center justify-center">
          <Loader2 className="h-7 w-7 animate-spin text-salsa-600" />
        </div>
      ) : catalog?.icons.length ? (
        <div className="grid grid-cols-5 gap-2 sm:grid-cols-8 md:grid-cols-10 lg:grid-cols-12 xl:grid-cols-[repeat(14,minmax(0,1fr))]">
          {catalog.icons.map((icon) => {
            const isSelected = selectedPath === icon.path
            return (
              <button
                key={icon.path}
                type="button"
                title={icon.name}
                aria-label={`Choose ${icon.name}`}
                aria-pressed={isSelected}
                onClick={() => {
                  setSelectedPath(icon.path)
                  setMessage('')
                }}
                className={cn(
                  'relative aspect-square overflow-hidden rounded-md border bg-gray-950 p-1.5 transition hover:border-salsa-500 hover:shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-salsa-600',
                  isSelected ? 'border-salsa-600 ring-2 ring-salsa-600' : 'border-gray-200'
                )}
              >
                <img
                  src={icon.path}
                  alt=""
                  width={80}
                  height={80}
                  loading="lazy"
                  decoding="async"
                  draggable={false}
                  className="block h-full w-full object-contain opacity-100"
                />
                {isSelected && (
                  <span className="absolute right-1 top-1 rounded-full bg-salsa-600 p-0.5 text-white">
                    <Check className="h-3 w-3" />
                  </span>
                )}
              </button>
            )
          })}
        </div>
      ) : (
        <div className="flex min-h-64 items-center justify-center border-y border-gray-200 text-sm text-gray-500">
          No characters match this search.
        </div>
      )}

      {catalog && catalog.totalPages > 1 && (
        <div className="flex items-center justify-center gap-3 border-t border-gray-200 pt-5">
          <Button
            type="button"
            variant="outline"
            size="icon"
            aria-label="Previous character page"
            disabled={catalog.page <= 1 || isLoading}
            onClick={() => setPage((current) => Math.max(1, current - 1))}
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <span className="min-w-28 text-center text-sm font-medium text-gray-700">
            {catalog.page} / {catalog.totalPages}
          </span>
          <Button
            type="button"
            variant="outline"
            size="icon"
            aria-label="Next character page"
            disabled={catalog.page >= catalog.totalPages || isLoading}
            onClick={() => setPage((current) => current + 1)}
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      )}
    </div>
  )
}
