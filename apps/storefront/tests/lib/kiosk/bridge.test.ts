import { afterEach, describe, expect, it, vi } from 'vitest'
import { cardReader, takeCardPayment } from '@/lib/kiosk/bridge'

function installBridge(reader: object, takeCardPayment = vi.fn(() => 'ok')) {
  window.JMKiosk = {
    getDeviceToken: () => 't',
    getAppVersion: () => '1.0',
    printerStatus: () => '{}',
    printReceipt: () => 'ok',
    cardReaderStatus: () => JSON.stringify(reader),
    takeCardPayment,
  }
  return takeCardPayment
}

const reply = (detail: object) => window.dispatchEvent(new CustomEvent('jmkiosk:card-result', { detail }))

afterEach(() => {
  delete window.JMKiosk
})

describe('cardReader', () => {
  it('is null in a browser and on a kiosk app without card payments', () => {
    expect(cardReader()).toBeNull()
    installBridge({ available: false, ready: false, sandbox: false, state: 'not set up' })
    expect(cardReader()).toBeNull()
  })

  it('reports the iPad reader when it can take cards', () => {
    installBridge({ available: true, ready: true, sandbox: false, state: 'Ready for cards' })
    expect(cardReader()).toMatchObject({ available: true, ready: true })
  })
})

describe('takeCardPayment', () => {
  it('sends the request to the iPad and resolves with the result for that order only', async () => {
    const send = installBridge({ available: true, ready: true, sandbox: false, state: '' })
    const payment = takeCardPayment({ amountCents: 3200, referenceId: 'o1', note: 'Kiosk order 1' })
    expect(JSON.parse(send.mock.calls[0][0])).toEqual({ amountCents: 3200, referenceId: 'o1', note: 'Kiosk order 1' })

    // A stale result for another order is ignored.
    reply({ status: 'paid', paymentId: 'pay_old', referenceId: 'o0' })
    reply({ status: 'paid', paymentId: 'pay_1', referenceId: 'o1' })
    await expect(payment).resolves.toMatchObject({ status: 'paid', paymentId: 'pay_1' })
  })

  it('fails at once when the iPad refuses to start', async () => {
    installBridge({ available: true, ready: false, sandbox: false, state: '' }, vi.fn(() => 'error: card payments are not set up on this kiosk'))
    await expect(takeCardPayment({ amountCents: 100, referenceId: 'o1', note: '' })).resolves.toEqual({
      status: 'failed',
      error: 'card payments are not set up on this kiosk',
    })
  })

  it('fails without a bridge', async () => {
    await expect(takeCardPayment({ amountCents: 100, referenceId: 'o1', note: '' })).resolves.toMatchObject({ status: 'failed' })
  })
})
