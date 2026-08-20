import { z } from 'zod'
import { slugSchema } from '@/lib/cms/schemas'
import {
  MAX_COMMENT_LENGTH,
  MAX_NAME_LENGTH,
  MAX_RATING_SCALE,
  POLL_ACCENTS,
} from './constants'

/**
 * Zod contracts for the polls feature: the admin write endpoints and the
 * public response endpoint. Nothing reaches Prisma without going through one
 * of these first.
 */

const contentStatus = z.enum(['DRAFT', 'SCHEDULED', 'PUBLISHED', 'ARCHIVED'])
const visibility = z.enum(['PUBLIC', 'INVITE_ONLY'])
const resultsVisibility = z.enum(['HIDDEN', 'AFTER_VOTE', 'ALWAYS'])

export const pollQuestionTypeSchema = z.enum([
  'SINGLE_CHOICE',
  'MULTI_CHOICE',
  'SHORT_TEXT',
  'LONG_TEXT',
  'RATING',
])

export type PollQuestionTypeValue = z.infer<typeof pollQuestionTypeSchema>

const nullableDate = z.coerce.date().nullable().optional()
const nullableText = (max: number) => z.string().max(max).nullable().optional()

/** Images are either a library/CDN URL or a site-relative path. */
const imageUrlSchema = z
  .string()
  .max(2048)
  .refine(
    (value) => value === '' || value.startsWith('/') || value.startsWith('https://'),
    'Use an https:// URL or a path starting with /'
  )
  .nullable()
  .optional()

export const pollOptionInputSchema = z.object({
  id: z.string().optional(),
  label: z.string().min(1, 'Every option needs a label').max(300),
  description: nullableText(500),
  imageUrl: imageUrlSchema,
  emoji: nullableText(8),
  sortOrder: z.number().int().min(0).default(0),
})

export const pollQuestionInputSchema = z
  .object({
    id: z.string().optional(),
    type: pollQuestionTypeSchema.default('SINGLE_CHOICE'),
    prompt: z.string().min(1, 'Every question needs a prompt').max(500),
    helpText: nullableText(1000),
    imageUrl: imageUrlSchema,
    imageAlt: nullableText(300),
    isRequired: z.boolean().default(false),
    maxLength: z.number().int().min(1).max(MAX_COMMENT_LENGTH).default(MAX_COMMENT_LENGTH),
    placeholder: nullableText(200),
    minSelections: z.number().int().min(0).nullable().optional(),
    maxSelections: z.number().int().min(1).nullable().optional(),
    allowOther: z.boolean().default(false),
    ratingMax: z.number().int().min(2).max(MAX_RATING_SCALE).default(5),
    sortOrder: z.number().int().min(0).default(0),
    options: z.array(pollOptionInputSchema).default([]),
  })
  .superRefine((question, ctx) => {
    const isChoice = question.type === 'SINGLE_CHOICE' || question.type === 'MULTI_CHOICE'
    if (isChoice && question.options.length < 2) {
      ctx.addIssue({
        code: 'custom',
        path: ['options'],
        message: 'Choice questions need at least two options',
      })
    }
    if (
      question.minSelections != null &&
      question.maxSelections != null &&
      question.minSelections > question.maxSelections
    ) {
      ctx.addIssue({
        code: 'custom',
        path: ['minSelections'],
        message: 'The minimum cannot be greater than the maximum',
      })
    }
    // A minimum above the number of answers on offer can never be satisfied,
    // so the poll would reject every submission.
    const available = question.options.length + (question.allowOther ? 1 : 0)
    if (isChoice && question.minSelections != null && question.minSelections > available) {
      ctx.addIssue({
        code: 'custom',
        path: ['minSelections'],
        message: `Only ${available} answers are on offer, so the minimum cannot be higher`,
      })
    }
  })

export const pollCreateSchema = z.object({
  slug: slugSchema,
  title: z.string().min(1, 'Give the poll a title').max(200),
  subtitle: nullableText(300),
  description: nullableText(5000),
  imageUrl: imageUrlSchema,
  imageAlt: nullableText(300),
  accentColor: z.enum(POLL_ACCENTS).nullable().optional(),
  status: contentStatus.default('DRAFT'),
  visibility: visibility.default('PUBLIC'),
  featured: z.boolean().default(false),
  sortOrder: z.number().int().min(0).default(0),
  publishedAt: nullableDate,
  startsAt: nullableDate,
  endsAt: nullableDate,
  resultsVisibility: resultsVisibility.default('AFTER_VOTE'),
  allowMultipleSubmissions: z.boolean().default(false),
  collectEmail: z.boolean().default(false),
  consentNotice: nullableText(2000),
  thankYouMessage: nullableText(1000),
  closedMessage: nullableText(1000),
  seoTitle: nullableText(200),
  seoDescription: nullableText(500),
  noIndex: z.boolean().default(false),
})

/**
 * Update payload. Questions are optional: the editor saves the poll's own
 * fields and its question tree together, but a quick status change need not
 * resend the whole tree.
 */
export const pollUpdateSchema = pollCreateSchema.partial().extend({
  questions: z.array(pollQuestionInputSchema).optional(),
})

export type PollCreateInput = z.infer<typeof pollCreateSchema>
export type PollUpdateInput = z.infer<typeof pollUpdateSchema>
export type PollQuestionInput = z.infer<typeof pollQuestionInputSchema>
export type PollOptionInput = z.infer<typeof pollOptionInputSchema>

/** One answer as it arrives from the public form. */
export const pollAnswerInputSchema = z.object({
  questionId: z.string().min(1),
  optionIds: z.array(z.string().min(1)).max(50).default([]),
  textValue: z.string().max(MAX_COMMENT_LENGTH).nullable().optional(),
  otherText: z.string().max(MAX_COMMENT_LENGTH).nullable().optional(),
  rating: z.number().int().min(1).max(MAX_RATING_SCALE).nullable().optional(),
})

/**
 * A visitor's submission.
 *
 * `firstName` is required but deliberately has no minimum beyond "not blank" —
 * the form tells people a first name alone is fine, so anything they type is
 * accepted. `website` is an unused honeypot; a filled one means a bot.
 */
export const pollResponseSchema = z.object({
  firstName: z.string().trim().min(1, 'Please enter your first name').max(MAX_NAME_LENGTH),
  lastName: z.string().trim().max(MAX_NAME_LENGTH).optional(),
  email: z.union([z.literal(''), z.string().email('That email address looks incomplete')]).optional(),
  anonymousRequested: z.boolean().default(false),
  consentAcknowledged: z.boolean().default(false),
  accessCode: z.string().max(120).optional(),
  website: z.string().max(200).optional(),
  answers: z.array(pollAnswerInputSchema).max(100).default([]),
})

export type PollResponseInput = z.infer<typeof pollResponseSchema>
export type PollAnswerInput = z.infer<typeof pollAnswerInputSchema>

/** A question as `validateAnswers` needs to see it. */
export interface AnswerableQuestion {
  id: string
  type: PollQuestionTypeValue
  prompt: string
  isRequired: boolean
  maxLength: number
  minSelections: number | null
  maxSelections: number | null
  allowOther: boolean
  ratingMax: number
  options: { id: string }[]
}

export interface AnswerValidationError {
  questionId: string
  message: string
}

/**
 * Check a submission against the poll it claims to answer.
 *
 * Zod validates the shape; this validates the meaning — required questions
 * answered, choices that actually belong to the question, selection counts
 * within the admin's bounds, comments inside the per-question character cap.
 * Returns every problem so the form can mark all of them at once.
 */
export function validateAnswers(
  questions: AnswerableQuestion[],
  answers: PollAnswerInput[]
): AnswerValidationError[] {
  const errors: AnswerValidationError[] = []
  const byQuestion = new Map(answers.map((answer) => [answer.questionId, answer]))

  // A question answered twice would collapse to one entry here but hit the
  // (responseId, questionId) unique index on insert, so reject it as bad input
  // rather than letting it surface as a server error.
  if (byQuestion.size !== answers.length) {
    const seen = new Set<string>()
    for (const answer of answers) {
      if (seen.has(answer.questionId)) {
        errors.push({ questionId: answer.questionId, message: 'This question was answered twice' })
      }
      seen.add(answer.questionId)
    }
    return errors
  }

  for (const question of questions) {
    const answer = byQuestion.get(question.id)
    const optionIds = answer?.optionIds ?? []
    const otherText = answer?.otherText?.trim() ?? ''
    const textValue = answer?.textValue?.trim() ?? ''
    const rating = answer?.rating ?? null

    const validIds = new Set(question.options.map((option) => option.id))
    const unknown = optionIds.filter((id) => !validIds.has(id))
    if (unknown.length > 0) {
      errors.push({ questionId: question.id, message: 'That choice is not on this question' })
      continue
    }
    // The same option sent twice would otherwise be tallied as two votes.
    if (new Set(optionIds).size !== optionIds.length) {
      errors.push({ questionId: question.id, message: 'Each choice can only be picked once' })
      continue
    }

    switch (question.type) {
      case 'SINGLE_CHOICE': {
        const chose = optionIds.length > 0 || (question.allowOther && otherText !== '')
        if (optionIds.length > 1) {
          errors.push({ questionId: question.id, message: 'Pick just one answer' })
        } else if (question.isRequired && !chose) {
          errors.push({ questionId: question.id, message: 'Please choose an answer' })
        }
        break
      }
      case 'MULTI_CHOICE': {
        const count = optionIds.length + (question.allowOther && otherText !== '' ? 1 : 0)
        if (question.isRequired && count === 0) {
          errors.push({ questionId: question.id, message: 'Please choose at least one answer' })
        } else if (count > 0) {
          if (question.minSelections != null && count < question.minSelections) {
            errors.push({
              questionId: question.id,
              message: `Please choose at least ${question.minSelections}`,
            })
          }
          if (question.maxSelections != null && count > question.maxSelections) {
            errors.push({
              questionId: question.id,
              message: `Please choose no more than ${question.maxSelections}`,
            })
          }
        }
        break
      }
      case 'SHORT_TEXT':
      case 'LONG_TEXT': {
        if (question.isRequired && textValue === '') {
          errors.push({ questionId: question.id, message: 'Please write an answer' })
        }
        if (textValue.length > question.maxLength) {
          errors.push({
            questionId: question.id,
            message: `Please keep this under ${question.maxLength} characters`,
          })
        }
        break
      }
      case 'RATING': {
        if (rating == null) {
          if (question.isRequired) {
            errors.push({ questionId: question.id, message: 'Please pick a rating' })
          }
        } else if (rating < 1 || rating > question.ratingMax) {
          errors.push({
            questionId: question.id,
            message: `Please pick a rating between 1 and ${question.ratingMax}`,
          })
        }
        break
      }
    }

    if (otherText.length > question.maxLength) {
      errors.push({
        questionId: question.id,
        message: `Please keep this under ${question.maxLength} characters`,
      })
    }
    if (otherText !== '' && !question.allowOther) {
      errors.push({ questionId: question.id, message: 'This question has no "other" answer' })
    }
  }

  for (const answer of answers) {
    if (!questions.some((question) => question.id === answer.questionId)) {
      errors.push({ questionId: answer.questionId, message: 'That question is not part of this poll' })
    }
  }

  return errors
}
