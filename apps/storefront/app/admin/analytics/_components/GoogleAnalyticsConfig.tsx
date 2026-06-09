'use client'

import { useTransition, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { saveGoogleAnalyticsSettingsAction } from '../actions'
import type { GoogleAnalyticsSettings } from '@/types/analytics'

interface GoogleAnalyticsConfigProps {
  gaSettings: GoogleAnalyticsSettings
  canManageGa: boolean
  gaStatusIsReady: boolean
  serviceAccountConfigured: boolean
}

export function GoogleAnalyticsConfig({
  gaSettings,
  canManageGa,
  gaStatusIsReady,
  serviceAccountConfigured,
}: GoogleAnalyticsConfigProps) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setError(null)
    const formData = new FormData(e.currentTarget)

    startTransition(async () => {
      const result = await saveGoogleAnalyticsSettingsAction(formData)

      if ('error' in result) {
        setError(result.error)
        return
      }
      router.refresh()
    })
  }

  return (
    <>
      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <Card className="p-6 space-y-6">
        <div className="flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
          <div>
            <h2 className="text-xl font-semibold">Google Analytics configuration</h2>
            <p className="text-sm text-muted-foreground">
              Manage your GA4 property connection, Google Tag, and default chart definitions.
            </p>
          </div>
          <Badge className={gaStatusIsReady ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'}>
            {gaStatusIsReady ? 'Connected' : 'Action required'}
          </Badge>
        </div>
        <form onSubmit={handleSubmit} className="grid gap-4 md:grid-cols-3">
          <div className="space-y-1.5">
            <label htmlFor="measurementId" className="text-sm font-medium text-foreground">
              Google Tag (Measurement ID)
            </label>
            <Input
              id="measurementId"
              name="measurementId"
              placeholder="G-XXXXXXXXXX"
              defaultValue={gaSettings.measurementId ?? ''}
              disabled={!canManageGa || isPending}
            />
            <p className="text-xs text-muted-foreground">Used by the storefront to load the gtag snippet.</p>
          </div>
          <div className="space-y-1.5">
            <label htmlFor="propertyId" className="text-sm font-medium text-foreground">
              GA4 Property ID
            </label>
            <Input
              id="propertyId"
              name="propertyId"
              placeholder="123456789"
              defaultValue={gaSettings.propertyId ?? ''}
              disabled={!canManageGa || isPending}
            />
            <p className="text-xs text-muted-foreground">Only numbers or the `properties/123` syntax are accepted.</p>
          </div>
          <div className="space-y-1.5">
            <label htmlFor="dataStreamId" className="text-sm font-medium text-foreground">
              Data stream ID (optional)
            </label>
            <Input
              id="dataStreamId"
              name="dataStreamId"
              placeholder="345678901"
              defaultValue={gaSettings.dataStreamId ?? ''}
              disabled={!canManageGa || isPending}
            />
            <p className="text-xs text-muted-foreground">Helpful when you manage multiple storefront streams.</p>
          </div>
          <div className="md:col-span-3 flex justify-end">
            <Button type="submit" disabled={!canManageGa || isPending}>
              Save Google Analytics settings
            </Button>
          </div>
        </form>
        <div className="grid gap-2 text-sm text-muted-foreground md:grid-cols-2">
          <p>
            <span className="font-semibold text-foreground">Service account:</span>{' '}
            {serviceAccountConfigured ? (
              <span className="text-primary">Connected</span>
            ) : (
              <span>
                Missing — add <code className="rounded bg-muted px-1">google_analytics / service_account</code> in{' '}
                <Link href="/admin/settings/integrations" className="text-foreground underline">
                  Integrations
                </Link>
              </span>
            )}
          </p>
          <p>
            <span className="font-semibold text-foreground">Custom charts saved:</span>{' '}
            {gaSettings.chartDefinitions.length}
          </p>
        </div>
      </Card>
    </>
  )
}
