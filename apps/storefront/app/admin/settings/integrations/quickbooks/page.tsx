import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import type { Metadata } from 'next'
import Link from 'next/link'
import { ArrowLeft, CheckCircle2, TriangleAlert } from 'lucide-react'
import { getCurrentUser, hasPermission } from '@/lib/rbac'
import { prisma } from '@/lib/prisma'
import { logAudit } from '@/lib/audit'
import { createMetadata } from '@/lib/metadata'
import { getConnectionStatus } from '@/lib/quickbooks/connection'
import {
  listAccounts,
  listItems,
  type QuickBooksAccount,
  type QuickBooksItem,
} from '@/lib/quickbooks/client'
import {
  getLedgerAccountMap,
  saveLedgerAccountMap,
} from '@/lib/quickbooks/ledger-account-settings'
import { unmappedCategories, type LedgerAccountMapSetting } from '@/lib/quickbooks/ledger-accounts'
import {
  CATEGORY_DIRECTION,
  LEDGER_CATEGORY_LABELS,
  LEDGER_CATEGORY_VALUES,
} from '@/lib/financials/ledger'
import { DEFAULT_ACCOUNT_MAP } from '@/lib/financials/ledger-export'
import type { LedgerCategory } from '@prisma/client'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

export const metadata: Metadata = createMetadata({
  title: 'QuickBooks Sync Settings - Jose Madrid Salsa Admin',
  description: 'Map QuickBooks accounts and review the order sync queue.',
  pathname: '/admin/settings/integrations/quickbooks',
})

export const dynamic = 'force-dynamic'

/** Fields backed by a QBO account dropdown. */
const ACCOUNT_FIELDS = [
  {
    name: 'incomeAccountId',
    label: 'Sales income account',
    help: 'Where product revenue is booked. Required — sync stays off without it.',
    types: ['Income'],
  },
  {
    name: 'depositAccountId',
    label: 'Deposit account',
    help: 'Where receipt proceeds land, usually Undeposited Funds.',
    types: ['Bank', 'Other Current Asset'],
  },
  {
    name: 'discountAccountId',
    label: 'Discount account',
    help: 'Where checkout discounts are booked.',
    types: ['Income', 'Expense'],
  },
  {
    name: 'giftCertificateAccountId',
    label: 'Gift certificate liability',
    help: 'Redemptions draw this down. Orders paid with a gift certificate are held until it is set.',
    types: ['Other Current Liability', 'Long Term Liability'],
  },
] as const

/**
 * What to call an account in a picker or an export.
 *
 * The leaf `Name` is not unique: QuickBooks creates one "Refunds & discounts to customers" under
 * every income account, so a list of bare names offers the same word three times with no way to
 * tell which is which. The qualified path is also the form QuickBooks itself matches on when the
 * ledger's journal file is imported, so the same string serves both.
 */
function accountLabel(account: QuickBooksAccount): string {
  return account.FullyQualifiedName ?? account.Name
}

type MappingChoice = { id: string; label: string }

/**
 * The `<option>` list for one mapping select, always including whatever is currently stored.
 *
 * A stored id that QuickBooks no longer offers — a deleted or deactivated account, or one filtered
 * out of this field by type — has no matching option, so the select silently displays "Not mapped"
 * and the next save writes that lie back to the database. Giving the stored id an option of its own
 * means the page shows what is actually mapped, and a mapping can only be cleared on purpose.
 */
function mappingOptions(choices: MappingChoice[], current: string) {
  return (
    <>
      <option value="">Not mapped</option>
      {current && !choices.some((choice) => choice.id === current) && (
        <option value={current}>Saved id {current} — not offered by QuickBooks</option>
      )}
      {choices.map((choice) => (
        <option key={choice.id} value={choice.id}>
          {choice.label}
        </option>
      ))}
    </>
  )
}

/**
 * Read the account catalog, or send the operator back to the page rather than saving.
 *
 * Every select on this page is built from that catalog. When it cannot be read they are all empty,
 * so a submit — from a tab left open, or a render that failed the same way — carries nothing but
 * blanks, and storing it would wipe a working mapping. That is precisely how this page used to lose
 * one. Refusing re-renders the page, where the banner at the top says why nothing could be saved.
 */
async function requireAccountCatalog(): Promise<QuickBooksAccount[]> {
  try {
    return await listAccounts()
  } catch {
    redirect('/admin/settings/integrations/quickbooks')
  }
}

async function saveSettingsAction(formData: FormData) {
  'use server'

  const user = await getCurrentUser()
  if (!user || !(await hasPermission(user, 'api_keys:manage'))) {
    redirect('/admin')
  }

  const status = await getConnectionStatus()
  if (!status.connected) redirect('/admin/settings/integrations')

  await requireAccountCatalog()

  const value = (key: string) => {
    const raw = formData.get(key)
    const trimmed = typeof raw === 'string' ? raw.trim() : ''
    return trimmed.length > 0 ? trimmed : null
  }

  const startDateRaw = value('syncStartDate')
  const data = {
    incomeAccountId: value('incomeAccountId'),
    depositAccountId: value('depositAccountId'),
    discountAccountId: value('discountAccountId'),
    giftCertificateAccountId: value('giftCertificateAccountId'),
    shippingItemId: value('shippingItemId'),
    refundItemId: value('refundItemId'),
    // Anchored at noon so a timezone shift can't move the cutoff a day.
    syncStartDate: startDateRaw ? new Date(`${startDateRaw}T12:00:00`) : null,
    autoSyncEnabled: formData.get('autoSyncEnabled') === 'on',
  }

  // Sync cannot run without somewhere to book revenue, so the switch is refused
  // rather than saved into a state that would only fail later.
  if (data.autoSyncEnabled && !data.incomeAccountId) {
    data.autoSyncEnabled = false
  }

  await prisma.quickBooksSettings.upsert({
    where: { realmId: status.realmId },
    create: { realmId: status.realmId, ...data },
    update: data,
  })

  await logAudit({
    userId: user.id,
    action: 'quickbooks.settings-update',
    entityType: 'QuickBooksSettings',
    entityId: status.realmId,
    changes: { autoSyncEnabled: data.autoSyncEnabled },
  })

  revalidatePath('/admin/settings/integrations/quickbooks')
}

/**
 * Save the bookkeeping-ledger chart-of-accounts mapping.
 *
 * The form asks for one cash/clearing account, one inventory account, and the account each
 * category is booked to. Those are **expanded here into a fully explicit per-category map** with
 * both sides filled in, rather than being resolved later at post time. Two reasons: the stored map
 * then says exactly what will happen, so the sync's "refuse rather than guess" rule needs no
 * exceptions; and a person who changes the clearing account later can see which categories moved.
 *
 * Cost of goods offsets against inventory, not cash — the money for that stock left the bank when
 * the ingredients were bought, and crediting cash again would count the same payment twice.
 */
async function saveLedgerAccountsAction(formData: FormData) {
  'use server'

  const user = await getCurrentUser()
  if (!user || !(await hasPermission(user, 'api_keys:manage'))) {
    redirect('/admin')
  }

  const status = await getConnectionStatus()
  if (!status.connected) redirect('/admin/settings/integrations')

  const value = (key: string) => {
    const raw = formData.get(key)
    const trimmed = typeof raw === 'string' ? raw.trim() : ''
    return trimmed.length > 0 ? trimmed : null
  }

  // Names are stored beside the ids so the file exports can print a real account name rather
  // than falling back to a suggestion, and so the mapping stays readable if QuickBooks is
  // unreachable when someone opens this page.
  const names = new Map((await requireAccountCatalog()).map((a) => [a.Id, accountLabel(a)]))

  const clearingId = value('ledgerClearingAccountId')
  const inventoryId = value('ledgerInventoryAccountId')

  const map: LedgerAccountMapSetting = {}
  for (const category of LEDGER_CATEGORY_VALUES) {
    const accountId = value(`ledgerAccount_${category}`)
    const offsetId = category === 'COGS' ? inventoryId : clearingId
    if (!accountId && !offsetId) continue
    map[category as LedgerCategory] = {
      accountId,
      accountName: accountId ? (names.get(accountId) ?? null) : null,
      offsetId,
      offsetName: offsetId ? (names.get(offsetId) ?? null) : null,
    }
  }

  await saveLedgerAccountMap(status.realmId, map)

  await logAudit({
    userId: user.id,
    action: 'quickbooks.ledger-accounts-update',
    entityType: 'QuickBooksSettings',
    entityId: status.realmId,
    changes: { mapped: LEDGER_CATEGORY_VALUES.length - unmappedCategories(map).length },
  })

  revalidatePath('/admin/settings/integrations/quickbooks')
}

async function retryFailedAction() {
  'use server'

  const user = await getCurrentUser()
  if (!user || !(await hasPermission(user, 'api_keys:manage'))) {
    redirect('/admin')
  }

  // Blocked rows are included deliberately: the usual reason to press this is
  // having just fixed the mapping that blocked them.
  const result = await prisma.quickBooksSyncRecord.updateMany({
    where: { status: { in: ['FAILED', 'BLOCKED'] } },
    data: { status: 'PENDING', attempts: 0, nextAttemptAt: null, lastError: null },
  })

  await logAudit({
    userId: user.id,
    action: 'quickbooks.sync-retry',
    entityType: 'QuickBooksSyncRecord',
    entityId: 'bulk',
    changes: { requeued: result.count },
  })

  revalidatePath('/admin/settings/integrations/quickbooks')
}

export default async function QuickBooksSettingsPage() {
  const user = await getCurrentUser()
  if (!user || !(await hasPermission(user, 'api_keys:manage'))) {
    redirect('/admin')
  }

  const status = await getConnectionStatus()
  if (!status.connected) {
    redirect('/admin/settings/integrations')
  }

  const settings = await prisma.quickBooksSettings.findUnique({
    where: { realmId: status.realmId },
  })
  const ledgerAccounts = await getLedgerAccountMap(status.realmId)
  const ledgerUnmapped = unmappedCategories(ledgerAccounts)
  // Every category shares one clearing account except COGS, so reading either back is just a
  // matter of finding a category that carries it.
  const clearingAccountId = ledgerAccounts.PRODUCT_SALES?.offsetId ?? ''
  const inventoryAccountId = ledgerAccounts.COGS?.offsetId ?? ''

  // The company may be unreachable (expired refresh token, network); the page
  // still has to render so the operator can see why.
  let accounts: QuickBooksAccount[] = []
  let items: QuickBooksItem[] = []
  let catalogError: string | null = null
  try {
    ;[accounts, items] = await Promise.all([listAccounts(), listItems()])
  } catch (error) {
    catalogError = error instanceof Error ? error.message : 'Could not reach QuickBooks'
  }

  const accountChoices: MappingChoice[] = accounts.map((a) => ({ id: a.Id, label: accountLabel(a) }))
  const itemChoices: MappingChoice[] = items.map((i) => ({ id: i.Id, label: i.Name }))

  const counts = await prisma.quickBooksSyncRecord.groupBy({
    by: ['status'],
    _count: { _all: true },
  })
  const tally = Object.fromEntries(counts.map((c) => [c.status, c._count._all]))

  const attention = await prisma.quickBooksSyncRecord.findMany({
    where: { status: { in: ['FAILED', 'BLOCKED'] } },
    orderBy: { updatedAt: 'desc' },
    take: 10,
  })

  const toDateInput = (d: Date | null | undefined) =>
    d ? new Date(d).toISOString().slice(0, 10) : ''

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Link href="/admin/settings/integrations">
          <Button variant="ghost" size="sm">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
        <div>
          <h1 className="text-3xl font-bold">QuickBooks Sync</h1>
          <p className="text-muted-foreground">
            {status.companyName ?? 'Connected company'} · {status.environment}
          </p>
        </div>
      </div>

      {catalogError && (
        <Card className="space-y-2 border-destructive/50 bg-destructive/5 p-4">
          <p className="flex items-center gap-2 text-sm font-medium text-destructive">
            <TriangleAlert className="h-4 w-4" />
            Could not load accounts from QuickBooks: {catalogError}
          </p>
          <p className="text-sm text-destructive/90">
            Saving is turned off until this clears, because the pickers below are empty and a
            save would blank the mapping you already have. Nothing has been lost — reload once
            QuickBooks is reachable, or reconnect from{' '}
            <Link href="/admin/settings/integrations" className="underline">
              Integrations
            </Link>{' '}
            if the connection has expired.
          </p>
        </Card>
      )}

      <form action={saveSettingsAction}>
        <Card className="space-y-6 p-6">
          <div>
            <h2 className="text-xl font-semibold">Account mapping</h2>
            <p className="text-sm text-muted-foreground">
              Where each part of an order is booked. Orders are held rather than posted at
              the wrong figure when a needed account is missing.
            </p>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            {ACCOUNT_FIELDS.map((field) => {
              const choices = accounts
                .filter((a) => field.types.includes(a.AccountType as never))
                .map((a) => ({ id: a.Id, label: accountLabel(a) }))
              const current = settings?.[field.name] ?? ''
              return (
                <div key={field.name} className="space-y-2">
                  <Label htmlFor={field.name}>{field.label}</Label>
                  <select
                    id={field.name}
                    name={field.name}
                    defaultValue={current}
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  >
                    {mappingOptions(choices, current)}
                  </select>
                  <p className="text-xs text-muted-foreground">{field.help}</p>
                </div>
              )
            })}

            <div className="space-y-2">
              <Label htmlFor="shippingItemId">Shipping item</Label>
              <select
                id="shippingItemId"
                name="shippingItemId"
                defaultValue={settings?.shippingItemId ?? ''}
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              >
                {mappingOptions(itemChoices, settings?.shippingItemId ?? '')}
              </select>
              <p className="text-xs text-muted-foreground">
                The QuickBooks item used for the shipping line.
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="refundItemId">Refund item</Label>
              <select
                id="refundItemId"
                name="refundItemId"
                defaultValue={settings?.refundItemId ?? ''}
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              >
                {mappingOptions(itemChoices, settings?.refundItemId ?? '')}
              </select>
              <p className="text-xs text-muted-foreground">
                Where partial refunds land. Full refunds reverse the original lines instead,
                so this is only needed for partial ones.
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="syncStartDate">Sync orders placed on or after</Label>
              <Input
                id="syncStartDate"
                name="syncStartDate"
                type="date"
                defaultValue={toDateInput(settings?.syncStartDate)}
              />
              <p className="text-xs text-muted-foreground">
                Leave blank to sync everything. Set this to avoid pushing years of history
                into the books on the first run.
              </p>
            </div>
          </div>

          <label className="flex w-fit items-center gap-2 text-sm">
            <input
              type="checkbox"
              name="autoSyncEnabled"
              defaultChecked={settings?.autoSyncEnabled ?? false}
              className="h-4 w-4"
            />
            Push paid orders to QuickBooks automatically
          </label>

          {catalogError ? (
            <p className="text-sm text-muted-foreground">
              Saving is unavailable while the QuickBooks account list cannot be loaded.
            </p>
          ) : (
            <Button type="submit">Save mapping</Button>
          )}
        </Card>
      </form>

      <form action={saveLedgerAccountsAction}>
        <Card className="space-y-6 p-6">
          <div>
            <h2 className="text-xl font-semibold">Bookkeeping ledger accounts</h2>
            <p className="text-sm text-muted-foreground">
              Where each ledger category is booked. This drives two things: the journal-entry file
              you can download from{' '}
              <Link href="/admin/financials/ledger" className="underline">
                Financials → Ledger
              </Link>
              , and the automatic posting of money that never became an order — cash and show
              takings, hand-entered expenses, imported statement rows. Website orders are not
              affected; they post as sales receipts using the mapping above.
            </p>
          </div>

          {ledgerUnmapped.length > 0 && (
            <p className="rounded-md bg-amber-50 p-3 text-sm text-amber-900 dark:bg-amber-950/40 dark:text-amber-200">
              {ledgerUnmapped.length} of {LEDGER_CATEGORY_VALUES.length} categories are not fully
              mapped. Ledger rows in those categories are held rather than posted at a guessed
              account. The downloadable file still works — it falls back to a suggested account
              name for you to check.
            </p>
          )}

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="ledgerClearingAccountId">Cash / clearing account</Label>
              <select
                id="ledgerClearingAccountId"
                name="ledgerClearingAccountId"
                defaultValue={clearingAccountId}
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              >
                {mappingOptions(accountChoices, clearingAccountId)}
              </select>
              <p className="text-xs text-muted-foreground">
                The other side of every entry: where money in lands and money out comes from.
                Usually Undeposited Funds or a bank account.
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="ledgerInventoryAccountId">Inventory asset account</Label>
              <select
                id="ledgerInventoryAccountId"
                name="ledgerInventoryAccountId"
                defaultValue={inventoryAccountId}
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              >
                {mappingOptions(accountChoices, inventoryAccountId)}
              </select>
              <p className="text-xs text-muted-foreground">
                The other side for cost of goods only. Cost of goods is offset against inventory,
                not cash — that money left the bank when the stock was bought.
              </p>
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            {LEDGER_CATEGORY_VALUES.map((category) => (
              <div key={category} className="space-y-2">
                <Label htmlFor={`ledgerAccount_${category}`} className="flex items-center gap-2">
                  {LEDGER_CATEGORY_LABELS[category]}
                  <Badge variant="outline" className="text-[10px]">
                    {CATEGORY_DIRECTION[category] === 'INCOME' ? 'in' : 'out'}
                  </Badge>
                </Label>
                <select
                  id={`ledgerAccount_${category}`}
                  name={`ledgerAccount_${category}`}
                  defaultValue={ledgerAccounts[category]?.accountId ?? ''}
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                >
                  {mappingOptions(accountChoices, ledgerAccounts[category]?.accountId ?? '')}
                </select>
                <p className="text-xs text-muted-foreground">
                  Suggested: {DEFAULT_ACCOUNT_MAP[category].account}
                  {category === 'SALES_TAX_COLLECTED' && ' — a liability, not income'}
                </p>
              </div>
            ))}
          </div>

          {catalogError ? (
            <p className="text-sm text-muted-foreground">
              Saving is unavailable while the QuickBooks account list cannot be loaded.
            </p>
          ) : (
            <Button type="submit">Save ledger accounts</Button>
          )}
        </Card>
      </form>

      <Card className="space-y-4 p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-xl font-semibold">Sync queue</h2>
            <p className="text-sm text-muted-foreground">
              Orders are swept hourly; nothing here ever runs during checkout.
            </p>
          </div>
          {(tally.FAILED ?? 0) + (tally.BLOCKED ?? 0) > 0 && (
            <form action={retryFailedAction}>
              <Button type="submit" variant="outline" size="sm">
                Retry {(tally.FAILED ?? 0) + (tally.BLOCKED ?? 0)} held item(s)
              </Button>
            </form>
          )}
        </div>

        <div className="flex flex-wrap gap-2">
          {(['SYNCED', 'PENDING', 'BLOCKED', 'FAILED', 'SKIPPED'] as const).map((s) => (
            <Badge key={s} variant="outline">
              {s.toLowerCase()}: {tally[s] ?? 0}
            </Badge>
          ))}
        </div>

        {attention.length === 0 ? (
          <p className="flex items-center gap-2 py-6 text-sm text-muted-foreground">
            <CheckCircle2 className="h-4 w-4 text-green-600" />
            Nothing needs attention.
          </p>
        ) : (
          <div className="space-y-2">
            {attention.map((record) => (
              <div key={record.id} className="rounded-lg border p-3 text-sm">
                <div className="flex items-center gap-2">
                  <Badge
                    className={
                      record.status === 'BLOCKED'
                        ? 'bg-amber-100 text-amber-900 dark:bg-amber-950 dark:text-amber-300'
                        : 'bg-red-100 text-red-900 dark:bg-red-950 dark:text-red-300'
                    }
                  >
                    {record.status}
                  </Badge>
                  {/* A journal-entry row's id is a ledger entry, not an order — sending someone
                      to /admin/orders/<ledger id> would show them a 404 and no way to act. */}
                  {record.entityType === 'JOURNAL_ENTRY' ? (
                    <Link href="/admin/financials/ledger" className="font-medium hover:underline">
                      Ledger entry {record.entityId}
                    </Link>
                  ) : (
                    <Link
                      href={`/admin/orders/${record.entityId}`}
                      className="font-medium hover:underline"
                    >
                      Order {record.entityId}
                    </Link>
                  )}
                  <span className="text-xs text-muted-foreground">
                    {record.attempts} attempt(s)
                  </span>
                </div>
                {record.lastError && (
                  <p className="mt-1 text-muted-foreground">{record.lastError}</p>
                )}
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  )
}
