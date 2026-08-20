import { cache } from 'react'
import type { Prisma } from '@prisma/client'
import prisma from '@/lib/prisma'
import { isMissingTableError } from '@/lib/prisma-errors'

/**
 * Public read helpers for community polls.
 *
 * These run on the storefront, so — like the CMS queries — they never throw:
 * a polls table that has not been migrated yet degrades to "no polls", which
 * renders the empty state instead of a 500.
 */

export const pollCardSelect = {
  id: true,
  slug: true,
  title: true,
  subtitle: true,
  description: true,
  imageUrl: true,
  imageAlt: true,
  accentColor: true,
  featured: true,
  visibility: true,
  status: true,
  startsAt: true,
  endsAt: true,
  publishedAt: true,
  responseCount: true,
  updatedAt: true,
  _count: { select: { questions: true } },
} satisfies Prisma.PollSelect

export type PollCard = Prisma.PollGetPayload<{ select: typeof pollCardSelect }>

export const pollDetailInclude = {
  questions: {
    orderBy: { sortOrder: 'asc' },
    include: { options: { orderBy: { sortOrder: 'asc' } } },
  },
} satisfies Prisma.PollInclude

export type PollDetail = Prisma.PollGetPayload<{ include: typeof pollDetailInclude }>

/**
 * Whether a poll's status means "live".
 *
 * SCHEDULED counts once its publication time has passed, matching how the rest
 * of the CMS treats scheduled content — nothing flips the row to PUBLISHED, so
 * without this a scheduled poll would never appear.
 */
export function isPollPublished(
  poll: { status: string; publishedAt?: Date | null },
  now: Date = new Date()
): boolean {
  if (poll.status === 'PUBLISHED') return true
  return poll.status === 'SCHEDULED' && poll.publishedAt != null && poll.publishedAt <= now
}

/** Prisma equivalent of `isPollPublished`, for use in a `where`. */
export function publishedPollFilter(now: Date = new Date()): Prisma.PollWhereInput {
  return {
    OR: [{ status: 'PUBLISHED' }, { status: 'SCHEDULED', publishedAt: { lte: now } }],
  }
}

/** Polls anyone may see listed: live, public, not archived. */
export function listablePollFilter(now: Date = new Date()): Prisma.PollWhereInput {
  return { visibility: 'PUBLIC', ...publishedPollFilter(now) }
}

/** The live polls shown on /polls, featured first. */
export const getListedPolls = cache(async (): Promise<PollCard[]> => {
  try {
    return await prisma.poll.findMany({
      where: listablePollFilter(),
      orderBy: [{ featured: 'desc' }, { sortOrder: 'asc' }, { publishedAt: 'desc' }, { createdAt: 'desc' }],
      select: pollCardSelect,
    })
  } catch (error) {
    if (!isMissingTableError(error)) {
      console.error('[polls] failed to load listed polls:', error)
    }
    return []
  }
})

/** One poll with its questions and options, whatever its status. */
export const getPollBySlug = cache(async (slug: string): Promise<PollDetail | null> => {
  try {
    return await prisma.poll.findUnique({ where: { slug }, include: pollDetailInclude })
  } catch (error) {
    if (!isMissingTableError(error)) {
      console.error('[polls] failed to load poll:', error)
    }
    return null
  }
})

export type PollWindowState = 'OPEN' | 'NOT_STARTED' | 'CLOSED' | 'UNPUBLISHED'

/** Whether a poll is currently accepting answers, and why not when it isn't. */
export function pollWindowState(
  poll: Pick<PollDetail, 'status' | 'startsAt' | 'endsAt'> & { publishedAt?: Date | null },
  now: Date = new Date()
): PollWindowState {
  if (!isPollPublished(poll, now)) return 'UNPUBLISHED'
  if (poll.startsAt && poll.startsAt > now) return 'NOT_STARTED'
  if (poll.endsAt && poll.endsAt <= now) return 'CLOSED'
  return 'OPEN'
}

/**
 * Whether this visitor may open the poll page at all.
 *
 * A public poll is open to everyone — signed in, signed out, or arrived by
 * accident. An invite-only poll needs the access code from its share link;
 * without it the page 404s rather than confirming the poll exists.
 */
export function canViewPoll(
  poll: Pick<PollDetail, 'status' | 'visibility' | 'accessCode'> & { publishedAt?: Date | null },
  suppliedCode?: string | null,
  now: Date = new Date()
): boolean {
  if (!isPollPublished(poll, now)) return false
  if (poll.visibility === 'PUBLIC') return true
  if (!poll.accessCode) return false
  return suppliedCode === poll.accessCode
}

export interface PollOptionTally {
  optionId: string
  label: string
  emoji: string | null
  count: number
  /** Share of the votes cast on this question, 0–100, rounded to one decimal. */
  percent: number
}

export interface PollQuestionResult {
  questionId: string
  prompt: string
  type: PollDetail['questions'][number]['type']
  /** Responses that answered this question at all. */
  answerCount: number
  options: PollOptionTally[]
  /** Mean rating for RATING questions, else null. */
  averageRating: number | null
  /** Written answers, newest first, from people who did not ask to stay anonymous. */
  comments: { text: string; name: string; submittedAt: Date }[]
}

const MAX_PUBLIC_COMMENTS = 12

/**
 * Tally a poll's answers for display.
 *
 * Comments carry the display name a response earned: someone who asked to stay
 * anonymous is shown as "Anonymous" here as well as in promotional use, so the
 * public page never contradicts the promise the form made.
 */
export async function getPollResults(pollId: string): Promise<PollQuestionResult[]> {
  try {
    const questions = await prisma.pollQuestion.findMany({
      where: { pollId },
      orderBy: { sortOrder: 'asc' },
      include: {
        options: { orderBy: { sortOrder: 'asc' } },
        answers: {
          orderBy: { createdAt: 'desc' },
          include: {
            response: { select: { firstName: true, lastName: true, anonymousRequested: true } },
          },
        },
      },
    })

    return questions.map((question) => {
      const counts = new Map<string, number>()
      let answered = 0
      let ratingTotal = 0
      let ratingCount = 0
      const comments: PollQuestionResult['comments'] = []

      const liveOptionIds = new Set(question.options.map((option) => option.id))
      let otherVotes = 0

      for (const answer of question.answers) {
        // Ignore ids for options the editor has since removed, and count a
        // repeated id once: both would otherwise inflate the denominator and
        // make the percentages lie.
        const chosen = Array.from(new Set(answer.optionIds)).filter((id) => liveOptionIds.has(id))
        // A question retyped away from RATING keeps its old rating values; they
        // are not an average of anything the question now asks.
        const rating = question.type === 'RATING' ? answer.rating : null

        const hasText = Boolean(answer.textValue?.trim() || answer.otherText?.trim())
        if (chosen.length === 0 && !hasText && rating == null) continue
        answered += 1

        for (const optionId of chosen) {
          counts.set(optionId, (counts.get(optionId) ?? 0) + 1)
        }
        if (rating != null) {
          ratingTotal += rating
          ratingCount += 1
        }
        if (answer.otherText?.trim()) otherVotes += 1

        const text = answer.textValue?.trim() || answer.otherText?.trim()
        // Someone who asked to stay anonymous was promised we would take their
        // name and contact details out before their words appeared publicly.
        // Their answer could name themselves inside the text, and no automatic
        // redaction is reliable, so their words are kept for staff to quote
        // deliberately rather than published here. Their votes still count.
        if (text && !answer.response.anonymousRequested && comments.length < MAX_PUBLIC_COMMENTS) {
          comments.push({
            text,
            name: displayName(answer.response),
            submittedAt: answer.createdAt,
          })
        }
      }

      // "Something else" answers are votes too: leaving them out of the
      // denominator would show one option as 100% when half the room picked
      // something the poll did not list.
      const votesCast =
        Array.from(counts.values()).reduce((sum, count) => sum + count, 0) + otherVotes

      return {
        questionId: question.id,
        prompt: question.prompt,
        type: question.type,
        answerCount: answered,
        averageRating: ratingCount > 0 ? Math.round((ratingTotal / ratingCount) * 10) / 10 : null,
        options: [
          ...question.options.map((option) => ({
            optionId: option.id,
            label: option.label,
            emoji: option.emoji,
            count: counts.get(option.id) ?? 0,
          })),
          ...(otherVotes > 0
            ? [{ optionId: 'other', label: 'Something else', emoji: null, count: otherVotes }]
            : []),
        ].map((option) => ({
          ...option,
          percent: votesCast > 0 ? Math.round((option.count / votesCast) * 1000) / 10 : 0,
        })),
        comments,
      }
    })
  } catch (error) {
    if (!isMissingTableError(error)) {
      console.error('[polls] failed to tally results:', error)
    }
    return []
  }
}

/**
 * How a respondent is credited anywhere their words are shown.
 *
 * Anonymous requests win over everything else; otherwise it is the first name
 * plus a last initial, never the full surname, because the form only warned
 * people about the name they typed being visible — not about it being indexed.
 */
export function displayName(response: {
  firstName: string
  lastName: string | null
  anonymousRequested: boolean
}): string {
  if (response.anonymousRequested) return 'Anonymous'
  const initial = response.lastName?.trim()?.charAt(0)
  return initial ? `${response.firstName} ${initial}.` : response.firstName
}
