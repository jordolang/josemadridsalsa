import { app } from 'electron'
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { DEFAULT_ENDPOINT, migrateLegacyDefault, validateEndpoint } from '../shared/endpoint'
import { PRINTED_MEMORY, RECEIPTS_OFF, parseReceiptPrinter, type ReceiptPrinter } from '../shared/receipts'

export interface DesktopSettings {
  endpoint: string
  zoomFactor: number
  /** The printer shipping labels go to without a dialog. Empty means ask each time. */
  labelPrinter: string
  /** A 4×6 label stock, or the label printed at 4×6 on a letter sheet. */
  labelPaper: LabelPaper
  /** The printer packing slips go to without a dialog. Empty means ask each time. */
  documentPrinter: string
  /** Where order tickets print. */
  receiptPrinter: ReceiptPrinter
  /** When the receipt printer was set up (ms). Orders placed before it are not printed. */
  receiptsEnabledAt: number
  /** Order ids already printed, newest last, so an order prints once. */
  printedReceipts: string[]
}

export type LabelPaper = '4x6' | 'letter'

const DEFAULTS: DesktopSettings = {
  endpoint: DEFAULT_ENDPOINT,
  zoomFactor: 1,
  labelPrinter: '',
  labelPaper: 'letter',
  documentPrinter: '',
  receiptPrinter: RECEIPTS_OFF,
  receiptsEnabledAt: 0,
  printedReceipts: [],
}

function settingsPath(): string {
  return join(app.getPath('userData'), 'settings.json')
}

/**
 * Settings are a convenience, never a dependency: a missing, unreadable or
 * hand-edited file falls back to the defaults rather than stopping the app from
 * opening. A stored endpoint is re-validated on read, so editing the file by
 * hand cannot point the app somewhere it would refuse to be pointed in the UI.
 */
export function readSettings(): DesktopSettings {
  try {
    const raw = JSON.parse(readFileSync(settingsPath(), 'utf8')) as Partial<DesktopSettings>
    const endpoint =
      typeof raw.endpoint === 'string' ? validateEndpoint(raw.endpoint) : { error: 'missing' }
    const zoomFactor =
      typeof raw.zoomFactor === 'number' && raw.zoomFactor >= 0.5 && raw.zoomFactor <= 3
        ? raw.zoomFactor
        : DEFAULTS.zoomFactor

    const labelPrinter = typeof raw.labelPrinter === 'string' ? raw.labelPrinter.slice(0, 200) : ''
    const receiptPrinter = parseReceiptPrinter(raw.receiptPrinter)

    return {
      endpoint: 'url' in endpoint ? migrateLegacyDefault(endpoint.url) : DEFAULTS.endpoint,
      zoomFactor,
      labelPrinter,
      // An install that chose a label printer before letter sheets were an
      // option chose a 4×6 one, and keeps printing at 4×6.
      labelPaper:
        raw.labelPaper === '4x6' || raw.labelPaper === 'letter' ? raw.labelPaper : labelPrinter ? '4x6' : 'letter',
      documentPrinter: typeof raw.documentPrinter === 'string' ? raw.documentPrinter.slice(0, 200) : '',
      receiptPrinter: 'error' in receiptPrinter ? RECEIPTS_OFF : receiptPrinter,
      receiptsEnabledAt: typeof raw.receiptsEnabledAt === 'number' ? raw.receiptsEnabledAt : 0,
      printedReceipts: Array.isArray(raw.printedReceipts)
        ? raw.printedReceipts.filter((id): id is string => typeof id === 'string').slice(-PRINTED_MEMORY)
        : [],
    }
  } catch {
    return { ...DEFAULTS }
  }
}

export function writeSettings(settings: DesktopSettings): void {
  try {
    const path = settingsPath()
    mkdirSync(dirname(path), { recursive: true })
    writeFileSync(path, JSON.stringify(settings, null, 2), 'utf8')
  } catch (error) {
    console.error('[settings] could not be saved:', error)
  }
}
