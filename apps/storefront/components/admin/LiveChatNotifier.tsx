'use client'

import { useEffect, useRef, useState } from 'react'
import { Bell, Headphones, Loader2, Send, X } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Textarea } from '@/components/ui/textarea'

const QUEUE_POLL_MS = 5000
const THREAD_POLL_MS = 2500
const TAB_POSITION_KEY = 'admin:live-chat-tab-position'
const MOBILE_MEDIA_QUERY = '(max-width: 767px)'
const DRAG_THRESHOLD_PX = 6
const EDGE_MARGIN_PX = 8

type TabPosition = {
  side: 'left' | 'right'
  topPct: number
}

const DEFAULT_TAB_POSITION: TabPosition = { side: 'right', topPct: 50 }

type QueueThread = {
  id: string
  customerName: string | null
  customerEmail: string | null
  source: string | null
  startedAt: string
  lastMessageAt: string
  assignedAdminId?: string | null
}

type QueueResponse = {
  waiting: QueueThread[]
  active: QueueThread[]
}

type ChatMessage = {
  id: string
  senderType: 'CUSTOMER' | 'AI' | 'ADMIN' | 'SYSTEM'
  senderLabel: string | null
  content: string
  createdAt: string
}

const CHIME =
  'data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEARKwAAIhYAQACABAAZGF0YQAAAAA='

export function LiveChatNotifier() {
  const [queue, setQueue] = useState<QueueResponse>({ waiting: [], active: [] })
  const [openPanel, setOpenPanel] = useState(false)
  const [activeThreadId, setActiveThreadId] = useState<string | null>(null)
  const seenWaitingIds = useRef<Set<string>>(new Set())
  const initialLoad = useRef(true)
  const tabRef = useRef<HTMLButtonElement | null>(null)
  const { position, dragging, dragHandlers, wasDragged } = useEdgeTabDrag(tabRef)

  useEffect(() => {
    let cancelled = false
    let intervalId: number | null = null

    async function tick() {
      try {
        const response = await fetch('/api/chat-handoff/admin/queue', { cache: 'no-store' })
        if (!response.ok) return
        const data = (await response.json()) as QueueResponse
        if (cancelled) return
        if (!initialLoad.current) {
          for (const thread of data.waiting) {
            if (!seenWaitingIds.current.has(thread.id)) {
              notifyNewHandoff(thread)
            }
          }
        }
        seenWaitingIds.current = new Set(data.waiting.map((t) => t.id))
        initialLoad.current = false
        setQueue(data)
      } catch {
        // ignore network blip
      }
    }
    tick()
    intervalId = window.setInterval(tick, QUEUE_POLL_MS)
    return () => {
      cancelled = true
      if (intervalId) window.clearInterval(intervalId)
    }
  }, [])

  function notifyNewHandoff(thread: QueueThread) {
    const label = thread.customerName?.trim() || 'A visitor'
    toast(`${label} is waiting to chat`, {
      description: thread.customerEmail ?? 'Open the live queue to respond.',
      duration: 10000,
      action: {
        label: 'Open',
        onClick: () => {
          setOpenPanel(true)
          setActiveThreadId(thread.id)
        },
      },
    })
    try {
      const audio = new Audio(CHIME)
      audio.volume = 0.4
      void audio.play().catch(() => {})
    } catch {
      // sound is best-effort
    }
    try {
      if (typeof Notification !== 'undefined' && Notification.permission === 'granted') {
        new Notification('Live chat request', {
          body: `${label} is waiting to chat with your team.`,
          tag: `handoff-${thread.id}`,
        })
      }
    } catch {
      // browser push best-effort
    }
  }

  async function requestBrowserPermission() {
    if (typeof Notification === 'undefined') return
    if (Notification.permission === 'default') {
      try {
        await Notification.requestPermission()
      } catch {
        // user rejected
      }
    }
  }

  const waitingCount = queue.waiting.length
  const activeCount = queue.active.length

  return (
    <>
      <button
        ref={tabRef}
        type="button"
        onClick={() => {
          if (wasDragged()) return
          setOpenPanel(true)
          void requestBrowserPermission()
        }}
        {...dragHandlers}
        style={{ '--live-chat-top': `${position.topPct}%` } as React.CSSProperties}
        data-side={position.side}
        data-dragging={dragging ? 'true' : undefined}
        className="fixed bottom-6 right-6 z-40 flex h-12 items-center gap-2 rounded-full bg-salsa-600 px-4 text-white shadow-lg transition hover:bg-salsa-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-salsa-300"
        aria-label="Open live chat queue"
        title="Live chats — drag to move along the edge"
      >
        <Headphones className="h-5 w-5" />
        <span className="text-sm font-medium">Live chats</span>
        {waitingCount > 0 ? (
          <span className="inline-flex items-center justify-center rounded-full bg-amber-400 px-2 py-0.5 text-xs font-semibold text-amber-900">
            {waitingCount}
          </span>
        ) : null}
      </button>

      <Dialog open={openPanel} onOpenChange={setOpenPanel}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Headphones className="h-5 w-5" /> Live chat queue
            </DialogTitle>
          </DialogHeader>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-[260px_1fr]">
            <div className="space-y-3 sm:max-h-[480px] sm:overflow-y-auto">
              <QueueSection
                label={`Waiting (${waitingCount})`}
                threads={queue.waiting}
                activeId={activeThreadId}
                onSelect={setActiveThreadId}
                emptyLabel="No one waiting."
              />
              <QueueSection
                label={`Active (${activeCount})`}
                threads={queue.active}
                activeId={activeThreadId}
                onSelect={setActiveThreadId}
                emptyLabel="No active chats."
              />
              <div className="rounded-md bg-muted p-3 text-xs text-muted-foreground">
                <p className="mb-2 font-medium">Tip</p>
                <p>Logged-in admins all share access to past chats from the Messages page.</p>
                <button
                  type="button"
                  onClick={() => void requestBrowserPermission()}
                  className="mt-2 inline-flex items-center gap-1 text-salsa-600 hover:text-salsa-700"
                >
                  <Bell className="h-3 w-3" /> Enable browser notifications
                </button>
              </div>
            </div>
            <div className="rounded-lg border border-border bg-card">
              {activeThreadId ? (
                <LiveChatPane threadId={activeThreadId} onClosed={() => setActiveThreadId(null)} />
              ) : (
                <div className="flex h-[400px] items-center justify-center text-sm text-muted-foreground">
                  Select a thread to start chatting.
                </div>
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}

function QueueSection({
  label,
  threads,
  activeId,
  onSelect,
  emptyLabel,
}: {
  label: string
  threads: QueueThread[]
  activeId: string | null
  onSelect: (id: string) => void
  emptyLabel: string
}) {
  return (
    <div>
      <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">{label}</p>
      {threads.length === 0 ? (
        <p className="rounded border border-dashed border-border p-2 text-xs text-muted-foreground">{emptyLabel}</p>
      ) : (
        <ul className="space-y-1">
          {threads.map((thread) => {
            const isActive = thread.id === activeId
            return (
              <li key={thread.id}>
                <button
                  type="button"
                  onClick={() => onSelect(thread.id)}
                  className={`w-full rounded px-2 py-2 text-left text-sm transition ${
                    isActive ? 'bg-salsa-50 text-salsa-900 ring-1 ring-salsa-200' : 'hover:bg-muted'
                  }`}
                >
                  <div className="font-medium">{thread.customerName ?? 'Visitor'}</div>
                  <div className="text-xs text-muted-foreground">
                    {thread.customerEmail ?? 'No email'} • {timeAgo(thread.startedAt)}
                  </div>
                </button>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}

function LiveChatPane({ threadId, onClosed }: { threadId: string; onClosed: () => void }) {
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [loading, setLoading] = useState(true)
  const [input, setInput] = useState('')
  const [sending, setSending] = useState(false)
  const [status, setStatus] = useState<string>('')
  const sinceRef = useRef<string | null>(null)
  const endRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    setMessages([])
    setStatus('')
    sinceRef.current = null
    setLoading(true)
    let cancelled = false

    async function pull() {
      try {
        const url = new URL(`/api/chat-handoff/${threadId}/messages`, window.location.origin)
        if (sinceRef.current) url.searchParams.set('since', sinceRef.current)
        const response = await fetch(url.toString(), { cache: 'no-store' })
        if (!response.ok) return
        const data = await response.json()
        if (cancelled) return
        if (Array.isArray(data?.messages) && data.messages.length > 0) {
          setMessages((prev) => {
            const seen = new Set(prev.map((m) => m.id))
            const next = [...prev]
            for (const m of data.messages) if (!seen.has(m.id)) next.push(m)
            return next
          })
          const latest = data.messages[data.messages.length - 1]?.createdAt
          if (latest) sinceRef.current = latest
        }
        setStatus(data?.thread?.status ?? '')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    pull()
    const id = window.setInterval(pull, THREAD_POLL_MS)
    return () => {
      cancelled = true
      window.clearInterval(id)
    }
  }, [threadId])

  useEffect(() => {
    if (endRef.current) endRef.current.scrollIntoView({ behavior: 'smooth' })
  }, [messages.length])

  async function handleSend(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const content = input.trim()
    if (!content) return
    setSending(true)
    try {
      const response = await fetch(`/api/chat-handoff/${threadId}/messages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content }),
      })
      if (!response.ok) {
        toast.error('Message failed to send.')
      } else {
        setInput('')
      }
    } finally {
      setSending(false)
    }
  }

  async function handleClose() {
    if (!confirm('Close this chat? The visitor will be returned to the AI assistant.')) return
    const response = await fetch(`/api/chat-handoff/${threadId}/close`, { method: 'POST' })
    if (response.ok) {
      toast.success('Chat closed.')
      onClosed()
    } else {
      toast.error('Failed to close chat.')
    }
  }

  return (
    <div className="flex h-[480px] flex-col">
      <div className="flex items-center justify-between border-b border-border px-3 py-2">
        <span className="text-xs text-muted-foreground">{status ? `Status: ${status}` : ''}</span>
        <button
          type="button"
          onClick={handleClose}
          className="inline-flex items-center gap-1 rounded px-2 py-1 text-xs text-muted-foreground hover:text-foreground"
        >
          <X className="h-3 w-3" /> Close chat
        </button>
      </div>
      <div className="flex-1 space-y-2 overflow-y-auto px-3 py-3 text-sm">
        {loading && messages.length === 0 ? (
          <p className="text-xs text-muted-foreground">Loading…</p>
        ) : null}
        {messages.map((message) => (
          <AdminMessageBubble key={message.id} message={message} />
        ))}
        <div ref={endRef} />
      </div>
      <form onSubmit={handleSend} className="border-t border-border px-3 py-2">
        <div className="flex gap-2">
          <Textarea
            rows={2}
            value={input}
            onChange={(event) => setInput(event.target.value)}
            maxLength={2000}
            disabled={sending || status === 'CLOSED'}
            placeholder={status === 'CLOSED' ? 'This chat is closed.' : 'Reply…'}
            className="resize-none"
          />
          <Button type="submit" size="icon" className="self-end" disabled={sending || !input.trim() || status === 'CLOSED'}>
            {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
          </Button>
        </div>
      </form>
    </div>
  )
}

function AdminMessageBubble({ message }: { message: ChatMessage }) {
  if (message.senderType === 'SYSTEM') {
    return (
      <div className="flex justify-center">
        <p className="rounded-full bg-muted px-3 py-1 text-[11px] uppercase tracking-wide text-muted-foreground">
          {message.content}
        </p>
      </div>
    )
  }
  const isAdmin = message.senderType === 'ADMIN'
  return (
    <div className={`flex ${isAdmin ? 'justify-end' : 'justify-start'}`}>
      <div
        className={`max-w-[85%] rounded-2xl px-3 py-2 ${
          isAdmin ? 'bg-salsa-600 text-white' : 'bg-muted text-foreground'
        }`}
      >
        <p className="text-[10px] uppercase tracking-wide opacity-70">
          {message.senderType === 'CUSTOMER'
            ? message.senderLabel ?? 'Visitor'
            : message.senderType === 'AI'
              ? 'AI assistant'
              : message.senderLabel ?? 'Team'}
          {' • '}
          {new Date(message.createdAt).toLocaleTimeString()}
        </p>
        <p className="whitespace-pre-wrap text-sm">{message.content}</p>
      </div>
    </div>
  )
}

function timeAgo(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime()
  const seconds = Math.round(diffMs / 1000)
  if (seconds < 60) return `${seconds}s ago`
  const minutes = Math.round(seconds / 60)
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.round(minutes / 60)
  if (hours < 24) return `${hours}h ago`
  return `${Math.round(hours / 24)}d ago`
}

function clampTopPct(value: number, tabHeight = 0): number {
  const viewportHeight = typeof window === 'undefined' ? 0 : window.innerHeight
  if (viewportHeight <= 0) return Math.min(Math.max(value, 0), 100)
  const halfTab = ((tabHeight / 2 + EDGE_MARGIN_PX) / viewportHeight) * 100
  return Math.min(Math.max(value, halfTab), 100 - halfTab)
}

function readStoredPosition(): TabPosition | null {
  try {
    const stored = window.localStorage.getItem(TAB_POSITION_KEY)
    if (!stored) return null
    const parsed = JSON.parse(stored) as Partial<TabPosition>
    if (parsed.side !== 'left' && parsed.side !== 'right') return null
    if (typeof parsed.topPct !== 'number' || Number.isNaN(parsed.topPct)) return null
    return { side: parsed.side, topPct: clampTopPct(parsed.topPct) }
  } catch {
    return null
  }
}

/**
 * Lets the mobile live-chat tab be dragged to any point along the left or right
 * edge so it never sits on top of the controls underneath it.
 */
function useEdgeTabDrag(tabRef: React.RefObject<HTMLButtonElement | null>) {
  const [position, setPositionState] = useState<TabPosition>(DEFAULT_TAB_POSITION)
  const [dragging, setDragging] = useState(false)
  const drag = useRef<{ pointerId: number; startX: number; startY: number; moved: boolean } | null>(null)
  const draggedRef = useRef(false)
  // Mirrors `position` so the pointerup handler always saves the latest value,
  // even when React has not re-rendered between the last move and the release.
  const positionRef = useRef<TabPosition>(DEFAULT_TAB_POSITION)

  function setPosition(next: TabPosition) {
    positionRef.current = next
    setPositionState(next)
  }

  useEffect(() => {
    const stored = readStoredPosition()
    if (!stored) return
    positionRef.current = stored
    setPositionState(stored)
  }, [])

  function handlePointerDown(event: React.PointerEvent<HTMLButtonElement>) {
    draggedRef.current = false
    if (event.button !== 0) return
    if (!window.matchMedia(MOBILE_MEDIA_QUERY).matches) return
    drag.current = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      moved: false,
    }
  }

  function handlePointerMove(event: React.PointerEvent<HTMLButtonElement>) {
    const state = drag.current
    if (!state || state.pointerId !== event.pointerId) return

    if (!state.moved) {
      const travelled = Math.hypot(event.clientX - state.startX, event.clientY - state.startY)
      if (travelled < DRAG_THRESHOLD_PX) return
      state.moved = true
      draggedRef.current = true
      setDragging(true)
      tabRef.current?.setPointerCapture(event.pointerId)
    }

    const tabHeight = tabRef.current?.offsetHeight ?? 0
    setPosition({
      side: event.clientX < window.innerWidth / 2 ? 'left' : 'right',
      topPct: clampTopPct((event.clientY / window.innerHeight) * 100, tabHeight),
    })
  }

  function endDrag(event: React.PointerEvent<HTMLButtonElement>) {
    const state = drag.current
    if (!state || state.pointerId !== event.pointerId) return
    drag.current = null
    if (!state.moved) return
    setDragging(false)
    tabRef.current?.releasePointerCapture(event.pointerId)
    try {
      window.localStorage.setItem(TAB_POSITION_KEY, JSON.stringify(positionRef.current))
    } catch {
      // position is a convenience; a full storage quota is not worth failing on
    }
  }

  return {
    position,
    dragging,
    // A drag ends with a click event on the button — swallow it so moving the
    // tab does not also open the queue panel.
    wasDragged: () => {
      if (!draggedRef.current) return false
      draggedRef.current = false
      return true
    },
    dragHandlers: {
      onPointerDown: handlePointerDown,
      onPointerMove: handlePointerMove,
      onPointerUp: endDrag,
      onPointerCancel: endDrag,
    },
  }
}
