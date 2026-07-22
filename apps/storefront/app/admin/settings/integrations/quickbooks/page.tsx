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
import { listAccounts, listItems } from '@/lib/quickbooks/client'
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

async function saveSettingsAction(formData: FormData) {
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

  // The company may be unreachable (expired refresh token, network); the page
  // still has to render so the operator can see why.
  let accounts: Awaited<ReturnType<typeof listAccounts>> = []
  let items: Awaited<ReturnType<typeof listItems>> = []
  let catalogError: string | null = null
  try {
    ;[accounts, items] = await Promise.all([listAccounts(), listItems()])
  } catch (error) {
    catalogError = error instanceof Error ? error.message : 'Could not reach QuickBooks'
  }

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
        <Card className="border-destructive/50 bg-destructive/5 p-4">
          <p className="flex items-center gap-2 text-sm text-destructive">
            <TriangleAlert className="h-4 w-4" />
            Could not load accounts from QuickBooks: {catalogError}
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
              const options = accounts.filter((a) => field.types.includes(a.AccountType as never))
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
                    <option value="">Not mapped</option>
                    {options.map((a) => (
                      <option key={a.Id} value={a.Id}>
                        {a.Name}
                      </option>
                    ))}
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
                <option value="">Not mapped</option>
                {items.map((i) => (
                  <option key={i.Id} value={i.Id}>
                    {i.Name}
                  </option>
                ))}
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
                <option value="">Not mapped</option>
                {items.map((i) => (
                  <option key={i.Id} value={i.Id}>
                    {i.Name}
                  </option>
                ))}
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

          <Button type="submit">Save mapping</Button>
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
                Retry {(tally.FAILED ?? 0) + (tally.BLOCKED ?? 0)} held order(s)
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
                  <Link
                    href={`/admin/orders/${record.entityId}`}
                    className="font-medium hover:underline"
                  >
                    Order {record.entityId}
                  </Link>
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
