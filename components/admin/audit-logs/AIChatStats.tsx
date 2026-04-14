'use client'

/**
 * AI Chat Statistics Component
 * Displays real-time AI chat usage metrics
 */

import { useEffect, useState } from 'react'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { MessageSquare, Users, Clock, TrendingUp, AlertTriangle } from 'lucide-react'

interface AIChatMetrics {
  totalRequests: number
  successfulRequests: number
  failedRequests: number
  avgResponseTime: number
  totalMessages: number
  guestRequests: number
  authenticatedRequests: number
}

interface StatsData {
  period: {
    days: number
    startDate: string
    endDate: string
  }
  overview: {
    totalLogs: number
    uniqueUsers: number
  }
  aiChat: AIChatMetrics
  topActions: Array<{ action: string; count: number }>
}

export function AIChatStats() {
  const [stats, setStats] = useState<StatsData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [days, setDays] = useState(7)

  useEffect(() => {
    async function fetchStats() {
      try {
        setLoading(true)
        const response = await fetch(`/api/admin/audit-logs/stats?days=${days}`)

        if (!response.ok) {
          throw new Error('Failed to fetch stats')
        }

        const data = await response.json()
        setStats(data)
        setError(null)
      } catch (err) {
        console.error('Error fetching AI chat stats:', err)
        setError('Failed to load statistics')
      } finally {
        setLoading(false)
      }
    }

    fetchStats()
  }, [days])

  if (loading) {
    return (
      <Card className="p-6">
        <div className="text-center text-muted-foreground">Loading AI Chat statistics...</div>
      </Card>
    )
  }

  if (error || !stats) {
    return (
      <Card className="p-6">
        <div className="text-center text-destructive">
          <AlertTriangle className="mx-auto h-8 w-8 mb-2" />
          {error || 'Failed to load statistics'}
        </div>
      </Card>
    )
  }

  const successRate =
    stats.aiChat.totalRequests > 0
      ? Math.round(
          (stats.aiChat.successfulRequests / stats.aiChat.totalRequests) * 100
        )
      : 0

  return (
    <div className="space-y-4">
      {/* Period Selector */}
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold">AI Chat Analytics</h2>
        <div className="flex gap-2">
          {[7, 30, 90].map((d) => (
            <Button
              key={d}
              size="sm"
              variant={days === d ? 'default' : 'outline'}
              onClick={() => setDays(d)}
            >
              {d} days
            </Button>
          ))}
        </div>
      </div>

      {/* AI Chat Metrics */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <MessageSquare className="h-8 w-8 text-primary" />
            <div>
              <p className="text-sm text-muted-foreground">Total Requests</p>
              <p className="text-2xl font-bold">{stats.aiChat.totalRequests}</p>
              <p className="text-xs text-muted-foreground">
                {stats.aiChat.totalMessages} messages
              </p>
            </div>
          </div>
        </Card>

        <Card className="p-4">
          <div className="flex items-center gap-3">
            <TrendingUp
              className={`h-8 w-8 ${successRate >= 95 ? 'text-primary' : 'text-yellow-600'}`}
            />
            <div>
              <p className="text-sm text-muted-foreground">Success Rate</p>
              <p className="text-2xl font-bold">{successRate}%</p>
              <div className="flex gap-1 text-xs">
                <Badge variant="outline" className="text-primary border-border">
                  {stats.aiChat.successfulRequests} ✓
                </Badge>
                <Badge variant="outline" className="text-destructive border-destructive/30">
                  {stats.aiChat.failedRequests} ✗
                </Badge>
              </div>
            </div>
          </div>
        </Card>

        <Card className="p-4">
          <div className="flex items-center gap-3">
            <Clock className="h-8 w-8 text-purple-600" />
            <div>
              <p className="text-sm text-muted-foreground">Avg Response Time</p>
              <p className="text-2xl font-bold">{stats.aiChat.avgResponseTime}ms</p>
              <p className="text-xs text-muted-foreground">
                {stats.aiChat.avgResponseTime < 1000 ? 'Fast' : 'Slow'}
              </p>
            </div>
          </div>
        </Card>

        <Card className="p-4">
          <div className="flex items-center gap-3">
            <Users className="h-8 w-8 text-orange-600" />
            <div>
              <p className="text-sm text-muted-foreground">User Types</p>
              <div className="flex gap-2 mt-1">
                <div>
                  <p className="text-lg font-bold">{stats.aiChat.authenticatedRequests}</p>
                  <p className="text-xs text-muted-foreground">Logged in</p>
                </div>
                <div className="border-l pl-2">
                  <p className="text-lg font-bold">{stats.aiChat.guestRequests}</p>
                  <p className="text-xs text-muted-foreground">Guest</p>
                </div>
              </div>
            </div>
          </div>
        </Card>
      </div>

      {/* Top Actions */}
      <Card className="p-4">
        <h3 className="font-semibold mb-3">Top Actions (Last {days} days)</h3>
        <div className="space-y-2">
          {stats.topActions.slice(0, 5).map((action) => (
            <div
              key={action.action}
              className="flex items-center justify-between text-sm"
            >
              <span className="font-medium">{action.action}</span>
              <Badge variant="outline">{action.count}</Badge>
            </div>
          ))}
        </div>
      </Card>
    </div>
  )
}
