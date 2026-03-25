import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { getCurrentUser, hasPermission } from '@/lib/rbac'
import { logAudit } from '@/lib/audit'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'

async function saveShippingSettings(formData: FormData) {
  'use server'

  const user = await getCurrentUser()
  if (!user || !(await hasPermission(user, 'settings:write'))) {
    throw new Error('Unauthorized')
  }

  const freeShippingThreshold = formData.get('freeShippingThreshold')
  const parsedThreshold = freeShippingThreshold && String(freeShippingThreshold).trim().length > 0
    ? parseFloat(String(freeShippingThreshold))
    : null
  const threshold = parsedThreshold !== null && !isNaN(parsedThreshold) && parsedThreshold > 0
    ? parsedThreshold
    : null

  const street = String(formData.get('street') || '').trim()
  const city = String(formData.get('city') || '').trim()
  const state = String(formData.get('state') || '').trim()
  const zipCode = String(formData.get('zipCode') || '').trim()
  const country = String(formData.get('country') || '').trim()

  const originAddress = street || city || state || zipCode || country
    ? { street, city, state, zipCode, country }
    : null

  const defaultCarrier = String(formData.get('defaultCarrier') || '').trim() || null

  const enabledCarriers = formData.getAll('enabledCarriers').map((c: FormDataEntryValue) => String(c))

  const existing = await prisma.shippingSettings.findFirst({
    orderBy: { createdAt: 'desc' },
  })

  if (existing) {
    await prisma.shippingSettings.update({
      where: { id: existing.id },
      data: {
        freeShippingThreshold: threshold,
        originAddress: originAddress ? originAddress : Prisma.JsonNull,
        defaultCarrier,
        enabledCarriers: { set: enabledCarriers },
        updatedById: user.id,
      },
    })
  } else {
    await prisma.shippingSettings.create({
      data: {
        freeShippingThreshold: threshold,
        originAddress: originAddress ? originAddress : Prisma.JsonNull,
        defaultCarrier,
        enabledCarriers,
        updatedById: user.id,
      },
    })
  }

  const data = {
    freeShippingThreshold: threshold,
    originAddress,
    defaultCarrier,
    enabledCarriers,
  }

  await logAudit({
    userId: user.id,
    action: existing ? 'shipping_settings.update' : 'shipping_settings.create',
    entityType: 'ShippingSettings',
    entityId: existing?.id || 'new',
    changes: data,
  })

  revalidatePath('/admin/settings/shipping')
}

export default async function ShippingSettingsPage() {
  const user = await getCurrentUser()

  if (!user || !(await hasPermission(user, 'settings:read'))) {
    redirect('/admin')
  }

  const canManage = await hasPermission(user, 'settings:write')

  const settings = await prisma.shippingSettings.findFirst({
    orderBy: { createdAt: 'desc' },
  })

  const originAddress = settings?.originAddress as {
    street?: string
    city?: string
    state?: string
    zipCode?: string
    country?: string
  } | null

  const availableCarriers = [
    { value: 'usps', label: 'USPS' },
    { value: 'ups', label: 'UPS' },
    { value: 'fedex', label: 'FedEx' },
  ]

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-2 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <h1 className="text-3xl font-bold">Shipping Settings</h1>
          <p className="text-slate-600">
            Configure shipping rates, free shipping threshold, and origin address for carrier API calculations.
          </p>
        </div>
        {settings && (
          <div className="rounded-lg bg-slate-100 px-4 py-2 text-sm text-slate-600">
            Last updated: {settings.updatedAt.toLocaleString()}
          </div>
        )}
      </div>

      <Card className="p-6">
        <h2 className="text-xl font-semibold">Configuration</h2>
        <p className="text-sm text-slate-600">
          Set the free shipping threshold and origin address used for real-time carrier rate calculations.
        </p>

        <form action={saveShippingSettings} className="mt-6 space-y-6">
          <div>
            <label htmlFor="freeShippingThreshold" className="block text-sm font-medium text-slate-700">
              Free shipping threshold
            </label>
            <p className="text-xs text-slate-500">
              Orders above this amount qualify for free shipping. Leave blank to disable.
            </p>
            <div className="mt-2 flex items-center gap-2">
              <span className="text-slate-600">$</span>
              <Input
                type="number"
                step="0.01"
                min="0"
                id="freeShippingThreshold"
                name="freeShippingThreshold"
                defaultValue={settings?.freeShippingThreshold?.toString() || ''}
                placeholder="75.00"
                className="max-w-xs"
                disabled={!canManage}
              />
            </div>
          </div>

          <div className="border-t pt-6">
            <h3 className="text-lg font-semibold">Origin address</h3>
            <p className="text-sm text-slate-600">
              The warehouse or fulfillment center address used to calculate shipping costs.
            </p>

            <div className="mt-4 grid gap-4 md:grid-cols-2">
              <div className="md:col-span-2">
                <label htmlFor="street" className="block text-sm font-medium text-slate-700">
                  Street address
                </label>
                <Input
                  type="text"
                  id="street"
                  name="street"
                  defaultValue={originAddress?.street || ''}
                  placeholder="123 Warehouse Blvd"
                  className="mt-1"
                  disabled={!canManage}
                />
              </div>

              <div>
                <label htmlFor="city" className="block text-sm font-medium text-slate-700">
                  City
                </label>
                <Input
                  type="text"
                  id="city"
                  name="city"
                  defaultValue={originAddress?.city || ''}
                  placeholder="San Francisco"
                  className="mt-1"
                  disabled={!canManage}
                />
              </div>

              <div>
                <label htmlFor="state" className="block text-sm font-medium text-slate-700">
                  State / Province
                </label>
                <Input
                  type="text"
                  id="state"
                  name="state"
                  defaultValue={originAddress?.state || ''}
                  placeholder="CA"
                  className="mt-1"
                  disabled={!canManage}
                />
              </div>

              <div>
                <label htmlFor="zipCode" className="block text-sm font-medium text-slate-700">
                  ZIP / Postal code
                </label>
                <Input
                  type="text"
                  id="zipCode"
                  name="zipCode"
                  defaultValue={originAddress?.zipCode || ''}
                  placeholder="94111"
                  className="mt-1"
                  disabled={!canManage}
                />
              </div>

              <div>
                <label htmlFor="country" className="block text-sm font-medium text-slate-700">
                  Country
                </label>
                <Input
                  type="text"
                  id="country"
                  name="country"
                  defaultValue={originAddress?.country || 'US'}
                  placeholder="US"
                  className="mt-1"
                  disabled={!canManage}
                />
              </div>
            </div>
          </div>

          <div className="border-t pt-6">
            <h3 className="text-lg font-semibold">Carrier settings</h3>
            <p className="text-sm text-slate-600">
              Select which shipping carriers to enable for rate calculation.
            </p>

            <div className="mt-4">
              <label htmlFor="defaultCarrier" className="block text-sm font-medium text-slate-700">
                Default carrier
              </label>
              <select
                id="defaultCarrier"
                name="defaultCarrier"
                defaultValue={settings?.defaultCarrier || ''}
                className="mt-1 block w-full max-w-xs rounded-md border border-slate-300 bg-white px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 disabled:bg-slate-50 disabled:text-slate-500"
                disabled={!canManage}
              >
                <option value="">None (use cheapest)</option>
                {availableCarriers.map((carrier) => (
                  <option key={carrier.value} value={carrier.value}>
                    {carrier.label}
                  </option>
                ))}
              </select>
            </div>

            <div className="mt-4">
              <label className="block text-sm font-medium text-slate-700">
                Enabled carriers
              </label>
              <p className="text-xs text-slate-500">
                Select which carriers to include in rate calculations.
              </p>
              <div className="mt-2 space-y-2">
                {availableCarriers.map((carrier) => (
                  <div key={carrier.value} className="flex items-center">
                    <input
                      type="checkbox"
                      id={`carrier-${carrier.value}`}
                      name="enabledCarriers"
                      value={carrier.value}
                      defaultChecked={settings?.enabledCarriers?.includes(carrier.value)}
                      className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500 disabled:opacity-50"
                      disabled={!canManage}
                    />
                    <label
                      htmlFor={`carrier-${carrier.value}`}
                      className="ml-2 text-sm text-slate-700"
                    >
                      {carrier.label}
                    </label>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {canManage && (
            <div className="flex justify-end border-t pt-6">
              <Button type="submit">
                Save shipping settings
              </Button>
            </div>
          )}
        </form>
      </Card>

      <Card className="p-6">
        <h2 className="text-xl font-semibold">Current status</h2>
        <div className="mt-4 space-y-3 text-sm">
          <div className="flex items-start gap-2">
            {settings?.freeShippingThreshold ? (
              <>
                <Badge className="bg-emerald-100 text-emerald-700">Active</Badge>
                <p className="text-slate-600">
                  Free shipping enabled for orders over ${settings.freeShippingThreshold.toString()}
                </p>
              </>
            ) : (
              <>
                <Badge className="bg-slate-200 text-slate-600">Disabled</Badge>
                <p className="text-slate-600">Free shipping threshold not configured</p>
              </>
            )}
          </div>

          <div className="flex items-start gap-2">
            {originAddress?.street && originAddress?.city ? (
              <>
                <Badge className="bg-emerald-100 text-emerald-700">Configured</Badge>
                <p className="text-slate-600">
                  Origin address: {originAddress.street}, {originAddress.city}, {originAddress.state} {originAddress.zipCode}
                </p>
              </>
            ) : (
              <>
                <Badge className="bg-amber-100 text-amber-700">Required</Badge>
                <p className="text-slate-600">Origin address required for carrier rate calculation</p>
              </>
            )}
          </div>

          <div className="flex items-start gap-2">
            {settings?.enabledCarriers && settings.enabledCarriers.length > 0 ? (
              <>
                <Badge className="bg-emerald-100 text-emerald-700">Active</Badge>
                <p className="text-slate-600">
                  {settings.enabledCarriers.length} carrier{settings.enabledCarriers.length !== 1 ? 's' : ''} enabled: {settings.enabledCarriers.map(c => c.toUpperCase()).join(', ')}
                </p>
              </>
            ) : (
              <>
                <Badge className="bg-amber-100 text-amber-700">Warning</Badge>
                <p className="text-slate-600">No carriers enabled - shipping calculations may fail</p>
              </>
            )}
          </div>
        </div>
      </Card>
    </div>
  )
}
