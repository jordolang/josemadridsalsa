import { randomBytes } from 'crypto'
import { ZodError } from 'zod'
import prisma from '@/lib/prisma'
import type { PollQuestionInput } from './schemas'

/**
 * Write helpers behind the admin poll endpoints. Kept out of the route
 * handlers so the question-tree reconciliation can be tested on its own.
 */

/** A share secret for an invite-only poll: URL-safe, unguessable, short enough to paste. */
export function generateAccessCode(): string {
  return randomBytes(12).toString('base64url')
}

/**
 * Replace a poll's question tree with `questions`.
 *
 * Questions and options the editor still knows about are updated in place so
 * their ids — and therefore the answers already recorded against them —
 * survive. Anything the editor dropped is deleted, which cascades to its
 * answers: removing a question from a live poll does discard the answers to
 * it, and the admin UI says so before saving.
 */
export async function savePollQuestions(
  pollId: string,
  questions: PollQuestionInput[]
): Promise<void> {
  const existing = await prisma.pollQuestion.findMany({
    where: { pollId },
    select: { id: true, options: { select: { id: true } } },
  })

  const keptQuestionIds = new Set(
    questions.map((question) => question.id).filter((id): id is string => Boolean(id))
  )
  const removedQuestionIds = existing
    .filter((question) => !keptQuestionIds.has(question.id))
    .map((question) => question.id)

  await prisma.$transaction(async (tx) => {
    if (removedQuestionIds.length > 0) {
      await tx.pollQuestion.deleteMany({ where: { id: { in: removedQuestionIds } } })
    }

    for (const [index, question] of questions.entries()) {
      const data = {
        type: question.type,
        prompt: question.prompt,
        helpText: question.helpText ?? null,
        imageUrl: question.imageUrl || null,
        imageAlt: question.imageAlt ?? null,
        isRequired: question.isRequired,
        maxLength: question.maxLength,
        placeholder: question.placeholder ?? null,
        minSelections: question.minSelections ?? null,
        maxSelections: question.maxSelections ?? null,
        allowOther: question.allowOther,
        ratingMax: question.ratingMax,
        sortOrder: index,
      }

      const isExisting =
        question.id != null && existing.some((candidate) => candidate.id === question.id)

      const saved = isExisting
        ? await tx.pollQuestion.update({ where: { id: question.id }, data })
        : await tx.pollQuestion.create({ data: { ...data, pollId } })

      const priorOptionIds =
        existing.find((candidate) => candidate.id === saved.id)?.options.map((o) => o.id) ?? []
      const keptOptionIds = new Set(
        question.options.map((option) => option.id).filter((id): id is string => Boolean(id))
      )
      const removedOptionIds = priorOptionIds.filter((id) => !keptOptionIds.has(id))
      if (removedOptionIds.length > 0) {
        await tx.pollOption.deleteMany({ where: { id: { in: removedOptionIds } } })
      }

      for (const [optionIndex, option] of question.options.entries()) {
        const optionData = {
          label: option.label,
          description: option.description ?? null,
          imageUrl: option.imageUrl || null,
          emoji: option.emoji ?? null,
          sortOrder: optionIndex,
        }
        if (option.id && priorOptionIds.includes(option.id)) {
          await tx.pollOption.update({ where: { id: option.id }, data: optionData })
        } else {
          await tx.pollOption.create({ data: { ...optionData, questionId: saved.id } })
        }
      }
    }
  })
}

/**
 * Map a thrown error onto an HTTP message and status.
 *
 * The generic CMS CRUD factory does this for the flat resources; polls need
 * their own handlers for the nested question tree, so they need their own copy
 * of the same mapping.
 */
export function describeWriteError(error: unknown): { message: string; status: number } {
  if (error instanceof ZodError) {
    return {
      message: error.issues.map((issue) => `${issue.path.join('.')}: ${issue.message}`).join('; '),
      status: 422,
    }
  }
  const err = error as { message?: string; status?: number; code?: string }
  if (err?.code === 'P2002') return { message: 'A poll with that URL already exists', status: 409 }
  if (err?.code === 'P2025') return { message: 'Not found', status: 404 }
  return { message: err?.message ?? 'Request failed', status: err?.status ?? 500 }
}
