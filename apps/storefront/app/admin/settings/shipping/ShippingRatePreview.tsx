'use client'

import { useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Loader2, Package } from 'lucide-react'

interface ShippingRate {
  id: string
  carrier: string
  service: string
  rate: number
  currency: string
  deliveryDays?: number
  deliveryDate?: string
  deliveryDateGuaranteed?: boolean
}

interface PreviewResult {
  success: boolean
  rates?: ShippingRate[]
  error?: string
  messages?: Array<{
    carrier?: string
    type: string
    message: string
  }>
}

interface ShippingRatePreviewProps {
  previewAction: (formData: FormData) => Promise<PreviewResult>
  defaultOrigin?: {
    street?: string
    city?: string
    state?: string
    zipCode?: string
    country?: string
  }
}

export function ShippingRatePreview({ previewAction, defaultOrigin }: ShippingRatePreviewProps) {
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<PreviewResult | null>(null)

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setLoading(true)
    setResult(null)

    try {
      const formData = new FormData(event.currentTarget)
      const previewResult = await previewAction(formData)
      setResult(previewResult)
    } catch (error) {
      setResult({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to preview rates',
      })
    } finally {
      setLoading(false)
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Shipping Rate Preview</CardTitle>
        <CardDescription>
          Test shipping calculations with a sample address and package dimensions.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="space-y-4">
            <div>
              <h3 className="text-sm font-semibold mb-3">Test Destination Address</h3>
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2 md:col-span-2">
                  <Label htmlFor="preview-street">Street address</Label>
                  <Input
                    type="text"
                    id="preview-street"
                    name="street"
                    placeholder="388 Townsend St"
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="preview-city">City</Label>
                  <Input
                    type="text"
                    id="preview-city"
                    name="city"
                    placeholder="San Francisco"
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="preview-state">State</Label>
                  <Input
                    type="text"
                    id="preview-state"
                    name="state"
                    placeholder="CA"
                    maxLength={2}
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="preview-zip">ZIP Code</Label>
                  <Input
                    type="text"
                    id="preview-zip"
                    name="zip"
                    placeholder="94107"
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="preview-country">Country</Label>
                  <Input
                    type="text"
                    id="preview-country"
                    name="country"
                    defaultValue="US"
                    maxLength={2}
                    required
                  />
                </div>
              </div>
            </div>

            <div>
              <h3 className="text-sm font-semibold mb-3">Package Dimensions</h3>
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="preview-length">Length (inches)</Label>
                  <Input
                    type="number"
                    step="0.1"
                    min="0.1"
                    id="preview-length"
                    name="length"
                    placeholder="12"
                    defaultValue="12"
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="preview-width">Width (inches)</Label>
                  <Input
                    type="number"
                    step="0.1"
                    min="0.1"
                    id="preview-width"
                    name="width"
                    placeholder="9"
                    defaultValue="9"
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="preview-height">Height (inches)</Label>
                  <Input
                    type="number"
                    step="0.1"
                    min="0.1"
                    id="preview-height"
                    name="height"
                    placeholder="6"
                    defaultValue="6"
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="preview-weight">Weight (ounces)</Label>
                  <Input
                    type="number"
                    step="0.1"
                    min="0.1"
                    id="preview-weight"
                    name="weight"
                    placeholder="16"
                    defaultValue="16"
                    required
                  />
                </div>
              </div>
              <p className="text-xs text-muted-foreground mt-2">
                Default dimensions represent a typical small box (1 lb package)
              </p>
            </div>
          </div>

          <Button type="submit" disabled={loading}>
            {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {loading ? 'Fetching rates...' : 'Preview rates'}
          </Button>
        </form>

        {result && (
          <div className="mt-6 space-y-4">
            {result.success && result.rates && result.rates.length > 0 && (
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <Package className="h-4 w-4 text-muted-foreground" />
                  <h4 className="text-sm font-semibold">
                    Available Rates ({result.rates.length})
                  </h4>
                </div>
                <div className="space-y-2">
                  {result.rates.map((rate) => (
                    <div
                      key={rate.id}
                      className="flex items-center justify-between rounded-lg border border-border bg-card p-3"
                    >
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <span className="font-medium">{rate.carrier}</span>
                          <Badge variant="outline" className="text-xs">
                            {rate.service}
                          </Badge>
                        </div>
                        {rate.deliveryDays && (
                          <p className="text-xs text-muted-foreground mt-1">
                            {rate.deliveryDays} {rate.deliveryDays === 1 ? 'day' : 'days'}
                            {rate.deliveryDate && ` (by ${rate.deliveryDate})`}
                          </p>
                        )}
                      </div>
                      <div className="text-right">
                        <p className="font-semibold">
                          ${rate.rate.toFixed(2)}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {result.success && result.rates && result.rates.length === 0 && (
              <div className="rounded-lg border border-yellow-200 bg-yellow-50 p-4">
                <p className="text-sm text-yellow-800">
                  No rates available for this shipment. Check your carrier API configuration and origin address settings.
                </p>
              </div>
            )}

            {result.messages && result.messages.length > 0 && (
              <div className="rounded-lg border border-blue-200 bg-blue-50 p-4">
                <ul className="space-y-1 text-sm text-blue-800">
                  {result.messages.map((msg, idx) => (
                    <li key={idx}>
                      {msg.carrier && <strong>{msg.carrier}:</strong>} {msg.message}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {!result.success && result.error && (
              <div className="rounded-lg border border-red-200 bg-red-50 p-4">
                <p className="text-sm text-red-800">{result.error}</p>
              </div>
            )}
          </div>
        )}

        {defaultOrigin && defaultOrigin.street && (
          <div className="mt-6 rounded-lg bg-muted p-4">
            <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground mb-2">
              Origin Address
            </p>
            <p className="text-sm text-foreground">
              {defaultOrigin.street}
              {defaultOrigin.city && `, ${defaultOrigin.city}`}
              {defaultOrigin.state && `, ${defaultOrigin.state}`}
              {defaultOrigin.zipCode && ` ${defaultOrigin.zipCode}`}
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
