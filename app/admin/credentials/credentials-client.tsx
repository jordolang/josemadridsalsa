'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import {
  Plus,
  Search,
  Upload,
  Trash2,
  Pencil,
  Eye,
  EyeOff,
  KeyRound,
  ShieldCheck,
  X,
  UserPlus,
  UserMinus,
  Copy,
  Check,
  AlertTriangle,
} from 'lucide-react'

type Credential = {
  id: string
  serviceName: string
  label: string
  username: string | null
  value: string
  url: string | null
  notes: string | null
  createdAt: string
  updatedAt: string
}

type AccessGrant = {
  id: string
  email: string
  grantedByEmail: string
  createdAt: string
  revokedAt: string | null
}

type CredentialFormData = {
  serviceName: string
  label: string
  username: string
  value: string
  url: string
  notes: string
}

const emptyForm: CredentialFormData = {
  serviceName: '',
  label: '',
  username: '',
  value: '',
  url: '',
  notes: '',
}

export function CredentialsClient({
  isGrantAdmin,
  userEmail,
}: {
  isGrantAdmin: boolean
  userEmail: string
}) {
  const [credentials, setCredentials] = useState<Credential[]>([])
  const [grants, setGrants] = useState<AccessGrant[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [visibleIds, setVisibleIds] = useState<Set<string>>(new Set())
  const [copiedId, setCopiedId] = useState<string | null>(null)

  // Form state
  const [showForm, setShowForm] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [form, setForm] = useState<CredentialFormData>(emptyForm)
  const [formError, setFormError] = useState('')
  const [saving, setSaving] = useState(false)

  // CSV upload
  const [showUpload, setShowUpload] = useState(false)
  const [uploadResult, setUploadResult] = useState<{ created: number; errors: string[] } | null>(null)
  const [uploading, setUploading] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Access management
  const [showAccess, setShowAccess] = useState(false)
  const [newGrantEmail, setNewGrantEmail] = useState('')
  const [grantError, setGrantError] = useState('')
  const [granting, setGranting] = useState(false)

  // Delete confirmation
  const [deletingId, setDeletingId] = useState<string | null>(null)

  const fetchCredentials = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/credentials')
      if (!res.ok) throw new Error('Failed to fetch')
      const data = await res.json()
      setCredentials(data.credentials || [])
    } catch {
      setCredentials([])
    }
  }, [])

  const fetchGrants = useCallback(async () => {
    if (!isGrantAdmin) return
    try {
      const res = await fetch('/api/admin/credentials/access')
      if (!res.ok) return
      const data = await res.json()
      setGrants(data.grants || [])
    } catch {
      // ignore
    }
  }, [isGrantAdmin])

  useEffect(() => {
    setLoading(true)
    Promise.all([fetchCredentials(), fetchGrants()]).finally(() =>
      setLoading(false)
    )
  }, [fetchCredentials, fetchGrants])

  // Filtering
  const filtered = credentials.filter((c) => {
    if (!search) return true
    const q = search.toLowerCase()
    return (
      c.serviceName.toLowerCase().includes(q) ||
      c.label.toLowerCase().includes(q) ||
      (c.username && c.username.toLowerCase().includes(q))
    )
  })

  // Group by service name
  const grouped = filtered.reduce<Record<string, Credential[]>>((acc, c) => {
    if (!acc[c.serviceName]) acc[c.serviceName] = []
    acc[c.serviceName].push(c)
    return acc
  }, {})

  const serviceNames = Object.keys(grouped).sort()

  // Handlers
  async function handleSave() {
    setFormError('')
    if (!form.serviceName.trim() || !form.label.trim() || !form.value.trim()) {
      setFormError('Service name, label, and value are required.')
      return
    }

    setSaving(true)
    try {
      const url = editingId
        ? `/api/admin/credentials/${editingId}`
        : '/api/admin/credentials'
      const method = editingId ? 'PUT' : 'POST'

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })

      if (!res.ok) {
        const data = await res.json()
        setFormError(data.error || 'Failed to save')
        return
      }

      setShowForm(false)
      setEditingId(null)
      setForm(emptyForm)
      await fetchCredentials()
    } catch {
      setFormError('Network error')
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete(id: string) {
    try {
      const res = await fetch(`/api/admin/credentials/${id}`, { method: 'DELETE' })
      if (res.ok) {
        setDeletingId(null)
        await fetchCredentials()
      }
    } catch {
      // ignore
    }
  }

  async function handleUpload(e: React.FormEvent) {
    e.preventDefault()
    const file = fileInputRef.current?.files?.[0]
    if (!file) return

    setUploading(true)
    setUploadResult(null)
    try {
      const formData = new FormData()
      formData.append('file', file)

      const res = await fetch('/api/admin/credentials/upload', {
        method: 'POST',
        body: formData,
      })

      const data = await res.json()
      if (!res.ok) {
        setUploadResult({ created: 0, errors: [data.error || 'Upload failed'] })
        return
      }

      setUploadResult(data)
      if (data.created > 0) await fetchCredentials()
    } catch {
      setUploadResult({ created: 0, errors: ['Network error'] })
    } finally {
      setUploading(false)
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  async function handleGrantAccess() {
    setGrantError('')
    if (!newGrantEmail.trim()) {
      setGrantError('Email is required')
      return
    }

    setGranting(true)
    try {
      const res = await fetch('/api/admin/credentials/access', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: newGrantEmail.trim() }),
      })

      if (!res.ok) {
        const data = await res.json()
        setGrantError(data.error || 'Failed to grant access')
        return
      }

      setNewGrantEmail('')
      await fetchGrants()
    } catch {
      setGrantError('Network error')
    } finally {
      setGranting(false)
    }
  }

  async function handleRevokeAccess(email: string) {
    try {
      const res = await fetch(
        `/api/admin/credentials/access?email=${encodeURIComponent(email)}`,
        { method: 'DELETE' }
      )
      if (res.ok) await fetchGrants()
    } catch {
      // ignore
    }
  }

  function toggleVisibility(id: string) {
    setVisibleIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  function copyToClipboard(text: string, id: string) {
    navigator.clipboard.writeText(text)
    setCopiedId(id)
    setTimeout(() => setCopiedId(null), 2000)
  }

  function startEdit(c: Credential) {
    setForm({
      serviceName: c.serviceName,
      label: c.label,
      username: c.username || '',
      value: c.value,
      url: c.url || '',
      notes: c.notes || '',
    })
    setEditingId(c.id)
    setShowForm(true)
    setFormError('')
  }

  function startAdd() {
    setForm(emptyForm)
    setEditingId(null)
    setShowForm(true)
    setFormError('')
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-3">
          <KeyRound className="h-8 w-8 text-amber-600" />
          <div>
            <h1 className="text-3xl font-bold">Credentials Vault</h1>
            <p className="text-slate-600">Loading...</p>
          </div>
        </div>
        <div className="grid gap-4 md:grid-cols-3">
          {[1, 2, 3].map((i) => (
            <Card key={i} className="h-32 animate-pulse bg-slate-100" />
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <KeyRound className="h-8 w-8 text-amber-600" />
          <div>
            <h1 className="text-3xl font-bold">Credentials Vault</h1>
            <p className="text-slate-600">
              Encrypted service credentials &middot; {credentials.length} stored
            </p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          {isGrantAdmin && (
            <Button
              variant="outline"
              onClick={() => setShowAccess(!showAccess)}
            >
              <ShieldCheck className="mr-2 h-4 w-4" />
              Manage Access
            </Button>
          )}
          <Button
            variant="outline"
            onClick={() => {
              setShowUpload(!showUpload)
              setUploadResult(null)
            }}
          >
            <Upload className="mr-2 h-4 w-4" />
            Import CSV
          </Button>
          <Button onClick={startAdd}>
            <Plus className="mr-2 h-4 w-4" />
            Add Credential
          </Button>
        </div>
      </div>

      {/* Access Management Panel */}
      {showAccess && isGrantAdmin && (
        <Card className="border-blue-200 bg-blue-50/50 p-6">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-lg font-semibold">Access Management</h2>
            <Button variant="ghost" size="sm" onClick={() => setShowAccess(false)}>
              <X className="h-4 w-4" />
            </Button>
          </div>
          <p className="mb-4 text-sm text-slate-600">
            Only you ({userEmail}) can grant or revoke access to this page.
          </p>

          <div className="mb-4 flex gap-2">
            <Input
              type="email"
              placeholder="Email address to grant access..."
              value={newGrantEmail}
              onChange={(e) => setNewGrantEmail(e.target.value)}
              className="max-w-sm"
              onKeyDown={(e) => e.key === 'Enter' && handleGrantAccess()}
            />
            <Button onClick={handleGrantAccess} disabled={granting}>
              <UserPlus className="mr-2 h-4 w-4" />
              {granting ? 'Granting...' : 'Grant Access'}
            </Button>
          </div>
          {grantError && (
            <p className="mb-4 text-sm text-red-600">{grantError}</p>
          )}

          {grants.length > 0 ? (
            <div className="space-y-2">
              {grants.map((g) => (
                <div
                  key={g.id}
                  className="flex items-center justify-between rounded-md border bg-white px-4 py-2"
                >
                  <div className="flex items-center gap-3">
                    <span className="text-sm font-medium">{g.email}</span>
                    {g.revokedAt ? (
                      <Badge className="bg-red-100 text-red-800">Revoked</Badge>
                    ) : (
                      <Badge className="bg-green-100 text-green-800">Active</Badge>
                    )}
                  </div>
                  {!g.revokedAt && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-red-600 hover:text-red-800"
                      onClick={() => handleRevokeAccess(g.email)}
                    >
                      <UserMinus className="mr-1 h-4 w-4" />
                      Revoke
                    </Button>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-slate-500">
              No additional users have been granted access.
            </p>
          )}
        </Card>
      )}

      {/* CSV Upload Panel */}
      {showUpload && (
        <Card className="border-amber-200 bg-amber-50/50 p-6">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-lg font-semibold">Import CSV</h2>
            <Button variant="ghost" size="sm" onClick={() => setShowUpload(false)}>
              <X className="h-4 w-4" />
            </Button>
          </div>
          <p className="mb-2 text-sm text-slate-600">
            Upload a .csv file with columns:{' '}
            <code className="rounded bg-slate-200 px-1 text-xs">
              serviceName, label, value
            </code>{' '}
            (required) and optionally{' '}
            <code className="rounded bg-slate-200 px-1 text-xs">
              username, url, notes
            </code>
          </p>
          <form onSubmit={handleUpload} className="flex gap-2">
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv"
              className="block w-full max-w-sm text-sm text-slate-500 file:mr-4 file:rounded-md file:border-0 file:bg-amber-100 file:px-4 file:py-2 file:text-sm file:font-semibold file:text-amber-700 hover:file:bg-amber-200"
            />
            <Button type="submit" disabled={uploading}>
              {uploading ? 'Uploading...' : 'Upload'}
            </Button>
          </form>
          {uploadResult && (
            <div className="mt-4">
              {uploadResult.created > 0 && (
                <p className="text-sm text-green-700">
                  Successfully imported {uploadResult.created} credential(s).
                </p>
              )}
              {uploadResult.errors.length > 0 && (
                <div className="mt-2">
                  <p className="text-sm font-medium text-red-700">Errors:</p>
                  <ul className="mt-1 list-inside list-disc text-sm text-red-600">
                    {uploadResult.errors.map((err, i) => (
                      <li key={i}>{err}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}
        </Card>
      )}

      {/* Add / Edit Form */}
      {showForm && (
        <Card className="border-green-200 bg-green-50/50 p-6">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-lg font-semibold">
              {editingId ? 'Edit Credential' : 'Add Credential'}
            </h2>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setShowForm(false)
                setEditingId(null)
                setForm(emptyForm)
              }}
            >
              <X className="h-4 w-4" />
            </Button>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <label className="mb-1 block text-sm font-medium">
                Service Name <span className="text-red-500">*</span>
              </label>
              <Input
                value={form.serviceName}
                onChange={(e) =>
                  setForm({ ...form, serviceName: e.target.value })
                }
                placeholder="e.g., Stripe, AWS, Vercel"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium">
                Label <span className="text-red-500">*</span>
              </label>
              <Input
                value={form.label}
                onChange={(e) => setForm({ ...form, label: e.target.value })}
                placeholder="e.g., API Key, Admin Password"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium">Username</label>
              <Input
                value={form.username}
                onChange={(e) =>
                  setForm({ ...form, username: e.target.value })
                }
                placeholder="Optional username or email"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium">
                Value / Secret <span className="text-red-500">*</span>
              </label>
              <Input
                type="password"
                value={form.value}
                onChange={(e) => setForm({ ...form, value: e.target.value })}
                placeholder="The credential value (will be encrypted)"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium">URL</label>
              <Input
                value={form.url}
                onChange={(e) => setForm({ ...form, url: e.target.value })}
                placeholder="https://..."
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium">Notes</label>
              <Input
                value={form.notes}
                onChange={(e) => setForm({ ...form, notes: e.target.value })}
                placeholder="Optional notes"
              />
            </div>
          </div>

          {formError && (
            <p className="mt-3 text-sm text-red-600">{formError}</p>
          )}

          <div className="mt-4 flex gap-2">
            <Button onClick={handleSave} disabled={saving}>
              {saving ? 'Saving...' : editingId ? 'Update' : 'Create'}
            </Button>
            <Button
              variant="outline"
              onClick={() => {
                setShowForm(false)
                setEditingId(null)
                setForm(emptyForm)
              }}
            >
              Cancel
            </Button>
          </div>
        </Card>
      )}

      {/* Search */}
      <Card className="p-4">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <Input
            type="search"
            placeholder="Search by service, label, or username..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
      </Card>

      {/* Credentials List */}
      {serviceNames.length === 0 ? (
        <Card className="p-12">
          <div className="text-center text-slate-500">
            <KeyRound className="mx-auto mb-4 h-12 w-12 text-slate-300" />
            <p className="text-lg font-medium">No credentials stored</p>
            <p className="mt-1 text-sm">
              {search
                ? 'No results match your search'
                : 'Add your first credential or import a CSV file'}
            </p>
            {!search && (
              <Button className="mt-4" onClick={startAdd}>
                <Plus className="mr-2 h-4 w-4" />
                Add Credential
              </Button>
            )}
          </div>
        </Card>
      ) : (
        <div className="space-y-4">
          {serviceNames.map((service) => (
            <Card key={service} className="overflow-hidden">
              <div className="border-b bg-slate-50 px-4 py-3">
                <h3 className="font-semibold text-slate-800">{service}</h3>
                <p className="text-xs text-slate-500">
                  {grouped[service].length} credential(s)
                </p>
              </div>
              <div className="divide-y">
                {grouped[service].map((c) => (
                  <div
                    key={c.id}
                    className="flex flex-wrap items-start justify-between gap-3 px-4 py-3"
                  >
                    <div className="min-w-0 flex-1 space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="font-medium">{c.label}</span>
                        {c.url && (
                          <a
                            href={c.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-xs text-blue-600 hover:underline"
                          >
                            Open
                          </a>
                        )}
                      </div>
                      {c.username && (
                        <p className="text-sm text-slate-600">
                          Username:{' '}
                          <span className="font-mono text-xs">{c.username}</span>
                        </p>
                      )}
                      <div className="flex items-center gap-2">
                        <span className="text-sm text-slate-600">Value:</span>
                        <code className="rounded bg-slate-100 px-2 py-0.5 font-mono text-xs">
                          {visibleIds.has(c.id) ? c.value : '\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022'}
                        </code>
                        <button
                          onClick={() => toggleVisibility(c.id)}
                          className="text-slate-400 hover:text-slate-600"
                          title={visibleIds.has(c.id) ? 'Hide' : 'Show'}
                        >
                          {visibleIds.has(c.id) ? (
                            <EyeOff className="h-4 w-4" />
                          ) : (
                            <Eye className="h-4 w-4" />
                          )}
                        </button>
                        <button
                          onClick={() => copyToClipboard(c.value, c.id)}
                          className="text-slate-400 hover:text-slate-600"
                          title="Copy to clipboard"
                        >
                          {copiedId === c.id ? (
                            <Check className="h-4 w-4 text-green-600" />
                          ) : (
                            <Copy className="h-4 w-4" />
                          )}
                        </button>
                      </div>
                      {c.notes && (
                        <p className="text-xs text-slate-500">{c.notes}</p>
                      )}
                    </div>
                    <div className="flex items-center gap-1">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => startEdit(c)}
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      {deletingId === c.id ? (
                        <div className="flex items-center gap-1">
                          <Button
                            variant="ghost"
                            size="sm"
                            className="text-red-600"
                            onClick={() => handleDelete(c.id)}
                          >
                            <Check className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setDeletingId(null)}
                          >
                            <X className="h-4 w-4" />
                          </Button>
                        </div>
                      ) : (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-red-500 hover:text-red-700"
                          onClick={() => setDeletingId(c.id)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* Security Note */}
      <Card className="border-amber-200 bg-amber-50/30 p-4">
        <div className="flex gap-3">
          <AlertTriangle className="mt-0.5 h-5 w-5 flex-shrink-0 text-amber-600" />
          <div className="text-sm text-slate-700">
            <p className="font-medium">Security Information</p>
            <p className="mt-1">
              All credential values are encrypted at rest using AES-256-GCM.
              Access to this page is restricted to designated users only.
              All actions are logged in the audit trail.
            </p>
          </div>
        </div>
      </Card>
    </div>
  )
}
