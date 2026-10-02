/**
 * The Android kiosk app exposes `window.JMKiosk` (apps/android-kiosk). In a plain
 * browser it is absent and the kiosk runs without a printer or device token.
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
}

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
