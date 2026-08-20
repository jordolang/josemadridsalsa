import { describe, it, expect } from 'vitest'

import { exportValue, formatAxisValue, formatMeasure } from '@/lib/data-studio/display'

describe('data-studio display', () => {
  describe('null is a dash, never a zero', () => {
    // The distinction the whole aggregator preserves would be thrown away by rendering null as 0.
    it('renders a missing figure as an em dash for every unit', () => {
      expect(formatMeasure(null, 'cents')).toBe('—')
      expect(formatMeasure(null, 'count')).toBe('—')
      expect(formatMeasure(null, 'miles')).toBe('—')
      expect(formatMeasure(null, 'jars')).toBe('—')
      expect(formatMeasure(undefined as unknown as null, 'cents')).toBe('—')
      expect(formatMeasure(Number.NaN, 'cents')).toBe('—')
    })

    it('still renders a real zero as zero', () => {
      expect(formatMeasure(0, 'cents')).toBe('$0.00')
      expect(formatMeasure(0, 'count')).toBe('0')
    })
  })

  describe('formatMeasure', () => {
    it('reads cents as dollars', () => {
      expect(formatMeasure(48_132_047, 'cents')).toBe('$481,320.47')
    })

    it('keeps the sign on a negative net', () => {
      expect(formatMeasure(-136_200, 'cents')).toBe('-$1,362.00')
    })

    it('labels miles and jars', () => {
      expect(formatMeasure(343_872, 'miles')).toBe('343,872 mi')
      expect(formatMeasure(117_084, 'jars')).toBe('117,084 jars')
    })

    it('renders a ratio as a percentage', () => {
      expect(formatMeasure(0.073, 'ratio')).toBe('7.3%')
    })
  })

  describe('formatAxisValue', () => {
    it('abbreviates money for a cramped axis', () => {
      expect(formatAxisValue(48_132_047, 'cents')).toBe('$481k')
      expect(formatAxisValue(500_000_000, 'cents')).toBe('$5.0M')
      expect(formatAxisValue(2_500, 'cents')).toBe('$25')
    })

    it('abbreviates counts', () => {
      expect(formatAxisValue(117_084, 'jars')).toBe('117k')
      expect(formatAxisValue(42, 'count')).toBe('42')
    })
  })

  describe('exportValue', () => {
    it('converts cents to dollars so a spreadsheet column sums correctly', () => {
      expect(exportValue(48_132_047, 'cents')).toBe(481320.47)
    })

    it('leaves a missing figure empty rather than writing 0 into a spreadsheet', () => {
      expect(exportValue(null, 'cents')).toBe('')
      expect(exportValue(null, 'count')).toBe('')
    })

    it('rounds counts to integers', () => {
      expect(exportValue(343_871.6, 'miles')).toBe(343872)
    })
  })
})
