import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { getCurrentUser, hasPermission } from '@/lib/rbac'
import { logAudit } from '@/lib/audit'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Label } from '@/components/ui/label'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Separator } from '@/components/ui/separator'
import { ALLOWED_CARRIERS, CARRIER_LABELS } from '@/lib/shipping-carriers'

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
  const threshold = parsedThreshold !== null && Number.isFinite(parsedThreshold) && parsedThreshold > 0
    ? parsedThreshold
    : null

  const street = String(formData.get('street') || '').trim()
  const city = String(formData.get('city') || '').trim()
  const state = String(formData.get('state') || '').trim()
  const zipCode = String(formData.get('zipCode') || '').trim()
  const country = String(formData.get('country') || '').trim()

  const hasAddressFields = street || city || state || zipCode
  const originAddress = hasAddressFields
    ? { street, city, state, zipCode, country: country || 'US' }
    : null

  const defaultCarrierRaw = String(formData.get('defaultCarrier') || '').trim()
  const defaultCarrier = defaultCarrierRaw && defaultCarrierRaw !== 'none' ? defaultCarrierRaw : null

  const enabledCarriers = formData.getAll('enabledCarriers').map((c: FormDataEntryValue) => String(c))

  const settingsData = {
    freeShippingThreshold: threshold,
    originAddress: originAddress ? originAddress : Prisma.JsonNull,
    defaultCarrier,
    enabledCarriers,
    updatedById: user.id,
  }

  const settings = await prisma.shippingSettings.upsert({
    where: { singleton: 'singleton' },
    create: settingsData,
    update: {
      ...settingsData,
      enabledCarriers: { set: enabledCarriers },
    },
  })

  await logAudit({
    userId: user.id,
    action: 'shipping_settings.upsert',
    entityType: 'ShippingSettings',
    entityId: settings.id,
    changes: {
      freeShippingThreshold: threshold,
      originAddress,
      defaultCarrier,
      enabledCarriers,
    },
  })

  revalidatePath('/admin/settings/shipping')
}

export default async function ShippingSettingsPage() {
  const user = await getCurrentUser()

  if (!user || !(await hasPermission(user, 'settings:read'))) {
    redirect('/admin')
  }

  const canManage = await hasPermission(user, 'settings:write')

  const settings = await prisma.shippingSettings.findUnique({
    where: { singleton: 'singleton' },
  })

  const originAddress = settings?.originAddress as {
    street?: string
    city?: string
    state?: string
    zipCode?: string
    country?: string
  } | null

  const availableCarriers = ALLOWED_CARRIERS.map((c) => ({
    value: c,
    label: CARRIER_LABELS[c],
  }))

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-2 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <h1 className="text-3xl font-bold">Shipping Settings</h1>
          <p className="text-muted-foreground">
            Configure shipping rates, free shipping threshold, and origin address for carrier API calculations.
          </p>
        </div>
        {settings && (
          <div className="rounded-lg bg-muted px-4 py-2 text-sm text-muted-foreground">
            Last updated: {settings.updatedAt.toLocaleString()}
          </div>
        )}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Configuration</CardTitle>
          <CardDescription>
            Set the free shipping threshold and origin address used for real-time carrier rate calculations.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form action={saveShippingSettings} className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="freeShippingThreshold">Free shipping threshold</Label>
              <p className="text-xs text-muted-foreground">
                Orders above this amount qualify for free shipping. Leave blank to disable.
              </p>
              <div className="flex items-center gap-2">
                <span className="text-muted-foreground">$</span>
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

            <Separator />

            <div className="space-y-4">
              <div>
                <h3 className="text-lg font-semibold">Origin address</h3>
                <p className="text-sm text-muted-foreground">
                  The warehouse or fulfillment center address used to calculate shipping costs.
                </p>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2 md:col-span-2">
                  <Label htmlFor="street">Street address</Label>
                  <Input
                    type="text"
                    id="street"
                    name="street"
                    defaultValue={originAddress?.street || ''}
                    placeholder="123 Warehouse Blvd"
                    disabled={!canManage}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="city">City</Label>
                  <Input
                    type="text"
                    id="city"
                    name="city"
                    defaultValue={originAddress?.city || ''}
                    placeholder="San Francisco"
                    disabled={!canManage}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="state">State / Province</Label>
                  <Input
                    type="text"
                    id="state"
                    name="state"
                    defaultValue={originAddress?.state || ''}
                    placeholder="CA"
                    disabled={!canManage}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="zipCode">ZIP / Postal code</Label>
                  <Input
                    type="text"
                    id="zipCode"
                    name="zipCode"
                    defaultValue={originAddress?.zipCode || ''}
                    placeholder="94111"
                    disabled={!canManage}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="country">Country</Label>
                  <Input
                    type="text"
                    id="country"
                    name="country"
                    defaultValue={originAddress?.country || 'US'}
                    placeholder="US"
                    disabled={!canManage}
                  />
                </div>
              </div>
            </div>

            <Separator />

            <div className="space-y-4">
              <div>
                <h3 className="text-lg font-semibold">Carrier settings</h3>
                <p className="text-sm text-muted-foreground">
                  Select which shipping carriers to enable for rate calculation.
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="defaultCarrier">Default carrier</Label>
                <Select
                  name="defaultCarrier"
                  defaultValue={settings?.defaultCarrier || 'none'}
                  disabled={!canManage}
                >
                  <SelectTrigger id="defaultCarrier" className="max-w-xs">
                    <SelectValue placeholder="None (use cheapest)" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">None (use cheapest)</SelectItem>
                    {availableCarriers.map((carrier) => (
                      <SelectItem key={carrier.value} value={carrier.value}>
                        {carrier.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <fieldset className="space-y-2">
                <legend className="text-sm font-medium text-foreground">
                  Enabled carriers
                </legend>
                <p id="enabled-carriers-desc" className="text-xs text-muted-foreground">
                  Select which carriers to include in rate calculations.
                </p>
                <div className="space-y-2 pt-1" role="group" aria-describedby="enabled-carriers-desc">
                  {availableCarriers.map((carrier) => (
                    <div key={carrier.value} className="flex items-center gap-2">
                      <Checkbox
                        id={`carrier-${carrier.value}`}
                        name="enabledCarriers"
                        value={carrier.value}
                        defaultChecked={settings?.enabledCarriers?.includes(carrier.value)}
                        disabled={!canManage}
                      />
                      <Label
                        htmlFor={`carrier-${carrier.value}`}
                        className="font-normal"
                      >
                        {carrier.label}
                      </Label>
                    </div>
                  ))}
                </div>
              </fieldset>
            </div>

            {canManage && (
              <>
                <Separator />
                <div className="flex justify-end">
                  <Button type="submit">Save shipping settings</Button>
                </div>
              </>
            )}
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Current status</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3 text-sm">
            <div className="flex items-start gap-2">
              {settings?.freeShippingThreshold ? (
                <>
                  <Badge>Active</Badge>
                  <p className="text-muted-foreground">
                    Free shipping enabled for orders over ${settings.freeShippingThreshold.toString()}
                  </p>
                </>
              ) : (
                <>
                  <Badge variant="outline">Disabled</Badge>
                  <p className="text-muted-foreground">Free shipping threshold not configured</p>
                </>
              )}
            </div>

            <div className="flex items-start gap-2">
              {originAddress?.street && originAddress?.city ? (
                <>
                  <Badge>Configured</Badge>
                  <p className="text-muted-foreground">
                    Origin address: {originAddress.street}, {originAddress.city}, {originAddress.state} {originAddress.zipCode}
                  </p>
                </>
              ) : (
                <>
                  <Badge variant="secondary">Required</Badge>
                  <p className="text-muted-foreground">Origin address required for carrier rate calculation</p>
                </>
              )}
            </div>

            <div className="flex items-start gap-2">
              {settings?.enabledCarriers && settings.enabledCarriers.length > 0 ? (
                <>
                  <Badge>Active</Badge>
                  <p className="text-muted-foreground">
                    {settings.enabledCarriers.length} carrier{settings.enabledCarriers.length !== 1 ? 's' : ''} enabled: {settings.enabledCarriers.map(c => c.toUpperCase()).join(', ')}
                  </p>
                </>
              ) : (
                <>
                  <Badge variant="secondary">Warning</Badge>
                  <p className="text-muted-foreground">No carriers enabled - shipping calculations may fail</p>
                </>
              )}
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
