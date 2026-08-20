import { describe, expect, it } from 'vitest'
import {
  pollCreateSchema,
  pollQuestionInputSchema,
  pollResponseSchema,
  validateAnswers,
  type AnswerableQuestion,
  type PollAnswerInput,
} from '@/lib/polls/schemas'
import { MAX_COMMENT_LENGTH } from '@/lib/polls/constants'

function question(over: Partial<AnswerableQuestion> = {}): AnswerableQuestion {
  return {
    id: 'q1',
    type: 'SINGLE_CHOICE',
    prompt: 'Which one?',
    isRequired: false,
    maxLength: MAX_COMMENT_LENGTH,
    minSelections: null,
    maxSelections: null,
    allowOther: false,
    ratingMax: 5,
    options: [{ id: 'o1' }, { id: 'o2' }],
    ...over,
  }
}

function answer(over: Partial<PollAnswerInput> = {}): PollAnswerInput {
  return { questionId: 'q1', optionIds: [], textValue: null, otherText: null, rating: null, ...over }
}

describe('pollResponseSchema', () => {
  it('accepts a one-character first name with no last name', () => {
    const parsed = pollResponseSchema.parse({ firstName: 'J', answers: [] })
    expect(parsed.firstName).toBe('J')
    expect(parsed.lastName).toBeUndefined()
  })

  it('rejects a blank first name', () => {
    expect(() => pollResponseSchema.parse({ firstName: '   ', answers: [] })).toThrow()
  })

  it('accepts an empty email but rejects a malformed one', () => {
    expect(pollResponseSchema.parse({ firstName: 'Ada', email: '', answers: [] }).email).toBe('')
    expect(() => pollResponseSchema.parse({ firstName: 'Ada', email: 'nope', answers: [] })).toThrow()
  })

  it('caps a written answer at 1500 characters', () => {
    const ok = { firstName: 'Ada', answers: [{ questionId: 'q1', textValue: 'x'.repeat(1500) }] }
    expect(() => pollResponseSchema.parse(ok)).not.toThrow()

    const tooLong = { firstName: 'Ada', answers: [{ questionId: 'q1', textValue: 'x'.repeat(1501) }] }
    expect(() => pollResponseSchema.parse(tooLong)).toThrow()
  })
})

describe('pollQuestionInputSchema', () => {
  it('requires two options on a choice question', () => {
    expect(() =>
      pollQuestionInputSchema.parse({ type: 'SINGLE_CHOICE', prompt: 'Pick', options: [{ label: 'Only one' }] })
    ).toThrow()
  })

  it('allows a text question with no options', () => {
    const parsed = pollQuestionInputSchema.parse({ type: 'LONG_TEXT', prompt: 'Tell us more' })
    expect(parsed.maxLength).toBe(MAX_COMMENT_LENGTH)
    expect(parsed.options).toEqual([])
  })

  it('rejects a minimum no answer could satisfy', () => {
    expect(() =>
      pollQuestionInputSchema.parse({
        type: 'MULTI_CHOICE',
        prompt: 'Pick three',
        minSelections: 3,
        options: [{ label: 'a' }, { label: 'b' }],
      })
    ).toThrow()

    // The same minimum is fine once an "other" box supplies the third answer.
    expect(() =>
      pollQuestionInputSchema.parse({
        type: 'MULTI_CHOICE',
        prompt: 'Pick three',
        minSelections: 3,
        allowOther: true,
        options: [{ label: 'a' }, { label: 'b' }],
      })
    ).not.toThrow()
  })

  it('rejects a minimum above the maximum', () => {
    expect(() =>
      pollQuestionInputSchema.parse({
        type: 'MULTI_CHOICE',
        prompt: 'Pick some',
        minSelections: 3,
        maxSelections: 2,
        options: [{ label: 'a' }, { label: 'b' }],
      })
    ).toThrow()
  })
})

describe('pollCreateSchema', () => {
  it('rejects a slug that is not URL-safe', () => {
    expect(() => pollCreateSchema.parse({ slug: 'Not A Slug', title: 'Hi' })).toThrow()
  })

  it('defaults a new poll to a private draft that is publicly listed once published', () => {
    const parsed = pollCreateSchema.parse({ slug: 'best-salsa', title: 'Best salsa' })
    expect(parsed.status).toBe('DRAFT')
    expect(parsed.visibility).toBe('PUBLIC')
    expect(parsed.resultsVisibility).toBe('AFTER_VOTE')
    expect(parsed.allowMultipleSubmissions).toBe(false)
  })
})

describe('validateAnswers', () => {
  it('passes a well-formed single choice', () => {
    expect(validateAnswers([question()], [answer({ optionIds: ['o1'] })])).toEqual([])
  })

  it('rejects an option that belongs to another question', () => {
    const errors = validateAnswers([question()], [answer({ optionIds: ['someone-elses'] })])
    expect(errors).toHaveLength(1)
    expect(errors[0].message).toMatch(/not on this question/)
  })

  it('rejects two choices on a pick-one question', () => {
    const errors = validateAnswers([question()], [answer({ optionIds: ['o1', 'o2'] })])
    expect(errors[0].message).toMatch(/just one/)
  })

  it('lets a multi-choice question take every option', () => {
    const multi = question({ type: 'MULTI_CHOICE' })
    expect(validateAnswers([multi], [answer({ optionIds: ['o1', 'o2'] })])).toEqual([])
  })

  it('enforces the admin selection bounds', () => {
    const multi = question({ type: 'MULTI_CHOICE', minSelections: 2, maxSelections: 2 })
    expect(validateAnswers([multi], [answer({ optionIds: ['o1'] })])[0].message).toMatch(/at least 2/)
    expect(
      validateAnswers([multi], [answer({ optionIds: ['o1', 'o2'], otherText: 'and this' })])
    ).toHaveLength(1)
  })

  it('flags a required question left blank, and only when required', () => {
    expect(validateAnswers([question({ isRequired: true })], [])).toHaveLength(1)
    expect(validateAnswers([question({ isRequired: false })], [])).toEqual([])
  })

  it('treats an "other" answer as an answer when the question offers one', () => {
    const q = question({ isRequired: true, allowOther: true })
    expect(validateAnswers([q], [answer({ otherText: 'Something else entirely' })])).toEqual([])
  })

  it('rejects an "other" answer on a question that does not offer one', () => {
    const errors = validateAnswers([question()], [answer({ otherText: 'sneaky' })])
    expect(errors[0].message).toMatch(/no "other" answer/)
  })

  it('enforces the per-question character cap', () => {
    const q = question({ type: 'LONG_TEXT', maxLength: 200, options: [] })
    const errors = validateAnswers([q], [answer({ textValue: 'x'.repeat(201) })])
    expect(errors[0].message).toMatch(/under 200 characters/)
  })

  it('keeps a rating inside its scale', () => {
    const q = question({ type: 'RATING', ratingMax: 5, options: [] })
    expect(validateAnswers([q], [answer({ rating: 5 })])).toEqual([])
    expect(validateAnswers([q], [answer({ rating: 6 })])[0].message).toMatch(/between 1 and 5/)
  })

  it('rejects an answer to a question the poll does not have', () => {
    const errors = validateAnswers([question()], [answer({ questionId: 'ghost' })])
    expect(errors[0].message).toMatch(/not part of this poll/)
  })

  it('rejects the same question answered twice', () => {
    const errors = validateAnswers(
      [question()],
      [answer({ optionIds: ['o1'] }), answer({ optionIds: ['o2'] })]
    )
    expect(errors).toHaveLength(1)
    expect(errors[0].message).toMatch(/answered twice/)
  })

  it('rejects the same option picked twice', () => {
    const multi = question({ type: 'MULTI_CHOICE' })
    const errors = validateAnswers([multi], [answer({ optionIds: ['o1', 'o1'] })])
    expect(errors[0].message).toMatch(/only be picked once/)
  })

  it('reports every problem at once', () => {
    const questions = [
      question({ id: 'a', isRequired: true }),
      question({ id: 'b', type: 'LONG_TEXT', isRequired: true, options: [] }),
    ]
    expect(validateAnswers(questions, [])).toHaveLength(2)
  })
})
