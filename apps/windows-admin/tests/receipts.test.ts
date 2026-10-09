import { describe, expect, it } from 'vitest'
import { parseReceiptJob, parseReceiptPrinter, remember, shouldPrint, PRINTED_MEMORY } from '../src/shared/receipts'

const ENDPOINT = 'https://www.josemadridsalsa.com/admin-desktop'
const PAGE = 'https://www.josemadridsalsa.com/admin-desktop?section=orders'
const TICKET = Buffer.from([0x1b, 0x40, 0x41, 0x0a]).toString('base64')

describe('parseReceiptPrinter', () => {
  it('accepts a network printer, defaulting to port 9100', () => {
    expect(parseReceiptPrinter({ mode: 'network', host: ' 192.168.1.87 ' })).toEqual({
      mode: 'network',
      host: '192.168.1.87',
      port: 9100,
    })
  })

  it('accepts an installed printer by name', () => {
    expect(parseReceiptPrinter({ mode: 'printer', name: 'RONGTA 80mm Series Printer' })).toEqual({
      mode: 'printer',
      name: 'RONGTA 80mm Series Printer',
    })
  })

  it('refuses a host or port it could not connect to', () => {
    expect(parseReceiptPrinter({ mode: 'network', host: 'printer; rm -rf /' })).toHaveProperty('error')
    expect(parseReceiptPrinter({ mode: 'network', host: '10.0.0.5', port: 70000 })).toHaveProperty('error')
    expect(parseReceiptPrinter({ mode: 'printer', name: '  ' })).toHaveProperty('error')
  })

  it('treats anything else as off', () => {
    expect(parseReceiptPrinter(undefined)).toEqual({ mode: 'off' })
    expect(parseReceiptPrinter({ mode: 'serial' })).toEqual({ mode: 'off' })
  })
})

describe('parseReceiptJob', () => {
  const job = { orderId: 'cmabc123', orderNumber: 'JMS-1', createdAt: '2026-10-09T03:00:00.000Z', data: TICKET }

  it('accepts a ticket from the admin page', () => {
    const parsed = parseReceiptJob(ENDPOINT, PAGE, job)
    expect(parsed).toMatchObject({ orderId: 'cmabc123', orderNumber: 'JMS-1', reprint: false })
    expect([...parsed!.bytes]).toEqual([0x1b, 0x40, 0x41, 0x0a])
  })

  it('ignores a page that is not the admin server', () => {
    expect(parseReceiptJob(ENDPOINT, 'https://accounts.google.com/signin', job)).toBeNull()
  })

  it('ignores a malformed job', () => {
    expect(parseReceiptJob(ENDPOINT, PAGE, { ...job, orderId: '../../x' })).toBeNull()
    expect(parseReceiptJob(ENDPOINT, PAGE, { ...job, createdAt: 'yesterday' })).toBeNull()
    expect(parseReceiptJob(ENDPOINT, PAGE, { ...job, data: 'not base64!' })).toBeNull()
    expect(parseReceiptJob(ENDPOINT, PAGE, { ...job, data: 'A'.repeat(200_000) })).toBeNull()
  })
})

describe('shouldPrint', () => {
  const job = { orderId: 'o1', orderNumber: 'JMS-1', createdAt: Date.parse('2026-10-09T03:00:00Z'), bytes: Buffer.alloc(1), reprint: false }
  const enabledAt = Date.parse('2026-10-09T00:00:00Z')

  it('prints a new order once', () => {
    expect(shouldPrint(job, [], enabledAt)).toBe(true)
    expect(shouldPrint(job, ['o1'], enabledAt)).toBe(false)
  })

  it('does not print the backlog from before receipts were switched on', () => {
    expect(shouldPrint({ ...job, createdAt: enabledAt - 1 }, [], enabledAt)).toBe(false)
  })

  it('always prints a reprint', () => {
    expect(shouldPrint({ ...job, reprint: true, createdAt: 0 }, ['o1'], enabledAt)).toBe(true)
  })
})

describe('remember', () => {
  it('keeps the newest orders up to the limit', () => {
    const many = Array.from({ length: PRINTED_MEMORY }, (_, index) => `o${index}`)
    const next = remember(many, 'new')
    expect(next).toHaveLength(PRINTED_MEMORY)
    expect(next[0]).toBe('o1')
    expect(next.at(-1)).toBe('new')
  })
})
