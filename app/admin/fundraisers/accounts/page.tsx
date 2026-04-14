'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import Link from 'next/link'
import { toast } from 'sonner'

type FundraiserAccountStatus = 'PENDING' | 'APPROVED' | 'SUSPENDED'

type FundraiserAccountData = {
  id: string
  status: FundraiserAccountStatus
  createdAt: string
  approvedAt: string | null
  user: { id: string; name: string | null; email: string; createdAt: string }
  fundraiser: {
    id: string
    name: string
    organizationName: string
    slug: string
    subdomain: string | null
    status: string
  }
}

const STATUS_FILTERS: { label: string; value: string }[] = [
  { label: 'All', value: '' },
  { label: 'Pending', value: 'PENDING' },
  { label: 'Approved', value: 'APPROVED' },
  { label: 'Suspended', value: 'SUSPENDED' },
]

const statusVariant = (
  status: FundraiserAccountStatus,
): 'default' | 'secondary' | 'outline' | 'destructive' => {
  switch (status) {
    case 'PENDING':
      return 'outline'
    case 'APPROVED':
      return 'default'
    case 'SUSPENDED':
      return 'destructive'
  }
}

export default function FundraiserAccountsPage() {
  const [accounts, setAccounts] = useState<FundraiserAccountData[]>([])
  const [filter, setFilter] = useState<string>('')
  const [isLoading, setIsLoading] = useState(true)
  const [actionLoading, setActionLoading] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false

    const load = async () => {
      setIsLoading(true)
      try {
        const url = filter
          ? `/api/admin/fundraiser-accounts?status=${filter}`
          : '/api/admin/fundraiser-accounts'
        const res = await fetch(url)
        if (!res.ok) throw new Error('Failed to load accounts')
        const data = await res.json()
        if (!cancelled) setAccounts(data.accounts)
      } catch (error: unknown) {
        if (!cancelled) {
          toast.error(
            error instanceof Error ? error.message : 'Failed to load accounts',
          )
        }
      } finally {
        if (!cancelled) setIsLoading(false)
      }
    }

    load()
    return () => {
      cancelled = true
    }
  }, [filter])

  async function reloadAccounts() {
    try {
      const url = filter
        ? `/api/admin/fundraiser-accounts?status=${filter}`
        : '/api/admin/fundraiser-accounts'
      const res = await fetch(url)
      if (!res.ok) throw new Error('Failed to reload accounts')
      const data = await res.json()
      setAccounts(data.accounts)
    } catch (error: unknown) {
      toast.error(
        error instanceof Error ? error.message : 'Failed to reload accounts',
      )
    }
  }

  async function handleAction(accountId: string, action: 'approve' | 'suspend') {
    setActionLoading(accountId)
    try {
      const res = await fetch('/api/admin/fundraiser-accounts', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ accountId, action }),
      })
      if (!res.ok) throw new Error('Action failed')
      toast.success(action === 'approve' ? 'Account approved' : 'Account suspended')
      await reloadAccounts()
    } catch (error: unknown) {
      toast.error(error instanceof Error ? error.message : 'Action failed')
    } finally {
      setActionLoading(null)
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">Fundraiser Accounts</h1>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-2">
        {STATUS_FILTERS.map(({ label, value }) => (
          <Button
            key={value || 'all'}
            size="sm"
            variant={filter === value ? 'default' : 'outline'}
            onClick={() => setFilter(value)}
          >
            {label}
          </Button>
        ))}
      </div>

      {isLoading ? (
        <div className="space-y-3">
          <Skeleton className="h-24 w-full" />
          <Skeleton className="h-24 w-full" />
          <Skeleton className="h-24 w-full" />
        </div>
      ) : accounts.length === 0 ? (
        <Card className="p-8 text-center text-muted-foreground">
          No fundraiser accounts found.
        </Card>
      ) : (
        <div className="space-y-3">
          {accounts.map((account) => (
            <Card key={account.id} className="p-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex-1">
                  <div className="flex flex-wrap items-center gap-3">
                    <h3 className="font-semibold text-foreground">
                      {account.fundraiser.organizationName}
                    </h3>
                    <Badge variant={statusVariant(account.status)}>
                      {account.status}
                    </Badge>
                  </div>
                  <div className="mt-1 flex flex-wrap gap-4 text-sm text-muted-foreground">
                    <span>{account.user.email}</span>
                    {account.user.name && <span>{account.user.name}</span>}
                    <span>
                      Signed up: {new Date(account.createdAt).toLocaleDateString()}
                    </span>
                  </div>
                  <div className="mt-1">
                    <Link
                      href={`/admin/fundraisers/${account.fundraiser.id}/edit`}
                      className="text-sm text-primary hover:underline"
                    >
                      View Fundraiser: {account.fundraiser.name}
                    </Link>
                  </div>
                </div>
                <div className="flex gap-2">
                  {account.status === 'PENDING' && (
                    <Button
                      size="sm"
                      onClick={() => handleAction(account.id, 'approve')}
                      disabled={actionLoading === account.id}
                    >
                      {actionLoading === account.id ? 'Processing...' : 'Approve'}
                    </Button>
                  )}
                  {account.status === 'APPROVED' && (
                    <Button
                      size="sm"
                      variant="destructive"
                      onClick={() => handleAction(account.id, 'suspend')}
                      disabled={actionLoading === account.id}
                    >
                      {actionLoading === account.id ? 'Processing...' : 'Suspend'}
                    </Button>
                  )}
                  {account.status === 'SUSPENDED' && (
                    <Button
                      size="sm"
                      onClick={() => handleAction(account.id, 'approve')}
                      disabled={actionLoading === account.id}
                    >
                      {actionLoading === account.id ? 'Processing...' : 'Reactivate'}
                    </Button>
                  )}
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
