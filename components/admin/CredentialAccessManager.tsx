'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
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
import { Loader2, UserPlus, X, Shield } from 'lucide-react'
import { toast } from 'sonner'

interface AccessGrant {
  id: string
  email: string
  grantedByEmail: string
  canView: boolean
  canAdd: boolean
  canEdit: boolean
  canDelete: boolean
  canUpload: boolean
  createdAt: string
  revokedAt: string | null
}

interface CredentialAccessManagerProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export default function CredentialAccessManager({
  open,
  onOpenChange,
}: CredentialAccessManagerProps) {
  const [grants, setGrants] = useState<AccessGrant[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [isSaving, setIsSaving] = useState(false)

  // New grant form
  const [newEmail, setNewEmail] = useState('')
  const [newPerms, setNewPerms] = useState({
    canView: true,
    canAdd: false,
    canEdit: false,
    canDelete: false,
    canUpload: false,
  })

  // Revoke confirmation
  const [revokeEmail, setRevokeEmail] = useState<string | null>(null)
  const [isRevoking, setIsRevoking] = useState(false)

  const fetchGrants = async () => {
    setIsLoading(true)
    try {
      const response = await fetch('/api/admin/credentials/access')
      const result = await response.json()
      if (response.ok) {
        setGrants(result.grants)
      }
    } catch {
      toast.error('Error', { description: 'Failed to load access grants' })
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    if (open) {
      fetchGrants()
    }
  }, [open])

  const handleAddGrant = async () => {
    if (!newEmail.trim()) return
    setIsSaving(true)
    try {
      const response = await fetch('/api/admin/credentials/access', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: newEmail.trim(), ...newPerms }),
      })
      const result = await response.json()
      if (!response.ok) throw new Error(result.error || 'Failed to add grant')

      toast.success('Success', { description: `Access granted to ${newEmail}` })
      setNewEmail('')
      setNewPerms({ canView: true, canAdd: false, canEdit: false, canDelete: false, canUpload: false })
      fetchGrants()
    } catch (err: any) {
      toast.error('Error', { description: err.message })
    } finally {
      setIsSaving(false)
    }
  }

  const handleRevoke = async () => {
    if (!revokeEmail) return
    setIsRevoking(true)
    try {
      const response = await fetch('/api/admin/credentials/access', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: revokeEmail }),
      })
      const result = await response.json()
      if (!response.ok) throw new Error(result.error || 'Failed to revoke access')

      toast.success('Revoked', { description: `Access revoked for ${revokeEmail}` })
      setRevokeEmail(null)
      fetchGrants()
    } catch (err: any) {
      toast.error('Error', { description: err.message })
    } finally {
      setIsRevoking(false)
    }
  }

  const activeGrants = grants.filter((g) => !g.revokedAt)
  const revokedGrants = grants.filter((g) => g.revokedAt)

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Shield className="h-5 w-5" />
              Manage Credential Access
            </DialogTitle>
            <DialogDescription>
              Grant or revoke access to the credentials vault. Only the super admin can manage access.
            </DialogDescription>
          </DialogHeader>

          {/* Add New Grant */}
          <div className="rounded-lg border bg-muted/50 p-4">
            <h3 className="mb-3 text-sm font-medium">Add New Access Grant</h3>
            <div className="space-y-3">
              <div>
                <Label htmlFor="grant-email">Email Address</Label>
                <Input
                  id="grant-email"
                  type="email"
                  placeholder="user@example.com"
                  value={newEmail}
                  onChange={(e) => setNewEmail(e.target.value)}
                />
              </div>
              <div>
                <Label className="mb-2 block">Permissions</Label>
                <div className="flex flex-wrap gap-4">
                  {(['canView', 'canAdd', 'canEdit', 'canDelete', 'canUpload'] as const).map((perm) => (
                    <div key={perm} className="flex items-center gap-2">
                      <Checkbox
                        id={`new-perm-${perm}`}
                        checked={newPerms[perm]}
                        onCheckedChange={(checked) =>
                          setNewPerms((prev) => ({ ...prev, [perm]: checked === true }))
                        }
                      />
                      <Label
                        htmlFor={`new-perm-${perm}`}
                        className="text-sm font-normal"
                      >
                        {perm.replace('can', '')}
                      </Label>
                    </div>
                  ))}
                </div>
              </div>
              <Button onClick={handleAddGrant} disabled={isSaving || !newEmail.trim()} size="sm">
                {isSaving ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <UserPlus className="mr-2 h-4 w-4" />
                )}
                Grant Access
              </Button>
            </div>
          </div>

          {/* Active Grants */}
          <div>
            <h3 className="mb-2 text-sm font-medium">Active Grants ({activeGrants.length})</h3>
            {isLoading ? (
              <div className="py-4 text-center text-sm text-muted-foreground">Loading...</div>
            ) : activeGrants.length === 0 ? (
              <div className="py-4 text-center text-sm text-muted-foreground">No active grants</div>
            ) : (
              <div className="space-y-2">
                {activeGrants.map((grant) => (
                  <div
                    key={grant.id}
                    className="flex items-center justify-between rounded-lg border p-3"
                  >
                    <div>
                      <p className="text-sm font-medium">{grant.email}</p>
                      <div className="mt-1 flex flex-wrap gap-1">
                        {grant.canView && <Badge variant="secondary" className="text-xs">View</Badge>}
                        {grant.canAdd && <Badge variant="secondary" className="text-xs">Add</Badge>}
                        {grant.canEdit && <Badge variant="secondary" className="text-xs">Edit</Badge>}
                        {grant.canDelete && <Badge variant="secondary" className="text-xs">Delete</Badge>}
                        {grant.canUpload && <Badge variant="secondary" className="text-xs">Upload</Badge>}
                      </div>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-destructive hover:text-destructive"
                      onClick={() => setRevokeEmail(grant.email)}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Revoked Grants */}
          {revokedGrants.length > 0 && (
            <div>
              <h3 className="mb-2 text-sm font-medium text-muted-foreground">
                Revoked ({revokedGrants.length})
              </h3>
              <div className="space-y-1">
                {revokedGrants.map((grant) => (
                  <div
                    key={grant.id}
                    className="flex items-center justify-between rounded-lg border border-dashed p-2 opacity-50"
                  >
                    <span className="text-sm line-through">{grant.email}</span>
                    <span className="text-xs text-muted-foreground">
                      Revoked {new Date(grant.revokedAt!).toLocaleDateString()}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Revoke Confirmation */}
      <AlertDialog open={!!revokeEmail} onOpenChange={(open) => !open && setRevokeEmail(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Revoke Access</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to revoke credential access for{' '}
              <strong>{revokeEmail}</strong>? They will no longer be able to view or manage
              credentials.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isRevoking}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleRevoke}
              disabled={isRevoking}
              className="bg-destructive hover:bg-destructive/90"
            >
              {isRevoking ? 'Revoking...' : 'Revoke Access'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
