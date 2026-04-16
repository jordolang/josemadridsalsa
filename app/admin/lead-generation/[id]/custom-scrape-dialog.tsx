'use client'

import { useEffect, useRef, useState } from 'react'
import { motion } from 'framer-motion'
import { Search, FileText, X } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import { ScrollArea } from '@/components/ui/scroll-area'
import { cn } from '@/lib/utils'

type LogLevel = 'info' | 'warn' | 'error' | 'success'

interface LogEntry {
  timestamp: string
  level: LogLevel
  stage: string
  message: string
}

type ScrapeStatus = 'running' | 'complete' | 'cancelled' | 'error'

interface CustomScrapeDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  campaignId: string
  leadId: string | null
  schoolName: string
  url: string
  onComplete: () => void
}

// Heuristic progress: each new log entry nudges progress up,
// capped at 95% until we see completion.
function bumpProgress(prev: number, level: LogLevel): number {
  if (level === 'success' && prev < 95) return Math.min(95, prev + 12)
  if (prev < 95) return Math.min(95, prev + 4)
  return prev
}

function levelClass(level: LogLevel): string {
  if (level === 'error') return 'text-red-400'
  if (level === 'warn') return 'text-yellow-400'
  if (level === 'success') return 'text-green-400'
  return 'text-muted-foreground'
}

function formatTime(iso: string): string {
  try {
    return new Date(iso).toLocaleTimeString(undefined, {
      hour12: false,
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    })
  } catch {
    return ''
  }
}

export function CustomScrapeDialog({
  open,
  onOpenChange,
  campaignId,
  leadId,
  schoolName,
  url,
  onComplete,
}: CustomScrapeDialogProps) {
  const [entries, setEntries] = useState<LogEntry[]>([])
  const [progress, setProgress] = useState(0)
  const [status, setStatus] = useState<ScrapeStatus>('running')
  const abortRef = useRef<AbortController | null>(null)
  const logEndRef = useRef<HTMLDivElement | null>(null)
  const completedRef = useRef(false)

  // Start the scrape when dialog opens with a leadId
  useEffect(() => {
    if (!open || !leadId) return

    completedRef.current = false
    setEntries([])
    setProgress(5)
    setStatus('running')

    const controller = new AbortController()
    abortRef.current = controller

    const pushEntry = (entry: LogEntry) => {
      setEntries((prev) => [...prev, entry])
      setProgress((p) => bumpProgress(p, entry.level))
    }

    async function run() {
      try {
        const res = await fetch(
          `/api/admin/lead-generation/${campaignId}/parse`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ leadIds: [leadId] }),
            signal: controller.signal,
          }
        )
        if (!res.ok || !res.body) {
          pushEntry({
            timestamp: new Date().toISOString(),
            level: 'error',
            stage: 'system',
            message: `Server error ${res.status}`,
          })
          setStatus('error')
          return
        }

        const reader = res.body.getReader()
        const decoder = new TextDecoder()
        let buffer = ''

        while (true) {
          const { done, value } = await reader.read()
          if (done) break
          buffer += decoder.decode(value, { stream: true })
          const lines = buffer.split('\n')
          buffer = lines.pop() || ''

          for (const line of lines) {
            if (!line.startsWith('data: ')) continue
            try {
              const parsed = JSON.parse(line.slice(6)) as Partial<LogEntry> & {
                type?: string
              }
              if (parsed.type === 'error_pause' || parsed.type === 'progress') {
                continue
              }
              if (parsed.message && parsed.level) {
                pushEntry({
                  timestamp: parsed.timestamp || new Date().toISOString(),
                  level: parsed.level,
                  stage: parsed.stage || 'system',
                  message: parsed.message,
                })
              }
            } catch {
              // ignore malformed line
            }
          }
        }

        completedRef.current = true
        setProgress(100)
        setStatus('complete')
        onComplete()
      } catch (err: unknown) {
        if ((err as { name?: string } | null)?.name === 'AbortError') {
          setStatus('cancelled')
          pushEntry({
            timestamp: new Date().toISOString(),
            level: 'warn',
            stage: 'system',
            message: 'Scrape cancelled by user.',
          })
          return
        }
        pushEntry({
          timestamp: new Date().toISOString(),
          level: 'error',
          stage: 'system',
          message: err instanceof Error ? err.message : 'Unknown error',
        })
        setStatus('error')
      }
    }

    void run()

    return () => {
      if (!completedRef.current) {
        controller.abort()
      }
    }
  }, [open, leadId, campaignId, onComplete])

  // Auto-scroll log to bottom
  useEffect(() => {
    logEndRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' })
  }, [entries])

  function handleCancel() {
    abortRef.current?.abort()
  }

  function handleClose() {
    if (status === 'running') {
      abortRef.current?.abort()
    }
    onOpenChange(false)
  }

  const canClose = status !== 'running'

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next && status === 'running') {
          // Don't allow closing mid-scrape via overlay click
          return
        }
        onOpenChange(next)
      }}
    >
      <DialogContent className="sm:max-w-[640px]">
        <DialogHeader>
          <DialogTitle>Scraping {schoolName}</DialogTitle>
          <DialogDescription className="truncate">{url}</DialogDescription>
        </DialogHeader>

        <SearchAnimation active={status === 'running'} />

        <div className="space-y-2">
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>
              {status === 'running' && 'Scraping staff directory…'}
              {status === 'complete' && 'Scrape complete'}
              {status === 'cancelled' && 'Scrape cancelled'}
              {status === 'error' && 'Scrape failed'}
            </span>
            <span>{progress}%</span>
          </div>
          <Progress value={progress} />
        </div>

        <div className="rounded-md border bg-zinc-950/40">
          <ScrollArea className="h-[220px] px-3 py-2 font-mono text-xs">
            {entries.length === 0 ? (
              <p className="text-muted-foreground italic">
                Waiting for scraper output…
              </p>
            ) : (
              entries.map((entry, idx) => (
                <div
                  key={idx}
                  className={cn('whitespace-pre-wrap break-words', levelClass(entry.level))}
                >
                  <span className="text-zinc-500">
                    [{formatTime(entry.timestamp)}]
                  </span>{' '}
                  <span className="uppercase text-[10px] tracking-wider">
                    {entry.stage}
                  </span>{' '}
                  {entry.message}
                </div>
              ))
            )}
            <div ref={logEndRef} />
          </ScrollArea>
        </div>

        <DialogFooter className="gap-2 sm:gap-2">
          {status === 'running' ? (
            <Button variant="destructive" size="sm" onClick={handleCancel}>
              <X className="mr-1 h-4 w-4" />
              Cancel Scrape
            </Button>
          ) : (
            <Button
              variant={status === 'complete' ? 'default' : 'outline'}
              size="sm"
              onClick={handleClose}
              disabled={!canClose}
            >
              Close
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function SearchAnimation({ active }: { active: boolean }) {
  return (
    <div className="relative mx-auto flex h-24 w-full max-w-[420px] items-center justify-center overflow-hidden rounded-md border bg-muted/20">
      {/* Sliding file icons — top to bottom */}
      {[0, 1, 2, 3].map((i) => (
        <motion.div
          key={i}
          className="absolute left-0 right-0 flex justify-around text-muted-foreground/50"
          initial={{ y: -32 }}
          animate={active ? { y: 120 } : { y: -32 }}
          transition={{
            duration: 2.4,
            repeat: active ? Infinity : 0,
            delay: i * 0.6,
            ease: 'linear',
          }}
        >
          <FileText className="h-5 w-5" />
          <FileText className="h-5 w-5" />
          <FileText className="h-5 w-5" />
          <FileText className="h-5 w-5" />
        </motion.div>
      ))}

      {/* Orbiting magnifying glass */}
      <motion.div
        className="relative z-10 flex h-14 w-14 items-center justify-center rounded-full bg-primary/10 text-primary"
        animate={active ? { rotate: 360 } : { rotate: 0 }}
        transition={{
          duration: 3,
          repeat: active ? Infinity : 0,
          ease: 'linear',
        }}
      >
        <motion.div
          animate={active ? { x: [0, 6, 0, -6, 0], y: [0, -6, 0, 6, 0] } : { x: 0, y: 0 }}
          transition={{
            duration: 2,
            repeat: active ? Infinity : 0,
            ease: 'easeInOut',
          }}
        >
          <Search className="h-7 w-7" />
        </motion.div>
      </motion.div>
    </div>
  )
}
