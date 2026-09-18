"use client"

import { useCallback, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  DollarSign, ShoppingBag, TrendingUp, Calendar,
  Package, User, CheckCircle2, Clock, ExternalLink, RefreshCw
} from 'lucide-react'
import { formatPrice } from '@/lib/utils'
import { ReferralLinkDisplay } from '@/components/fundraising/referral-link-display'
import { CampaignStatsCard } from '@/components/fundraising/campaign-stats-card'
import Link from 'next/link'

interface Order {
  id: string
  orderNumber: string
  total: number
  status: string
  createdAt: Date
  items: {
    productName: string
    quantity: number
    unitPrice: number
  }[]
}

interface ParticipantDashboardProps {
  participant: {
    id: string
    name: string
    email: string
    referralCode: string
    totalOrders: number
    totalRevenue: number
    totalCommission: number
  }
  fundraiser: {
    name: string
    slug: string
    organizationName: string
    commissionRate: number
    goal?: number
    totalRevenue: number
    startDate: Date
    endDate: Date
  }
  orders: Order[]
  referralUrl: string
}

export function ParticipantDashboard({
  participant,
  fundraiser,
  orders,
  referralUrl,
}: ParticipantDashboardProps) {
  const router = useRouter()
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [lastUpdated, setLastUpdated] = useState(new Date())

  // Calculate commission rate display
  const commissionPercentage = fundraiser.commissionRate

  // Calculate progress towards campaign goal
  const goalProgress = fundraiser.goal
    ? Math.min((fundraiser.totalRevenue / fundraiser.goal) * 100, 100)
    : 0

  // Format dates
  const now = new Date()
  const isActive = now >= fundraiser.startDate && now <= fundraiser.endDate
  const daysRemaining = Math.max(0, Math.ceil((fundraiser.endDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)))

  // Sort orders by date descending
  const sortedOrders = [...orders].sort((a, b) =>
    b.createdAt.getTime() - a.createdAt.getTime()
  )

  // Auto-refresh functionality
  const handleRefresh = useCallback(async () => {
    setIsRefreshing(true)
    router.refresh()
    setLastUpdated(new Date())

    // Keep refreshing indicator visible for a brief moment
    setTimeout(() => {
      setIsRefreshing(false)
    }, 500)
  }, [router])

  // Set up auto-refresh interval - refresh every 10 seconds when campaign is active
  useEffect(() => {
    if (!isActive) return

    const interval = setInterval(() => {
      handleRefresh()
    }, 10000) // 10 seconds

    return () => clearInterval(interval)
  }, [handleRefresh, isActive])

  // Format last updated time
  const formatLastUpdated = () => {
    const now = new Date()
    const diffInSeconds = Math.floor((now.getTime() - lastUpdated.getTime()) / 1000)

    if (diffInSeconds < 60) {
      return 'Just now'
    } else if (diffInSeconds < 3600) {
      const minutes = Math.floor(diffInSeconds / 60)
      return `${minutes} minute${minutes !== 1 ? 's' : ''} ago`
    } else {
      return lastUpdated.toLocaleTimeString('en-US', {
        hour: 'numeric',
        minute: '2-digit',
      })
    }
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="bg-gradient-to-r from-verde-600 via-salsa-600 to-chile-600 text-white">
        <div className="container mx-auto px-4 py-12">
          <div className="max-w-6xl mx-auto">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h1 className="text-3xl lg:text-4xl font-bold mb-2">
                  {participant.name}'s Dashboard
                </h1>
                <p className="text-verde-100 text-lg">
                  {fundraiser.name} • {fundraiser.organizationName}
                </p>
              </div>
              <div className="flex items-center gap-3">
                <div className="text-right hidden sm:block">
                  <p className="text-xs text-verde-100">
                    Last updated: {formatLastUpdated()}
                  </p>
                  {isActive && (
                    <p className="text-xs text-verde-200">
                      Auto-refreshing every 10s
                    </p>
                  )}
                </div>
                <Badge
                  variant={isActive ? 'default' : 'secondary'}
                  className={isActive ? 'bg-white text-verde-700 hover:bg-white/90' : ''}
                >
                  {isActive ? `${daysRemaining} days left` : 'Campaign Ended'}
                </Badge>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="container mx-auto px-4 py-8">
        <div className="max-w-6xl mx-auto space-y-8">
          {/* Share Link - Prominent */}
          <Card className="border-2 border-salsa-200 bg-salsa-50/30">
            <CardHeader>
              <CardTitle className="text-2xl flex items-center gap-2">
                <TrendingUp className="h-6 w-6 text-salsa-600" />
                Your Referral Link
              </CardTitle>
              <CardDescription>
                Share this link with supporters to get credit for their orders
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ReferralLinkDisplay
                url={referralUrl}
                code={participant.referralCode}
                participantName={participant.name}
                variant="card"
                showQRCode={true}
                showExternalLink={true}
              />
            </CardContent>
          </Card>

          {/* Stats Grid */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold">Your Stats</h2>
              <Button
                variant="outline"
                size="sm"
                onClick={handleRefresh}
                disabled={isRefreshing}
                className="gap-2"
              >
                <RefreshCw className={`h-4 w-4 ${isRefreshing ? 'animate-spin' : ''}`} />
                Refresh
              </Button>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <CampaignStatsCard
                title="Total Orders"
                value={participant.totalOrders}
                icon={ShoppingBag}
                iconColor="text-blue-600"
                borderColor="border-l-blue-500"
                isRefreshing={isRefreshing}
              />
              <CampaignStatsCard
                title="Total Revenue"
                value={formatPrice(participant.totalRevenue)}
                icon={DollarSign}
                iconColor="text-green-600"
                borderColor="border-l-green-500"
                isRefreshing={isRefreshing}
              />
              <CampaignStatsCard
                title="Commission Earned"
                value={formatPrice(participant.totalCommission)}
                icon={TrendingUp}
                iconColor="text-salsa-600"
                borderColor="border-l-salsa-500"
                isRefreshing={isRefreshing}
              />
            </div>
          </div>

          {/* Campaign Info */}
          <Card>
            <CardHeader>
              <CardTitle>Campaign Information</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <p className="text-sm text-muted-foreground mb-1">Commission Rate</p>
                  <p className="text-2xl font-bold text-verde-600">
                    {commissionPercentage.toString()}%
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    You earn {commissionPercentage.toString()}% of each sale
                  </p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground mb-1">Campaign Status</p>
                  <div className="flex items-center gap-2">
                    <Badge variant={isActive ? 'default' : 'secondary'}>
                      {isActive ? 'Active' : 'Ended'}
                    </Badge>
                    {isActive && (
                      <span className="text-sm text-muted-foreground">
                        {daysRemaining} day{daysRemaining !== 1 ? 's' : ''} remaining
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    {fundraiser.startDate.toLocaleDateString()} - {fundraiser.endDate.toLocaleDateString()}
                  </p>
                </div>
                {fundraiser.goal && (
                  <div className="md:col-span-2">
                    <p className="text-sm text-muted-foreground mb-2">
                      Campaign Goal Progress
                    </p>
                    <div className="flex items-center gap-4">
                      <div className="flex-1">
                        <div className="h-3 bg-slate-200 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-gradient-to-r from-verde-500 to-salsa-500 transition-all duration-500"
                            style={{ width: `${goalProgress}%` }}
                          />
                        </div>
                      </div>
                      <div className="text-sm font-medium">
                        {goalProgress.toFixed(1)}%
                      </div>
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">
                      {formatPrice(fundraiser.totalRevenue)} of {formatPrice(fundraiser.goal)} raised
                    </p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Orders List */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Package className="h-5 w-5" />
                Your Orders
              </CardTitle>
              <CardDescription>
                {participant.totalOrders > 0
                  ? `${participant.totalOrders} order${participant.totalOrders !== 1 ? 's' : ''} placed through your referral link`
                  : 'No orders yet - start sharing your referral link!'
                }
              </CardDescription>
            </CardHeader>
            <CardContent>
              {sortedOrders.length > 0 ? (
                <div className="space-y-4">
                  {sortedOrders.map((order) => (
                    <div
                      key={order.id}
                      className="border rounded-lg p-4 hover:bg-slate-50 transition-colors"
                    >
                      <div className="flex items-start justify-between mb-3">
                        <div>
                          <div className="flex items-center gap-2 mb-1">
                            <span className="font-mono text-sm font-medium">
                              #{order.orderNumber}
                            </span>
                            <Badge
                              variant={
                                order.status === 'COMPLETED' ? 'default' :
                                order.status === 'PROCESSING' ? 'secondary' :
                                order.status === 'PENDING' ? 'outline' :
                                'destructive'
                              }
                            >
                              {order.status === 'COMPLETED' && <CheckCircle2 className="h-3 w-3 mr-1" />}
                              {order.status === 'PROCESSING' && <Clock className="h-3 w-3 mr-1" />}
                              {order.status}
                            </Badge>
                          </div>
                          <p className="text-sm text-muted-foreground flex items-center gap-1">
                            <Calendar className="h-3 w-3" />
                            {order.createdAt.toLocaleDateString('en-US', {
                              month: 'short',
                              day: 'numeric',
                              year: 'numeric',
                            })}
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="text-lg font-bold">
                            {formatPrice(Number(order.total))}
                          </p>
                          <p className="text-xs text-verde-600 font-medium">
                            +{formatPrice(Number(order.total) * (commissionPercentage / 100))} commission
                          </p>
                        </div>
                      </div>
                      <div className="space-y-1">
                        {order.items.map((item, idx) => (
                          <div key={idx} className="flex justify-between text-sm">
                            <span className="text-muted-foreground">
                              {item.quantity}x {item.productName}
                            </span>
                            <span className="font-medium">
                              {formatPrice(Number(item.unitPrice))}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-12">
                  <Package className="h-12 w-12 text-muted-foreground mx-auto mb-4 opacity-50" />
                  <p className="text-muted-foreground mb-4">
                    No orders yet. Share your referral link to start earning!
                  </p>
                  <Button variant="outline" asChild>
                    <a href={referralUrl} target="_blank" rel="noopener noreferrer">
                      <ExternalLink className="h-4 w-4 mr-2" />
                      View Your Referral Page
                    </a>
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>

          {/* How to Share Section */}
          <Card className="bg-muted/50">
            <CardHeader>
              <CardTitle>Tips for Sharing</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid md:grid-cols-3 gap-4">
                <div>
                  <div className="w-10 h-10 bg-verde-100 rounded-full flex items-center justify-center mb-3">
                    <User className="h-5 w-5 text-verde-700" />
                  </div>
                  <h3 className="font-semibold mb-1">Personal Outreach</h3>
                  <p className="text-sm text-muted-foreground">
                    Share directly with family, friends, and colleagues via email or text
                  </p>
                </div>
                <div>
                  <div className="w-10 h-10 bg-salsa-100 rounded-full flex items-center justify-center mb-3">
                    <TrendingUp className="h-5 w-5 text-salsa-700" />
                  </div>
                  <h3 className="font-semibold mb-1">Social Media</h3>
                  <p className="text-sm text-muted-foreground">
                    Post your link on Facebook, Instagram, or Twitter to reach more people
                  </p>
                </div>
                <div>
                  <div className="w-10 h-10 bg-chile-100 rounded-full flex items-center justify-center mb-3">
                    <Package className="h-5 w-5 text-chile-700" />
                  </div>
                  <h3 className="font-semibold mb-1">QR Code</h3>
                  <p className="text-sm text-muted-foreground">
                    Print the QR code to share at events or in physical locations
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
