'use client'

import { useState } from 'react'
import { AlertCircle, Check, CheckCircle, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { cn } from '@/lib/utils'
import {
  SITE_FEEDBACK_CATEGORIES,
  SITE_FEEDBACK_MAX_RATING,
  SITE_FEEDBACK_MIN_RATING,
  type SiteFeedbackCategoryKey,
  type SiteFeedbackRatings,
} from '@/lib/site-feedback'

type FormStatus = 'idle' | 'submitting' | 'success' | 'error'

const SCORES = Array.from(
  { length: SITE_FEEDBACK_MAX_RATING - SITE_FEEDBACK_MIN_RATING + 1 },
  (_, i) => SITE_FEEDBACK_MIN_RATING + i,
)

interface SiteFeedbackFormProps {
  source: 'homepage' | 'feedback-page'
  /** Prefix for element ids so two forms can share a page. */
  idPrefix?: string
}

export function SiteFeedbackForm({ source, idPrefix = 'site-feedback' }: SiteFeedbackFormProps) {
  const [selected, setSelected] = useState<SiteFeedbackCategoryKey[]>([])
  const [ratings, setRatings] = useState<SiteFeedbackRatings>({})
  const [comment, setComment] = useState('')
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [status, setStatus] = useState<FormStatus>('idle')
  const [errorMessage, setErrorMessage] = useState('')

  const toggleCategory = (key: SiteFeedbackCategoryKey) => {
    setSelected((prev) => (prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]))
    setRatings((prev) => {
      if (!(key in prev)) return prev
      const next = { ...prev }
      delete next[key]
      return next
    })
  }

  const reset = () => {
    setSelected([])
    setRatings({})
    setComment('')
    setName('')
    setEmail('')
    setStatus('idle')
  }

  const onSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const unrated = selected.filter((key) => ratings[key] === undefined)
    if (unrated.length > 0) {
      const labels = SITE_FEEDBACK_CATEGORIES.filter((c) => unrated.includes(c.key)).map(
        (c) => c.label,
      )
      setStatus('error')
      setErrorMessage(`Pick a score for: ${labels.join(', ')}.`)
      return
    }
    if (Object.keys(ratings).length === 0 && comment.trim() === '') {
      setStatus('error')
      setErrorMessage('Rate at least one part of the site or leave a comment.')
      return
    }

    setStatus('submitting')
    setErrorMessage('')
    try {
      const res = await fetch('/api/site-feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ratings,
          comment: comment.trim() || undefined,
          name: name.trim() || undefined,
          email: email.trim() || undefined,
          source,
        }),
      })
      if (res.status === 429) {
        setStatus('error')
        setErrorMessage('Too many submissions. Please try again in a minute.')
        return
      }
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        setStatus('error')
        setErrorMessage(body.error || 'Something went wrong. Please try again.')
        return
      }
      setStatus('success')
    } catch {
      setStatus('error')
      setErrorMessage('Network error. Please check your connection and try again.')
    }
  }

  if (status === 'success') {
    return (
      <div className="rounded-2xl border border-salsa-200 bg-salsa-50 p-10 text-center dark:border-salsa-800 dark:bg-salsa-950/30">
        <CheckCircle className="mx-auto mb-4 h-14 w-14 text-green-600" />
        <h3 className="mb-2 font-serif text-2xl font-bold text-salsa-800 dark:text-salsa-200">
          Thanks for the feedback!
        </h3>
        <p className="mb-6 text-muted-foreground">
          Every rating goes straight to our team and helps us make the site better.
        </p>
        <Button variant="outline" onClick={reset}>
          Send more feedback
        </Button>
      </div>
    )
  }

  return (
    <form onSubmit={onSubmit} className="space-y-8" noValidate>
      {status === 'error' && (
        <div
          role="alert"
          className="flex items-start gap-3 rounded-lg border border-red-200 bg-red-50 p-4 dark:border-red-900 dark:bg-red-950/40"
        >
          <AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-red-600" />
          <p className="text-sm text-red-700 dark:text-red-300">{errorMessage}</p>
        </div>
      )}

      <fieldset>
        <legend className="mb-3 text-sm font-semibold">
          Which parts of the site did you use? Pick as many as you like.
        </legend>
        <div className="flex flex-wrap gap-2">
          {SITE_FEEDBACK_CATEGORIES.map((category) => {
            const isOn = selected.includes(category.key)
            return (
              <button
                key={category.key}
                type="button"
                aria-pressed={isOn}
                title={category.hint}
                onClick={() => toggleCategory(category.key)}
                className={cn(
                  'inline-flex items-center gap-1.5 rounded-full border px-4 py-2 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-salsa-500 focus-visible:ring-offset-2',
                  isOn
                    ? 'border-salsa-600 bg-salsa-600 text-white'
                    : 'border-border bg-background hover:border-salsa-400 hover:bg-salsa-50 dark:hover:bg-salsa-950/30',
                )}
              >
                {isOn && <Check className="h-4 w-4" aria-hidden />}
                {category.label}
              </button>
            )
          })}
        </div>
      </fieldset>

      {selected.length > 0 && (
        <div className="space-y-5">
          <p className="text-sm text-muted-foreground">
            Rate each one from {SITE_FEEDBACK_MIN_RATING} (needs work) to{' '}
            {SITE_FEEDBACK_MAX_RATING} (excellent).
          </p>
          {SITE_FEEDBACK_CATEGORIES.filter((c) => selected.includes(c.key)).map((category) => (
            <fieldset key={category.key}>
              <legend className="mb-2 text-sm font-semibold">
                {category.label}
                <span className="ml-2 font-normal text-muted-foreground">{category.hint}</span>
              </legend>
              <div className="grid grid-cols-10 gap-1 sm:gap-1.5">
                {SCORES.map((score) => {
                  const id = `${idPrefix}-${category.key}-${score}`
                  const checked = ratings[category.key] === score
                  return (
                    <label
                      key={score}
                      htmlFor={id}
                      className={cn(
                        'flex h-10 cursor-pointer items-center justify-center rounded-md border text-sm font-semibold transition-colors has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-salsa-500',
                        checked
                          ? 'border-salsa-600 bg-salsa-600 text-white'
                          : 'border-border bg-background hover:border-salsa-400',
                      )}
                    >
                      <input
                        id={id}
                        type="radio"
                        name={`${idPrefix}-${category.key}`}
                        value={score}
                        checked={checked}
                        onChange={() =>
                          setRatings((prev) => ({ ...prev, [category.key]: score }))
                        }
                        className="sr-only"
                        aria-label={`${category.label}: ${score} out of ${SITE_FEEDBACK_MAX_RATING}`}
                      />
                      {score}
                    </label>
                  )
                })}
              </div>
            </fieldset>
          ))}
        </div>
      )}

      <div className="space-y-2">
        <Label htmlFor={`${idPrefix}-comment`}>
          Anything else? <span className="text-muted-foreground">(optional)</span>
        </Label>
        <Textarea
          id={`${idPrefix}-comment`}
          rows={4}
          maxLength={5000}
          value={comment}
          onChange={(e) => setComment(e.target.value)}
          placeholder="Tell us what you loved, what tripped you up, or what you'd like to see next."
          className="resize-none"
        />
      </div>

      <div className="grid gap-5 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor={`${idPrefix}-name`}>
            Name <span className="text-muted-foreground">(optional)</span>
          </Label>
          <Input
            id={`${idPrefix}-name`}
            maxLength={120}
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Your name"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor={`${idPrefix}-email`}>
            Email <span className="text-muted-foreground">(optional, if you&apos;d like a reply)</span>
          </Label>
          <Input
            id={`${idPrefix}-email`}
            type="email"
            maxLength={320}
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="your@email.com"
          />
        </div>
      </div>

      <Button type="submit" size="lg" disabled={status === 'submitting'} className="w-full sm:w-auto">
        {status === 'submitting' ? (
          <>
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            Sending...
          </>
        ) : (
          'Send Feedback'
        )}
      </Button>
    </form>
  )
}
