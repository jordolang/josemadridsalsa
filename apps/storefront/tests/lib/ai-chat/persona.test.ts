import { describe, expect, it } from 'vitest'
import { PICANTE_INITIAL_MESSAGE, PICANTE_SYSTEM_PROMPT } from '@/lib/ai-chat/persona'

describe('Picante chat persona', () => {
  it('introduces Picante and preserves the human handoff', () => {
    expect(PICANTE_INITIAL_MESSAGE).toContain("I'm Picante")
    expect(PICANTE_INITIAL_MESSAGE).toContain('Talk to a human')
  })

  it('keeps the character voice bounded by accuracy and support rules', () => {
    expect(PICANTE_SYSTEM_PROMPT).toContain('pepper or penguin expressions')
    expect(PICANTE_SYSTEM_PROMPT).toContain('Never invent products')
    expect(PICANTE_SYSTEM_PROMPT).toContain('Prioritize clarity')
  })
})
