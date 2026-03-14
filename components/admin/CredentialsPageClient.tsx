'use client'

import { useState, useEffect, useCallback, useRef, useMemo } from 'react'
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
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuCheckboxItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
  DropdownMenuLabel,
} from '@/components/ui/dropdown-menu'
import {
  Search,
  Plus,
  Eye,
  Copy,
  Pencil,
  Trash2,
  ExternalLink,
  KeyRound,
  Upload,
  ShieldAlert,
  Shield,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  Filter,
  AlertTriangle,
  X,
} from 'lucide-react'
import { useToast } from '@/hooks/use-toast'
import CredentialFormDialog from './CredentialFormDialog'
import PasswordRevealDialog from './PasswordRevealDialog'
import CredentialAccessManager from './CredentialAccessManager'
import CredentialImportDialog from './CredentialImportDialog'
import CredentialBreachCheckDialog from './CredentialBreachCheckDialog'

interface Credential {
  id: string
  serviceName: string
  label: string
  username: string | null
  password: string
  hasPassword?: boolean
  url: string | null
  notes: string | null
  passwordChangedAt: string | null
  createdAt: string
  updatedAt: string
}

interface CredentialsPageClientProps {
  initialCredentials: Credential[]
  totalCount: number
  accessLevel: 'read' | 'write'
  canWrite: boolean
  isSuperAdmin: boolean
  grantPermissions: {
    canView: boolean
    canAdd: boolean
    canEdit: boolean
    canDelete: boolean
    canUpload: boolean
  } | null
  providers: string[]
}

type SortField = 'serviceName' | 'label' | 'username' | 'passwordChangedAt' | 'updatedAt'
type SortOrder = 'asc' | 'desc'

const NINETY_DAYS_MS = 90 * 24 * 60 * 60 * 1000

function getPasswordAge(credential: Credential): number {
  const changedAt = credential.passwordChangedAt
    ? new Date(credential.passwordChangedAt)
    : new Date(credential.createdAt)
  return Math.floor((Date.now() - changedAt.getTime()) / 86400000)
}

function isPasswordExpired(credential: Credential): boolean {
  const changedAt = credential.passwordChangedAt
    ? new Date(credential.passwordChangedAt)
    : new Date(credential.createdAt)
  return Date.now() - changedAt.getTime() > NINETY_DAYS_MS
}

export default function CredentialsPageClient({
  initialCredentials,
  totalCount,
  accessLevel,
  canWrite,
  isSuperAdmin: isSuperAdminProp,
  grantPermissions,
  providers: initialProviders,
}: CredentialsPageClientProps) {
  const router = useRouter()
  const { toast } = useToast()
  const [credentials, setCredentials] = useState<Credential[]>(initialCredentials)
  const [revealedPasswords, setRevealedPasswords] = useState<Record<string, string>>({})
  const [revealCountdowns, setRevealCountdowns] = useState<Record<string, number>>({})
  const revealTimersRef = useRef<Record<string, ReturnType<typeof setInterval>>>({})
  const [providers, setProviders] = useState<string[]>(initialProviders)

  // Search & filter state
  const [searchQuery, setSearchQuery] = useState('')
  const [providerFilter, setProviderFilter] = useState<Set<string>>(new Set())
  const [labelFilter, setLabelFilter] = useState<Set<string>>(new Set())
  const [passwordAgeFilter, setPasswordAgeFilter] = useState<'all' | 'expired' | 'recent'>('all')
  const [sortField, setSortField] = useState<SortField>('serviceName')
  const [sortOrder, setSortOrder] = useState<SortOrder>('asc')

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
  const [accessManagerOpen, setAccessManagerOpen] = useState(false)
  const [importDialogOpen, setImportDialogOpen] = useState(false)
  const [breachCheckOpen, setBreachCheckOpen] = useState(false)
  const [breachCheckCredentialId, setBreachCheckCredentialId] = useState<string | undefined>()
  const [breachCheckCredentialLabel, setBreachCheckCredentialLabel] = useState<string | undefined>()

  // Permission helpers
  const canAdd = isSuperAdminProp || (canWrite && grantPermissions?.canAdd)
  const canEdit = isSuperAdminProp || (canWrite && grantPermissions?.canEdit)
  const canDelete = isSuperAdminProp || (canWrite && grantPermissions?.canDelete)
  const canUpload = isSuperAdminProp || (canWrite && grantPermissions?.canUpload)

  // Clear timers on unmount
  useEffect(() => {
    return () => {
      setRevealedPasswords({})
      Object.values(revealTimersRef.current).forEach(clearInterval)
    }
  }, [])

  const fetchCredentials = useCallback(async () => {
    try {
      const params = new URLSearchParams()
      if (searchQuery) params.set('search', searchQuery)
      params.set('sortBy', sortField)
      params.set('sortOrder', sortOrder)
      const response = await fetch(`/api/admin/credentials?${params.toString()}`)
      const result = await response.json()
      if (response.ok) {
        setCredentials(result.credentials)
        if (result.providers) setProviders(result.providers)
      }
    } catch {
      // keep current data
    }
  }, [searchQuery, sortField, sortOrder])

  // Debounced search
  useEffect(() => {
    const timeout = setTimeout(() => {
      fetchCredentials()
    }, 300)
    return () => clearTimeout(timeout)
  }, [fetchCredentials])

  // Filter and sort credentials client-side for column filters
  const filteredCredentials = useMemo(() => {
    let filtered = [...credentials]

    // Provider filter
    if (providerFilter.size > 0) {
      filtered = filtered.filter((c) => providerFilter.has(c.serviceName))
    }

    // Label filter
    if (labelFilter.size > 0) {
      filtered = filtered.filter((c) => labelFilter.has(c.label))
    }

    // Password age filter
    if (passwordAgeFilter === 'expired') {
      filtered = filtered.filter((c) => isPasswordExpired(c))
    } else if (passwordAgeFilter === 'recent') {
      filtered = filtered.filter((c) => !isPasswordExpired(c))
    }

    return filtered
  }, [credentials, providerFilter, labelFilter, passwordAgeFilter])

  // Unique labels for filter
  const uniqueLabels = useMemo(
    () => [...new Set(credentials.map((c) => c.label))].sort(),
    [credentials]
  )

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
    setRevealCredentialLabel(`${credential.serviceName} - ${credential.label}`)
    setRevealDialogOpen(true)
  }

  const handleRevealSuccess = (plaintext: string) => {
    const credId = revealCredentialId
    setRevealedPasswords((prev) => ({ ...prev, [credId]: plaintext }))
    setRevealCountdowns((prev) => ({ ...prev, [credId]: 10 }))

    // Clear any existing timer
    if (revealTimersRef.current[credId]) {
      clearInterval(revealTimersRef.current[credId])
    }

    // Countdown timer: decrement every second, hide at 0
    revealTimersRef.current[credId] = setInterval(() => {
      setRevealCountdowns((prev) => {
        const remaining = (prev[credId] || 0) - 1
        if (remaining <= 0) {
          clearInterval(revealTimersRef.current[credId])
          delete revealTimersRef.current[credId]
          setRevealedPasswords((p) => {
            const next = { ...p }
            delete next[credId]
            return next
          })
          const { [credId]: _, ...rest } = prev
          return rest
        }
        return { ...prev, [credId]: remaining }
      })
    }, 1000)
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
    fetchCredentials()
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
      fetchCredentials()
    } catch (err: any) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' })
    } finally {
      setIsDeleting(false)
    }
  }

  const handleBreachCheckSingle = (credential: Credential) => {
    setBreachCheckCredentialId(credential.id)
    setBreachCheckCredentialLabel(`${credential.serviceName} - ${credential.label}`)
    setBreachCheckOpen(true)
  }

  const handleBreachCheckAll = () => {
    setBreachCheckCredentialId(undefined)
    setBreachCheckCredentialLabel(undefined)
    setBreachCheckOpen(true)
  }

  const toggleSort = (field: SortField) => {
    if (sortField === field) {
      setSortOrder((prev) => (prev === 'asc' ? 'desc' : 'asc'))
    } else {
      setSortField(field)
      setSortOrder('asc')
    }
  }

  const SortIcon = ({ field }: { field: SortField }) => {
    if (sortField !== field) return <ArrowUpDown className="h-3 w-3 opacity-40" />
    return sortOrder === 'asc' ? (
      <ArrowUp className="h-3 w-3" />
    ) : (
      <ArrowDown className="h-3 w-3" />
    )
  }

  const clearFilters = () => {
    setProviderFilter(new Set())
    setLabelFilter(new Set())
    setPasswordAgeFilter('all')
    setSearchQuery('')
  }

  const hasActiveFilters = providerFilter.size > 0 || labelFilter.size > 0 || passwordAgeFilter !== 'all' || searchQuery !== ''

  const truncateUrl = (url: string, maxLength = 35) => {
    if (url.length <= maxLength) return url
    return url.substring(0, maxLength) + '...'
  }

  const isSafeUrl = (url: string): boolean => {
    try {
      const parsed = new URL(url)
      return parsed.protocol === 'http:' || parsed.protocol === 'https:'
    } catch {
      return false
    }
  }

  return (
    <div className="space-y-4">
      {/* Search & Actions Bar */}
      <Card className="p-4">
        <div className="flex flex-wrap items-center gap-3">
          {/* Search */}
          <div className="relative min-w-[280px] flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <Input
              type="search"
              placeholder="Search by provider, label, email..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9"
            />
          </div>

          {/* Password Age Filter */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" className="gap-1.5">
                <Filter className="h-3.5 w-3.5" />
                Password Age
                {passwordAgeFilter !== 'all' && (
                  <Badge variant="secondary" className="ml-1 h-5 px-1 text-xs">
                    1
                  </Badge>
                )}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuCheckboxItem
                checked={passwordAgeFilter === 'all'}
                onCheckedChange={() => setPasswordAgeFilter('all')}
              >
                All
              </DropdownMenuCheckboxItem>
              <DropdownMenuCheckboxItem
                checked={passwordAgeFilter === 'expired'}
                onCheckedChange={() => setPasswordAgeFilter('expired')}
              >
                Expired (90+ days)
              </DropdownMenuCheckboxItem>
              <DropdownMenuCheckboxItem
                checked={passwordAgeFilter === 'recent'}
                onCheckedChange={() => setPasswordAgeFilter('recent')}
              >
                Current (&lt; 90 days)
              </DropdownMenuCheckboxItem>
            </DropdownMenuContent>
          </DropdownMenu>

          {hasActiveFilters && (
            <Button variant="ghost" size="sm" onClick={clearFilters} className="gap-1 text-xs">
              <X className="h-3 w-3" />
              Clear Filters
            </Button>
          )}

          {/* Actions */}
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={handleBreachCheckAll} className="gap-1.5">
              <ShieldAlert className="h-3.5 w-3.5" />
              Breach Check
            </Button>

            {canUpload && (
              <Button variant="outline" size="sm" onClick={() => setImportDialogOpen(true)} className="gap-1.5">
                <Upload className="h-3.5 w-3.5" />
                Import
              </Button>
            )}

            {isSuperAdminProp && (
              <Button variant="outline" size="sm" onClick={() => setAccessManagerOpen(true)} className="gap-1.5">
                <Shield className="h-3.5 w-3.5" />
                Access
              </Button>
            )}

            {canAdd && (
              <Button size="sm" onClick={handleCreate} className="gap-1.5">
                <Plus className="h-3.5 w-3.5" />
                Add Credential
              </Button>
            )}
          </div>
        </div>
      </Card>

      {/* Data Table */}
      {filteredCredentials.length === 0 ? (
        <Card className="p-12">
          <div className="text-center text-slate-500">
            <KeyRound className="mx-auto mb-4 h-12 w-12 text-slate-300" />
            <p className="text-lg font-medium">No credentials found</p>
            <p className="mt-1 text-sm">
              {hasActiveFilters
                ? 'Try adjusting your filters'
                : 'Add your first credential to get started'}
            </p>
            {canAdd && !hasActiveFilters && (
              <Button className="mt-4" onClick={handleCreate} size="sm">
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
                  {/* Provider Column */}
                  <th className="px-4 py-3 text-left">
                    <div className="flex items-center gap-1">
                      <button
                        className="flex items-center gap-1 text-sm font-medium text-slate-600 hover:text-slate-900"
                        onClick={() => toggleSort('serviceName')}
                      >
                        Provider
                        <SortIcon field="serviceName" />
                      </button>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <button className="rounded p-0.5 hover:bg-slate-200">
                            <Filter className={`h-3 w-3 ${providerFilter.size > 0 ? 'text-blue-600' : 'text-slate-400'}`} />
                          </button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="start" className="max-h-60 overflow-y-auto">
                          <DropdownMenuLabel className="text-xs">Filter by Provider</DropdownMenuLabel>
                          <DropdownMenuSeparator />
                          {providers.map((p) => (
                            <DropdownMenuCheckboxItem
                              key={p}
                              checked={providerFilter.has(p)}
                              onCheckedChange={(checked) => {
                                setProviderFilter((prev) => {
                                  const next = new Set(prev)
                                  if (checked) next.add(p)
                                  else next.delete(p)
                                  return next
                                })
                              }}
                            >
                              {p}
                            </DropdownMenuCheckboxItem>
                          ))}
                          {providerFilter.size > 0 && (
                            <>
                              <DropdownMenuSeparator />
                              <button
                                className="w-full px-2 py-1.5 text-left text-xs text-blue-600 hover:bg-slate-50"
                                onClick={() => setProviderFilter(new Set())}
                              >
                                Clear filter
                              </button>
                            </>
                          )}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </th>

                  {/* Label Column */}
                  <th className="px-4 py-3 text-left">
                    <div className="flex items-center gap-1">
                      <button
                        className="flex items-center gap-1 text-sm font-medium text-slate-600 hover:text-slate-900"
                        onClick={() => toggleSort('label')}
                      >
                        Label
                        <SortIcon field="label" />
                      </button>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <button className="rounded p-0.5 hover:bg-slate-200">
                            <Filter className={`h-3 w-3 ${labelFilter.size > 0 ? 'text-blue-600' : 'text-slate-400'}`} />
                          </button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="start" className="max-h-60 overflow-y-auto">
                          <DropdownMenuLabel className="text-xs">Filter by Label</DropdownMenuLabel>
                          <DropdownMenuSeparator />
                          {uniqueLabels.map((l) => (
                            <DropdownMenuCheckboxItem
                              key={l}
                              checked={labelFilter.has(l)}
                              onCheckedChange={(checked) => {
                                setLabelFilter((prev) => {
                                  const next = new Set(prev)
                                  if (checked) next.add(l)
                                  else next.delete(l)
                                  return next
                                })
                              }}
                            >
                              {l}
                            </DropdownMenuCheckboxItem>
                          ))}
                          {labelFilter.size > 0 && (
                            <>
                              <DropdownMenuSeparator />
                              <button
                                className="w-full px-2 py-1.5 text-left text-xs text-blue-600 hover:bg-slate-50"
                                onClick={() => setLabelFilter(new Set())}
                              >
                                Clear filter
                              </button>
                            </>
                          )}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </th>

                  {/* Username Column */}
                  <th className="px-4 py-3 text-left">
                    <button
                      className="flex items-center gap-1 text-sm font-medium text-slate-600 hover:text-slate-900"
                      onClick={() => toggleSort('username')}
                    >
                      Username / Email
                      <SortIcon field="username" />
                    </button>
                  </th>

                  {/* Password Column */}
                  <th className="px-4 py-3 text-left text-sm font-medium text-slate-600">
                    Password
                  </th>

                  {/* URL Column */}
                  <th className="px-4 py-3 text-left text-sm font-medium text-slate-600">
                    URL
                  </th>

                  {/* Password Age Column */}
                  <th className="px-4 py-3 text-left">
                    <button
                      className="flex items-center gap-1 text-sm font-medium text-slate-600 hover:text-slate-900"
                      onClick={() => toggleSort('passwordChangedAt')}
                    >
                      Age
                      <SortIcon field="passwordChangedAt" />
                    </button>
                  </th>

                  {/* Actions Column */}
                  <th className="px-4 py-3 text-left text-sm font-medium text-slate-600">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {filteredCredentials.map((credential) => {
                  const isRevealed = !!revealedPasswords[credential.id]
                  const hasPassword = credential.hasPassword ?? true
                  const expired = isPasswordExpired(credential)
                  const ageDays = getPasswordAge(credential)
                  const countdown = revealCountdowns[credential.id]

                  return (
                    <tr
                      key={credential.id}
                      className={`transition-colors ${
                        expired
                          ? 'bg-red-50 hover:bg-red-100'
                          : 'hover:bg-slate-50'
                      }`}
                    >
                      {/* Provider */}
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1.5">
                          <span className="font-medium text-slate-900">
                            {credential.serviceName}
                          </span>
                          {expired && (
                            <span
                              title="This password has not been changed in over 90 days. It is recommended to update it for security."
                              className="cursor-help"
                            >
                              <AlertTriangle className="h-4 w-4 text-red-500" />
                            </span>
                          )}
                        </div>
                      </td>

                      {/* Label */}
                      <td className="px-4 py-3">
                        <Badge variant="secondary">{credential.label}</Badge>
                      </td>

                      {/* Username */}
                      <td className="px-4 py-3">
                        {credential.username ? (
                          <div className="flex items-center gap-1.5">
                            <span className="text-sm text-slate-700">
                              {credential.username}
                            </span>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-6 w-6 p-0"
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

                      {/* Password */}
                      <td className="px-4 py-3">
                        {!hasPassword ? (
                          <span className="text-sm italic text-slate-400">
                            No password
                          </span>
                        ) : isRevealed ? (
                          <div className="flex items-center gap-1.5">
                            <code className="rounded bg-slate-100 px-2 py-1 font-mono text-sm">
                              {revealedPasswords[credential.id]}
                            </code>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-6 w-6 p-0"
                              onClick={() =>
                                handleCopyToClipboard(
                                  revealedPasswords[credential.id],
                                  'Password'
                                )
                              }
                            >
                              <Copy className="h-3 w-3" />
                            </Button>
                            {countdown !== undefined && (
                              <span className="text-xs text-slate-400">{countdown}s</span>
                            )}
                          </div>
                        ) : (
                          <div className="flex items-center gap-1.5">
                            <span className="font-mono text-sm text-slate-500">
                              ********
                            </span>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-6 w-6 p-0"
                              onClick={() => handleReveal(credential)}
                            >
                              <Eye className="h-3 w-3" />
                            </Button>
                          </div>
                        )}
                      </td>

                      {/* URL */}
                      <td className="px-4 py-3">
                        {credential.url ? (
                          isSafeUrl(credential.url) ? (
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
                            <span className="text-sm text-slate-700">
                              {truncateUrl(credential.url)}
                            </span>
                          )
                        ) : (
                          <span className="text-sm text-slate-400">-</span>
                        )}
                      </td>

                      {/* Password Age */}
                      <td className="px-4 py-3">
                        <span
                          className={`text-sm ${expired ? 'font-medium text-red-600' : 'text-slate-500'}`}
                        >
                          {ageDays}d
                        </span>
                      </td>

                      {/* Actions */}
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-0.5">
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 w-7 p-0"
                            title="Check for breaches"
                            onClick={() => handleBreachCheckSingle(credential)}
                          >
                            <ShieldAlert className="h-3.5 w-3.5" />
                          </Button>
                          {canEdit && (
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-7 w-7 p-0"
                              onClick={() => handleEdit(credential)}
                            >
                              <Pencil className="h-3.5 w-3.5" />
                            </Button>
                          )}
                          {canDelete && (
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-7 w-7 p-0 text-red-600 hover:text-red-700"
                              onClick={() => {
                                setDeletingCredential(credential)
                                setDeleteDialogOpen(true)
                              }}
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          )}
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>

          {/* Table footer with count */}
          <div className="border-t px-4 py-2 text-sm text-slate-500">
            Showing {filteredCredentials.length} of {credentials.length} credentials
            {hasActiveFilters && ' (filtered)'}
          </div>
        </Card>
      )}

      {/* All Dialogs */}
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

      <CredentialAccessManager
        open={accessManagerOpen}
        onOpenChange={setAccessManagerOpen}
      />

      <CredentialImportDialog
        open={importDialogOpen}
        onOpenChange={setImportDialogOpen}
        onSuccess={handleFormSuccess}
      />

      <CredentialBreachCheckDialog
        open={breachCheckOpen}
        onOpenChange={setBreachCheckOpen}
        credentialId={breachCheckCredentialId}
        credentialLabel={breachCheckCredentialLabel}
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
