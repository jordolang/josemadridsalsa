import { describe, expect, it } from 'vitest'

import type { Classification } from '@/lib/inbox/classifier'
import {
  decideReply,
  gmailLabelFor,
  humaniseCategory,
  NEVER_AUTO_ANSWER,
  stepsFor,
} from '@/lib/inbox/policy'

/**
 * The gate between "the model thinks this is simple" and "a customer receives this".
 * Every branch is tested because this is the only thing standing between a
 * misclassification and a wrong answer going out under the business's name.
 */

function classification(overrides: Partial<Classification> = {}): Classification {
  return {
    category: 'PRODUCT_QUESTION',
    severity: 'INFO',
    confidence: 95,
    summary: 'Asking how hot the Chipotle is',
    canAnswerWithoutHuman: true,
    replyBody: 'It is a medium heat. — Jose Madrid Salsa',
    actionSummary: null,
    steps: [],
    ...overrides,
  }
}

const ON = { autoReplyEnabled: true, autoReplyMinConfidence: 80 }

describe('decideReply', () => {
  it('sends a confident, simple answer', () => {
    const decision = decideReply({ classification: classification(), ...ON })

    expect(decision.send).toBe(true)
    expect(decision.draft).toBe(false)
    expect(decision.status).toBe('AUTO_ANSWERED')
  })

  it('drafts instead of sending when confidence is below the floor', () => {
    const decision = decideReply({
      classification: classification({ confidence: 79 }),
      ...ON,
    })

    expect(decision.send).toBe(false)
    expect(decision.draft).toBe(true)
    expect(decision.status).toBe('REPLY_DRAFTED')
    expect(decision.reason).toContain('79%')
  })

  it('treats the floor as inclusive, so the configured number is sendable', () => {
    const decision = decideReply({ classification: classification({ confidence: 80 }), ...ON })

    expect(decision.send).toBe(true)
  })

  it('drafts everything when the kill switch is off', () => {
    const decision = decideReply({
      classification: classification(),
      autoReplyEnabled: false,
      autoReplyMinConfidence: 80,
    })

    expect(decision.send).toBe(false)
    expect(decision.status).toBe('REPLY_DRAFTED')
  })

  it.each(NEVER_AUTO_ANSWER)('never auto-sends %s however confident', (category) => {
    const decision = decideReply({
      classification: classification({ category, confidence: 100 }),
      ...ON,
    })

    expect(decision.send).toBe(false)
    expect(decision.draft).toBe(true)
    expect(decision.status).toBe('REPLY_DRAFTED')
  })

  it('escalates when the model says it needs a human', () => {
    const decision = decideReply({
      classification: classification({
        canAnswerWithoutHuman: false,
        replyBody: null,
        confidence: 99,
      }),
      ...ON,
    })

    expect(decision.send).toBe(false)
    expect(decision.draft).toBe(false)
    expect(decision.status).toBe('NEEDS_ACTION')
  })

  it('still drafts a suggested reply when a human is needed but one was written', () => {
    const decision = decideReply({
      classification: classification({ canAnswerWithoutHuman: false }),
      ...ON,
    })

    expect(decision.send).toBe(false)
    expect(decision.draft).toBe(true)
    expect(decision.status).toBe('REPLY_DRAFTED')
  })

  it('escalates rather than sending nothing when judged simple with no reply written', () => {
    const decision = decideReply({
      classification: classification({ replyBody: null }),
      ...ON,
    })

    expect(decision.send).toBe(false)
    expect(decision.status).toBe('NEEDS_ACTION')
  })

  it('ignores spam without replying or alerting', () => {
    const decision = decideReply({
      classification: classification({ category: 'SPAM_OR_AUTOMATED' }),
      ...ON,
    })

    expect(decision.send).toBe(false)
    expect(decision.draft).toBe(false)
    expect(decision.status).toBe('IGNORED')
  })
})

describe('gmailLabelFor', () => {
  it('labels each handled state and leaves spam unlabelled', () => {
    expect(gmailLabelFor('AUTO_ANSWERED')).toBe('JMS/Answered')
    expect(gmailLabelFor('REPLY_DRAFTED')).toBe('JMS/Reply drafted')
    expect(gmailLabelFor('NEEDS_ACTION')).toBe('JMS/Needs action')
    expect(gmailLabelFor('IN_PROGRESS')).toBe('JMS/Needs action')
    expect(gmailLabelFor('RESOLVED')).toBe('JMS/Resolved')
    expect(gmailLabelFor('IGNORED')).toBeNull()
  })
})

describe('humaniseCategory', () => {
  it('reads as English rather than as an enum', () => {
    expect(humaniseCategory('RETURN_OR_DAMAGE')).toBe('Return / Damage')
    expect(humaniseCategory('ORDER_STATUS')).toBe('Order Status')
  })
})

describe('stepsFor', () => {
  /**
   * An unsent Gmail draft is an unanswered customer. Without a step to send it, the alert
   * clears in one click and the draft sits there forever — the exact failure the whole
   * feature exists to prevent.
   */

  it('adds the send step to a drafted reply that came with no steps at all', () => {
    const steps = stepsFor({ steps: [] }, { draft: true, status: 'REPLY_DRAFTED' })

    expect(steps).toHaveLength(1)
    expect(steps[0].instruction).toMatch(/send it/i)
    expect(steps[0].isOptional).toBe(false)
  })

  it('appends the send step after the work the classifier asked for', () => {
    const steps = stepsFor(
      { steps: [{ instruction: 'Check the warehouse shelf', isOptional: false }] },
      { draft: true, status: 'REPLY_DRAFTED' },
    )

    expect(steps.map((step) => step.instruction)).toEqual([
      'Check the warehouse shelf',
      expect.stringMatching(/send it/i),
    ])
  })

  it('replaces a trailing "reply to the customer" rather than asking twice', () => {
    const steps = stepsFor(
      {
        steps: [
          { instruction: 'Refund the broken jar', isOptional: false },
          { instruction: 'Reply to the customer', isOptional: false },
        ],
      },
      { draft: true, status: 'REPLY_DRAFTED' },
    )

    expect(steps).toHaveLength(2)
    expect(steps[1].instruction).toMatch(/send it/i)
  })

  it('leaves an escalated email with no draft untouched', () => {
    const steps = stepsFor(
      { steps: [{ instruction: 'Call them', isOptional: false }] },
      { draft: false, status: 'NEEDS_ACTION' },
    )

    expect(steps).toEqual([{ instruction: 'Call them', isOptional: false }])
  })

  it('does not mutate the classification it was given', () => {
    const classification = { steps: [{ instruction: 'Reply to them', isOptional: false }] }
    stepsFor(classification, { draft: true, status: 'REPLY_DRAFTED' })

    expect(classification.steps[0].instruction).toBe('Reply to them')
  })
})
