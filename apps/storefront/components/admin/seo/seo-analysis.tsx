'use client'

import { useState } from 'react'
import { ChevronDown, ChevronRight, Gauge, Play } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

interface SeoCheck {
  id: string
  label: string
  status: 'pass' | 'warn' | 'fail'
  message: string
}

interface AnalyzedPage {
  type: string
  id: string
  label: string
  path: string
  score: number
  checks: SeoCheck[]
  recommendations: string[]
}

interface AnalysisResult {
  summary: { pageCount: number; averageScore: number; issueCount: number }
  pages: AnalyzedPage[]
}

const TYPE_LABELS: Record<string, string> = {
  all: 'All pages',
  product: 'Products',
  recipe: 'Recipes',
  'blog-post': 'Blog posts',
}

function scoreBadgeClass(score: number): string {
  if (score >= 80) return 'bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300'
  if (score >= 50) return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/40 dark:text-yellow-300'
  return 'bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300'
}

export function SeoAnalysisPanel() {
  const [result, setResult] = useState<AnalysisResult | null>(null)
  const [running, setRunning] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [typeFilter, setTypeFilter] = useState('all')
  const [expanded, setExpanded] = useState<string | null>(null)

  async function runAnalysis() {
    setRunning(true)
    setError(null)
    try {
      const response = await fetch('/api/admin/seo/analysis')
      const data = await response.json()
      if (!response.ok) {
        setError(data.error || 'Analysis failed')
        return
      }
      setResult(data)
    } catch (err) {
      setError(String(err))
    } finally {
      setRunning(false)
    }
  }

  const pages = result?.pages.filter((p) => typeFilter === 'all' || p.type === typeFilter) ?? []

  return (
    <Card className="p-6">
      <div className="flex items-center justify-between mb-1">
        <h2 className="text-xl font-semibold flex items-center gap-2">
          <Gauge className="h-5 w-5" />
          SEO Analysis
        </h2>
        <Button onClick={runAnalysis} disabled={running}>
          <Play className="mr-1 h-4 w-4" />
          {running ? 'Analyzing…' : result ? 'Re-run Analysis' : 'Run Analysis'}
        </Button>
      </div>
      <p className="text-sm text-muted-foreground mb-6">
        Checks every product, recipe, and published blog post for title/description length, slug
        format, images, keyword usage, and structured data.
      </p>

      {error && <p className="mb-4 text-sm text-destructive">{error}</p>}

      {result && (
        <>
          <div className="mb-6 grid grid-cols-3 gap-4">
            <div className="rounded-lg border border-border p-4 text-center">
              <p className="text-2xl font-bold">{result.summary.averageScore}</p>
              <p className="text-xs text-muted-foreground">Average score</p>
            </div>
            <div className="rounded-lg border border-border p-4 text-center">
              <p className="text-2xl font-bold">{result.summary.pageCount}</p>
              <p className="text-xs text-muted-foreground">Pages analyzed</p>
            </div>
            <div className="rounded-lg border border-border p-4 text-center">
              <p className="text-2xl font-bold">{result.summary.issueCount}</p>
              <p className="text-xs text-muted-foreground">Recommendations</p>
            </div>
          </div>

          <div className="mb-4 w-48">
            <Select value={typeFilter} onValueChange={setTypeFilter}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(TYPE_LABELS).map(([value, label]) => (
                  <SelectItem key={value} value={value}>
                    {label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {pages.length === 0 ? (
            <p className="text-sm text-muted-foreground">No pages found for this filter.</p>
          ) : (
            <div className="divide-y divide-border rounded-lg border border-border">
              {pages.map((page) => {
                const key = `${page.type}-${page.id}`
                const isExpanded = expanded === key
                return (
                  <div key={key}>
                    <button
                      type="button"
                      className="flex w-full items-center gap-3 p-3 text-left"
                      onClick={() => setExpanded(isExpanded ? null : key)}
                    >
                      {isExpanded ? (
                        <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground" />
                      ) : (
                        <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
                      )}
                      <span
                        className={`inline-flex w-12 justify-center rounded-full px-2 py-0.5 text-xs font-semibold ${scoreBadgeClass(page.score)}`}
                      >
                        {page.score}
                      </span>
                      <span className="flex-1 truncate">
                        <span className="font-medium">{page.label}</span>
                        <span className="ml-2 text-xs text-muted-foreground">{page.path}</span>
                      </span>
                      <Badge variant="outline">{TYPE_LABELS[page.type] ?? page.type}</Badge>
                    </button>
                    {isExpanded && (
                      <div className="space-y-2 px-10 pb-4">
                        {page.checks.map((check) => (
                          <div key={check.id} className="flex items-start gap-2 text-sm">
                            <span
                              className={
                                check.status === 'pass'
                                  ? 'text-green-600 dark:text-green-400'
                                  : check.status === 'warn'
                                    ? 'text-yellow-600 dark:text-yellow-400'
                                    : 'text-red-600 dark:text-red-400'
                              }
                            >
                              {check.status === 'pass' ? '✓' : check.status === 'warn' ? '!' : '✗'}
                            </span>
                            <span>
                              <span className="font-medium">{check.label}:</span>{' '}
                              <span className="text-muted-foreground">{check.message}</span>
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </>
      )}
    </Card>
  )
}
