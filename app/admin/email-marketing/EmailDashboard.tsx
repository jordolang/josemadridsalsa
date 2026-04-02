'use client'

import Link from 'next/link'
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Mail, Users, Zap, ShieldX, Plus, ArrowRight } from 'lucide-react'

const STATUS_COLORS: Record<string, string> = {
  SENT: 'bg-green-100 text-green-800',
  SENDING: 'bg-blue-100 text-blue-800',
  DRAFT: 'bg-gray-100 text-gray-800',
  SCHEDULED: 'bg-yellow-100 text-yellow-800',
  PAUSED: 'bg-orange-100 text-orange-800',
  CANCELLED: 'bg-red-100 text-red-800',
  FAILED: 'bg-red-100 text-red-800',
}

interface DashboardProps {
  stats: {
    campaigns: number
    totalSubscribers: number
    automationCount: number
    suppressionCount: number
  }
  recentCampaigns: {
    id: string
    name: string
    status: string
    sentCount: number
    totalRecipients: number
    openRate: number
    createdAt: string
  }[]
}

export function EmailDashboard({ stats, recentCampaigns }: DashboardProps) {
  const chartData = recentCampaigns.map((c) => ({
    name: c.name.length > 20 ? c.name.slice(0, 20) + '…' : c.name,
    sent: c.sentCount,
    openRate: c.openRate,
  }))

  return (
    <div className="space-y-6">
      {/* Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-100 rounded-lg">
                <Mail className="h-5 w-5 text-blue-600" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Campaigns Sent (30d)</p>
                <p className="text-2xl font-bold">{stats.campaigns}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-green-100 rounded-lg">
                <Users className="h-5 w-5 text-green-600" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Total Subscribers</p>
                <p className="text-2xl font-bold">{stats.totalSubscribers.toLocaleString()}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-purple-100 rounded-lg">
                <Zap className="h-5 w-5 text-purple-600" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Active Automations</p>
                <p className="text-2xl font-bold">{stats.automationCount}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-red-100 rounded-lg">
                <ShieldX className="h-5 w-5 text-red-600" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Suppressed</p>
                <p className="text-2xl font-bold">{stats.suppressionCount.toLocaleString()}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Quick Actions */}
      <div className="flex flex-wrap gap-3">
        <Link href="/admin/email-campaigns">
          <Button>
            <Plus className="mr-2 h-4 w-4" />
            New Campaign
          </Button>
        </Link>
        <Link href="/admin/email-marketing/automations/new">
          <Button variant="outline">
            <Zap className="mr-2 h-4 w-4" />
            New Automation
          </Button>
        </Link>
        <Link href="/admin/communications/lists">
          <Button variant="outline">
            <Users className="mr-2 h-4 w-4" />
            Manage Lists
          </Button>
        </Link>
      </div>

      {/* Recent Campaigns Chart */}
      {chartData.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Recent Campaign Performance</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={250}>
              <BarChart data={chartData} margin={{ top: 5, right: 20, left: 0, bottom: 60 }}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" tick={{ fontSize: 11 }} angle={-30} textAnchor="end" />
                <YAxis />
                <Tooltip />
                <Bar dataKey="sent" fill="#3b82f6" name="Emails Sent" />
                <Bar dataKey="openRate" fill="#10b981" name="Open Rate %" />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      )}

      {/* Recent Campaigns Table */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Recent Campaigns</CardTitle>
            <Link href="/admin/email-campaigns">
              <Button variant="ghost" size="sm" className="text-muted-foreground">
                View all <ArrowRight className="ml-1 h-4 w-4" />
              </Button>
            </Link>
          </div>
        </CardHeader>
        <CardContent>
          {recentCampaigns.length === 0 ? (
            <p className="text-center py-6 text-muted-foreground">
              No campaigns yet. Create your first campaign!
            </p>
          ) : (
            <div className="space-y-2">
              {recentCampaigns.map((c) => (
                <div key={c.id} className="flex items-center gap-4 py-2 border-b last:border-0">
                  <div className="flex-1 min-w-0">
                    <p className="font-medium truncate">{c.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {new Date(c.createdAt).toLocaleDateString()}
                    </p>
                  </div>
                  <Badge className={STATUS_COLORS[c.status] || 'bg-gray-100'}>{c.status}</Badge>
                  <div className="text-sm text-right">
                    <p>{c.sentCount.toLocaleString()} sent</p>
                    <p className="text-muted-foreground">{c.openRate}% open rate</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
