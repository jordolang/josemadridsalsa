'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
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
import {
  Search,
  Plus,
  Eye,
  Copy,
  Pencil,
  Trash2,
  ExternalLink,
  KeyRound,
} from 'lucide-react'
import { useToast } from '@/hooks/use-toast'
import CredentialFormDialog from './CredentialFormDialog'
import PasswordRevealDialog from './PasswordRevealDialog'

interface Credential {
  id: string
  serviceName: string
  label: string
  username: string | null
  password: string
  url: string | null
  notes: string | null
  createdAt: string
  updatedAt: string
}

interface CredentialsPageClientProps {
  initialCredentials: Credential[]
  totalCount: number
  accessLevel: 'read' | 'write'
  canWrite: boolean
}

export default function CredentialsPageClient({
  initialCredentials,
  totalCount,
  accessLevel,
  canWrite,
}: CredentialsPageClientProps) {
  const router = useRouter()
  const { toast } = useToast()
  const [credentials, setCredentials] = useState<Credential[]>(initialCredentials)
  const [revealedPasswords, setRevealedPasswords] = useState<Record<string, string>>({})
  const [searchQuery, setSearchQuery] = useState('')

  // Dialog states
  const [formDialogOpen, setFormDialogOpen] = useState(false)
  const [formDialogMode, setFormDialogMode] = useState<'create' | 'edit'>('create')
  const [editingCredential, setEditingCredential] = useState<Credential | undefined>()
  const [revealDialogOpen, setRevealDialogOpen] = useState(false)
  const [revealCredentialId, setRevealCredentialId] = useState('')
  const [revealCredentialLabel, setRevealCredentialLabel] = useState('')
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [deletingCredential, setDeletingCredential] = useState<Credential | null>(null)
  const [isDeleting, setIsDeleting] = useState(false)

  // Clear revealed passwords on unmount
  useEffect(() => {
    return () => {
      setRevealedPasswords({})
    }
  }, [])

  // Debounced search
  useEffect(() => {
    const timeout = setTimeout(() => {
      fetchCredentials(searchQuery)
    }, 300)
    return () => clearTimeout(timeout)
  }, [searchQuery])

  const fetchCredentials = async (search: string) => {
    try {
      const params = new URLSearchParams()
      if (search) params.set('search', search)
      const response = await fetch(`/api/admin/credentials?${params.toString()}`)
      const result = await response.json()
      if (response.ok) {
        setCredentials(result.credentials)
      }
    } catch {
      // silently fail, keep current data
    }
  }

  const handleCopyToClipboard = useCallback(async (text: string, label: string) => {
    try {
      await navigator.clipboard.writeText(text)
      toast({ title: 'Copied', description: `${label} copied to clipboard` })
    } catch {
      toast({ title: 'Failed', description: 'Could not copy to clipboard', variant: 'destructive' })
    }
  }, [toast])

  const handleReveal = (credential: Credential) => {
    setRevealCredentialId(credential.id)
    setRevealCredentialLabel(credential.label)
    setRevealDialogOpen(true)
  }

  const handleRevealSuccess = (plaintext: string) => {
    setRevealedPasswords((prev) => ({ ...prev, [revealCredentialId]: plaintext }))
  }

  const handleEdit = (credential: Credential) => {
    setEditingCredential(credential)
    setFormDialogMode('edit')
    setFormDialogOpen(true)
  }

  const handleCreate = () => {
    setEditingCredential(undefined)
    setFormDialogMode('create')
    setFormDialogOpen(true)
  }

  const handleFormSuccess = () => {
    fetchCredentials(searchQuery)
  }

  const handleDeleteConfirm = async () => {
    if (!deletingCredential) return
    setIsDeleting(true)
    try {
      const response = await fetch(`/api/admin/credentials/${deletingCredential.id}`, {
        method: 'DELETE',
      })
      if (!response.ok) {
        const result = await response.json()
        throw new Error(result.error || 'Failed to delete credential')
      }
      toast({ title: 'Deleted', description: 'Credential deleted successfully' })
      setDeleteDialogOpen(false)
      setDeletingCredential(null)
      fetchCredentials(searchQuery)
    } catch (err: any) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' })
    } finally {
      setIsDeleting(false)
    }
  }

  const truncateUrl = (url: string, maxLength = 40) => {
    if (url.length <= maxLength) return url
    return url.substring(0, maxLength) + '...'
  }

  return (
    <div className="space-y-6">
      {/* Search and Actions */}
      <Card className="p-4">
        <div className="flex items-center gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <Input
              type="search"
              placeholder="Search credentials..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9"
            />
          </div>
          {canWrite && (
            <Button onClick={handleCreate}>
              <Plus className="mr-2 h-4 w-4" />
              Add Credential
            </Button>
          )}
        </div>
      </Card>

      {/* Data Table */}
      {credentials.length === 0 ? (
        <Card className="p-12">
          <div className="text-center text-slate-500">
            <KeyRound className="mx-auto mb-4 h-12 w-12 text-slate-300" />
            <p className="text-lg font-medium">No credentials found</p>
            <p className="mt-1 text-sm">
              {searchQuery
                ? 'Try a different search term'
                : 'Add your first credential to get started'}
            </p>
            {canWrite && !searchQuery && (
              <Button className="mt-4" onClick={handleCreate}>
                <Plus className="mr-2 h-4 w-4" />
                Add Credential
              </Button>
            )}
          </div>
        </Card>
      ) : (
        <Card>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="border-b bg-slate-50">
                <tr>
                  <th className="px-4 py-3 text-left text-sm font-medium text-slate-600">
                    Service Name
                  </th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-slate-600">
                    Label
                  </th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-slate-600">
                    Username/Email
                  </th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-slate-600">
                    Password
                  </th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-slate-600">
                    URL
                  </th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-slate-600">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {credentials.map((credential) => {
                  const isRevealed = !!revealedPasswords[credential.id]
                  const hasPassword = credential.password !== 'No password set'

                  return (
                    <tr key={credential.id} className="hover:bg-slate-50">
                      <td className="px-4 py-3">
                        <span className="font-medium text-slate-900">
                          {credential.serviceName}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <Badge variant="secondary">{credential.label}</Badge>
                      </td>
                      <td className="px-4 py-3">
                        {credential.username ? (
                          <div className="flex items-center gap-2">
                            <span className="text-sm text-slate-700">
                              {credential.username}
                            </span>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-7 w-7 p-0"
                              onClick={() =>
                                handleCopyToClipboard(credential.username!, 'Username')
                              }
                            >
                              <Copy className="h-3 w-3" />
                            </Button>
                          </div>
                        ) : (
                          <span className="text-sm text-slate-400">-</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        {!hasPassword ? (
                          <span className="text-sm text-slate-400 italic">
                            No password set
                          </span>
                        ) : isRevealed ? (
                          <div className="flex items-center gap-2">
                            <code className="rounded bg-slate-100 px-2 py-1 text-sm font-mono">
                              {revealedPasswords[credential.id]}
                            </code>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-7 w-7 p-0"
                              onClick={() =>
                                handleCopyToClipboard(
                                  revealedPasswords[credential.id],
                                  'Password'
                                )
                              }
                            >
                              <Copy className="h-3 w-3" />
                            </Button>
                          </div>
                        ) : (
                          <div className="flex items-center gap-2">
                            <span className="font-mono text-sm text-slate-500">
                              {'••••••••'}
                            </span>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-7 w-7 p-0"
                              onClick={() => handleReveal(credential)}
                            >
                              <Eye className="h-3 w-3" />
                            </Button>
                          </div>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        {credential.url ? (
                          <a
                            href={credential.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 text-sm text-blue-600 hover:underline"
                          >
                            {truncateUrl(credential.url)}
                            <ExternalLink className="h-3 w-3" />
                          </a>
                        ) : (
                          <span className="text-sm text-slate-400">-</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1">
                          {canWrite && (
                            <>
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-8 w-8 p-0"
                                onClick={() => handleEdit(credential)}
                              >
                                <Pencil className="h-4 w-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-8 w-8 p-0 text-red-600 hover:text-red-700"
                                onClick={() => {
                                  setDeletingCredential(credential)
                                  setDeleteDialogOpen(true)
                                }}
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {/* Dialogs */}
      <CredentialFormDialog
        mode={formDialogMode}
        credential={editingCredential}
        open={formDialogOpen}
        onOpenChange={setFormDialogOpen}
        onSuccess={handleFormSuccess}
      />

      <PasswordRevealDialog
        credentialId={revealCredentialId}
        credentialLabel={revealCredentialLabel}
        open={revealDialogOpen}
        onOpenChange={setRevealDialogOpen}
        onReveal={handleRevealSuccess}
      />

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Credential</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete the credential for{' '}
              <strong>{deletingCredential?.serviceName}</strong> ({deletingCredential?.label})?
              This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteConfirm}
              disabled={isDeleting}
              className="bg-red-600 hover:bg-red-700"
            >
              {isDeleting ? 'Deleting...' : 'Delete'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
