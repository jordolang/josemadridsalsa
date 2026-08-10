'use client'

import { useCallback, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { ShieldCheck, ShieldOff } from 'lucide-react'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'

type Stage = 'idle' | 'enrolling' | 'showing-codes' | 'disabling'

/**
 * Enrol or remove a second factor.
 *
 * The secret is shown once during setup and the recovery codes exactly once after it —
 * only their hashes are stored, so there is no way to show them again. The UI says so
 * rather than letting someone assume they can come back for them.
 */
export function TwoFactorSettings() {
  const router = useRouter()
  // Fetches its own status so the card can be dropped into a client page without the
  // parent having to thread server state through.
  const [enabled, setEnabled] = useState(false)
  const [recoveryCodesRemaining, setRecoveryCodesRemaining] = useState(0)

  const refreshStatus = useCallback(async () => {
    try {
      const response = await fetch('/api/admin/security/two-factor')
      if (!response.ok) return
      const data = await response.json()
      setEnabled(Boolean(data.enabled))
      setRecoveryCodesRemaining(Number(data.recoveryCodesRemaining ?? 0))
    } catch {
      // Leaving the card showing "Off" is the safe failure: it never claims protection
      // that is not there.
    }
  }, [])

  useEffect(() => {
    void refreshStatus()
  }, [refreshStatus])
  const [stage, setStage] = useState<Stage>('idle')
  const [isSaving, setIsSaving] = useState(false)
  const [secret, setSecret] = useState('')
  const [otpauthUri, setOtpauthUri] = useState('')
  const [token, setToken] = useState('')
  const [password, setPassword] = useState('')
  const [recoveryCodes, setRecoveryCodes] = useState<string[]>([])

  async function post(body: Record<string, unknown>) {
    const response = await fetch('/api/admin/security/two-factor', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    const data = await response.json()
    if (!response.ok) throw new Error(data.error ?? 'Request failed')
    return data
  }

  async function start() {
    setIsSaving(true)
    try {
      const data = await post({ action: 'start' })
      setSecret(data.secret)
      setOtpauthUri(data.otpauthUri)
      setStage('enrolling')
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Could not start setup')
    } finally {
      setIsSaving(false)
    }
  }

  async function confirm() {
    setIsSaving(true)
    try {
      const data = await post({ action: 'confirm', token: token.trim() })
      setRecoveryCodes(data.recoveryCodes ?? [])
      setStage('showing-codes')
      setToken('')
      toast.success('Two-factor authentication enabled')
      void refreshStatus()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Could not verify that code')
    } finally {
      setIsSaving(false)
    }
  }

  async function disable() {
    setIsSaving(true)
    try {
      await post({ action: 'disable', password })
      setPassword('')
      setStage('idle')
      toast.success('Two-factor authentication disabled')
      void refreshStatus()
      router.refresh()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Could not disable')
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between gap-3">
          <div>
            <CardTitle className="flex items-center gap-2">
              {enabled ? <ShieldCheck className="size-5" /> : <ShieldOff className="size-5" />}
              Two-factor authentication
            </CardTitle>
            <CardDescription>
              Require a code from your authenticator app when signing in with a password.
            </CardDescription>
          </div>
          <Badge variant={enabled ? 'default' : 'outline'}>{enabled ? 'On' : 'Off'}</Badge>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {stage === 'showing-codes' && (
          <div className="space-y-2 rounded-md border border-amber-500/40 bg-amber-500/5 p-4">
            <p className="text-sm font-medium">Save these recovery codes now</p>
            <p className="text-xs text-muted-foreground">
              Each works once if you lose your device. Only their hashes are stored, so this
              is the only time they can be shown.
            </p>
            <ul className="grid grid-cols-2 gap-1 font-mono text-sm">
              {recoveryCodes.map((code) => (
                <li key={code}>{code}</li>
              ))}
            </ul>
            <Button
              size="sm"
              variant="outline"
              onClick={() => {
                setStage('idle')
                void refreshStatus()
                router.refresh()
              }}
            >
              I have saved them
            </Button>
          </div>
        )}

        {stage === 'enrolling' && (
          <div className="space-y-3">
            <div>
              <p className="text-sm font-medium">1. Add this to your authenticator app</p>
              <p className="mt-1 break-all font-mono text-xs text-muted-foreground">{secret}</p>
              <a
                href={otpauthUri}
                className="text-xs text-primary hover:underline"
                rel="noreferrer"
              >
                Or open it directly
              </a>
            </div>
            <div className="space-y-1">
              <Label htmlFor="totp-confirm" className="text-sm font-medium">
                2. Enter the six-digit code it shows
              </Label>
              <Input
                id="totp-confirm"
                inputMode="numeric"
                autoComplete="one-time-code"
                value={token}
                onChange={(e) => setToken(e.target.value)}
                placeholder="123456"
                className="w-40 font-mono"
              />
            </div>
            <div className="flex gap-2">
              <Button onClick={confirm} disabled={isSaving || token.trim().length < 6}>
                Enable
              </Button>
              <Button variant="ghost" onClick={() => setStage('idle')} disabled={isSaving}>
                Cancel
              </Button>
            </div>
          </div>
        )}

        {stage === 'disabling' && (
          <div className="space-y-3">
            <div className="space-y-1">
              <Label htmlFor="disable-password" className="text-sm">
                Confirm your password to turn this off
              </Label>
              <Input
                id="disable-password"
                type="password"
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-64"
              />
            </div>
            <div className="flex gap-2">
              <Button variant="destructive" onClick={disable} disabled={isSaving || !password}>
                Disable
              </Button>
              <Button variant="ghost" onClick={() => setStage('idle')} disabled={isSaving}>
                Cancel
              </Button>
            </div>
          </div>
        )}

        {stage === 'idle' &&
          (enabled ? (
            <div className="flex items-center justify-between gap-4">
              <p className="text-sm text-muted-foreground">
                {recoveryCodesRemaining} recovery code{recoveryCodesRemaining === 1 ? '' : 's'}{' '}
                remaining.
              </p>
              <Button variant="outline" onClick={() => setStage('disabling')}>
                Turn off
              </Button>
            </div>
          ) : (
            <Button onClick={start} disabled={isSaving}>
              Set up two-factor authentication
            </Button>
          ))}
      </CardContent>
    </Card>
  )
}
