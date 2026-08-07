import { describe, expect, it } from 'vitest'

import { isNextControlFlowError } from '@/lib/next-errors'

describe('isNextControlFlowError', () => {
  it('recognises a redirect thrown by Next', () => {
    // Next tags redirects on `digest`, with the status and destination appended.
    const err = Object.assign(new Error('NEXT_REDIRECT'), {
      digest: 'NEXT_REDIRECT;replace;/admin;307;',
    })
    expect(isNextControlFlowError(err)).toBe(true)
  })

  it('recognises notFound()', () => {
    expect(isNextControlFlowError(Object.assign(new Error(), { digest: 'NEXT_NOT_FOUND' }))).toBe(
      true
    )
  })

  it('falls back to the message for older shapes', () => {
    expect(isNextControlFlowError(new Error('NEXT_REDIRECT'))).toBe(true)
  })

  it('does not swallow genuine failures', () => {
    expect(isNextControlFlowError(new Error('Database connection lost'))).toBe(false)
    expect(isNextControlFlowError(Object.assign(new Error(), { digest: 'some-rsc-digest' }))).toBe(
      false
    )
  })

  it('tolerates non-error values', () => {
    expect(isNextControlFlowError(null)).toBe(false)
    expect(isNextControlFlowError(undefined)).toBe(false)
    expect(isNextControlFlowError('NEXT_REDIRECT')).toBe(false)
    expect(isNextControlFlowError(42)).toBe(false)
  })
})
