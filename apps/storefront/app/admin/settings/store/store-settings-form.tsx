'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Loader2, Save } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Card } from '@/components/ui/card'
import { Switch } from '@/components/ui/switch'
import { getErrorMessage } from '@/lib/errors'
import type { StoreSettings } from '@/lib/store-settings'

interface StoreSettingsFormProps {
  initial: StoreSettings
  canWrite: boolean
}

export function StoreSettingsForm({ initial, canWrite }: StoreSettingsFormProps) {
  const router = useRouter()
  const [saving, setSaving] = useState(false)

  const [allowGuestCheckout, setAllowGuestCheckout] = useState(initial.allowGuestCheckout)
  const [minimumOrder, setMinimumOrder] = useState(
    initial.minimumOrderCents > 0 ? (initial.minimumOrderCents / 100).toFixed(2) : ''
  )
  const [businessName, setBusinessName] = useState(initial.businessName ?? '')
  const [supportEmail, setSupportEmail] = useState(initial.supportEmail ?? '')
  const [supportPhone, setSupportPhone] = useState(initial.supportPhone ?? '')
  const [businessAddress, setBusinessAddress] = useState(initial.businessAddress ?? '')
  const [defaultLowStockThreshold, setDefaultLowStockThreshold] = useState(
    String(initial.defaultLowStockThreshold)
  )
  const [termsContent, setTermsContent] = useState(initial.termsContent ?? '')
  const [privacyContent, setPrivacyContent] = useState(initial.privacyContent ?? '')
  const [returnsContent, setReturnsContent] = useState(initial.returnsContent ?? '')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    try {
      // Parse the whole string with Number (not parseFloat/parseInt, which accept a valid
      // prefix like "12abc" or truncate "1e2") and reject anything that isn't a clean value.
      const minTrim = minimumOrder.trim()
      const minimumOrderDollars = minTrim ? Number(minTrim) : 0
      if (!Number.isFinite(minimumOrderDollars) || minimumOrderDollars < 0) {
        throw new Error('Minimum order must be a non-negative amount.')
      }
      const minimumOrderCents = Math.round(minimumOrderDollars * 100)

      // A cleared threshold is an error, not a silent reset — the column is non-null, and
      // coercing back to a hardcoded default is exactly what this setting exists to replace.
      const threshold = Number(defaultLowStockThreshold.trim())
      if (!Number.isInteger(threshold) || threshold < 0) {
        throw new Error('Low-stock threshold must be a whole number of 0 or more.')
      }

      const payload = {
        allowGuestCheckout,
        minimumOrderCents,
        businessName: businessName.trim() || null,
        supportEmail: supportEmail.trim() || null,
        supportPhone: supportPhone.trim() || null,
        businessAddress: businessAddress.trim() || null,
        defaultLowStockThreshold: threshold,
        termsContent: termsContent.trim() || null,
        privacyContent: privacyContent.trim() || null,
        returnsContent: returnsContent.trim() || null,
      }

      const res = await fetch('/api/admin/settings/store', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      const result = await res.json()
      if (!res.ok) throw new Error(result.error || 'Failed to save settings')

      toast.success('Store settings saved')
      router.refresh()
    } catch (err: unknown) {
      toast.error('Could not save', { description: getErrorMessage(err) })
    } finally {
      setSaving(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Disable every control for read-only users, and while a save is in flight so an edit
          can't be lost between the request and the refresh. */}
      <fieldset disabled={!canWrite || saving} className="m-0 space-y-6 border-0 p-0">
      <Card className="p-6">
        <h2 className="mb-1 text-lg font-semibold">Checkout</h2>
        <p className="mb-4 text-sm text-muted-foreground">Rules enforced on every online order.</p>
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <Label htmlFor="allowGuestCheckout">Allow guest checkout</Label>
              <p className="text-sm text-muted-foreground">
                When off, shoppers must sign in before placing an order.
              </p>
            </div>
            <Switch
              id="allowGuestCheckout"
              aria-label="Allow guest checkout"
              checked={allowGuestCheckout}
              onCheckedChange={setAllowGuestCheckout}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="minimumOrder">Minimum order amount ($)</Label>
            <Input
              id="minimumOrder"
              inputMode="decimal"
              placeholder="0.00 (no minimum)"
              value={minimumOrder}
              onChange={(e) => setMinimumOrder(e.target.value)}
            />
            <p className="text-xs text-muted-foreground">
              Orders below this subtotal are rejected at checkout. Leave blank for no minimum.
            </p>
          </div>
        </div>
      </Card>

      <Card className="p-6">
        <h2 className="mb-1 text-lg font-semibold">Store identity</h2>
        <p className="mb-4 text-sm text-muted-foreground">
          Shown on the storefront (e.g. the contact page). Blank falls back to the built-in defaults.
        </p>
        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="businessName">Business name</Label>
            <Input id="businessName" value={businessName} onChange={(e) => setBusinessName(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="supportEmail">Support email</Label>
            <Input id="supportEmail" type="email" value={supportEmail} onChange={(e) => setSupportEmail(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="supportPhone">Support phone</Label>
            <Input id="supportPhone" value={supportPhone} onChange={(e) => setSupportPhone(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="businessAddress">Business address</Label>
            <Input id="businessAddress" value={businessAddress} onChange={(e) => setBusinessAddress(e.target.value)} />
          </div>
        </div>
      </Card>

      <Card className="p-6">
        <h2 className="mb-1 text-lg font-semibold">Operational defaults</h2>
        <div className="space-y-2">
          <Label htmlFor="threshold">Default low-stock threshold</Label>
          <Input
            id="threshold"
            type="number"
            min={0}
            value={defaultLowStockThreshold}
            onChange={(e) => setDefaultLowStockThreshold(e.target.value)}
            className="max-w-[10rem]"
          />
          <p className="text-xs text-muted-foreground">
            New products get this low-stock threshold unless one is set on the product.
          </p>
        </div>
      </Card>

      <Card className="p-6">
        <h2 className="mb-1 text-lg font-semibold">Legal pages</h2>
        <p className="mb-4 text-sm text-muted-foreground">
          Custom text shown on the Terms, Privacy, and Returns pages. Leave a field blank to keep the
          built-in page.
        </p>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="terms">Terms of Service</Label>
            <Textarea id="terms" rows={5} value={termsContent} onChange={(e) => setTermsContent(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="privacy">Privacy Policy</Label>
            <Textarea id="privacy" rows={5} value={privacyContent} onChange={(e) => setPrivacyContent(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="returns">Returns Policy</Label>
            <Textarea id="returns" rows={5} value={returnsContent} onChange={(e) => setReturnsContent(e.target.value)} />
          </div>
        </div>
      </Card>
      </fieldset>

      {canWrite ? (
        <Button type="submit" disabled={saving}>
          {saving ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Saving...</> : <><Save className="mr-2 h-4 w-4" />Save settings</>}
        </Button>
      ) : (
        <p className="text-sm text-muted-foreground">You have read-only access to settings.</p>
      )}
    </form>
  )
}
