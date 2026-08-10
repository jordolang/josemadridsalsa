import { describe, expect, it } from 'vitest'

import {
  buildReturnInstructions,
  formatReturnAddress,
} from '@/lib/orders/return-instructions'

const warehouse = {
  name: 'Jose Madrid Salsa',
  street1: '321 Market St',
  city: 'Zanesville',
  state: 'OH',
  zip: '43701',
  country: 'US',
}

describe('buildReturnInstructions', () => {
  it('puts the RMA in the first step, since it goes on the box', () => {
    const instructions = buildReturnInstructions('RMA-20260810-1234', warehouse)
    expect(instructions.steps[0]).toContain('RMA-20260810-1234')
  })

  it('says plainly that the customer pays the return postage', () => {
    // This replaced a feature that bought the label on the business account, so the message has to
    // be unambiguous or a customer waits for a label that is never coming.
    const instructions = buildReturnInstructions('RMA-1', warehouse)
    expect(instructions.steps.join(' ')).toMatch(/pay for/i)
  })

  it('explains the condition that earns a full refund', () => {
    const instructions = buildReturnInstructions('RMA-1', warehouse)
    expect(instructions.conditionNote).toMatch(/unopened/i)
    expect(instructions.conditionNote).toMatch(/damaged|wrong/i)
  })

  it('carries the address through unchanged', () => {
    expect(buildReturnInstructions('RMA-1', warehouse).address).toEqual(warehouse)
  })
})

describe('formatReturnAddress', () => {
  it('formats a US address without a redundant country line', () => {
    expect(formatReturnAddress(warehouse)).toBe(
      'Jose Madrid Salsa\n321 Market St\nZanesville, OH 43701'
    )
  })

  it('includes the country when it is not the US', () => {
    expect(formatReturnAddress({ ...warehouse, country: 'CA' })).toContain('CA')
  })
})
