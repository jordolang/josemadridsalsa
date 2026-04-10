'use client'

import { useState } from 'react'
import { Eye } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'

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
  const [isRevealing, setIsRevealing] = useState(false)
  const [error, setError] = useState('')

  const handleConfirm = async () => {
    setError('')
    setIsRevealing(true)

    try {
      const response = await fetch(`/api/admin/credentials/${credentialId}/reveal`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      })

      const result = await response.json()

      if (!response.ok) {
        throw new Error(result.error || 'Failed to reveal password')
      }

      onOpenChange(false)
      onReveal(result.password)
    } catch (err: any) {
      setError(err.message)
    } finally {
      setIsRevealing(false)
    }
  }

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <div className="mx-auto mb-2 flex h-12 w-12 items-center justify-center rounded-full bg-amber-100">
            <Eye className="h-6 w-6 text-muted-foreground" />
          </div>
          <AlertDialogTitle className="text-center">Reveal Password</AlertDialogTitle>
          <AlertDialogDescription className="text-center">
            Are you sure you want to display the password for{' '}
            <strong>{credentialLabel}</strong>?
            <br />
            <span className="mt-1 block text-xs text-muted-foreground">
              The password will be visible for 10 seconds before automatically hiding.
            </span>
          </AlertDialogDescription>
        </AlertDialogHeader>
        {error && (
          <div className="rounded-lg border border-destructive/30 bg-destructive/10 p-3">
            <p className="text-sm text-destructive">{error}</p>
          </div>
        )}
        <AlertDialogFooter>
          <AlertDialogCancel disabled={isRevealing}>Cancel</AlertDialogCancel>
          <AlertDialogAction onClick={handleConfirm} disabled={isRevealing}>
            {isRevealing ? 'Revealing...' : 'Yes, Show Password'}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
