'use client'

import { useMemo, useRef, useState } from 'react'
import Image from 'next/image'
import { AlertCircle, Check, Loader2, PartyPopper, Send, ShieldCheck, Star } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import {
  ANONYMOUS_REQUEST_HELP,
  ANONYMOUS_REQUEST_LABEL,
  FIRST_NAME_PLACEHOLDER,
  LAST_NAME_PLACEHOLDER,
  MAX_NAME_LENGTH,
  accentClasses,
} from '@/lib/polls/constants'
import type { PollQuestionResult } from '@/lib/polls/queries'
import { PollResults } from './poll-results'

export interface PollFormOption {
  id: string
  label: string
  description: string | null
  imageUrl: string | null
  emoji: string | null
}

export interface PollFormQuestion {
  id: string
  type: 'SINGLE_CHOICE' | 'MULTI_CHOICE' | 'SHORT_TEXT' | 'LONG_TEXT' | 'RATING'
  prompt: string
  helpText: string | null
  imageUrl: string | null
  imageAlt: string | null
  isRequired: boolean
  maxLength: number
  placeholder: string | null
  minSelections: number | null
  maxSelections: number | null
  allowOther: boolean
  ratingMax: number
  options: PollFormOption[]
}

interface AnswerState {
  optionIds: string[]
  textValue: string
  otherText: string
  rating: number | null
}

const emptyAnswer: AnswerState = { optionIds: [], textValue: '', otherText: '', rating: null }

/**
 * The interactive part of a poll page.
 *
 * Every control is a real form control underneath — radios, checkboxes,
 * inputs — wrapped in a pill so it works the same under a mouse, a finger and
 * a keyboard. Selection state is drawn from React rather than CSS `:checked`
 * so a chosen pill can carry the poll's accent colour, its check mark and its
 * raised outline all at once.
 */
export function PollForm({
  slug,
  accent,
  questions,
  collectEmail,
  consentNotice,
  thankYouMessage,
  accessCode,
  showResultsAfterVote,
  initialResults,
}: {
  slug: string
  accent: string | null
  questions: PollFormQuestion[]
  collectEmail: boolean
  consentNotice: string
  thankYouMessage: string | null
  accessCode?: string
  showResultsAfterVote: boolean
  /** Tallies to show above the form when the poll publishes them from the start. */
  initialResults?: PollQuestionResult[]
}) {
  const classes = accentClasses(accent)
  const [answers, setAnswers] = useState<Record<string, AnswerState>>({})
  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [email, setEmail] = useState('')
  const [anonymousRequested, setAnonymousRequested] = useState(false)
  const [consentAcknowledged, setConsentAcknowledged] = useState(false)
  const [honeypot, setHoneypot] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({})
  const [results, setResults] = useState<PollQuestionResult[] | null>(null)
  const [done, setDone] = useState(false)
  const errorRef = useRef<HTMLDivElement>(null)

  const answerFor = (questionId: string): AnswerState => answers[questionId] ?? emptyAnswer

  const update = (questionId: string, patch: Partial<AnswerState>) => {
    setAnswers((current) => ({
      ...current,
      [questionId]: { ...(current[questionId] ?? emptyAnswer), ...patch },
    }))
    setFieldErrors((current) => {
      if (!current[questionId]) return current
      const next = { ...current }
      delete next[questionId]
      return next
    })
  }

  const toggleOption = (question: PollFormQuestion, optionId: string) => {
    const answer = answerFor(question.id)
    if (question.type === 'SINGLE_CHOICE') {
      update(question.id, { optionIds: answer.optionIds[0] === optionId ? [] : [optionId] })
      return
    }
    const selected = answer.optionIds.includes(optionId)
    // The server counts a filled "something else" box as one of the choices, so
    // the limit here has to count it too or the form would post a payload the
    // server then rejects.
    const otherCounts = question.allowOther && answer.otherText.trim() !== '' ? 1 : 0
    if (
      !selected &&
      question.maxSelections != null &&
      answer.optionIds.length + otherCounts >= question.maxSelections
    ) {
      setFieldErrors((current) => ({
        ...current,
        [question.id]: `You can pick up to ${question.maxSelections} answers here.`,
      }))
      return
    }
    update(question.id, {
      optionIds: selected
        ? answer.optionIds.filter((id) => id !== optionId)
        : [...answer.optionIds, optionId],
    })
  }

  /**
   * Questions the visitor cannot yet submit: a required one left blank, or a
   * multi-choice one outside the bounds the admin set. Each carries the message
   * shown against that question.
   */
  const blockingQuestions = useMemo<[string, string][]>(
    () =>
      questions.flatMap<[string, string]>((question) => {
        const answer = answerFor(question.id)
        const chosen =
          answer.optionIds.length +
          (question.allowOther && answer.otherText.trim() !== '' ? 1 : 0)

        if (question.type === 'MULTI_CHOICE' && chosen > 0) {
          if (question.minSelections != null && chosen < question.minSelections) {
            return [[question.id, `Please choose at least ${question.minSelections}`]]
          }
          if (question.maxSelections != null && chosen > question.maxSelections) {
            return [[question.id, `Please choose no more than ${question.maxSelections}`]]
          }
        }

        if (!question.isRequired) return []

        const blank =
          question.type === 'SINGLE_CHOICE' || question.type === 'MULTI_CHOICE'
            ? chosen === 0
            : question.type === 'RATING'
              ? answer.rating == null
              : answer.textValue.trim() === ''

        return blank ? [[question.id, 'This one needs an answer']] : []
      }),
    // `answers` drives every branch above; `questions` is stable per poll.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [answers, questions]
  )

  async function submit(event: React.FormEvent) {
    event.preventDefault()
    setError(null)
    setFieldErrors({})

    if (firstName.trim() === '') {
      setError('Please add your first name so we know who to thank.')
      errorRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' })
      return
    }
    if (blockingQuestions.length > 0) {
      setFieldErrors(Object.fromEntries(blockingQuestions))
      setError('A couple of questions still need an answer.')
      errorRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' })
      return
    }
    if (!consentAcknowledged) {
      setError('Please tick the box to confirm you have read how your answers may be used.')
      errorRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' })
      return
    }

    setSubmitting(true)
    try {
      const response = await fetch(`/api/polls/${slug}/respond`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          firstName,
          lastName,
          email,
          anonymousRequested,
          consentAcknowledged,
          accessCode,
          website: honeypot,
          answers: questions.map((question) => {
            const answer = answerFor(question.id)
            return {
              questionId: question.id,
              optionIds: answer.optionIds,
              textValue: answer.textValue || null,
              otherText: answer.otherText || null,
              rating: answer.rating,
            }
          }),
        }),
      })

      const payload = await response.json().catch(() => ({}))
      if (!response.ok) {
        setError(payload.error ?? 'Something went wrong sending your answers. Please try again.')
        errorRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' })
        return
      }

      setResults(showResultsAfterVote ? (payload.results ?? null) : null)
      setDone(true)
      window.scrollTo({ top: 0, behavior: 'smooth' })
    } catch {
      setError('We could not reach the server. Please check your connection and try again.')
    } finally {
      setSubmitting(false)
    }
  }

  if (done) {
    return (
      <div className="space-y-8">
        <div className="rounded-2xl border border-verde-200 bg-verde-50 p-6 text-center sm:p-8">
          <PartyPopper className="mx-auto h-10 w-10 text-verde-700" aria-hidden />
          <h2 className="mt-3 font-serif text-2xl font-bold text-stone-900">
            Thank you, {firstName.trim()}!
          </h2>
          <p className="mx-auto mt-2 max-w-xl text-stone-700">
            {thankYouMessage ??
              'Your answers are in. We read every single one — thank you for helping shape what we make next.'}
          </p>
          {anonymousRequested && (
            <p className="mx-auto mt-4 inline-flex max-w-xl items-center gap-2 rounded-full bg-white px-4 py-2 text-sm text-stone-700">
              <ShieldCheck className="h-4 w-4 text-verde-700" aria-hidden />
              We have noted that you would like to stay anonymous.
            </p>
          )}
        </div>
        {results && <PollResults results={results} accent={accent} />}
      </div>
    )
  }

  return (
    <form onSubmit={submit} className="space-y-8" noValidate>
      {initialResults && initialResults.length > 0 && (
        <PollResults results={initialResults} accent={accent} heading="How it stands so far" />
      )}

      {questions.map((question, index) => (
        <fieldset
          key={question.id}
          className={`rounded-2xl border bg-white p-5 shadow-sm transition sm:p-6 ${
            fieldErrors[question.id] ? 'border-destructive' : 'border-stone-200'
          }`}
        >
          <legend className="sr-only">{question.prompt}</legend>

          <div className="flex items-start gap-3">
            <span
              className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-sm font-bold ${classes.pill}`}
              aria-hidden
            >
              {index + 1}
            </span>
            <div className="min-w-0 flex-1">
              <h2 className="text-lg font-semibold leading-snug text-stone-900" id={`q-${question.id}`}>
                {question.prompt}
                {question.isRequired && (
                  <span className="ml-1 text-destructive" aria-hidden>
                    *
                  </span>
                )}
              </h2>
              {question.helpText && (
                <p className="mt-1 text-sm leading-6 text-stone-600">{question.helpText}</p>
              )}
              {question.type === 'MULTI_CHOICE' && (
                <p className="mt-1 text-sm font-medium text-stone-500">
                  Select as many as apply to you
                  {question.maxSelections != null ? ` (up to ${question.maxSelections})` : ''}.
                </p>
              )}
            </div>
          </div>

          {question.imageUrl && (
            <div className="relative mt-4 aspect-[16/9] w-full overflow-hidden rounded-xl bg-stone-100">
              <Image
                src={question.imageUrl}
                alt={question.imageAlt ?? ''}
                fill
                sizes="(max-width: 768px) 100vw, 720px"
                className="object-cover"
              />
            </div>
          )}

          <div className="mt-4">
            {(question.type === 'SINGLE_CHOICE' || question.type === 'MULTI_CHOICE') && (
              <div
                role={question.type === 'SINGLE_CHOICE' ? 'radiogroup' : 'group'}
                aria-labelledby={`q-${question.id}`}
                className="flex flex-wrap gap-3"
              >
                {question.options.map((option) => {
                  const selected = answerFor(question.id).optionIds.includes(option.id)
                  return (
                    <label
                      key={option.id}
                      className={`group inline-flex min-h-[3rem] cursor-pointer items-center gap-3 rounded-full border-2 px-4 py-2.5 text-base transition duration-200 active:scale-[0.98] has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-offset-2 motion-reduce:transition-none motion-reduce:active:scale-100 ${
                        selected
                          ? `${classes.pill} ${classes.border} shadow-md`
                          : 'border-stone-200 bg-white text-stone-800 hover:border-stone-400 hover:bg-stone-50'
                      }`}
                    >
                      <input
                        type={question.type === 'SINGLE_CHOICE' ? 'radio' : 'checkbox'}
                        name={`question-${question.id}`}
                        className="sr-only"
                        checked={selected}
                        onChange={() => toggleOption(question, option.id)}
                      />
                      <span
                        className={`flex h-5 w-5 shrink-0 items-center justify-center border-2 transition ${
                          question.type === 'SINGLE_CHOICE' ? 'rounded-full' : 'rounded-md'
                        } ${selected ? 'border-white bg-white/25' : 'border-stone-300'}`}
                        aria-hidden
                      >
                        {selected && <Check className="h-3.5 w-3.5" strokeWidth={3} />}
                      </span>
                      {option.imageUrl && (
                        <span className="relative h-9 w-9 shrink-0 overflow-hidden rounded-full bg-stone-100">
                          <Image src={option.imageUrl} alt="" fill sizes="36px" className="object-cover" />
                        </span>
                      )}
                      <span className="text-left">
                        {option.emoji && <span className="mr-1.5">{option.emoji}</span>}
                        {option.label}
                        {option.description && (
                          <span
                            className={`block text-xs ${selected ? 'text-white/80' : 'text-stone-500'}`}
                          >
                            {option.description}
                          </span>
                        )}
                      </span>
                    </label>
                  )
                })}
              </div>
            )}

            {question.type === 'RATING' && (
              <div role="radiogroup" aria-labelledby={`q-${question.id}`} className="flex flex-wrap gap-2">
                {Array.from({ length: question.ratingMax }, (_, i) => i + 1).map((value) => {
                  const selected = answerFor(question.id).rating === value
                  return (
                    <label
                      key={value}
                      className={`inline-flex h-12 w-12 cursor-pointer items-center justify-center rounded-full border-2 text-base font-bold transition duration-200 active:scale-95 has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-offset-2 motion-reduce:transition-none motion-reduce:active:scale-100 ${
                        selected
                          ? `${classes.pill} ${classes.border} shadow-md`
                          : 'border-stone-200 bg-white text-stone-800 hover:border-stone-400 hover:bg-stone-50'
                      }`}
                    >
                      <input
                        type="radio"
                        name={`question-${question.id}`}
                        className="sr-only"
                        checked={selected}
                        onChange={() => update(question.id, { rating: selected ? null : value })}
                      />
                      {selected ? <Star className="h-5 w-5 fill-current" aria-hidden /> : value}
                      <span className="sr-only">
                        {value} out of {question.ratingMax}
                      </span>
                    </label>
                  )
                })}
              </div>
            )}

            {question.type === 'SHORT_TEXT' && (
              <Input
                aria-labelledby={`q-${question.id}`}
                value={answerFor(question.id).textValue}
                maxLength={question.maxLength}
                placeholder={question.placeholder ?? 'Type your answer'}
                onChange={(event) => update(question.id, { textValue: event.target.value })}
                className="h-12 text-base"
              />
            )}

            {question.type === 'LONG_TEXT' && (
              <div>
                <Textarea
                  aria-labelledby={`q-${question.id}`}
                  value={answerFor(question.id).textValue}
                  maxLength={question.maxLength}
                  rows={5}
                  placeholder={question.placeholder ?? 'Tell us as much or as little as you like'}
                  onChange={(event) => update(question.id, { textValue: event.target.value })}
                  className="text-base leading-6"
                />
                <CharacterCount
                  used={answerFor(question.id).textValue.length}
                  max={question.maxLength}
                />
              </div>
            )}

            {question.allowOther &&
              (question.type === 'SINGLE_CHOICE' || question.type === 'MULTI_CHOICE') && (
              <div className="mt-3">
                <label className="text-sm font-medium text-stone-700" htmlFor={`other-${question.id}`}>
                  Something else? Tell us here
                </label>
                <Input
                  id={`other-${question.id}`}
                  value={answerFor(question.id).otherText}
                  maxLength={question.maxLength}
                  placeholder="Your own answer"
                  onChange={(event) => update(question.id, { otherText: event.target.value })}
                  className="mt-1 h-12 text-base"
                />
              </div>
            )}
          </div>

          {fieldErrors[question.id] && (
            <p className="mt-3 flex items-center gap-2 text-sm font-medium text-destructive">
              <AlertCircle className="h-4 w-4" aria-hidden />
              {fieldErrors[question.id]}
            </p>
          )}
        </fieldset>
      ))}

      <div className="rounded-2xl border border-stone-200 bg-white p-5 shadow-sm sm:p-6">
        <h2 className="font-serif text-xl font-bold text-stone-900">Just your name, and you are done</h2>
        <p className="mt-1 text-sm leading-6 text-stone-600">
          A first name is all we need. A last name is welcome but completely optional.
        </p>

        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <div>
            <label className="text-sm font-medium text-stone-700" htmlFor="poll-first-name">
              First name <span className="text-destructive">*</span>
            </label>
            <Input
              id="poll-first-name"
              value={firstName}
              onChange={(event) => setFirstName(event.target.value)}
              placeholder={FIRST_NAME_PLACEHOLDER}
              autoComplete="given-name"
              maxLength={MAX_NAME_LENGTH}
              required
              className="mt-1 h-12 text-base"
            />
          </div>
          <div>
            <label className="text-sm font-medium text-stone-700" htmlFor="poll-last-name">
              Last name <span className="text-stone-400">(optional)</span>
            </label>
            <Input
              id="poll-last-name"
              value={lastName}
              onChange={(event) => setLastName(event.target.value)}
              placeholder={LAST_NAME_PLACEHOLDER}
              autoComplete="family-name"
              maxLength={MAX_NAME_LENGTH}
              className="mt-1 h-12 text-base"
            />
          </div>
          {collectEmail && (
            <div className="sm:col-span-2">
              <label className="text-sm font-medium text-stone-700" htmlFor="poll-email">
                Email <span className="text-stone-400">(optional — only if you want a reply)</span>
              </label>
              <Input
                id="poll-email"
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder="you@example.com"
                autoComplete="email"
                className="mt-1 h-12 text-base"
              />
            </div>
          )}
        </div>

        {/* Honeypot: hidden from people, irresistible to bots. */}
        <div className="hidden" aria-hidden>
          <label htmlFor="poll-website">Website</label>
          <input
            id="poll-website"
            name="website"
            tabIndex={-1}
            autoComplete="off"
            value={honeypot}
            onChange={(event) => setHoneypot(event.target.value)}
          />
        </div>

        <div className="mt-6 rounded-xl bg-stone-50 p-4 text-sm leading-6 text-stone-700">
          <p>{consentNotice}</p>
        </div>

        <button
          type="button"
          onClick={() => setAnonymousRequested((current) => !current)}
          aria-pressed={anonymousRequested}
          className={`mt-4 inline-flex min-h-[3rem] w-full items-center justify-center gap-3 rounded-full border-2 px-5 py-3 text-base font-semibold transition duration-200 active:scale-[0.99] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 motion-reduce:transition-none motion-reduce:active:scale-100 sm:w-auto ${
            anonymousRequested
              ? `${classes.pill} ${classes.border} shadow-md`
              : 'border-stone-300 bg-white text-stone-800 hover:border-stone-500 hover:bg-stone-50'
          }`}
        >
          <ShieldCheck className="h-5 w-5" aria-hidden />
          {ANONYMOUS_REQUEST_LABEL}
          {anonymousRequested && <Check className="h-5 w-5" strokeWidth={3} aria-hidden />}
        </button>
        <p className="mt-2 text-sm text-stone-500">{ANONYMOUS_REQUEST_HELP}</p>

        <label className="mt-5 flex cursor-pointer items-start gap-3 text-sm leading-6 text-stone-700">
          <input
            type="checkbox"
            checked={consentAcknowledged}
            onChange={(event) => setConsentAcknowledged(event.target.checked)}
            className="mt-1 h-5 w-5 shrink-0 rounded border-stone-300 accent-salsa-700"
          />
          <span>
            I have read the note above and understand my answers may be shared publicly or used
            internally. <span className="text-destructive">*</span>
          </span>
        </label>

        <div ref={errorRef}>
          {error && (
            <p
              role="alert"
              className="mt-4 flex items-start gap-2 rounded-xl bg-destructive/10 p-3 text-sm font-medium text-destructive"
            >
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
              {error}
            </p>
          )}
        </div>

        <Button
          type="submit"
          size="lg"
          disabled={submitting}
          className="mt-5 h-14 w-full rounded-full text-base font-bold sm:w-auto sm:px-10"
        >
          {submitting ? (
            <>
              <Loader2 className="mr-2 h-5 w-5 animate-spin" aria-hidden />
              Sending your answers…
            </>
          ) : (
            <>
              <Send className="mr-2 h-5 w-5" aria-hidden />
              Submit my answers
            </>
          )}
        </Button>
      </div>
    </form>
  )
}

/** Live character budget under a long answer, warning before the cap bites. */
function CharacterCount({ used, max }: { used: number; max: number }) {
  const remaining = max - used
  const tight = remaining <= 100
  return (
    <p
      className={`mt-1 text-right text-xs tabular-nums ${tight ? 'font-semibold text-amber-700' : 'text-stone-500'}`}
      aria-live="polite"
    >
      {remaining} characters left of {max}
    </p>
  )
}
