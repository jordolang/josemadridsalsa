'use client'

import { useState } from 'react'
import { Mail, Loader2, CheckCircle2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

interface SubscribeFormProps {
  seriesSlug?: string
  source?: string
  variant?: 'inline' | 'card'
  heading?: string
  description?: string
}

export function SubscribeForm({
  seriesSlug,
  source = 'heat-index',
  variant = 'card',
  heading = 'Get The Heat Index in your inbox',
  description = "Stories, recipes, and road notes — straight from the kettle. No spam, ever.",
}: SubscribeFormProps) {
  const [email, setEmail] = useState('')
  const [firstName, setFirstName] = useState('')
  const [status, setStatus] = useState<'idle' | 'submitting' | 'success' | 'error'>('idle')
  const [error, setError] = useState<string | null>(null)

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    setStatus('submitting')
    setError(null)
    try {
      const res = await fetch('/api/heat-index/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, firstName: firstName || undefined, seriesSlug, source }),
      })
      const data = await res.json()
      if (!res.ok) {
        throw new Error(data.error ?? 'Subscription failed')
      }
      setStatus('success')
      setEmail('')
      setFirstName('')
    } catch (err) {
      setStatus('error')
      setError(err instanceof Error ? err.message : 'Subscription failed')
    }
  }

  if (status === 'success') {
    return (
      <div
        className={`flex items-center gap-3 rounded-2xl border border-verde-300 bg-verde-50 dark:bg-verde-900/20 dark:border-verde-700 p-6 text-verde-800 dark:text-verde-200 ${
          variant === 'inline' ? 'max-w-xl' : ''
        }`}
      >
        <CheckCircle2 className="w-6 h-6 flex-shrink-0" />
        <div>
          <p className="font-semibold">You're in.</p>
          <p className="text-sm">Check your inbox for a welcome note.</p>
        </div>
      </div>
    )
  }

  const isCard = variant === 'card'

  return (
    <div
      className={
        isCard
          ? 'rounded-3xl border border-border bg-gradient-to-br from-salsa-50 to-amber-50 dark:from-salsa-950/30 dark:to-amber-950/30 p-8 lg:p-10 shadow-sm'
          : ''
      }
    >
      {isCard && (
        <>
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-salsa-600 text-white mb-4">
            <Mail className="w-5 h-5" />
          </div>
          <h3 className="font-serif font-bold text-2xl lg:text-3xl text-foreground mb-2">
            {heading}
          </h3>
          <p className="text-muted-foreground mb-6 max-w-md">{description}</p>
        </>
      )}

      <form onSubmit={onSubmit} className="flex flex-col sm:flex-row gap-3 max-w-xl">
        <Input
          type="text"
          placeholder="First name (optional)"
          value={firstName}
          onChange={(e) => setFirstName(e.target.value)}
          disabled={status === 'submitting'}
          className="flex-1"
          autoComplete="given-name"
        />
        <Input
          type="email"
          required
          placeholder="you@example.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          disabled={status === 'submitting'}
          className="flex-1"
          autoComplete="email"
        />
        <Button
          type="submit"
          disabled={status === 'submitting' || !email}
          className="bg-salsa-600 hover:bg-salsa-700 text-white"
        >
          {status === 'submitting' ? (
            <>
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              Subscribing
            </>
          ) : (
            'Subscribe'
          )}
        </Button>
      </form>

      {error && <p className="text-sm text-salsa-700 mt-3">{error}</p>}
    </div>
  )
}
