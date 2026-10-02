/**
 * The kiosk apps expose `window.JMKiosk` (apps/android-kiosk, apps/ios-kiosk). In a plain
 * browser it is absent and the kiosk runs without a printer, card reader or device token.
 * The iPad app adds a Square Reader: `cardReaderStatus` and `takeCardPayment`.
 */
export interface KioskReceipt {
  orderNumber: string
  dateText: string
  lines: Array<{ name: string; qty: number; total: string }>
  subtotal: string
  adjustments: Array<{ label: string; amount: string }>
  tax: string
  total: string
  payment: string
  footer: string[]
}

interface JMKioskBridge {
  getDeviceToken(): string
  getAppVersion(): string
  printerStatus(): string
  printReceipt(json: string): string
  /** iPad only. JSON of {@link CardReaderStatus}. */
  cardReaderStatus?(): string
  /** iPad only. Starts Square's payment screen; the result arrives as a `jmkiosk:card-result` event. */
  takeCardPayment?(json: string): string
}

export interface CardReaderStatus {
  /** The app can take cards (Square's SDK is set up), even if not signed in yet. */
  available: boolean
  ready: boolean
  sandbox: boolean
  state: string
}

export type CardPaymentResult =
  | { status: 'paid'; paymentId: string }
  | { status: 'canceled' }
  | { status: 'failed'; error: string }

declare global {
  interface Window {
    JMKiosk?: JMKioskBridge
  }
}

const bridge = () => (typeof window === 'undefined' ? undefined : window.JMKiosk)

export function kioskAuthHeaders(): Record<string, string> {
  const token = bridge()?.getDeviceToken()
  return token ? { Authorization: `Bearer ${token}` } : {}
}

/** Returns null when printed, or a reason the receipt didn't print. */
export function printKioskReceipt(receipt: KioskReceipt): string | null {
  const b = bridge()
  if (!b) return 'No receipt printer on this device'
  try {
    const result = b.printReceipt(JSON.stringify(receipt))
    return result === 'ok' ? null : result.replace(/^error:\s*/, '')
  } catch (error) {
    return error instanceof Error ? error.message : 'Printer error'
  }
}

/** The iPad's Square Reader, or null on a device without one. */
export function cardReader(): CardReaderStatus | null {
  const b = bridge()
  if (!b?.cardReaderStatus) return null
  try {
    const status = JSON.parse(b.cardReaderStatus()) as CardReaderStatus
    return status.available ? status : null
  } catch {
    return null
  }
}

/**
 * Take a card on the iPad's Square Reader. Resolves when Square's payment screen closes.
 * The payment id is only a claim until the server confirms it with Square.
 */
export function takeCardPayment(request: { amountCents: number; referenceId: string; note: string }): Promise<CardPaymentResult> {
  const b = bridge()
  if (!b?.takeCardPayment) return Promise.resolve({ status: 'failed', error: 'No card reader on this device' })

  return new Promise((resolve) => {
    const onResult = (event: Event) => {
      const detail = (event as CustomEvent).detail as (CardPaymentResult & { referenceId?: string }) | undefined
      if (!detail || detail.referenceId !== request.referenceId) return
      window.removeEventListener('jmkiosk:card-result', onResult)
      resolve(detail)
    }
    window.addEventListener('jmkiosk:card-result', onResult)
    const started = b.takeCardPayment?.(JSON.stringify(request)) ?? 'error: no card reader'
    if (started !== 'ok') {
      window.removeEventListener('jmkiosk:card-result', onResult)
      resolve({ status: 'failed', error: started.replace(/^error:\s*/, '') })
    }
  })
}
