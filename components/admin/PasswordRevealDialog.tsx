'use client'

import { useState, useEffect } from 'react'
import { Lock } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

interface PasswordRevealDialogProps {
  credentialId: string
  credentialLabel: string
  open: boolean
  onOpenChange: (open: boolean) => void
  onReveal: (plaintext: string) => void
}

export default function PasswordRevealDialog({
  credentialId,
  credentialLabel,
  open,
  onOpenChange,
  onReveal,
}: PasswordRevealDialogProps) {
  const [password, setPassword] = useState('')
  const [isVerifying, setIsVerifying] = useState(false)
  const [error, setError] = useState('')
  const [attempts, setAttempts] = useState(0)

  useEffect(() => {
    if (!open) {
      setPassword('')
      setError('')
      setAttempts(0)
    }
  }, [open])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setIsVerifying(true)

    try {
      const response = await fetch(`/api/admin/credentials/${credentialId}/reveal`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password }),
      })

      const result = await response.json()

      if (!response.ok) {
        const newAttempts = attempts + 1
        setAttempts(newAttempts)
        setPassword('')
        if (response.status === 429) {
          throw new Error('Too many failed attempts. Please wait before trying again.')
        } else if (response.status === 401) {
          throw new Error(result.error || 'Incorrect password. Please try again.')
        } else {
          throw new Error('An error occurred. Please try again.')
        }
      }

      onOpenChange(false)
      onReveal(result.password)
    } catch (error: any) {
      setError(error.message)
    } finally {
      setIsVerifying(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <div className="mx-auto mb-2 flex h-12 w-12 items-center justify-center rounded-full bg-slate-100">
              <Lock className="h-6 w-6 text-slate-600" />
            </div>
            <DialogTitle className="text-center">Reveal Credential</DialogTitle>
            <DialogDescription className="text-center">
              Enter your password to reveal <strong>{credentialLabel}</strong>
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="reveal-password">Password</Label>
              <Input
                id="reveal-password"
                type="password"
                value={password}
                onChange={(e) => {
                  setPassword(e.target.value)
                  setError('')
                }}
                placeholder="Enter your password"
                autoFocus
                required
              />
              {error && (
                <p className="text-sm text-red-600">
                  {error}
                  {attempts > 1 && (
                    <span className="ml-1 text-red-400">
                      ({attempts} failed {attempts === 1 ? 'attempt' : 'attempts'})
                    </span>
                  )}
                </p>
              )}
            </div>
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={isVerifying}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={isVerifying || !password}>
              {isVerifying ? 'Verifying...' : 'Verify & Reveal'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
