'use client'

import { useEffect, useRef, useState } from 'react'
import { Bot, Headphones, Loader2, MessageCircle, Send, Sparkles, User, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'

type ChatMessage = {
  id: string
  role: 'user' | 'assistant' | 'system'
  content: string
  senderLabel?: string
}

type Mode = 'ai' | 'handoff-form' | 'live' | 'offline-sent'

const INITIAL_MESSAGE: ChatMessage = {
  id: 'assistant-welcome',
  role: 'assistant',
  content:
    "Hi there! I'm the Jose Madrid Salsa assistant. Ask about flavors, fundraising, wholesale orders, or anything else you need. If you'd rather speak with a human, tap “Talk to a human” below.",
}

const LIVE_POLL_MS = 3000

export function AiChatWidget() {
  const [isOpen, setIsOpen] = useState(false)
  const [input, setInput] = useState('')
  const [messages, setMessages] = useState<ChatMessage[]>([INITIAL_MESSAGE])
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const endRef = useRef<HTMLDivElement | null>(null)

  // Handoff state
  const [mode, setMode] = useState<Mode>('ai')
  const [handoffName, setHandoffName] = useState('')
  const [handoffEmail, setHandoffEmail] = useState('')
  const [handoffMessage, setHandoffMessage] = useState('')
  const [businessOpen, setBusinessOpen] = useState<boolean | null>(null)
  const [hoursLabel, setHoursLabel] = useState<string>('Mon-Fri 9am-5pm ET')
  const [threadId, setThreadId] = useState<string | null>(null)
  const [lastFetchedAt, setLastFetchedAt] = useState<string | null>(null)

  useEffect(() => {
    if (endRef.current) {
      endRef.current.scrollIntoView({ behavior: 'smooth' })
    }
  }, [messages, isOpen, mode])

  useEffect(() => {
    if (!isOpen) return
    fetch('/api/chat-handoff/status', { cache: 'no-store' })
      .then((r) => r.ok ? r.json() : null)
      .then((data) => {
        if (data) {
          setBusinessOpen(Boolean(data.open))
          if (typeof data.hoursLabel === 'string') setHoursLabel(data.hoursLabel)
        }
      })
      .catch(() => {})
  }, [isOpen])

  // Poll for new messages while in live mode.
  useEffect(() => {
    if (mode !== 'live' || !threadId) return
    let cancelled = false

    async function pull() {
      try {
        const url = new URL(`/api/chat-handoff/${threadId}/messages`, window.location.origin)
        if (lastFetchedAt) url.searchParams.set('since', lastFetchedAt)
        const response = await fetch(url.toString(), { cache: 'no-store' })
        if (!response.ok) return
        const data = await response.json()
        if (cancelled) return
        if (Array.isArray(data?.messages) && data.messages.length > 0) {
          setMessages((prev) => {
            const incoming: ChatMessage[] = data.messages
              .filter((m: any) => m.senderType !== 'CUSTOMER')
              .map((m: any) => ({
                id: m.id,
                role: m.senderType === 'ADMIN' ? 'assistant' : m.senderType === 'SYSTEM' ? 'system' : 'assistant',
                content: m.content,
                senderLabel:
                  m.senderType === 'ADMIN'
                    ? m.senderLabel ?? 'Jose Madrid Salsa team'
                    : m.senderType === 'SYSTEM'
                      ? 'System'
                      : 'AI assistant',
              }))
            const existing = new Set(prev.map((p) => p.id))
            const next = [...prev]
            for (const m of incoming) if (!existing.has(m.id)) next.push(m)
            return next
          })
          const latest = data.messages[data.messages.length - 1]?.createdAt
          if (latest) setLastFetchedAt(latest)
        }
        if (data?.thread?.status === 'CLOSED') {
          setMode('ai')
          setMessages((prev) => [
            ...prev,
            {
              id: `system-${Date.now()}`,
              role: 'system',
              content: 'The live chat was closed. You’re back with the AI assistant.',
            },
          ])
        }
      } catch {
        // network blip — try again next tick
      }
    }

    pull()
    const interval = window.setInterval(pull, LIVE_POLL_MS)
    return () => {
      cancelled = true
      window.clearInterval(interval)
    }
  }, [mode, threadId, lastFetchedAt])

  const handleToggle = () => {
    setIsOpen((prev) => !prev)
    setError(null)
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const trimmed = input.trim()
    if (!trimmed || isLoading) return

    const userMessage: ChatMessage = {
      id: `user-${Date.now()}`,
      role: 'user',
      content: trimmed,
    }
    const newMessages = [...messages, userMessage]
    setMessages(newMessages)
    setInput('')
    setError(null)

    if (mode === 'live' && threadId) {
      try {
        const response = await fetch(`/api/chat-handoff/${threadId}/messages`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ content: trimmed }),
        })
        if (!response.ok) {
          const data = await response.json().catch(() => ({}))
          throw new Error(typeof data?.error === 'string' ? data.error : 'Message failed to send.')
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Message failed to send.')
      }
      return
    }

    setIsLoading(true)
    try {
      const response = await fetch('/api/ai-chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: newMessages
            .filter((m) => m.role !== 'system')
            .map((m) => ({ role: m.role, content: m.content })),
        }),
      })
      if (!response.ok) {
        const data = await response.json().catch(() => ({}))
        throw new Error(typeof data?.error === 'string' && data.error.length ? data.error : 'The assistant is unavailable right now.')
      }
      const data = await response.json()
      setMessages((prev) => [
        ...prev,
        { id: `assistant-${Date.now()}`, role: 'assistant', content: data?.reply ?? 'Sorry, I could not generate a response.' },
      ])
    } catch (err) {
      setError(err instanceof Error ? err.message : 'The assistant is unavailable right now.')
    } finally {
      setIsLoading(false)
    }
  }

  async function requestHandoff(payload: { name?: string; email?: string; message?: string }) {
    setIsLoading(true)
    setError(null)
    try {
      const transcript = messages
        .filter((m) => m.role === 'user' || m.role === 'assistant')
        .map((m) => ({ role: m.role, content: m.content }))
      const response = await fetch('/api/chat-handoff/request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...payload,
          transcript,
          source: 'chat-widget',
        }),
      })
      if (!response.ok) {
        const data = await response.json().catch(() => ({}))
        throw new Error(typeof data?.error === 'string' ? data.error : 'Unable to start the handoff.')
      }
      const data = await response.json()
      if (data.status === 'OFFLINE') {
        setMode('offline-sent')
      } else {
        setThreadId(data.threadId)
        setMode('live')
        setMessages((prev) => [
          ...prev,
          {
            id: `system-${Date.now()}`,
            role: 'system',
            content: "Connecting you with our team — someone will be right with you.",
          },
        ])
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to start the handoff.')
    } finally {
      setIsLoading(false)
    }
  }

  function startHandoff() {
    if (businessOpen === false) {
      setMode('handoff-form')
    } else {
      // open hours — go straight if we have any info, else show small form.
      setMode('handoff-form')
    }
  }

  return (
    <div className="fixed bottom-6 right-6 z-50 flex flex-col items-end gap-4">
      {isOpen && (
        <div className="w-[480px] max-w-[calc(100vw-3rem)] overflow-hidden rounded-3xl border border-border bg-card shadow-2xl ring-1 ring-black/5 dark:ring-white/10">
          <div className="flex items-center justify-between bg-gradient-to-r from-salsa-600 via-salsa-500 to-chile-500 px-4 py-3 text-white">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.3em] text-white/80">
                {mode === 'live' ? 'Live chat' : 'AI assistant'}
              </p>
              <p className="flex items-center gap-2 text-base font-semibold">
                {mode === 'live' ? <Headphones className="h-4 w-4" /> : <Sparkles className="h-4 w-4" />}
                {mode === 'live' ? 'You’re chatting with our team' : 'Chat with Jose Madrid Salsa'}
              </p>
            </div>
            <button
              type="button"
              onClick={handleToggle}
              className="rounded-full p-1 transition hover:bg-white/20 focus:outline-none focus-visible:ring-2 focus-visible:ring-white"
              aria-label="Close chat panel"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          <div className="flex h-[600px] flex-col justify-between">
            {mode === 'handoff-form' ? (
              <HandoffForm
                businessOpen={businessOpen ?? true}
                hoursLabel={hoursLabel}
                isLoading={isLoading}
                error={error}
                onCancel={() => setMode('ai')}
                onSubmit={(payload) => requestHandoff(payload)}
                seedName={handoffName}
                seedEmail={handoffEmail}
                seedMessage={handoffMessage}
                setSeedName={setHandoffName}
                setSeedEmail={setHandoffEmail}
                setSeedMessage={setHandoffMessage}
              />
            ) : mode === 'offline-sent' ? (
              <OfflineSent
                hoursLabel={hoursLabel}
                onClose={handleToggle}
              />
            ) : (
              <>
                <div className="space-y-3 overflow-y-auto px-4 py-4 text-sm text-foreground">
                  {messages.map((message) => (
                    <MessageBubble key={message.id} message={message} />
                  ))}
                  {isLoading && mode === 'ai' ? (
                    <div className="flex justify-start">
                      <div className="flex items-center gap-2 rounded-2xl bg-muted px-4 py-2 text-xs text-muted-foreground">
                        <Loader2 className="h-3 w-3 animate-spin" />
                        Typing…
                      </div>
                    </div>
                  ) : null}
                  <div ref={endRef} />
                </div>

                <form onSubmit={handleSubmit} className="border-t border-border bg-card px-4 py-3">
                  <div className="flex gap-2">
                    <Textarea
                      value={input}
                      onChange={(event) => setInput(event.target.value)}
                      placeholder={mode === 'live' ? 'Type your message…' : 'Ask about flavors, fundraising, or order support...'}
                      rows={2}
                      maxLength={2000}
                      className="resize-none bg-muted flex-1"
                    />
                    <Button
                      type="submit"
                      className="bg-salsa-600 hover:bg-salsa-700 self-end"
                      disabled={isLoading || !input.trim()}
                      size="icon"
                    >
                      {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                    </Button>
                  </div>
                  {error ? (
                    <p className="mt-2 text-xs text-red-600 dark:text-red-400">{error}</p>
                  ) : (
                    <div className="mt-2 flex items-center justify-between text-xs text-muted-foreground">
                      <span>
                        {mode === 'live'
                          ? 'A human from our team is on the line.'
                          : `Powered by ${process.env.NEXT_PUBLIC_AI_CHAT_PROVIDER ?? 'OpenAI'}`}
                      </span>
                      {mode === 'ai' ? (
                        <button
                          type="button"
                          onClick={startHandoff}
                          className="inline-flex items-center gap-1 font-medium text-salsa-600 hover:text-salsa-700"
                        >
                          <Headphones className="h-3 w-3" />
                          Talk to a human
                        </button>
                      ) : null}
                    </div>
                  )}
                </form>
              </>
            )}
          </div>
        </div>
      )}

      <button
        type="button"
        onClick={handleToggle}
        className="flex h-14 w-14 items-center justify-center rounded-full bg-salsa-600 text-white shadow-lg transition hover:bg-salsa-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-salsa-500"
        aria-label={isOpen ? 'Close chat window' : 'Open chat window'}
      >
        {isOpen ? <X className="h-6 w-6" /> : <MessageCircle className="h-6 w-6" />}
      </button>
    </div>
  )
}

function MessageBubble({ message }: { message: ChatMessage }) {
  if (message.role === 'system') {
    return (
      <div className="flex justify-center">
        <p className="rounded-full bg-muted px-3 py-1 text-[11px] uppercase tracking-wide text-muted-foreground">
          {message.content}
        </p>
      </div>
    )
  }
  const isUser = message.role === 'user'
  return (
    <div className={`flex ${isUser ? 'justify-end' : 'justify-start'}`}>
      <div
        className={`max-w-[90%] rounded-2xl px-4 py-3 ${
          isUser ? 'bg-salsa-600 text-white shadow-md' : 'bg-muted text-foreground'
        }`}
      >
        {!isUser ? (
          <div className="mb-1 flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            {message.senderLabel?.toLowerCase().includes('ai') || !message.senderLabel ? (
              <Bot className="h-3.5 w-3.5" />
            ) : (
              <User className="h-3.5 w-3.5" />
            )}
            {message.senderLabel ?? 'Jose Madrid Salsa'}
          </div>
        ) : null}
        <p className="whitespace-pre-wrap text-sm leading-relaxed">{message.content}</p>
      </div>
    </div>
  )
}

function HandoffForm({
  businessOpen,
  hoursLabel,
  isLoading,
  error,
  onCancel,
  onSubmit,
  seedName,
  seedEmail,
  seedMessage,
  setSeedName,
  setSeedEmail,
  setSeedMessage,
}: {
  businessOpen: boolean
  hoursLabel: string
  isLoading: boolean
  error: string | null
  onCancel: () => void
  onSubmit: (payload: { name?: string; email?: string; message?: string }) => void
  seedName: string
  seedEmail: string
  seedMessage: string
  setSeedName: (value: string) => void
  setSeedEmail: (value: string) => void
  setSeedMessage: (value: string) => void
}) {
  return (
    <form
      onSubmit={(event) => {
        event.preventDefault()
        onSubmit({
          name: seedName.trim() || undefined,
          email: seedEmail.trim() || undefined,
          message: seedMessage.trim() || undefined,
        })
      }}
      className="flex flex-1 flex-col gap-3 overflow-y-auto px-4 py-4 text-sm"
    >
      <div className="rounded-xl bg-muted px-3 py-2 text-xs text-muted-foreground">
        {businessOpen
          ? 'We’re online. Drop a quick note and we’ll connect you with someone on the team.'
          : `We’re offline right now (${hoursLabel}). Leave your details and we’ll follow up by email.`}
      </div>
      <label className="text-xs font-medium">
        Name <span className="text-muted-foreground">(optional)</span>
        <Input
          className="mt-1"
          value={seedName}
          onChange={(event) => setSeedName(event.target.value)}
          maxLength={120}
          autoComplete="name"
          disabled={isLoading}
        />
      </label>
      <label className="text-xs font-medium">
        Email {businessOpen ? <span className="text-muted-foreground">(optional)</span> : <span className="text-red-600">(required)</span>}
        <Input
          type="email"
          className="mt-1"
          value={seedEmail}
          onChange={(event) => setSeedEmail(event.target.value)}
          maxLength={200}
          autoComplete="email"
          required={!businessOpen}
          disabled={isLoading}
        />
      </label>
      <label className="text-xs font-medium">
        What can we help with?
        <Textarea
          rows={4}
          maxLength={2000}
          className="mt-1"
          value={seedMessage}
          onChange={(event) => setSeedMessage(event.target.value)}
          disabled={isLoading}
          placeholder={businessOpen ? 'Optional — gives our team a head start.' : 'Tell us how we can help and we’ll respond by email.'}
        />
      </label>
      {error ? <p className="text-xs text-red-600">{error}</p> : null}
      <div className="mt-auto flex justify-end gap-2 pt-2">
        <Button type="button" variant="ghost" onClick={onCancel} disabled={isLoading}>
          Back to AI
        </Button>
        <Button type="submit" className="bg-salsa-600 hover:bg-salsa-700" disabled={isLoading}>
          {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Headphones className="mr-2 h-4 w-4" />}
          {businessOpen ? 'Start live chat' : 'Send message'}
        </Button>
      </div>
    </form>
  )
}

function OfflineSent({ hoursLabel, onClose }: { hoursLabel: string; onClose: () => void }) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-4 px-6 py-8 text-center text-sm">
      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-green-100 text-green-600">
        <Headphones className="h-6 w-6" />
      </div>
      <div>
        <p className="text-base font-semibold text-foreground">Got it — we’ll be in touch.</p>
        <p className="mt-1 text-muted-foreground">
          Our hours are {hoursLabel}. Someone from the team will follow up by email as soon as we’re back.
        </p>
      </div>
      <Button onClick={onClose}>Close</Button>
    </div>
  )
}
