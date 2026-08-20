/**
 * The chart-of-accounts mapping that connects a ledger category to a QuickBooks account.
 *
 * One stored map serves two consumers with deliberately different standards of proof:
 *
 * - The **file exports** use the account *names*, falling back to the suggested defaults in
 *   `lib/financials/ledger-export.ts`. A person opens that file and reviews it before importing,
 *   so a sensible default is a helpful starting point rather than a claim about these books.
 * - The **journal sync** posts straight into the live books and uses account *ids* only. It has
 *   no reviewer, so it never falls back: an unmapped category blocks the row for a human instead
 *   of guessing an account. Money posted to the wrong account is silent and tedious to unpick.
 *
 * The parsing here is defensive because the column is `Json` — it holds whatever was last written,
 * including by an older version of the settings form.
 *
 * Pure by design: no Prisma import, so the journal mapper that depends on it stays unit-testable
 * without a database. Reading and writing the stored map lives in `ledger-account-settings.ts`.
 */
import type { LedgerCategory } from '@prisma/client'

import { LEDGER_CATEGORY_VALUES } from '@/lib/financials/ledger'
import type { AccountMapOverrides } from '@/lib/financials/ledger-export'

/** One category's mapping. Every field optional — a half-filled map is a normal state. */
export interface LedgerAccountSetting {
  accountId?: string | null
  accountName?: string | null
  offsetId?: string | null
  offsetName?: string | null
}

export type LedgerAccountMapSetting = Partial<Record<LedgerCategory, LedgerAccountSetting>>

const CATEGORIES = new Set<string>(LEDGER_CATEGORY_VALUES)

function cleanString(value: unknown): string | null {
  return typeof value === 'string' && value.trim().length > 0 ? value.trim() : null
}

/**
 * Read the stored Json into a typed map, dropping anything unrecognisable.
 *
 * Unknown keys are discarded rather than carried through, so a category renamed or removed in the
 * schema cannot resurface as a phantom account mapping in the settings screen.
 */
export function parseLedgerAccountMap(raw: unknown): LedgerAccountMapSetting {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {}
  const out: LedgerAccountMapSetting = {}

  for (const [key, value] of Object.entries(raw as Record<string, unknown>)) {
    if (!CATEGORIES.has(key)) continue
    if (!value || typeof value !== 'object' || Array.isArray(value)) continue
    const v = value as Record<string, unknown>
    const setting: LedgerAccountSetting = {
      accountId: cleanString(v.accountId),
      accountName: cleanString(v.accountName),
      offsetId: cleanString(v.offsetId),
      offsetName: cleanString(v.offsetName),
    }
    if (setting.accountId || setting.accountName || setting.offsetId || setting.offsetName) {
      out[key as LedgerCategory] = setting
    }
  }

  return out
}

/** The name-only view the file exports layer on top of its defaults. */
export function toNameOverrides(map: LedgerAccountMapSetting): AccountMapOverrides {
  const overrides: AccountMapOverrides = {}
  for (const [category, setting] of Object.entries(map) as Array<[LedgerCategory, LedgerAccountSetting]>) {
    overrides[category] = {
      ...(setting.accountName ? { account: setting.accountName } : {}),
      ...(setting.offsetName ? { offset: setting.offsetName } : {}),
    }
  }
  return overrides
}

export type AccountIdResolution =
  | { ok: true; accountId: string; offsetId: string }
  /** Named so the caller can put the missing side in front of the person who can fix it. */
  | { ok: false; missing: 'account' | 'offset' }

/**
 * The ids the journal sync needs. Both sides are required — a journal entry with one account is
 * not an entry — and there is deliberately no default to fall back on.
 */
export function resolveAccountIds(
  category: LedgerCategory,
  map: LedgerAccountMapSetting
): AccountIdResolution {
  const setting = map[category]
  const accountId = cleanString(setting?.accountId)
  if (!accountId) return { ok: false, missing: 'account' }
  const offsetId = cleanString(setting?.offsetId)
  if (!offsetId) return { ok: false, missing: 'offset' }
  return { ok: true, accountId, offsetId }
}

/** Which categories are not yet fully mapped, for the settings screen to show at a glance. */
export function unmappedCategories(map: LedgerAccountMapSetting): LedgerCategory[] {
  return LEDGER_CATEGORY_VALUES.filter(
    (c) => !resolveAccountIds(c as LedgerCategory, map).ok
  ) as LedgerCategory[]
}
