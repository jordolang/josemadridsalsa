import Image from 'next/image'
import Link from 'next/link'
import { ArrowRight, Lock, MessageSquare, Users } from 'lucide-react'
import { accentClasses } from '@/lib/polls/constants'
import type { PollCard as PollCardData } from '@/lib/polls/queries'

/**
 * One poll on the index.
 *
 * The image sits in a fixed 16:10 frame and is cropped to fill it, so a
 * portrait phone photo and a wide banner both land as the same tidy card. A
 * poll with no image gets the accent gradient instead — an image is optional,
 * never a hole in the layout.
 */
export function PollCard({ poll }: { poll: PollCardData }) {
  const accent = accentClasses(poll.accentColor)
  const isPrivate = poll.visibility === 'INVITE_ONLY'

  return (
    <Link
      href={`/polls/${poll.slug}`}
      className="group flex h-full flex-col overflow-hidden rounded-2xl border border-stone-200 bg-white shadow-sm transition duration-300 hover:-translate-y-1 hover:border-stone-300 hover:shadow-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-salsa-600 focus-visible:ring-offset-2 motion-reduce:transition-none motion-reduce:hover:translate-y-0"
    >
      <div className={`relative aspect-[16/10] w-full overflow-hidden bg-gradient-to-br ${accent.gradient}`}>
        {poll.imageUrl && (
          <Image
            src={poll.imageUrl}
            alt={poll.imageAlt ?? ''}
            fill
            sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
            className="object-cover transition duration-500 group-hover:scale-105 motion-reduce:transition-none motion-reduce:group-hover:scale-100"
          />
        )}
        <div className="absolute inset-x-0 bottom-0 h-2/3 bg-gradient-to-t from-black/55 to-transparent" />
        <div className="absolute left-4 top-4 flex flex-wrap gap-2">
          {poll.featured && (
            <span className="rounded-full bg-white/90 px-3 py-1 text-[11px] font-bold uppercase tracking-[0.16em] text-stone-800 backdrop-blur">
              Featured
            </span>
          )}
          {isPrivate && (
            <span className="inline-flex items-center gap-1 rounded-full bg-white/90 px-3 py-1 text-[11px] font-bold uppercase tracking-[0.16em] text-stone-800 backdrop-blur">
              <Lock className="h-3 w-3" aria-hidden />
              Invite only
            </span>
          )}
        </div>
      </div>

      <div className="flex flex-1 flex-col gap-3 p-5 sm:p-6">
        <h2 className="font-serif text-xl font-bold leading-snug text-stone-900 sm:text-2xl">
          {poll.title}
        </h2>
        {poll.subtitle && <p className="text-sm leading-6 text-stone-600">{poll.subtitle}</p>}

        <div className="mt-auto flex flex-wrap items-center gap-x-4 gap-y-2 pt-2 text-sm text-stone-500">
          <span className="inline-flex items-center gap-1.5">
            <MessageSquare className="h-4 w-4" aria-hidden />
            {poll._count.questions} {poll._count.questions === 1 ? 'question' : 'questions'}
          </span>
          <span className="inline-flex items-center gap-1.5">
            <Users className="h-4 w-4" aria-hidden />
            {poll.responseCount} {poll.responseCount === 1 ? 'response' : 'responses'}
          </span>
        </div>

        <span
          className={`inline-flex items-center gap-2 text-sm font-bold uppercase tracking-[0.14em] ${accent.text}`}
        >
          Take the poll
          <ArrowRight className="h-4 w-4 transition-transform duration-300 group-hover:translate-x-1 motion-reduce:transition-none motion-reduce:group-hover:translate-x-0" aria-hidden />
        </span>
      </div>
    </Link>
  )
}
