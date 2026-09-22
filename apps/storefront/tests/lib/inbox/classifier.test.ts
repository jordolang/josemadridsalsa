import { describe, expect, it } from 'vitest'

import { escalationFallback } from '@/lib/inbox/classifier'

/**
 * The classifier's own failure mode. This is the one behaviour of it that must never
 * change: when the model cannot be reached, the message becomes a human's problem rather
 * than disappearing.
 */

describe('escalationFallback', () => {
  it('escalates to a human rather than going quiet', () => {
    const result = escalationFallback('API error 500')

    expect(result.canAnswerWithoutHuman).toBe(false)
    expect(result.replyBody).toBeNull()
    expect(result.confidence).toBe(0)
    expect(result.severity).toBe('WARNING')
  })

  it('carries steps, so the alert it produces cannot be cleared without being worked', () => {
    const result = escalationFallback('no key')

    expect(result.steps.length).toBeGreaterThan(0)
    expect(result.steps.every((step) => !step.isOptional)).toBe(true)
    expect(result.steps[result.steps.length - 1]?.instruction).toMatch(/reply/i)
  })

  it('says why it could not classify, so the operator is not guessing', () => {
    expect(escalationFallback('API error 429').actionSummary).toContain('API error 429')
  })
})
