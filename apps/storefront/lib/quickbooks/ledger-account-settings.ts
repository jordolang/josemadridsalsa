/**
 * Reading and writing the stored chart-of-accounts mapping.
 *
 * Separated from `ledger-accounts.ts` so that module — and the journal mapper built on it — stays
 * free of Prisma and testable without a database, the same split `mappers.ts` and `sync.ts` use.
 */
import { Prisma } from '@prisma/client'

import { prisma } from '@/lib/prisma'
import type { AccountMapOverrides } from '@/lib/financials/ledger-export'

import {
  parseLedgerAccountMap,
  toNameOverrides,
  type LedgerAccountMapSetting,
} from './ledger-accounts'

/** The stored map for a company. Empty when nothing has been mapped yet. */
export async function getLedgerAccountMap(realmId: string): Promise<LedgerAccountMapSetting> {
  const settings = await prisma.quickBooksSettings.findUnique({
    where: { realmId },
    select: { ledgerAccountMap: true },
  })
  return parseLedgerAccountMap(settings?.ledgerAccountMap)
}

/**
 * Name overrides for the file export, resolved without a realm id or a live connection.
 *
 * The export has to work for a business that has not connected QuickBooks at all, and for the
 * historical years that predate it, so "no connection" means "use the suggested defaults" rather
 * than an error. This is safe precisely because the file is reviewed by a person before import;
 * the sync, which is not, requires `getLedgerAccountMap` and mapped ids.
 */
export async function getLedgerAccountOverrides(): Promise<AccountMapOverrides | null> {
  try {
    const settings = await prisma.quickBooksSettings.findFirst({
      where: { ledgerAccountMap: { not: Prisma.DbNull } },
      select: { ledgerAccountMap: true },
    })
    if (!settings) return null
    return toNameOverrides(parseLedgerAccountMap(settings.ledgerAccountMap))
  } catch {
    // Downloading the ledger is a reporting path. It must not fail because the settings table is
    // unreachable or predates this column — the defaults produce a perfectly usable file.
    return null
  }
}

/** Replace the stored map for a company. */
export async function saveLedgerAccountMap(realmId: string, map: LedgerAccountMapSetting) {
  return prisma.quickBooksSettings.upsert({
    where: { realmId },
    create: { realmId, ledgerAccountMap: map as Prisma.InputJsonValue },
    update: { ledgerAccountMap: map as Prisma.InputJsonValue },
  })
}
