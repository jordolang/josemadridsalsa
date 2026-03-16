'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import Link from 'next/link'

type FundraiserAccountData = {
  id: string
  status: 'PENDING' | 'APPROVED' | 'SUSPENDED'
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

export default function FundraiserAccountsPage() {
  const [accounts, setAccounts] = useState<FundraiserAccountData[]>([])
  const [filter, setFilter] = useState<string>('')
  const [isLoading, setIsLoading] = useState(true)
  const [actionLoading, setActionLoading] = useState<string | null>(null)

  async function loadAccounts() {
    try {
      const url = filter
        ? `/api/admin/fundraiser-accounts?status=${filter}`
        : '/api/admin/fundraiser-accounts'
      const res = await fetch(url)
      if (res.ok) {
        const data = await res.json()
        setAccounts(data.accounts)
      }
    } catch {
      // ignore
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    setIsLoading(true)
    loadAccounts()
  }, [filter])

  async function handleAction(accountId: string, action: 'approve' | 'suspend') {
    setActionLoading(accountId)
    try {
      const res = await fetch('/api/admin/fundraiser-accounts', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ accountId, action }),
      })
      if (res.ok) {
        await loadAccounts()
      }
    } catch {
      // ignore
    } finally {
      setActionLoading(null)
    }
  }

  const statusBadge = (status: string) => {
    switch (status) {
      case 'PENDING':
        return 'bg-yellow-100 text-yellow-800'
      case 'APPROVED':
        return 'bg-green-100 text-green-800'
      case 'SUSPENDED':
        return 'bg-red-100 text-red-800'
      default:
        return 'bg-gray-100 text-gray-800'
    }
  }

  return (
    <div className="p-6">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-bold">Fundraiser Accounts</h1>
      </div>

      {/* Filters */}
      <div className="mb-6 flex gap-2">
        {['', 'PENDING', 'APPROVED', 'SUSPENDED'].map((s) => (
          <button
            key={s}
            onClick={() => setFilter(s)}
            className={`rounded-md px-3 py-1.5 text-sm font-medium transition ${
              filter === s
                ? 'bg-gray-900 text-white'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            {s || 'All'}
          </button>
        ))}
      </div>

      {isLoading ? (
        <p className="text-gray-500">Loading...</p>
      ) : accounts.length === 0 ? (
        <Card className="p-8 text-center text-gray-500">
          No fundraiser accounts found.
        </Card>
      ) : (
        <div className="space-y-3">
          {accounts.map((account) => (
            <Card key={account.id} className="p-4">
              <div className="flex items-center justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-3">
                    <h3 className="font-semibold text-gray-900">
                      {account.fundraiser.organizationName}
                    </h3>
                    <span
                      className={`inline-flex rounded-full px-2 py-0.5 text-xs font-semibold ${statusBadge(account.status)}`}
                    >
                      {account.status}
                    </span>
                  </div>
                  <div className="mt-1 flex gap-4 text-sm text-gray-500">
                    <span>{account.user.email}</span>
                    <span>{account.user.name}</span>
                    <span>
                      Signed up: {new Date(account.createdAt).toLocaleDateString()}
                    </span>
                  </div>
                  <div className="mt-1">
                    <Link
                      href={`/admin/fundraisers/${account.fundraiser.id}/edit`}
                      className="text-sm text-blue-600 hover:text-blue-700"
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
                      className="bg-green-600 hover:bg-green-700"
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
