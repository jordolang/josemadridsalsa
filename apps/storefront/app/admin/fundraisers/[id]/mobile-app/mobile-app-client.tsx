'use client'

import { useState } from 'react'
import { toast } from 'sonner'
import { KeyRound, LogOut, RefreshCw, ShieldCheck, Smartphone } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import type { AppSettings } from '@/lib/fundraiser-app/admin'

/** `AppSettings` after crossing the server/client boundary: dates arrive as strings. */
type Settings = Omit<AppSettings, 'sellers'> & {
  sellers: Array<
    Omit<AppSettings['sellers'][number], 'pinSetAt' | 'devices'> & {
      pinSetAt: string | null
      devices: Array<{ id: string; deviceName: string | null; platform: string | null; lastSeenAt: string }>
    }
  >
}

const NO_ORGANIZER = 'none'

export function MobileAppClient({ initial, canWrite }: { initial: Settings; canWrite: boolean }) {
  const [settings, setSettings] = useState(initial)
  const [groupPin, setGroupPin] = useState('')
  const [busy, setBusy] = useState(false)

  async function send(url: string, method: 'PATCH' | 'POST', body: unknown, success: string) {
    setBusy(true)
    try {
      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const data = await response.json()
      if (!response.ok) throw new Error(data.error ?? 'Request failed')
      setSettings(data)
      toast.success(success)
      return true
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Request failed')
      return false
    } finally {
      setBusy(false)
    }
  }

  const base = `/api/admin/fundraisers/${settings.id}/mobile-app`
  const update = (body: unknown, success: string) => send(base, 'PATCH', body, success)
  const sellerAction = (sellerId: string, body: unknown, success: string) =>
    send(`${base}/sellers/${sellerId}`, 'POST', body, success)

  const organizer = settings.sellers.find((s) => s.id === settings.organizerId)
  const registered = settings.sellers.filter((s) => s.hasPin).length

  return (
    <div className="space-y-6">
      <Card className="space-y-6 p-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="flex items-center gap-2 text-xl font-semibold">
              <Smartphone className="h-5 w-5" /> App access
            </h2>
            <p className="text-sm text-muted-foreground">
              Sellers set up the app with the group ID, the group PIN and their first and last name.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Label htmlFor="app-enabled">{settings.enabled ? 'On' : 'Off'}</Label>
            <Switch
              id="app-enabled"
              checked={settings.enabled}
              disabled={!canWrite || busy}
              onCheckedChange={(enabled) =>
                update({ enabled }, enabled ? 'Mobile app turned on' : 'Mobile app turned off')
              }
            />
          </div>
        </div>

        <div className="grid gap-6 md:grid-cols-2">
          <div className="space-y-2">
            <Label>Group ID</Label>
            <div className="flex items-center gap-3">
              <span className="rounded-md border bg-muted px-4 py-2 font-mono text-2xl tracking-widest">
                {settings.groupCode ?? '— — —'}
              </span>
              {canWrite && (
                <Button
                  variant="outline"
                  size="sm"
                  disabled={busy}
                  onClick={() => {
                    if (
                      !settings.groupCode ||
                      confirm('Issue a new group ID? Phones already signed in stay signed in; new sellers will need the new ID.')
                    ) {
                      update({ regenerateCode: true }, 'New group ID issued')
                    }
                  }}
                >
                  <RefreshCw className="mr-2 h-4 w-4" />
                  {settings.groupCode ? 'New ID' : 'Issue ID'}
                </Button>
              )}
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="group-pin">
              Group PIN {settings.hasGroupPin ? <Badge variant="outline">Set</Badge> : <Badge variant="destructive">Not set</Badge>}
              {settings.groupLocked && <Badge variant="destructive" className="ml-2">Locked: too many wrong tries</Badge>}
            </Label>
            {canWrite && (
              <form
                className="flex gap-2"
                onSubmit={async (event) => {
                  event.preventDefault()
                  if (await update({ groupPin }, 'Group PIN saved')) setGroupPin('')
                }}
              >
                <Input
                  id="group-pin"
                  inputMode="numeric"
                  autoComplete="off"
                  pattern="\d{4,6}"
                  maxLength={6}
                  placeholder="4–6 digits"
                  value={groupPin}
                  onChange={(e) => setGroupPin(e.target.value.replace(/\D/g, ''))}
                />
                <Button type="submit" disabled={busy || groupPin.length < 4}>
                  <KeyRound className="mr-2 h-4 w-4" />
                  Save
                </Button>
              </form>
            )}
            <p className="text-xs text-muted-foreground">
              Give this to the organizer to share with sellers. It is stored scrambled, so write it down — you can
              always set a new one. The organizer can also change it in the app.
            </p>
          </div>
        </div>

        <div className="space-y-2">
          <Label className="flex items-center gap-2">
            <ShieldCheck className="h-4 w-4" /> Organizer seat (one per group)
          </Label>
          <Select
            value={settings.organizerId ?? NO_ORGANIZER}
            disabled={!canWrite || busy}
            onValueChange={(value) =>
              update(
                { organizerId: value === NO_ORGANIZER ? null : value },
                value === NO_ORGANIZER ? 'Organizer seat cleared' : 'Organizer seat assigned'
              )
            }
          >
            <SelectTrigger className="max-w-sm">
              <SelectValue placeholder="Nobody" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={NO_ORGANIZER}>Nobody</SelectItem>
              {settings.sellers.map((seller) => (
                <SelectItem key={seller.id} value={seller.id}>
                  {seller.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <p className="text-xs text-muted-foreground">
            The organizer can reset other sellers&apos; PINs and change the group PIN from the app. Have them join
            the app first, then pick them here.{' '}
            {organizer && !organizer.hasPin && 'They have not set up the app yet.'}
          </p>
        </div>
      </Card>

      <Card className="p-6">
        <h2 className="mb-1 text-xl font-semibold">Sellers</h2>
        <p className="mb-4 text-sm text-muted-foreground">
          {registered} of {settings.sellers.length} have set up the app. Resetting a PIN signs the seller out; they get
          back in with &ldquo;I already joined&rdquo; and choose a new PIN.
        </p>
        {settings.sellers.length === 0 ? (
          <p className="text-sm text-muted-foreground">No sellers yet. They appear here as they join in the app.</p>
        ) : (
          <div className="divide-y">
            {settings.sellers.map((seller) => (
              <div key={seller.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
                <div>
                  <div className="font-medium">
                    {seller.name}
                    {seller.id === settings.organizerId && <Badge className="ml-2">Organizer</Badge>}
                    {!seller.active && <Badge variant="outline" className="ml-2">Inactive</Badge>}
                  </div>
                  <p className="text-sm text-muted-foreground">
                    {seller.hasPin ? 'PIN set' : 'No PIN yet'}
                    {seller.lockedOut && ' · locked out after wrong PINs'}
                    {' · '}
                    {seller.devices.length === 0
                      ? 'not signed in'
                      : `${seller.devices.length} phone${seller.devices.length === 1 ? '' : 's'} · last seen ${new Date(
                          seller.devices[0].lastSeenAt
                        ).toLocaleString()}`}
                  </p>
                </div>
                {canWrite && (
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={busy || (!seller.hasPin && !seller.lockedOut)}
                      onClick={() => {
                        if (confirm(`Reset ${seller.name}'s PIN? Their phones will be signed out.`)) {
                          sellerAction(seller.id, { action: 'reset-pin' }, `${seller.name}'s PIN was reset`)
                        }
                      }}
                    >
                      <KeyRound className="mr-2 h-4 w-4" />
                      Reset PIN
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={busy || seller.devices.length === 0}
                      onClick={() => sellerAction(seller.id, { action: 'sign-out' }, `${seller.name} signed out`)}
                    >
                      <LogOut className="mr-2 h-4 w-4" />
                      Sign out
                    </Button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  )
}
