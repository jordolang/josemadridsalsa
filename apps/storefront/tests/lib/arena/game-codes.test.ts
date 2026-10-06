import { describe, expect, it } from 'vitest'
import { generateGameCode, normalizeGameCode } from '@/lib/arena/game-codes'

describe('normalizeGameCode', () => {
  it('reads the same code however it is typed', () => {
    for (const typed of ['JM-7KQ4-X2PD', 'jm 7kq4 x2pd', 'JM7KQ4X2PD', '7kq4-x2pd', ' jm-7KQ4-x2pd ']) {
      expect(normalizeGameCode(typed)).toBe('JM-7KQ4-X2PD')
    }
  })

  it('rejects text that is not a code', () => {
    for (const typed of ['', 'Lincoln PTA', 'JM-7KQ4', 'XX-7KQ4-X2PD', 'JM-7KQ4-X2PD-1']) {
      expect(normalizeGameCode(typed)).toBeNull()
    }
  })
})

describe('generateGameCode', () => {
  it('makes formatted codes without lookalike characters', () => {
    for (let i = 0; i < 200; i++) {
      const code = generateGameCode()
      expect(code).toMatch(/^JM-[A-HJ-NP-Z2-9]{4}-[A-HJ-NP-Z2-9]{4}$/)
      expect(normalizeGameCode(code)).toBe(code)
    }
  })
})
