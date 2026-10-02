'use client'

import { useEffect, useRef, useState } from 'react'
import { Bot, CheckCircle2, Headphones, Loader2, Mail, Send, Sparkles, User, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { PicanteChatLauncher } from '@/components/chat/picante-chat-launcher'
import { PICANTE_INITIAL_MESSAGE } from '@/lib/ai-chat/persona'

type ChatMessage = {
  id: string
  role: 'user' | 'assistant' | 'system'
  content: string
  senderLabel?: string
}

type Mode = 'ai' | 'handoff-form' | 'live' | 'offline-sent' | 'contact-form' | 'contact-sent'

const INITIAL_MESSAGE: ChatMessage = {
  id: 'assistant-welcome',
  role: 'assistant',
  content: PICANTE_INITIAL_MESSAGE,
}

const LIVE_POLL_MS = 3000

export function AiChatWidget() {
  const [isOpen, setIsOpen] = useState(false)
  const [input, setInput] = useState('')
  const [messages, setMessages] = useState<ChatMessage[]>([INITIAL_MESSAGE])
  // One per conversation (this widget's lifetime), never persisted, so Agent Analytics groups
  // its turns without folding a new visit into an old session.
  const [chatSessionId] = useState(() => crypto.randomUUID())
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
                      : 'Picante',
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
              content: 'The live chat was closed. You’re back with Picante.',
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
          sessionId: chatSessionId,
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
    <div className="pointer-events-none fixed inset-0 z-50">
      {isOpen && (
        <div className="pointer-events-auto fixed bottom-28 right-3 w-[480px] max-w-[calc(100vw-1.5rem)] overflow-hidden rounded-3xl border border-border bg-card shadow-2xl ring-1 ring-black/5 sm:right-6 dark:ring-white/10">
          <div className="flex items-center justify-between bg-gradient-to-r from-salsa-600 via-salsa-500 to-chile-500 px-4 py-3 text-white">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.3em] text-white/80">
                {mode === 'live' ? 'Live chat' : mode === 'contact-form' || mode === 'contact-sent' ? 'Contact us' : 'Picante'}
              </p>
              <p className="flex items-center gap-2 text-base font-semibold">
                {mode === 'live' ? (
                  <Headphones className="h-4 w-4" />
                ) : mode === 'contact-form' || mode === 'contact-sent' ? (
                  <Mail className="h-4 w-4" />
                ) : (
                  <Sparkles className="h-4 w-4" />
                )}
                {mode === 'live'
                  ? 'You’re chatting with our team'
                  : mode === 'contact-form' || mode === 'contact-sent'
                    ? 'Send us a message'
                    : 'Your pepper-penguin salsa pal'}
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

          <div className="flex h-[min(600px,calc(100dvh-9rem))] flex-col justify-between">
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
            ) : mode === 'contact-form' ? (
              <ContactForm onCancel={() => setMode('ai')} onSent={() => setMode('contact-sent')} />
            ) : mode === 'contact-sent' ? (
              <ContactSent
                onClose={() => {
                  // Drop back to the chat so reopening the widget doesn't land on the
                  // confirmation screen, which has no route back to Picante.
                  setMode('ai')
                  handleToggle()
                }}
              />
            ) : (
              <>
                <div className="space-y-3 overflow-y-auto px-4 py-4 text-sm text-foreground">
                  {messages.map((message) => (
                    <div key={message.id} className="space-y-3">
                      <MessageBubble message={message} />
                      {message.id === INITIAL_MESSAGE.id && mode === 'ai' ? (
                        <div className="flex justify-start">
                          <button
                            type="button"
                            onClick={() => setMode('contact-form')}
                            className="inline-flex items-center gap-2 rounded-2xl border border-salsa-200 bg-salsa-50 px-4 py-2 text-left text-xs font-semibold uppercase tracking-wide text-salsa-700 transition hover:bg-salsa-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-salsa-500 dark:border-salsa-800 dark:bg-salsa-950 dark:text-salsa-200 dark:hover:bg-salsa-900"
                          >
                            <Mail className="h-3.5 w-3.5 shrink-0" />
                            Or fill out a contact form by clicking here
                          </button>
                        </div>
                      ) : null}
                    </div>
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
                          : `Powered by ${process.env.NEXT_PUBLIC_AI_CHAT_PROVIDER ?? 'Anthropic'}`}
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

      <PicanteChatLauncher isOpen={isOpen} onToggle={handleToggle} />
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

function ContactForm({ onCancel, onSent }: { onCancel: () => void; onSent: () => void }) {
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [company, setCompany] = useState('')
  const [phone, setPhone] = useState('')
  const [message, setMessage] = useState('')
  const [isSending, setIsSending] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (isSending) return
    setIsSending(true)
    setError(null)
    try {
      const response = await fetch('/api/send-email/contact', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: name.trim(),
          email: email.trim(),
          company: company.trim() || undefined,
          phone: phone.trim() || undefined,
          message: message.trim(),
          sourcePage: 'Picante Chat',
          submittedAt: new Date().toISOString(),
        }),
      })
      if (response.status === 429) {
        throw new Error('Too many requests. Please try again in a few minutes.')
      }
      if (!response.ok) {
        const data = await response.json().catch(() => ({}))
        throw new Error(typeof data?.error === 'string' ? data.error : 'Something went wrong. Please try again.')
      }
      onSent()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong. Please try again.')
    } finally {
      setIsSending(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-1 flex-col gap-3 overflow-y-auto px-4 py-4 text-sm">
      <div className="rounded-xl bg-muted px-3 py-2 text-xs text-muted-foreground">
        Fill this out and it lands straight in our inbox. We&apos;ll reply by email.
      </div>
      <label className="text-xs font-medium">
        Full Name
        <Input
          className="mt-1"
          value={name}
          onChange={(event) => setName(event.target.value)}
          maxLength={200}
          autoComplete="name"
          required
          disabled={isSending}
        />
      </label>
      <label className="text-xs font-medium">
        Email Address
        <Input
          type="email"
          className="mt-1"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          maxLength={320}
          autoComplete="email"
          required
          disabled={isSending}
        />
      </label>
      <label className="text-xs font-medium">
        Company name <span className="text-muted-foreground">(optional)</span>
        <Input
          className="mt-1"
          value={company}
          onChange={(event) => setCompany(event.target.value)}
          maxLength={200}
          autoComplete="organization"
          disabled={isSending}
        />
      </label>
      <label className="text-xs font-medium">
        Phone number <span className="text-muted-foreground">(optional)</span>
        <Input
          type="tel"
          className="mt-1"
          value={phone}
          onChange={(event) => setPhone(event.target.value)}
          maxLength={30}
          autoComplete="tel"
          disabled={isSending}
        />
      </label>
      <label className="text-xs font-medium">
        Comments / questions
        <Textarea
          rows={4}
          maxLength={5000}
          className="mt-1"
          value={message}
          onChange={(event) => setMessage(event.target.value)}
          required
          disabled={isSending}
          placeholder="How can we help?"
        />
      </label>
      {error ? <p className="text-xs text-red-600">{error}</p> : null}
      <div className="mt-auto flex justify-end gap-2 pt-2">
        <Button type="button" variant="ghost" onClick={onCancel} disabled={isSending}>
          Back to chat
        </Button>
        <Button type="submit" className="bg-salsa-600 hover:bg-salsa-700" disabled={isSending}>
          {isSending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Mail className="mr-2 h-4 w-4" />}
          Send message
        </Button>
      </div>
    </form>
  )
}

function ContactSent({ onClose }: { onClose: () => void }) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-4 px-6 py-8 text-center text-sm">
      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-green-100 text-green-600">
        <CheckCircle2 className="h-6 w-6" />
      </div>
      <div>
        <p className="text-base font-semibold text-foreground">Message sent!</p>
        <p className="mt-1 text-muted-foreground">
          Thanks for reaching out — we&apos;ll get back to you by email as soon as we can.
        </p>
      </div>
      <Button onClick={onClose}>Close</Button>
    </div>
  )
}
