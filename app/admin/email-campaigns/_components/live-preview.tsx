'use client'

import { useEffect, useMemo, useState } from 'react'
import { ChevronLeft, ChevronRight, Eye, RefreshCw, Shuffle } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  resolveVariablesForRecipient,
  type DiscountCodeMap,
  type SubscriberLike,
  type VariableMappings,
} from '@/lib/email/variable-mapping'
import {
  getPreviewSampleData,
  type PreviewActiveDiscount,
  type PreviewSubscriber,
} from '../actions'

interface LivePreviewProps {
  templateHtml: string
  templateText: string | null
  subject: string
  mappings: VariableMappings
  /** Currently selected mailing list (null = sample from all subscribers). */
  listId: string | null
}

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function substitute(template: string, vars: Record<string, string>): string {
  let out = template
  for (const [key, value] of Object.entries(vars)) {
    const re = new RegExp(`{{\\s*${escapeRegex(key)}\\s*}}`, 'g')
    out = out.replace(re, () => value ?? '')
  }
  return out
}

/**
 * Convert a PreviewSubscriber to the shape the resolver expects.
 * (PreviewSubscriber matches SubscriberLike except it always includes an id.)
 */
function asSubscriberLike(s: PreviewSubscriber): SubscriberLike {
  return {
    email: s.email,
    firstName: s.firstName,
    lastName: s.lastName,
    phone: s.phone,
    customFields: s.customFields,
  }
}

const PLACEHOLDER_SUBSCRIBER: PreviewSubscriber = {
  id: 'placeholder',
  email: 'jane@example.com',
  firstName: 'Jane',
  lastName: 'Doe',
  phone: '555-0100',
  customFields: null,
}

export function LivePreview({
  templateHtml,
  templateText,
  subject,
  mappings,
  listId,
}: LivePreviewProps) {
  const [subscribers, setSubscribers] = useState<PreviewSubscriber[]>([])
  const [discountCodes, setDiscountCodes] = useState<PreviewActiveDiscount[]>([])
  const [loading, setLoading] = useState(false)
  const [index, setIndex] = useState(0)
  const [view, setView] = useState<'rendered' | 'text' | 'raw'>('rendered')

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    getPreviewSampleData(listId)
      .then((data) => {
        if (cancelled) return
        setSubscribers(data.subscribers)
        setDiscountCodes(data.discountCodes)
        setIndex(0)
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [listId])

  const discountCodeMap: DiscountCodeMap = useMemo(
    () => Object.fromEntries(discountCodes.map((d) => [d.id, d.code])),
    [discountCodes],
  )

  const activeSubscriber: PreviewSubscriber =
    subscribers[index] ?? PLACEHOLDER_SUBSCRIBER

  const resolved = useMemo(
    () =>
      resolveVariablesForRecipient(
        mappings,
        asSubscriberLike(activeSubscriber),
        { discountCodes: discountCodeMap },
      ),
    [mappings, activeSubscriber, discountCodeMap],
  )

  const renderedSubject = useMemo(
    () => substitute(subject, resolved),
    [subject, resolved],
  )
  const renderedHtml = useMemo(
    () => substitute(templateHtml, resolved),
    [templateHtml, resolved],
  )
  const renderedText = useMemo(
    () => (templateText ? substitute(templateText, resolved) : ''),
    [templateText, resolved],
  )

  const total = subscribers.length
  const hasSubscribers = total > 0

  const goPrev = () => setIndex((i) => (i - 1 + total) % Math.max(total, 1))
  const goNext = () => setIndex((i) => (i + 1) % Math.max(total, 1))
  const goRandom = () => {
    if (total <= 1) return
    let next = index
    while (next === index) next = Math.floor(Math.random() * total)
    setIndex(next)
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <CardTitle className="flex items-center gap-2 text-base">
            <Eye className="h-5 w-5" />
            Live Preview
          </CardTitle>
          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={goPrev}
              disabled={!hasSubscribers || total <= 1}
              aria-label="Previous subscriber"
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <span className="text-xs text-muted-foreground tabular-nums min-w-[3.5rem] text-center">
              {hasSubscribers ? `${index + 1} / ${total}` : '0 / 0'}
            </span>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={goNext}
              disabled={!hasSubscribers || total <= 1}
              aria-label="Next subscriber"
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={goRandom}
              disabled={total <= 1}
              aria-label="Random subscriber"
            >
              <Shuffle className="h-4 w-4" />
            </Button>
          </div>
        </div>
        <p className="text-sm text-muted-foreground">
          Rendered with real subscriber data — cycle through samples to verify
          every token resolves correctly.
        </p>
      </CardHeader>

      <CardContent className="space-y-4">
        <div className="rounded-lg border bg-muted/30 p-3 space-y-2">
          <div className="flex flex-wrap items-center gap-2 text-sm">
            <Badge variant="outline" className="font-mono">
              {activeSubscriber.email}
            </Badge>
            {(activeSubscriber.firstName || activeSubscriber.lastName) && (
              <span className="text-muted-foreground">
                {[activeSubscriber.firstName, activeSubscriber.lastName]
                  .filter(Boolean)
                  .join(' ')}
              </span>
            )}
            {!hasSubscribers && !loading && (
              <span className="text-xs text-amber-600">
                No subscribers found — showing placeholder data
              </span>
            )}
            {loading && (
              <span className="text-xs text-muted-foreground inline-flex items-center gap-1">
                <RefreshCw className="h-3 w-3 animate-spin" /> Loading samples…
              </span>
            )}
          </div>
          {Object.keys(resolved).length > 0 && (
            <details className="text-xs text-muted-foreground">
              <summary className="cursor-pointer">Resolved tokens</summary>
              <ul className="mt-1 grid gap-1 sm:grid-cols-2">
                {Object.entries(resolved).map(([k, v]) => (
                  <li key={k} className="font-mono">
                    <span className="text-foreground">{`{{${k}}}`}</span>{' '}
                    →{' '}
                    <span className="text-primary">
                      {v || <em className="text-amber-600">(empty)</em>}
                    </span>
                  </li>
                ))}
              </ul>
            </details>
          )}
        </div>

        <div className="space-y-1">
          <div className="text-xs font-semibold uppercase text-muted-foreground">
            Subject
          </div>
          <div className="rounded border bg-background px-3 py-2 text-sm">
            {renderedSubject || (
              <em className="text-muted-foreground">No subject</em>
            )}
          </div>
        </div>

        <Tabs value={view} onValueChange={(v) => setView(v as typeof view)}>
          <TabsList>
            <TabsTrigger value="rendered">Rendered</TabsTrigger>
            <TabsTrigger value="text" disabled={!templateText}>
              Plain text
            </TabsTrigger>
            <TabsTrigger value="raw">Raw HTML</TabsTrigger>
          </TabsList>
        </Tabs>

        {view === 'rendered' && (
          <div className="rounded-lg border bg-white">
            <iframe
              key={`${activeSubscriber.id}-${renderedHtml.length}`}
              title="Email preview"
              srcDoc={renderedHtml}
              sandbox="allow-same-origin"
              className="h-[600px] w-full rounded-lg"
            />
          </div>
        )}

        {view === 'text' && (
          <pre className="max-h-[600px] overflow-auto rounded-lg border bg-muted/30 p-3 text-xs whitespace-pre-wrap">
            {renderedText}
          </pre>
        )}

        {view === 'raw' && (
          <pre className="max-h-[600px] overflow-auto rounded-lg border bg-muted/30 p-3 text-xs">
            {renderedHtml}
          </pre>
        )}
      </CardContent>
    </Card>
  )
}
