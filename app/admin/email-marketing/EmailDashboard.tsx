'use client'

import Link from 'next/link'
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  ResponsiveContainer,
} from 'recharts'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from '@/components/ui/chart'
import { Mail, Users, Zap, ShieldX, Plus, ArrowRight } from 'lucide-react'

type StatusVariant = 'default' | 'secondary' | 'destructive' | 'outline'

const STATUS_VARIANT: Record<string, StatusVariant> = {
  SENT: 'default',
  SENDING: 'secondary',
  DRAFT: 'outline',
  SCHEDULED: 'secondary',
  PAUSED: 'outline',
  CANCELLED: 'destructive',
  FAILED: 'destructive',
}

const chartConfig = {
  sent: {
    label: 'Emails Sent',
    color: 'hsl(var(--chart-1))',
  },
  openRate: {
    label: 'Open Rate %',
    color: 'hsl(var(--chart-2))',
  },
} satisfies ChartConfig

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

interface StatTileProps {
  icon: React.ElementType
  label: string
  value: string | number
}

function StatTile({ icon: Icon, label, value }: StatTileProps) {
  return (
    <Card>
      <CardContent className="p-6">
        <div className="flex items-center gap-3">
          <div className="rounded-lg bg-muted p-2">
            <Icon className="h-5 w-5 text-muted-foreground" />
          </div>
          <div>
            <p className="text-sm text-muted-foreground">{label}</p>
            <p className="text-2xl font-bold text-foreground">{value}</p>
          </div>
        </div>
      </CardContent>
    </Card>
  )
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
        <StatTile icon={Mail} label="Campaigns Sent (30d)" value={stats.campaigns} />
        <StatTile
          icon={Users}
          label="Total Subscribers"
          value={stats.totalSubscribers.toLocaleString()}
        />
        <StatTile
          icon={Zap}
          label="Active Automations"
          value={stats.automationCount}
        />
        <StatTile
          icon={ShieldX}
          label="Suppressed"
          value={stats.suppressionCount.toLocaleString()}
        />
      </div>

      {/* Quick Actions */}
      <div className="flex flex-wrap gap-3">
        <Button asChild>
          <Link href="/admin/email-campaigns">
            <Plus className="mr-2 h-4 w-4" />
            New Campaign
          </Link>
        </Button>
        <Button asChild variant="outline">
          <Link href="/admin/email-marketing/automations/new">
            <Zap className="mr-2 h-4 w-4" />
            New Automation
          </Link>
        </Button>
        <Button asChild variant="outline">
          <Link href="/admin/communications/lists">
            <Users className="mr-2 h-4 w-4" />
            Manage Lists
          </Link>
        </Button>
      </div>

      {/* Recent Campaigns Chart */}
      {chartData.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Recent Campaign Performance</CardTitle>
          </CardHeader>
          <CardContent>
            <ChartContainer config={chartConfig} className="h-[250px] w-full">
              <BarChart
                data={chartData}
                margin={{ top: 5, right: 20, left: 0, bottom: 60 }}
              >
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis
                  dataKey="name"
                  tick={{ fontSize: 11 }}
                  angle={-30}
                  textAnchor="end"
                  tickLine={false}
                  axisLine={false}
                />
                <YAxis tickLine={false} axisLine={false} />
                <ChartTooltip content={<ChartTooltipContent />} />
                <Bar dataKey="sent" fill="var(--color-sent)" radius={[4, 4, 0, 0]} />
                <Bar
                  dataKey="openRate"
                  fill="var(--color-openRate)"
                  radius={[4, 4, 0, 0]}
                />
              </BarChart>
            </ChartContainer>
          </CardContent>
        </Card>
      )}

      {/* Recent Campaigns Table */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Recent Campaigns</CardTitle>
            <Button asChild variant="ghost" size="sm">
              <Link href="/admin/email-campaigns">
                View all <ArrowRight className="ml-1 h-4 w-4" />
              </Link>
            </Button>
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
                <div
                  key={c.id}
                  className="flex items-center gap-4 py-2 border-b last:border-0"
                >
                  <div className="flex-1 min-w-0">
                    <p className="font-medium truncate">{c.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {new Date(c.createdAt).toLocaleDateString()}
                    </p>
                  </div>
                  <Badge variant={STATUS_VARIANT[c.status] ?? 'outline'}>
                    {c.status}
                  </Badge>
                  <div className="text-sm text-right">
                    <p>{c.sentCount.toLocaleString()} sent</p>
                    <p className="text-muted-foreground">
                      {c.openRate}% open rate
                    </p>
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
