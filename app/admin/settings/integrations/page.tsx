import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { prisma } from '@/lib/prisma'
import { getCurrentUser, hasPermission } from '@/lib/rbac'
import { encryptSecret } from '@/lib/crypto'
import { logAudit } from '@/lib/audit'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Textarea } from '@/components/ui/textarea'

async function saveServiceKey(formData: FormData) {
  'use server'

  const user = await getCurrentUser()
  if (!user || !(await hasPermission(user, 'api_keys:manage'))) {
    throw new Error('Unauthorized')
  }

  const serviceName = String(formData.get('serviceName') || '').trim()
  const keyName = String(formData.get('keyName') || '').trim()
  const rawValue = formData.get('value')
  const value = typeof rawValue === 'string' && rawValue.trim().length > 0 ? rawValue.trim() : null
  const isActive = formData.get('isActive') === 'on'

  if (!serviceName || !keyName) {
    throw new Error('Service name and key name are required')
  }

  const compositeKey = {
    serviceName: serviceName.toLowerCase(),
    keyName: keyName.toLowerCase(),
  }

  const existing = await prisma.serviceKey.findUnique({
    where: {
      serviceName_keyName: compositeKey,
    },
  })

  if (!existing && !value) {
    throw new Error('Please provide a secret value for new integrations')
  }

  const baseData = {
    serviceName: compositeKey.serviceName,
    keyName: compositeKey.keyName,
    isActive,
  }

  const encrypted = value ? encryptSecret(value) : null

  const createData = encrypted
    ? {
        ...baseData,
        encryptedValue: encrypted.encryptedValue,
        iv: encrypted.iv,
      }
    : {
        ...baseData,
        encryptedValue: existing?.encryptedValue ?? '',
        iv: existing?.iv ?? '',
      }

  await prisma.serviceKey.upsert({
    where: { serviceName_keyName: compositeKey },
    update: encrypted
      ? {
          ...baseData,
          encryptedValue: encrypted.encryptedValue,
          iv: encrypted.iv,
        }
      : baseData,
    create: createData,
  })

  await logAudit({
    userId: user.id,
    action: existing ? 'integration.update' : 'integration.create',
    entityType: 'ServiceKey',
    entityId: `${compositeKey.serviceName}:${compositeKey.keyName}`,
    changes: {
      isActive,
      rotated: Boolean(value),
    },
  })

  revalidatePath('/admin/settings/integrations')
}

async function toggleServiceKey(id: string, nextState: 'enable' | 'disable') {
  'use server'

  const user = await getCurrentUser()
  if (!user || !(await hasPermission(user, 'api_keys:manage'))) {
    throw new Error('Unauthorized')
  }

  const isActive = nextState === 'enable'

  await prisma.serviceKey.update({
    where: { id },
    data: {
      isActive,
    },
  })

  await logAudit({
    userId: user.id,
    action: 'integration.toggle',
    entityType: 'ServiceKey',
    entityId: id,
    changes: { isActive },
  })

  revalidatePath('/admin/settings/integrations')
}

export default async function IntegrationsPage() {
  const user = await getCurrentUser()

  if (!user || !(await hasPermission(user, 'settings:read'))) {
    redirect('/admin')
  }

  const canManage = await hasPermission(user, 'api_keys:manage')

  const serviceKeys = await prisma.serviceKey.findMany({
    orderBy: [{ serviceName: 'asc' }, { keyName: 'asc' }],
  })

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-2 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <h1 className="text-3xl font-bold">Integrations</h1>
          <p className="text-slate-600">
            Manage encrypted API credentials for payments, calendar sync, email, and social platforms.
          </p>
        </div>
        <div className="rounded-lg bg-slate-100 px-4 py-2 text-sm text-slate-600">
          Encryption enabled • Keys stored using AES-256-GCM
        </div>
      </div>

      <Card className="p-6">
        <h2 className="text-xl font-semibold">Current credentials</h2>
        {serviceKeys.length === 0 ? (
          <div className="py-12 text-center text-sm text-slate-500">
            No integrations configured yet. Add Stripe, Google Calendar, or social media secrets below.
          </div>
        ) : (
          <div className="mt-4 overflow-x-auto">
            <table className="w-full min-w-[720px]">
              <thead className="border-b bg-slate-50 text-sm text-slate-600">
                <tr>
                  <th className="px-4 py-3 text-left font-medium">Service</th>
                  <th className="px-4 py-3 text-left font-medium">Key</th>
                  <th className="px-4 py-3 text-left font-medium">Status</th>
                  <th className="px-4 py-3 text-left font-medium">Last used</th>
                  <th className="px-4 py-3 text-left font-medium">Updated</th>
                  {canManage && <th className="px-4 py-3 text-right font-medium">Actions</th>}
                </tr>
              </thead>
              <tbody className="text-sm">
                {serviceKeys.map((serviceKey) => {
                  const enableAction = toggleServiceKey.bind(null, serviceKey.id, 'enable')
                  const disableAction = toggleServiceKey.bind(null, serviceKey.id, 'disable')
                  return (
                    <tr key={serviceKey.id} className="border-b last:border-0">
                      <td className="px-4 py-4 font-medium text-slate-900">
                        {serviceKey.serviceName}
                      </td>
                      <td className="px-4 py-4 text-slate-600">{serviceKey.keyName}</td>
                      <td className="px-4 py-4">
                        <Badge className={serviceKey.isActive ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-200 text-slate-600'}>
                          {serviceKey.isActive ? 'Active' : 'Disabled'}
                        </Badge>
                      </td>
                      <td className="px-4 py-4 text-slate-600">
                        {serviceKey.lastUsed ? serviceKey.lastUsed.toLocaleString() : 'Never'}
                      </td>
                      <td className="px-4 py-4 text-slate-600">
                        {serviceKey.updatedAt.toLocaleString()}
                      </td>
                      {canManage && (
                        <td className="px-4 py-4 text-right">
                          <div className="flex justify-end gap-2">
                            {serviceKey.isActive ? (
                              <form action={disableAction}>
                                <Button type="submit" variant="ghost" size="sm">
                                  Disable
                                </Button>
                              </form>
                            ) : (
                              <form action={enableAction}>
                                <Button type="submit" variant="ghost" size="sm">
                                  Enable
                                </Button>
                              </form>
                            )}
                          </div>
                        </td>
                      )}
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <Card className="p-6">
        <h2 className="text-xl font-semibold">Add or rotate credentials</h2>
        <p className="text-sm text-slate-600">
          Secrets are encrypted immediately and never returned in plaintext. Re-enter a value to rotate it.
        </p>
        {canManage ? (
          <form action={saveServiceKey} className="mt-4 grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-700" htmlFor="serviceName">
                Service name
              </label>
              <Input
                id="serviceName"
                name="serviceName"
                placeholder="stripe"
                required
                className="font-mono text-sm"
              />
              <p className="text-xs text-slate-500">
                Lowercase identifier, e.g. <code>stripe</code>, <code>google_calendar</code>.
              </p>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-700" htmlFor="keyName">
                Key name
              </label>
              <Input
                id="keyName"
                name="keyName"
                placeholder="api_key"
                required
                className="font-mono text-sm"
              />
              <p className="text-xs text-slate-500">
                Label for this secret, e.g. <code>api_key</code>, <code>webhook_secret</code>.
              </p>
            </div>
            <div className="md:col-span-2 space-y-2">
              <label className="text-sm font-medium text-slate-700" htmlFor="value">
                Secret value
              </label>
              <Textarea
                id="value"
                name="value"
                placeholder="Paste the API key or credential value..."
                className="h-32 font-mono text-xs"
              />
              <p className="text-xs text-slate-500">
                Leave blank to keep the existing value for this service/key combination.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <input
                id="isActive"
                name="isActive"
                type="checkbox"
                defaultChecked
                className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
              />
              <label htmlFor="isActive" className="text-sm text-slate-700">
                Enable immediately
              </label>
            </div>
            <div className="md:col-span-2 flex justify-end">
              <Button type="submit">Save integration</Button>
            </div>
          </form>
        ) : (
          <div className="mt-4 rounded-lg bg-amber-50 p-4 text-sm text-amber-700">
            You have read-only access. Contact an administrator with API key permissions to add or rotate credentials.
          </div>
        )}
      </Card>
    </div>
  )
}
