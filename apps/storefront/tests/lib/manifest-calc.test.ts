import { describe, it, expect } from 'vitest'
import {
  toJars,
  soldUnits,
  toCasesAndJars,
  formatCasesAndJars,
} from '@/lib/events/manifest-calc'

describe('manifest-calc', () => {
  describe('toJars', () => {
    it('combines cases and loose jars using the pack size', () => {
      // "2 cases and 6 jars" at 12/case = 30 jars
      expect(toJars(2, 6, 12)).toBe(30)
    })

    it('treats a non-positive pack size as 1 jar per case', () => {
      expect(toJars(3, 0, 0)).toBe(3)
      expect(toJars(3, 0, -5)).toBe(3)
    })

    it('floors negative and fractional inputs to safe integers', () => {
      expect(toJars(-1, -4, 12)).toBe(0)
      expect(toJars(1.9, 2.9, 12)).toBe(14)
    })
  })

  describe('soldUnits', () => {
    it('computes taken minus returned', () => {
      // took 2 cases + 6 jars (30), returned 1 case (12) => 18 sold
      expect(
        soldUnits({
          takenCases: 2,
          takenJars: 6,
          returnedCases: 1,
          returnedJars: 0,
          unitsPerCase: 12,
        })
      ).toBe(18)
    })

    it('never goes negative when more is returned than taken', () => {
      expect(
        soldUnits({
          takenCases: 1,
          takenJars: 0,
          returnedCases: 2,
          returnedJars: 0,
          unitsPerCase: 12,
        })
      ).toBe(0)
    })

    it('handles chips tracked in boxes (jars stay 0)', () => {
      // 10 boxes out, 3 boxes back, pack size 12 => 84 units == 7 boxes
      const sold = soldUnits({
        takenCases: 10,
        takenJars: 0,
        returnedCases: 3,
        returnedJars: 0,
        unitsPerCase: 12,
      })
      expect(sold).toBe(84)
      expect(toCasesAndJars(sold, 12)).toEqual({ cases: 7, jars: 0 })
    })
  })

  describe('toCasesAndJars', () => {
    it('breaks a jar count back into whole cases and leftover jars', () => {
      expect(toCasesAndJars(30, 12)).toEqual({ cases: 2, jars: 6 })
      expect(toCasesAndJars(11, 12)).toEqual({ cases: 0, jars: 11 })
      expect(toCasesAndJars(24, 12)).toEqual({ cases: 2, jars: 0 })
    })

    it('is the inverse of toJars', () => {
      const jars = toJars(4, 7, 12)
      expect(toCasesAndJars(jars, 12)).toEqual({ cases: 4, jars: 7 })
    })
  })

  describe('formatCasesAndJars', () => {
    it('renders a readable label with singular/plural units', () => {
      expect(formatCasesAndJars(2, 6)).toBe('2 cases + 6 jars')
      expect(formatCasesAndJars(1, 1)).toBe('1 case + 1 jar')
      expect(formatCasesAndJars(3, 0)).toBe('3 cases')
      expect(formatCasesAndJars(0, 5)).toBe('5 jars')
      expect(formatCasesAndJars(0, 0)).toBe('0')
    })
  })
})
