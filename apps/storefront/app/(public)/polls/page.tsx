import type { Metadata } from 'next'
import { MessageCircleHeart, ShieldCheck, Sparkles } from 'lucide-react'
import { createMetadata } from '@/lib/metadata'
import { getListedPolls } from '@/lib/polls/queries'
import { PollCard } from '@/components/polls/poll-card'

export const revalidate = 300

export const metadata: Metadata = createMetadata({
  title: 'Community Polls | Jose Madrid Salsa',
  description:
    'Tell us what you think. Quick polls on flavours, recipes and everything else we make — your answers shape what comes next.',
  pathname: '/polls',
  keywords: ['Jose Madrid Salsa polls', 'salsa survey', 'customer feedback', 'vote on flavors'],
})

export default async function PollsIndexPage() {
  const polls = await getListedPolls()

  return (
    <main className="bg-stone-50">
      <section className="relative overflow-hidden bg-gradient-to-br from-salsa-800 via-salsa-700 to-amber-600 text-white">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_18%,rgba(255,255,255,0.28),transparent_32%)]" />
        <div className="relative mx-auto max-w-5xl px-4 py-16 text-center sm:px-6 sm:py-20">
          <span className="inline-flex items-center gap-2 rounded-full border border-white/40 bg-white/15 px-4 py-1.5 text-xs font-bold uppercase tracking-[0.2em] backdrop-blur">
            <Sparkles className="h-3.5 w-3.5" aria-hidden />
            Have your say
          </span>
          <h1 className="mt-5 font-serif text-4xl font-bold tracking-tight sm:text-5xl">
            Community Polls
          </h1>
          <p className="mx-auto mt-4 max-w-2xl text-lg leading-8 text-white/90">
            Pick an answer, tick every option that fits, or write us a paragraph — whatever suits the
            question. It takes a minute, no account needed, and every answer is read by the people who
            actually make the salsa.
          </p>
        </div>
      </section>

      <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6 sm:py-16">
        <div className="mb-10 flex flex-col gap-4 rounded-2xl border border-stone-200 bg-white p-5 text-sm leading-6 text-stone-700 sm:flex-row sm:items-start sm:p-6">
          <ShieldCheck className="h-6 w-6 shrink-0 text-verde-700" aria-hidden />
          <p>
            <span className="font-semibold text-stone-900">Thank you for taking part.</span> Your
            participation is genuinely appreciated. Please keep in mind that the answers you give may
            be used in our promotional material or internally, which means they can be seen by people
            who may not share your opinions or feelings. Every poll lets you ask to be kept anonymous
            before you send it, and a first name alone is always enough.
          </p>
        </div>

        {polls.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-stone-300 bg-white p-12 text-center">
            <MessageCircleHeart className="mx-auto h-10 w-10 text-stone-400" aria-hidden />
            <h2 className="mt-4 font-serif text-2xl font-bold text-stone-900">
              No polls open right now
            </h2>
            <p className="mx-auto mt-2 max-w-md text-stone-600">
              We run these whenever we have a real question to ask. Check back soon — the next one is
              never far off.
            </p>
          </div>
        ) : (
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {polls.map((poll) => (
              <PollCard key={poll.id} poll={poll} />
            ))}
          </div>
        )}
      </div>
    </main>
  )
}
