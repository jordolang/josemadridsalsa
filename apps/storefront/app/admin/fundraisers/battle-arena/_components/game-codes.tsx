'use client'

import { useState } from 'react'
import { toast } from 'sonner'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

export interface GameCodeRow {
  id: string
  code: string
  groupName: string
  fundraiser: { id: string; name: string } | null
  createdAt: string
  revokedAt: string | null
  lastUsedAt: string | null
}

interface FundraiserOption {
  id: string
  name: string
  organizationName: string
}

function errorOf(data: unknown, status: number): string {
  const error = (data as { error?: unknown }).error
  return typeof error === 'string' ? error : `HTTP ${status}`
}

export function GameCodes({ initialCodes, fundraisers }: { initialCodes: GameCodeRow[]; fundraisers: FundraiserOption[] }) {
  const [codes, setCodes] = useState(initialCodes)
  const [groupName, setGroupName] = useState('')
  const [fundraiserId, setFundraiserId] = useState('')
  const [pending, setPending] = useState(false)

  async function create(e: React.FormEvent): Promise<void> {
    e.preventDefault()
    if (!groupName.trim() && !fundraiserId) {
      toast.error('Type the group name or pick a fundraiser.')
      return
    }
    setPending(true)
    try {
      const res = await fetch('/api/admin/arena/game-codes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ groupName: groupName.trim() || undefined, fundraiserId: fundraiserId || undefined }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        toast.error(errorOf(data, res.status))
        return
      }
      const code = (data as { code: GameCodeRow }).code
      setCodes((prev) => [code, ...prev])
      setGroupName('')
      setFundraiserId('')
      toast.success(`${code.groupName}: ${code.code}`)
    } finally {
      setPending(false)
    }
  }

  async function setRevoked(row: GameCodeRow, revoked: boolean): Promise<void> {
    const res = await fetch(`/api/admin/arena/game-codes/${row.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ revoked }),
    })
    const data = await res.json().catch(() => ({}))
    if (!res.ok) {
      toast.error(errorOf(data, res.status))
      return
    }
    const code = (data as { code: GameCodeRow }).code
    setCodes((prev) => prev.map((c) => (c.id === code.id ? code : c)))
  }

  async function copy(row: GameCodeRow): Promise<void> {
    const text = `${row.groupName}: your José Madrid Salsa Battle Arena fundraiser code is ${row.code}. Type it in the Fundraiser code box on the game's title screen.`
    try {
      await navigator.clipboard.writeText(text)
      toast.success(`Copied ${row.groupName}'s code.`)
    } catch {
      toast.error(row.code)
    }
  }

  return (
    <div className="space-y-6">
      <Card className="p-6">
        <form onSubmit={create} className="grid gap-4 md:grid-cols-[1fr_1fr_auto] md:items-end">
          <div className="space-y-2">
            <Label htmlFor="gc-fundraiser">Fundraiser (optional)</Label>
            <select
              id="gc-fundraiser"
              value={fundraiserId}
              onChange={(e) => setFundraiserId(e.target.value)}
              className="h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm"
            >
              <option value="">No linked fundraiser</option>
              {fundraisers.map((f) => (
                <option key={f.id} value={f.id}>
                  {f.name}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="gc-group">Group name in the game</Label>
            <Input
              id="gc-group"
              value={groupName}
              maxLength={40}
              onChange={(e) => setGroupName(e.target.value)}
              placeholder={fundraiserId ? "Defaults to the fundraiser's organization" : 'Lincoln Elementary PTA'}
            />
          </div>
          <Button type="submit" disabled={pending}>
            {pending ? 'Making…' : 'Make code'}
          </Button>
        </form>
      </Card>

      <Card className="overflow-hidden p-0">
        {codes.length === 0 ? (
          <p className="p-12 text-center text-muted-foreground">No codes yet. Make one per fundraising group above.</p>
        ) : (
          <table className="w-full text-sm">
            <thead className="border-b bg-muted/30 text-left text-xs uppercase tracking-wider text-muted-foreground">
              <tr>
                <th className="p-3">Code</th>
                <th className="p-3">Group</th>
                <th className="p-3">Fundraiser</th>
                <th className="p-3">Last used</th>
                <th className="p-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {codes.map((c) => (
                <tr key={c.id} className="border-b last:border-b-0">
                  <td className="p-3 font-mono font-semibold">
                    {c.code}{' '}
                    {c.revokedAt && (
                      <Badge variant="secondary" className="ml-2">
                        Revoked
                      </Badge>
                    )}
                  </td>
                  <td className="p-3">{c.groupName}</td>
                  <td className="p-3 text-xs text-muted-foreground">{c.fundraiser?.name ?? '—'}</td>
                  <td className="p-3 text-xs text-muted-foreground">
                    {c.lastUsedAt ? new Date(c.lastUsedAt).toLocaleString() : 'Never'}
                  </td>
                  <td className="space-x-2 p-3 text-right">
                    <Button size="sm" variant="outline" onClick={() => copy(c)}>
                      Copy
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => setRevoked(c, !c.revokedAt)}>
                      {c.revokedAt ? 'Restore' : 'Revoke'}
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>
    </div>
  )
}
