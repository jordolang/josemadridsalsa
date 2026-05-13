'use client'

import { useState } from 'react'
import { Loader2, Mail } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

type Status = 'idle' | 'submitting' | 'success' | 'error'

export function FooterNewsletterSignup({ source = 'footer:newsletter' }: { source?: string }) {
  const [email, setEmail] = useState('')
  const [name, setName] = useState('')
  const [status, setStatus] = useState<Status>('idle')
  const [message, setMessage] = useState<string | null>(null)

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!email.trim()) return
    setStatus('submitting')
    setMessage(null)

    try {
      const response = await fetch('/api/newsletter', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: email.trim(),
          name: name.trim() || undefined,
          source,
        }),
      })

      if (!response.ok) {
        const data = await response.json().catch(() => ({}))
        throw new Error(
          typeof data?.error === 'string' && data.error.length
            ? data.error
            : 'Unable to subscribe. Try again shortly.',
        )
      }

      setStatus('success')
      setMessage("You're on the list — we'll send the first batch update soon.")
      setEmail('')
      setName('')
    } catch (err) {
      setStatus('error')
      setMessage(err instanceof Error ? err.message : 'Unable to subscribe right now.')
    }
  }

  return (
    <div className="text-center sm:text-left">
      <p className="text-lg font-medium">Newsletter</p>
      <p className="text-secondary-foreground/70 mt-3 text-sm">
        Fresh batches, fundraiser news, and exclusive discounts — straight to your inbox.
      </p>
      <form onSubmit={handleSubmit} className="mt-4 space-y-2" aria-label="Newsletter signup">
        <Input
          type="text"
          placeholder="First name (optional)"
          value={name}
          onChange={(event) => setName(event.target.value)}
          maxLength={120}
          autoComplete="given-name"
          className="bg-background"
          disabled={status === 'submitting'}
        />
        <div className="flex gap-2">
          <Input
            type="email"
            required
            placeholder="you@example.com"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            maxLength={200}
            autoComplete="email"
            className="bg-background flex-1"
            disabled={status === 'submitting'}
          />
          <Button
            type="submit"
            size="icon"
            className="bg-salsa-600 hover:bg-salsa-700 shrink-0"
            disabled={status === 'submitting' || !email.trim()}
            aria-label="Subscribe to newsletter"
          >
            {status === 'submitting' ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Mail className="h-4 w-4" />
            )}
          </Button>
        </div>
        {message ? (
          <p
            role="status"
            aria-live="polite"
            className={`text-xs ${status === 'error' ? 'text-red-600 dark:text-red-400' : 'text-primary'}`}
          >
            {message}
          </p>
        ) : null}
      </form>
    </div>
  )
}

export default FooterNewsletterSignup
