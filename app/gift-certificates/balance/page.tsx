'use client'

import { useState } from 'react'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { formatPrice } from '@/lib/utils'

type BalanceResult = {
  code: string
  originalAmount: number
  balance: number
  status: string
  recipientName?: string
  expiresAt?: string
  recentUsage?: Array<{
    amount: number
    balanceAfter: number
    usedAt: string
  }>
  isExpired?: boolean
  isRedeemed?: boolean
  message?: string
}

export default function GiftCertificateBalancePage() {
  const [code, setCode] = useState('')
  const [isChecking, setIsChecking] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [result, setResult] = useState<BalanceResult | null>(null)

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setError(null)
    setResult(null)
    setIsChecking(true)

    try {
      const response = await fetch('/api/gift-certificates/balance', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: code.toUpperCase().trim() }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Unable to check balance.')
      }

      setResult(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to check balance. Please try again.')
    } finally {
      setIsChecking(false)
    }
  }

  return (
    <div className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Check Gift Certificate Balance</h1>
        <p className="text-gray-600">
          Enter your gift certificate code to check the current balance and view recent usage.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Enter Gift Certificate Code</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <Label htmlFor="code">Gift Certificate Code</Label>
              <Input
                id="code"
                type="text"
                value={code}
                onChange={(e) => setCode(e.target.value.toUpperCase())}
                placeholder="JMS-GC-XXXX-XXXX"
                required
                className="font-mono"
              />
            </div>

            {error && (
              <div className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                {error}
              </div>
            )}

            <Button
              type="submit"
              className="w-full bg-salsa-500 hover:bg-salsa-600"
              disabled={isChecking || !code.trim()}
            >
              {isChecking ? 'Checking...' : 'Check Balance'}
            </Button>
          </form>

          {result && (
            <div className="mt-8 space-y-4">
              <div className="rounded-md border border-gray-200 bg-gray-50 p-6">
                <div className="space-y-3">
                  <div className="flex justify-between items-center">
                    <span className="text-sm font-medium text-gray-700">Gift Certificate Code:</span>
                    <span className="text-sm font-mono font-semibold text-gray-900">{result.code}</span>
                  </div>
                  {result.recipientName && (
                    <div className="flex justify-between items-center">
                      <span className="text-sm font-medium text-gray-700">Recipient:</span>
                      <span className="text-sm text-gray-900">{result.recipientName}</span>
                    </div>
                  )}
                  <div className="flex justify-between items-center">
                    <span className="text-sm font-medium text-gray-700">Original Amount:</span>
                    <span className="text-sm font-semibold text-gray-900">{formatPrice(result.originalAmount)}</span>
                  </div>
                  <div className="flex justify-between items-center border-t pt-3">
                    <span className="text-base font-semibold text-gray-900">Current Balance:</span>
                    <span className="text-lg font-bold text-salsa-600">{formatPrice(result.balance)}</span>
                  </div>
                  {result.status === 'REDEEMED' && (
                    <div className="rounded-md bg-yellow-50 border border-yellow-200 px-3 py-2 text-sm text-yellow-800">
                      This gift certificate has been fully redeemed.
                    </div>
                  )}
                  {result.isExpired && (
                    <div className="rounded-md bg-red-50 border border-red-200 px-3 py-2 text-sm text-red-800">
                      This gift certificate has expired.
                    </div>
                  )}
                  {result.message && (
                    <div className="rounded-md bg-blue-50 border border-blue-200 px-3 py-2 text-sm text-blue-800">
                      {result.message}
                    </div>
                  )}
                </div>
              </div>

              {result.recentUsage && result.recentUsage.length > 0 && (
                <div>
                  <h3 className="text-sm font-semibold text-gray-900 mb-3">Recent Usage</h3>
                  <div className="space-y-2">
                    {result.recentUsage.map((usage, index) => (
                      <div
                        key={index}
                        className="flex justify-between items-center text-sm border-b border-gray-200 pb-2"
                      >
                        <div>
                          <span className="text-gray-700">
                            Used {formatPrice(usage.amount)} on{' '}
                            {new Date(usage.usedAt).toLocaleDateString()}
                          </span>
                        </div>
                        <span className="text-gray-600">Balance: {formatPrice(usage.balanceAfter)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

