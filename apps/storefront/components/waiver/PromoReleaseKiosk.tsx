'use client'

import { useCallback, useEffect, useState, type FormEvent } from 'react'
import Image from 'next/image'
import { Check, ChevronDown, Loader2, RotateCcw, X } from 'lucide-react'
import { SignaturePad } from '@/components/waiver/SignaturePad'
import { cn } from '@/lib/utils'
import {
  PROMO_RELEASE_INTRO,
  PROMO_RELEASE_TERMS,
  PROMO_RELEASE_TITLE,
  type PromoReleaseDecision,
} from '@/lib/waivers/promoReleaseCopy'

const LOGO_URL =
  'https://can9pwc8drhj1bme.public.blob.vercel-storage.com/site/images/shared/logo-image.webp'
const RESET_SECONDS = 8

type Status = 'form' | 'submitting' | 'done'

interface FormState {
  decision: PromoReleaseDecision | null
  signature: string | null
  signingForMinor: boolean
  minorName: string
  fullName: string
  email: string
}

const EMPTY_FORM: FormState = {
  decision: null,
  signature: null,
  signingForMinor: false,
  minorName: '',
  fullName: '',
  email: '',
}

const inputClass =
  'h-14 w-full rounded-xl border-2 border-stone-200 bg-white px-4 text-xl text-stone-900 placeholder:text-stone-400 focus:border-salsa-600 focus:outline-none focus:ring-4 focus:ring-salsa-100'

const textInputProps = {
  autoComplete: 'off',
  autoCorrect: 'off',
  spellCheck: false,
} as const

export function PromoReleaseKiosk({ event }: { event?: string }) {
  const [form, setForm] = useState<FormState>(EMPTY_FORM)
  const [showDetails, setShowDetails] = useState(false)
  const [status, setStatus] = useState<Status>('form')
  const [error, setError] = useState<string | null>(null)
  const [submitted, setSubmitted] = useState<{ firstName: string; decision: PromoReleaseDecision } | null>(null)
  const [countdown, setCountdown] = useState(RESET_SECONDS)

  const reset = useCallback(() => {
    setForm(EMPTY_FORM)
    setShowDetails(false)
    setSubmitted(null)
    setError(null)
    setStatus('form')
    setCountdown(RESET_SECONDS)
    window.scrollTo({ top: 0 })
  }, [])

  // Clear the thank-you screen on its own so the next person gets a blank form.
  useEffect(() => {
    if (status !== 'done') return
    if (countdown <= 0) {
      reset()
      return
    }
    const timer = window.setTimeout(() => setCountdown((value) => value - 1), 1000)
    return () => window.clearTimeout(timer)
  }, [status, countdown, reset])

  const update = <K extends keyof FormState>(key: K, value: FormState[K]) => {
    setForm((current) => ({ ...current, [key]: value }))
    setError(null)
  }

  // Stable so the pad's setup effect doesn't re-run on every keystroke.
  const handleSignature = useCallback((signature: string | null) => {
    setForm((current) => ({ ...current, signature }))
    setError(null)
  }, [])

  const chooseDecision = (decision: PromoReleaseDecision) => {
    setForm((current) => ({
      ...current,
      decision,
      // Only a "yes" is signed; drop anything drawn before switching to "no".
      signature: decision === 'agree' ? current.signature : null,
      signingForMinor: decision === 'agree' ? current.signingForMinor : false,
    }))
    setError(null)
  }

  const agreed = form.decision === 'agree'
  const canSubmit =
    status === 'form' && form.decision !== null && (form.decision === 'decline' || form.signature !== null)

  async function handleSubmit(eventArg: FormEvent<HTMLFormElement>) {
    eventArg.preventDefault()
    if (!canSubmit || !form.decision) return

    setStatus('submitting')
    setError(null)
    try {
      const response = await fetch('/api/waivers/promotional-release', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          decision: form.decision,
          signature: agreed ? form.signature ?? undefined : undefined,
          signingForMinor: agreed && form.signingForMinor,
          minorName: form.minorName,
          fullName: form.fullName,
          email: form.email,
          event,
        }),
      })

      if (!response.ok) {
        const data: unknown = await response.json().catch(() => null)
        const message =
          data && typeof data === 'object' && 'error' in data && typeof data.error === 'string'
            ? data.error
            : 'Something went wrong saving your response.'
        throw new Error(message)
      }

      setSubmitted({ firstName: form.fullName.trim().split(/\s+/)[0] ?? '', decision: form.decision })
      setStatus('done')
    } catch (submitError) {
      setError(
        `${submitError instanceof Error ? submitError.message : 'Something went wrong.'} Please try again or hand the iPad to our team.`,
      )
      setStatus('form')
    }
  }

  if (status === 'done' && submitted) {
    const yes = submitted.decision === 'agree'
    return (
      <main className="flex min-h-dvh flex-col items-center justify-center bg-chile-50 px-6 text-center">
        <div
          className={cn(
            'mb-8 flex h-28 w-28 items-center justify-center rounded-full',
            yes ? 'bg-verde-600' : 'bg-stone-700',
          )}
        >
          <Check className="h-16 w-16 text-white" strokeWidth={3} aria-hidden />
        </div>
        <h1 className="font-serif text-5xl text-stone-900">
          Thank you{submitted.firstName ? `, ${submitted.firstName}` : ''}!
        </h1>
        <p className="mt-4 max-w-xl text-2xl text-stone-600">
          {yes
            ? "You're all set. We can't wait to share the fun."
            : "Got it. We won't feature you in our photos or promotions."}
        </p>
        <p className="mt-10 text-xl font-semibold text-salsa-700">Please hand the iPad back to our team.</p>
        <button
          type="button"
          onClick={reset}
          className="mt-10 inline-flex h-14 items-center gap-2 rounded-full border-2 border-stone-300 bg-white px-8 text-lg font-semibold text-stone-700 active:bg-stone-100"
        >
          <RotateCcw className="h-5 w-5" aria-hidden />
          Next person
        </button>
        <p className="mt-4 text-sm text-stone-500">Resetting in {countdown}s</p>
      </main>
    )
  }

  const submitting = status === 'submitting'

  return (
    <main className="min-h-dvh bg-chile-50 px-5 py-8 sm:px-10 sm:py-12">
      <form onSubmit={handleSubmit} className="mx-auto flex max-w-3xl flex-col gap-8" noValidate>
        <header className="flex flex-col items-center text-center">
          <Image src={LOGO_URL} alt="Jose Madrid Salsa" width={96} height={96} priority className="h-24 w-24 object-contain" />
          <h1 className="mt-4 font-serif text-4xl text-stone-900 sm:text-5xl">{PROMO_RELEASE_TITLE}</h1>
          <p className="mt-3 max-w-2xl text-lg text-stone-600 sm:text-xl">{PROMO_RELEASE_INTRO}</p>
          {event ? (
            <span className="mt-4 rounded-full bg-salsa-100 px-4 py-1 text-sm font-semibold text-salsa-800">{event}</span>
          ) : null}
        </header>

        <section className="rounded-2xl border border-stone-200 bg-white p-6 shadow-sm">
          <h2 className="text-sm font-bold uppercase tracking-wider text-stone-500">What you&apos;re agreeing to</h2>
          <ol className="mt-3 list-decimal space-y-2 pl-5 text-base leading-relaxed text-stone-700 marker:font-semibold marker:text-salsa-700">
            {PROMO_RELEASE_TERMS.map((term) => (
              <li key={term}>{term}</li>
            ))}
          </ol>
        </section>

        <section>
          <h2 className="mb-3 text-2xl font-semibold text-stone-900">
            May we feature you on our website and in promotional materials?
          </h2>
          <div role="radiogroup" aria-label="Your choice" className="grid gap-4 sm:grid-cols-2">
            <ChoiceCard
              selected={form.decision === 'agree'}
              onSelect={() => chooseDecision('agree')}
              disabled={submitting}
              tone="yes"
              title="Yes, feature me"
              detail="I agree to the release above."
            />
            <ChoiceCard
              selected={form.decision === 'decline'}
              onSelect={() => chooseDecision('decline')}
              disabled={submitting}
              tone="no"
              title="No, please don't"
              detail="Please don't use my photo or video."
            />
          </div>
        </section>

        {agreed ? (
          <section className="flex flex-col gap-4">
            <h2 className="text-2xl font-semibold text-stone-900">Sign to agree</h2>
            <SignaturePad onChange={handleSignature} disabled={submitting} />
            <label className="flex cursor-pointer items-center gap-4 rounded-xl border-2 border-stone-200 bg-white px-4 py-4">
              <input
                type="checkbox"
                className="h-7 w-7 shrink-0 accent-salsa-700"
                checked={form.signingForMinor}
                onChange={(e) => update('signingForMinor', e.target.checked)}
                disabled={submitting}
              />
              <span className="text-lg text-stone-800">I&apos;m a parent or guardian signing for my child under 18</span>
            </label>
            {form.signingForMinor ? (
              <input
                className={inputClass}
                aria-label="Child's name (optional)"
                value={form.minorName}
                onChange={(e) => update('minorName', e.target.value)}
                {...textInputProps}
                autoCapitalize="words"
                placeholder="Child's name (optional)"
                maxLength={100}
                disabled={submitting}
              />
            ) : null}
          </section>
        ) : null}

        {form.decision ? (
          <section className="rounded-2xl border-2 border-stone-200 bg-white">
            <button
              type="button"
              onClick={() => setShowDetails((open) => !open)}
              aria-expanded={showDetails}
              className="flex w-full items-center justify-between gap-4 px-5 py-4 text-left"
            >
              <span>
                <span className="block text-lg font-semibold text-stone-800">Add your name and email</span>
                <span className="block text-base text-stone-500">Optional. Skip this to stay anonymous.</span>
              </span>
              <ChevronDown
                className={cn('h-6 w-6 shrink-0 text-stone-500 transition-transform', showDetails && 'rotate-180')}
                aria-hidden
              />
            </button>
            {showDetails ? (
              <div className="flex flex-col gap-4 border-t border-stone-200 px-5 py-5">
                <input
                  className={inputClass}
                  aria-label="Your name (optional)"
                  value={form.fullName}
                  onChange={(e) => update('fullName', e.target.value)}
                  {...textInputProps}
                  autoCapitalize="words"
                  placeholder="Your name"
                  maxLength={100}
                  disabled={submitting}
                />
                <input
                  className={inputClass}
                  aria-label="Email (optional)"
                  type="email"
                  inputMode="email"
                  value={form.email}
                  onChange={(e) => update('email', e.target.value)}
                  {...textInputProps}
                  autoCapitalize="none"
                  placeholder="Email"
                  maxLength={200}
                  disabled={submitting}
                />
              </div>
            ) : null}
          </section>
        ) : null}

        {error ? (
          <p role="alert" className="rounded-xl bg-salsa-50 px-4 py-3 text-lg text-salsa-800">
            {error}
          </p>
        ) : null}

        <button
          type="submit"
          disabled={!canSubmit}
          className="flex h-16 items-center justify-center gap-3 rounded-2xl bg-salsa-700 text-xl font-bold text-white shadow-lg transition active:bg-salsa-800 disabled:bg-stone-300 disabled:text-stone-500 disabled:shadow-none"
        >
          {submitting ? <Loader2 className="h-6 w-6 animate-spin" aria-hidden /> : null}
          {submitting ? 'Saving…' : agreed && !form.signature ? 'Sign above to submit' : 'Submit'}
        </button>
      </form>
    </main>
  )
}

function ChoiceCard({
  selected,
  onSelect,
  disabled,
  tone,
  title,
  detail,
}: {
  selected: boolean
  onSelect: () => void
  disabled: boolean
  tone: 'yes' | 'no'
  title: string
  detail: string
}) {
  const yes = tone === 'yes'
  const Icon = yes ? Check : X
  return (
    <button
      type="button"
      role="radio"
      aria-checked={selected}
      onClick={onSelect}
      disabled={disabled}
      className={cn(
        'flex min-h-32 items-center gap-4 rounded-2xl border-[3px] bg-white p-5 text-left transition',
        selected
          ? yes
            ? 'border-verde-600 bg-verde-50 ring-4 ring-verde-100'
            : 'border-stone-700 bg-stone-100 ring-4 ring-stone-200'
          : 'border-stone-200 active:bg-stone-50',
      )}
    >
      <span
        className={cn(
          'flex h-14 w-14 shrink-0 items-center justify-center rounded-full border-2',
          selected
            ? yes
              ? 'border-verde-600 bg-verde-600 text-white'
              : 'border-stone-700 bg-stone-700 text-white'
            : 'border-stone-300 text-stone-400',
        )}
      >
        <Icon className="h-8 w-8" strokeWidth={3} aria-hidden />
      </span>
      <span className="flex flex-col">
        <span className="text-xl font-bold text-stone-900">{title}</span>
        <span className="mt-1 text-base text-stone-600">{detail}</span>
      </span>
    </button>
  )
}
