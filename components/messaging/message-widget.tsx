'use client'

import { useState } from 'react'
import { MessageCircle, Send, X, Loader2 } from 'lucide-react'
import { useSession } from 'next-auth/react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'

export function MessageWidget() {
  const { data: session } = useSession()
  const [isOpen, setIsOpen] = useState(false)
  const [subject, setSubject] = useState('')
  const [message, setMessage] = useState('')
  const [email, setEmail] = useState('')
  const [sending, setSending] = useState(false)
  const [sent, setSent] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const toggleWidget = () => {
    setIsOpen((prev) => !prev)
    if (sent) setSent(false)
    setError(null)
  }

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()

    if (!message.trim()) {
      setError('Please share how we can help before sending.')
      return
    }

    if (!session?.user?.email && !email.trim()) {
      setError('Add your email so we can reach you.')
      return
    }

    setSending(true)
    setError(null)

    try {
      const payload = {
        subject: subject.trim() || undefined,
        message: message.trim(),
        email: session?.user?.email ? undefined : email.trim(),
      }

      const response = await fetch('/messages/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })

      if (!response.ok) {
        const data = await response.json().catch(() => ({}))
        throw new Error(
          typeof data?.error === 'string' && data.error.length
            ? data.error
            : 'Unable to send your message right now.'
        )
      }

      setSubject('')
      setMessage('')
      if (!session?.user?.email) {
        setEmail('')
      }
      setSent(true)
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unable to send your message right now.'
      setError(message)
    } finally {
      setSending(false)
    }
  }

  return (
    <div className="fixed bottom-6 right-6 z-50 flex flex-col items-end gap-4">
      {isOpen && (
        <div className="w-[320px] max-w-[calc(100vw-3rem)] overflow-hidden rounded-3xl border border-salsa-100 bg-white shadow-2xl ring-1 ring-black/5">
          <div className="flex items-center justify-between bg-gradient-to-r from-salsa-600 via-salsa-500 to-chile-500 px-4 py-3 text-white">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-widest text-white/80">Need a hand?</p>
              <p className="text-base font-semibold">Message Jose Madrid Salsa</p>
            </div>
            <button
              type="button"
              onClick={toggleWidget}
              className="rounded-full p-1 transition hover:bg-white/20 focus:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-salsa-600"
              aria-label="Close message panel"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          <div className="px-4 py-4">
            {sent ? (
              <div className="space-y-4 text-sm text-slate-600">
                <div className="rounded-xl border border-green-200 bg-green-50 px-3 py-2 text-green-700">
                  Thanks for reaching out! We&apos;ll get back to you shortly.
                </div>
                <Button
                  type="button"
                  variant="secondary"
                  className="w-full"
                  onClick={() => {
                    setSent(false)
                    setIsOpen(false)
                  }}
                >
                  Close
                </Button>
              </div>
            ) : (
              <form className="space-y-4 text-sm text-slate-700" onSubmit={handleSubmit}>
                {!session?.user?.email && (
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold uppercase tracking-wide text-salsa-600">
                      Your Email
                    </label>
                    <Input
                      type="email"
                      placeholder="you@example.com"
                      value={email}
                      onChange={(event) => setEmail(event.target.value)}
                      autoComplete="email"
                    />
                  </div>
                )}

                <div className="space-y-1.5">
                  <label className="text-xs font-semibold uppercase tracking-wide text-salsa-600">
                    Subject (optional)
                  </label>
                  <Input
                    placeholder="How can we help?"
                    value={subject}
                    onChange={(event) => setSubject(event.target.value)}
                    autoComplete="off"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-semibold uppercase tracking-wide text-salsa-600">Message</label>
                  <Textarea
                    placeholder="Share a few details and we’ll follow up soon."
                    value={message}
                    onChange={(event) => setMessage(event.target.value)}
                    rows={4}
                    maxLength={1000}
                  />
                </div>

                {error && (
                  <div className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-600">
                    {error}
                  </div>
                )}

                <div className="flex items-center justify-between text-[11px] text-slate-400">
                  <span>Typically replies within 1 business day.</span>
                  <span>{message.length}/1000</span>
                </div>

                <Button
                  type="submit"
                  className="w-full bg-salsa-600 hover:bg-salsa-700"
                  disabled={sending}
                >
                  {sending ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <Send className="mr-2 h-4 w-4" />
                  )}
                  {sending ? 'Sending...' : 'Send message'}
                </Button>
              </form>
            )}
          </div>
        </div>
      )}

      <button
        type="button"
        onClick={toggleWidget}
        className="flex h-14 w-14 items-center justify-center rounded-full bg-salsa-600 text-white shadow-lg transition hover:bg-salsa-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-salsa-500"
        aria-label={isOpen ? 'Close message window' : 'Open message window'}
      >
        {isOpen ? <X className="h-6 w-6" /> : <MessageCircle className="h-6 w-6" />}
      </button>
    </div>
  )
}
