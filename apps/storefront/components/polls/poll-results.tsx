import { BarChart3, Quote, Star } from 'lucide-react'
import { accentClasses } from '@/lib/polls/constants'
import type { PollQuestionResult } from '@/lib/polls/queries'

/**
 * Read-only tallies for a poll.
 *
 * Rendered on the server when results are always public, and by the form after
 * a visitor votes. Names come from `displayName`, which already honours an
 * anonymity request, so nothing here needs to decide that again.
 */
export function PollResults({
  results,
  accent,
  heading = 'What everyone said',
}: {
  results: PollQuestionResult[]
  accent?: string | null
  heading?: string
}) {
  const classes = accentClasses(accent)
  const withData = results.filter((result) => result.answerCount > 0)

  if (withData.length === 0) {
    return (
      <p className="rounded-2xl border border-dashed border-stone-300 bg-stone-50 p-6 text-center text-sm text-stone-600">
        No answers yet — yours could be the first.
      </p>
    )
  }

  return (
    <section className="space-y-6" aria-label={heading}>
      <h2 className="flex items-center gap-2 font-serif text-2xl font-bold text-stone-900">
        <BarChart3 className={`h-5 w-5 ${classes.text}`} aria-hidden />
        {heading}
      </h2>

      {withData.map((result) => (
        <div key={result.questionId} className="rounded-2xl border border-stone-200 bg-white p-5 sm:p-6">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h3 className="font-semibold text-stone-900">{result.prompt}</h3>
            <span className="text-sm text-stone-500">
              {result.answerCount} {result.answerCount === 1 ? 'answer' : 'answers'}
            </span>
          </div>

          {result.averageRating != null && (
            <p className={`mt-3 inline-flex items-center gap-2 text-lg font-bold ${classes.text}`}>
              <Star className="h-5 w-5 fill-current" aria-hidden />
              {result.averageRating} average
            </p>
          )}

          {result.options.length > 0 && (
            <ul className="mt-4 space-y-3">
              {result.options.map((option) => (
                <li key={option.optionId}>
                  <div className="flex items-baseline justify-between gap-3 text-sm">
                    <span className="font-medium text-stone-800">
                      {option.emoji && <span className="mr-1.5">{option.emoji}</span>}
                      {option.label}
                    </span>
                    <span className="shrink-0 tabular-nums text-stone-600">
                      {option.percent}% ({option.count})
                    </span>
                  </div>
                  <div className="mt-1.5 h-2.5 overflow-hidden rounded-full bg-stone-100">
                    <div
                      className={`h-full rounded-full ${classes.bar} transition-[width] duration-700 ease-out motion-reduce:transition-none`}
                      style={{ width: `${Math.max(option.percent, option.count > 0 ? 2 : 0)}%` }}
                    />
                  </div>
                </li>
              ))}
            </ul>
          )}

          {result.comments.length > 0 && (
            <ul className="mt-5 space-y-3 border-t border-stone-100 pt-4">
              {result.comments.map((comment, index) => (
                <li key={`${result.questionId}-${index}`} className="rounded-xl bg-stone-50 p-4">
                  <Quote className="h-4 w-4 text-stone-400" aria-hidden />
                  <p className="mt-1 whitespace-pre-line text-sm leading-6 text-stone-700">
                    {comment.text}
                  </p>
                  <p className="mt-2 text-xs font-semibold uppercase tracking-wide text-stone-500">
                    — {comment.name}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </div>
      ))}
    </section>
  )
}
