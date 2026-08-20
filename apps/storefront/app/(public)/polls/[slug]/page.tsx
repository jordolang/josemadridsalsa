import Image from 'next/image'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import type { Metadata } from 'next'
import { ArrowLeft, CalendarClock, Lock, Users } from 'lucide-react'
import { createMetadata } from '@/lib/metadata'
import { accentClasses, DEFAULT_CONSENT_NOTICE } from '@/lib/polls/constants'
import { canViewPoll, getPollBySlug, getPollResults, pollWindowState } from '@/lib/polls/queries'
import { PollForm } from '@/components/polls/poll-form'
import { PollResults } from '@/components/polls/poll-results'
import { PollShare } from '@/components/polls/poll-share'

export const dynamic = 'force-dynamic'

type PageProps = {
  params: Promise<{ slug: string }>
  searchParams: Promise<{ key?: string }>
}

export async function generateMetadata({ params, searchParams }: PageProps): Promise<Metadata> {
  const { slug } = await params
  const { key } = await searchParams
  const poll = await getPollBySlug(slug)

  if (!poll || !canViewPoll(poll, key)) {
    return createMetadata({
      title: 'Poll not found | Jose Madrid Salsa',
      description: 'This poll is not available.',
      pathname: `/polls/${slug}`,
    })
  }

  // Invite-only polls are shared by link, never crawled: the code in the URL
  // is the whole access control, so an indexed copy of it would undo it.
  const hidden = poll.noIndex || poll.visibility === 'INVITE_ONLY'

  return {
    ...createMetadata({
      title: poll.seoTitle ?? `${poll.title} | Jose Madrid Salsa`,
      description:
        poll.seoDescription ??
        poll.subtitle ??
        `Share your answer: ${poll.title}. A one-minute poll from Jose Madrid Salsa.`,
      pathname: `/polls/${poll.slug}`,
    }),
    ...(hidden ? { robots: { index: false, follow: false } } : {}),
  }
}

export default async function PollPage({ params, searchParams }: PageProps) {
  const { slug } = await params
  const { key } = await searchParams
  const poll = await getPollBySlug(slug)

  if (!poll || !canViewPoll(poll, key)) {
    notFound()
  }

  const accent = accentClasses(poll.accentColor)
  const state = pollWindowState(poll)
  const showResultsNow = poll.resultsVisibility === 'ALWAYS' || state !== 'OPEN'
  const results = poll.resultsVisibility === 'HIDDEN' ? [] : showResultsNow ? await getPollResults(poll.id) : []

  return (
    <main className="bg-stone-50 pb-16">
      <section className={`relative overflow-hidden bg-gradient-to-br ${accent.gradient} text-white`}>
        {poll.imageUrl && (
          <Image
            src={poll.imageUrl}
            alt=""
            fill
            priority
            sizes="100vw"
            className="object-cover opacity-30"
          />
        )}
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_18%_16%,rgba(255,255,255,0.26),transparent_34%)]" />
        <div className="relative mx-auto max-w-4xl px-4 py-12 sm:px-6 sm:py-16">
          <Link
            href="/polls"
            className="inline-flex items-center gap-2 text-sm font-semibold uppercase tracking-[0.16em] text-white/85 transition hover:text-white"
          >
            <ArrowLeft className="h-4 w-4" aria-hidden />
            All polls
          </Link>

          <div className="mt-5 flex flex-wrap items-center gap-2">
            {poll.visibility === 'INVITE_ONLY' && (
              <span className="inline-flex items-center gap-1.5 rounded-full border border-white/40 bg-white/15 px-3 py-1 text-xs font-bold uppercase tracking-[0.16em] backdrop-blur">
                <Lock className="h-3 w-3" aria-hidden />
                Invite only
              </span>
            )}
            <span className="inline-flex items-center gap-1.5 rounded-full border border-white/40 bg-white/15 px-3 py-1 text-xs font-bold uppercase tracking-[0.16em] backdrop-blur">
              <Users className="h-3 w-3" aria-hidden />
              {poll.responseCount} so far
            </span>
            {poll.endsAt && state === 'OPEN' && (
              <span className="inline-flex items-center gap-1.5 rounded-full border border-white/40 bg-white/15 px-3 py-1 text-xs font-bold uppercase tracking-[0.16em] backdrop-blur">
                <CalendarClock className="h-3 w-3" aria-hidden />
                Open until {poll.endsAt.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
              </span>
            )}
          </div>

          <h1 className="mt-4 font-serif text-3xl font-bold leading-tight tracking-tight sm:text-5xl">
            {poll.title}
          </h1>
          {poll.subtitle && (
            <p className="mt-3 max-w-2xl text-lg leading-8 text-white/90">{poll.subtitle}</p>
          )}

          <div className="mt-6">
            <PollShare title={poll.title} />
          </div>
        </div>
      </section>

      <div className="mx-auto max-w-3xl px-4 py-10 sm:px-6 sm:py-12">
        {poll.imageUrl && (
          <div className="relative mb-8 aspect-[16/9] w-full overflow-hidden rounded-2xl border border-stone-200 bg-stone-100 shadow-sm">
            <Image
              src={poll.imageUrl}
              alt={poll.imageAlt ?? poll.title}
              fill
              sizes="(max-width: 768px) 100vw, 768px"
              className="object-cover"
            />
          </div>
        )}

        {poll.description && (
          <div className="mb-8 whitespace-pre-line text-lg leading-8 text-stone-700">
            {poll.description}
          </div>
        )}

        {state === 'OPEN' ? (
          <PollForm
            slug={poll.slug}
            accent={poll.accentColor}
            collectEmail={poll.collectEmail}
            consentNotice={poll.consentNotice ?? DEFAULT_CONSENT_NOTICE}
            thankYouMessage={poll.thankYouMessage}
            accessCode={key}
            showResultsAfterVote={poll.resultsVisibility !== 'HIDDEN'}
            initialResults={poll.resultsVisibility === 'ALWAYS' ? results : undefined}
            questions={poll.questions.map((question) => ({
              id: question.id,
              type: question.type,
              prompt: question.prompt,
              helpText: question.helpText,
              imageUrl: question.imageUrl,
              imageAlt: question.imageAlt,
              isRequired: question.isRequired,
              maxLength: question.maxLength,
              placeholder: question.placeholder,
              minSelections: question.minSelections,
              maxSelections: question.maxSelections,
              allowOther: question.allowOther,
              ratingMax: question.ratingMax,
              options: question.options.map((option) => ({
                id: option.id,
                label: option.label,
                description: option.description,
                imageUrl: option.imageUrl,
                emoji: option.emoji,
              })),
            }))}
          />
        ) : (
          <div className="rounded-2xl border border-stone-200 bg-white p-6 text-center sm:p-8">
            <h2 className="font-serif text-2xl font-bold text-stone-900">
              {state === 'NOT_STARTED' ? 'This poll opens soon' : 'This poll has closed'}
            </h2>
            <p className="mx-auto mt-2 max-w-xl text-stone-600">
              {poll.closedMessage ??
                (state === 'NOT_STARTED'
                  ? 'Come back when it opens — we would love to hear from you.'
                  : 'Thank you to everyone who took part. Here is where things landed.')}
            </p>
          </div>
        )}

        {state !== 'OPEN' && results.length > 0 && (
          <div className="mt-12">
            <PollResults results={results} accent={poll.accentColor} />
          </div>
        )}
      </div>
    </main>
  )
}
