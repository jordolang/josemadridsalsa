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
import { getShippingRates, type ShipmentRequest } from '@/lib/shipping-api'
import { resolveRateConfig } from '@/lib/shipping/rate-config'
import { CheckCircle2, XCircle, Truck } from 'lucide-react'
import { ShippingRatePreview } from './ShippingRatePreview'

/** Dollars string → whole cents, or null when blank/invalid (falls back to the built-in default). */
function dollarsToCents(value: FormDataEntryValue | null): number | null {
  const s = String(value ?? '').trim()
  if (!s) return null
  const n = Number(s)
  return Number.isFinite(n) && n >= 0 ? Math.round(n * 100) : null
}

/** Whole-number string → int, or null when blank/invalid. */
function toIntOrNull(value: FormDataEntryValue | null): number | null {
  const s = String(value ?? '').trim()
  if (!s) return null
  const n = Number(s)
  return Number.isInteger(n) && n >= 0 ? n : null
}

/** Multiplier string → positive number, or null when blank/invalid. */
function toMultiplierOrNull(value: FormDataEntryValue | null): number | null {
  const s = String(value ?? '').trim()
  if (!s) return null
  const n = Number(s)
  return Number.isFinite(n) && n > 0 ? n : null
}

type ConnectionStatus = 'connected' | 'not_configured' | 'error'

interface CarrierApiStatus {
  status: ConnectionStatus
  statusDetail: string
  provider?: string
  testMode: boolean
}

function getCarrierApiStatus(): CarrierApiStatus {
  const apiKey = process.env.SHIPPING_API_KEY
  const provider = process.env.SHIPPING_PROVIDER
  const testMode = process.env.SHIPPING_TEST_MODE === 'true'

  if (!apiKey) {
    return {
      status: 'not_configured',
      statusDetail: 'Carrier API key is not configured. Add SHIPPING_API_KEY to your environment variables.',
      testMode: false,
    }
  }

  if (!provider || !['easypost', 'shippo'].includes(provider)) {
    return {
      status: 'error',
      statusDetail: 'SHIPPING_PROVIDER must be set to either "easypost" or "shippo".',
      testMode,
    }
  }

  return {
    status: 'connected',
    statusDetail: `Connected to ${provider === 'easypost' ? 'EasyPost' : 'Shippo'} API. Real-time carrier rates are enabled.`,
    provider,
    testMode,
  }
}

const statusConfig: Record<
  ConnectionStatus,
  { label: string; badgeClass: string; Icon: typeof CheckCircle2 }
> = {
  connected: {
    label: 'Connected',
    badgeClass: 'bg-primary/10 text-primary',
    Icon: CheckCircle2,
  },
  not_configured: {
    label: 'Not configured',
    badgeClass: 'bg-muted text-muted-foreground',
    Icon: XCircle,
  },
  error: {
    label: 'Configuration error',
    badgeClass: 'bg-yellow-100 text-yellow-800',
    Icon: XCircle,
  },
}

async function saveShippingSettings(formData: FormData) {
  'use server'

  const user = await getCurrentUser()
  if (!user || !(await hasPermission(user, 'settings:write'))) {
    throw new Error('Unauthorized')
  }

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
      originAddress,
      defaultCarrier,
      enabledCarriers,
    },
  })

  revalidatePath('/admin/settings/shipping')
}

async function previewShippingRates(formData: FormData) {
  'use server'

  const user = await getCurrentUser()
  if (!user || !(await hasPermission(user, 'settings:read'))) {
    throw new Error('Unauthorized')
  }

  try {
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

    if (!originAddress?.street || !originAddress?.city || !originAddress?.state || !originAddress?.zipCode) {
      return {
        success: false,
        error: 'Origin address is not configured. Please configure the origin address in the settings above.',
      }
    }

    const street = String(formData.get('street') || '').trim()
    const city = String(formData.get('city') || '').trim()
    const state = String(formData.get('state') || '').trim()
    const zip = String(formData.get('zip') || '').trim()
    const country = String(formData.get('country') || 'US').trim()

    const length = parseFloat(String(formData.get('length') || '12'))
    const width = parseFloat(String(formData.get('width') || '9'))
    const height = parseFloat(String(formData.get('height') || '6'))
    const weight = parseFloat(String(formData.get('weight') || '16'))

    if (!street || !city || !state || !zip) {
      return {
        success: false,
        error: 'Please fill in all required address fields.',
      }
    }

    const request: ShipmentRequest = {
      fromAddress: {
        street1: originAddress.street,
        city: originAddress.city,
        state: originAddress.state,
        zip: originAddress.zipCode,
        country: originAddress.country || 'US',
      },
      toAddress: {
        street1: street,
        city,
        state,
        zip,
        country,
      },
      parcel: {
        length,
        width,
        height,
        weight,
      },
      reference: 'preview-test',
    }

    const result = await getShippingRates(request)

    return {
      success: true,
      rates: result.rates,
      messages: result.messages,
    }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to fetch shipping rates',
    }
  }
}

async function saveRatePresets(formData: FormData) {
  'use server'

  const user = await getCurrentUser()
  if (!user || !(await hasPermission(user, 'settings:write'))) {
    throw new Error('Unauthorized')
  }

  // Only the three remote states have a multiplier today; a blank field drops that state, so it
  // quotes at ×1. The whole map is stored explicitly (even when empty) so clearing every field
  // means "no surcharge" — storing null here would instead be read back as the built-in defaults.
  const surcharges: Record<string, number> = {}
  for (const state of ['AK', 'HI', 'PR'] as const) {
    const value = toMultiplierOrNull(formData.get(`surcharge_${state}`))
    if (value !== null) surcharges[state] = value
  }

  // Touches only the rate-preset columns, so origin and carrier settings are left untouched.
  const presetData = {
    flatRateCents: dollarsToCents(formData.get('flatRate')),
    weightSurchargeBaseCents: dollarsToCents(formData.get('weightBase')),
    weightSurchargePerLbCents: dollarsToCents(formData.get('weightPerLb')),
    weightSurchargeThresholdLb: toIntOrNull(formData.get('weightThreshold')),
    internationalRateCents: dollarsToCents(formData.get('internationalRate')),
    stateSurcharges: surcharges,
  }

  const settings = await prisma.shippingSettings.upsert({
    where: { singleton: 'singleton' },
    create: { ...presetData, updatedById: user.id },
    update: { ...presetData, updatedById: user.id },
  })

  await logAudit({
    userId: user.id,
    action: 'shipping_settings.rate_presets',
    entityType: 'ShippingSettings',
    entityId: settings.id,
    changes: { ...presetData, stateSurcharges: surcharges },
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

  // Effective rate presets (stored values merged over the built-in defaults) for the form defaults.
  const rateConfig = resolveRateConfig(settings)
  const dollars = (cents: number) => (cents / 100).toFixed(2)

  const availableCarriers = ALLOWED_CARRIERS.map((c) => ({
    value: c,
    label: CARRIER_LABELS[c],
  }))

  const apiStatus = getCarrierApiStatus()
  const config = statusConfig[apiStatus.status]
  const StatusIcon = config.Icon

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-2 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <h1 className="text-3xl font-bold">Shipping Settings</h1>
          <p className="text-muted-foreground">
            Configure shipping rates and the origin address for carrier API calculations.
          </p>
        </div>
        {settings && (
          <div className="rounded-lg bg-muted px-4 py-2 text-sm text-muted-foreground">
            Last updated: {settings.updatedAt.toLocaleString()}
          </div>
        )}
      </div>

      <Card className="p-6">
        <div className="flex items-start gap-4">
          <div className="rounded-lg bg-muted p-3">
            <Truck className="h-6 w-6 text-muted-foreground" />
          </div>
          <div className="flex-1">
            <div className="flex items-center gap-3">
              <h2 className="text-lg font-semibold text-foreground">
                Carrier API Integration
              </h2>
              <Badge className={config.badgeClass}>
                <StatusIcon className="mr-1 h-3 w-3" />
                {config.label}
              </Badge>
              {apiStatus.testMode && (
                <Badge className="bg-blue-100 text-blue-800">
                  Test Mode
                </Badge>
              )}
            </div>
            <p className="mt-1 text-sm text-muted-foreground">
              {apiStatus.provider === 'easypost'
                ? 'EasyPost provides real-time shipping rates from USPS, UPS, FedEx, and more.'
                : apiStatus.provider === 'shippo'
                  ? 'Shippo provides real-time shipping rates from multiple carriers.'
                  : 'Configure a shipping provider to enable real-time carrier rate calculations.'}
            </p>
          </div>
        </div>

        <div className="mt-4 rounded-lg bg-muted/50 p-4">
          <p className="text-sm text-foreground">{apiStatus.statusDetail}</p>
        </div>

        {apiStatus.status === 'not_configured' && (
          <div className="mt-3 rounded-lg border border-border bg-card p-4">
            <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground mb-2">
              Setup instructions
            </p>
            <p className="text-sm text-muted-foreground">
              To enable real-time carrier rates, add SHIPPING_PROVIDER (easypost or shippo) and SHIPPING_API_KEY to your environment variables.
              Optionally set SHIPPING_TEST_MODE=true for testing.
            </p>
          </div>
        )}
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Configuration</CardTitle>
          <CardDescription>
            Set the warehouse origin address used for real-time carrier rate calculations. Shipping
            is charged on every order — there is no free-shipping threshold.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form action={saveShippingSettings} className="space-y-6">
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
          <CardTitle>Flat-rate presets</CardTitle>
          <CardDescription>
            The rates quoted when a live carrier rate isn&apos;t available — no API key, an unset
            origin, or a carrier outage. Live EasyPost rates, when available, are used ahead of
            these. Leave a field blank to use the built-in default.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form action={saveRatePresets} className="space-y-6">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="flatRate">Flat rate ($)</Label>
                <Input
                  id="flatRate"
                  name="flatRate"
                  type="number"
                  step="0.01"
                  min="0"
                  defaultValue={dollars(rateConfig.flatRateCents)}
                  disabled={!canManage}
                />
                <p className="text-xs text-muted-foreground">Base domestic rate for a light order.</p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="internationalRate">International rate ($)</Label>
                <Input
                  id="internationalRate"
                  name="internationalRate"
                  type="number"
                  step="0.01"
                  min="0"
                  defaultValue={dollars(rateConfig.internationalRateCents)}
                  disabled={!canManage}
                />
                <p className="text-xs text-muted-foreground">Flat rate for any non-US destination.</p>
              </div>
            </div>

            <fieldset className="space-y-4">
              <legend className="text-sm font-medium text-foreground">Heavy-order surcharge</legend>
              <p className="text-xs text-muted-foreground">
                Above the threshold weight, the base flat rate is replaced by{' '}
                <span className="whitespace-nowrap">base + per-pound × pounds-over-threshold</span>{' '}
                when that is higher.
              </p>
              <div className="grid gap-4 sm:grid-cols-3">
                <div className="space-y-2">
                  <Label htmlFor="weightThreshold">Threshold (lb)</Label>
                  <Input
                    id="weightThreshold"
                    name="weightThreshold"
                    type="number"
                    step="1"
                    min="0"
                    defaultValue={String(rateConfig.weightSurchargeThresholdLb)}
                    disabled={!canManage}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="weightBase">Base ($)</Label>
                  <Input
                    id="weightBase"
                    name="weightBase"
                    type="number"
                    step="0.01"
                    min="0"
                    defaultValue={dollars(rateConfig.weightSurchargeBaseCents)}
                    disabled={!canManage}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="weightPerLb">Per pound ($)</Label>
                  <Input
                    id="weightPerLb"
                    name="weightPerLb"
                    type="number"
                    step="0.01"
                    min="0"
                    defaultValue={dollars(rateConfig.weightSurchargePerLbCents)}
                    disabled={!canManage}
                  />
                </div>
              </div>
            </fieldset>

            <fieldset className="space-y-4">
              <legend className="text-sm font-medium text-foreground">Remote-state multipliers</legend>
              <p className="text-xs text-muted-foreground">
                The domestic rate is multiplied by this for the listed destinations. Leave blank for
                no surcharge (×1).
              </p>
              <div className="grid gap-4 sm:grid-cols-3">
                {(['AK', 'HI', 'PR'] as const).map((state) => (
                  <div key={state} className="space-y-2">
                    <Label htmlFor={`surcharge_${state}`}>
                      {state === 'AK' ? 'Alaska' : state === 'HI' ? 'Hawaii' : 'Puerto Rico'} (×)
                    </Label>
                    <Input
                      id={`surcharge_${state}`}
                      name={`surcharge_${state}`}
                      type="number"
                      step="0.1"
                      min="0"
                      defaultValue={rateConfig.stateSurcharges[state]?.toString() ?? ''}
                      disabled={!canManage}
                    />
                  </div>
                ))}
              </div>
            </fieldset>

            {canManage && (
              <div className="flex justify-end">
                <Button type="submit">Save rate presets</Button>
              </div>
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

      <ShippingRatePreview
        previewAction={previewShippingRates}
        defaultOrigin={originAddress || undefined}
      />
    </div>
  )
}
