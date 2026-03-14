import { redirect, notFound } from 'next/navigation'
import type { Metadata } from 'next'
import { getCurrentUser, hasPermission } from '@/lib/rbac'
import prisma from '@/lib/prisma'
import { createMetadata } from '@/lib/metadata'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  ArrowLeft, DollarSign, TrendingUp, Package, ShoppingCart,
  Edit, Mail, Phone, ExternalLink, User, Calendar
} from 'lucide-react'
import Link from 'next/link'
import { format } from 'date-fns'
import { FundraiserParticipantStatus } from '@prisma/client'
import { ReferralLinkDisplay } from '@/components/fundraising/referral-link-display'

export const metadata: Metadata = createMetadata({
  title: 'Participant Details - Jose Madrid Salsa Admin',
  description: 'View participant details and sales history.',
  pathname: '/admin/fundraisers',
})

async function getParticipantWithDetails(participantId: string, fundraiserId: string) {
  const [participant, orders] = await Promise.all([
    prisma.fundraiserParticipant.findUnique({
      where: {
        id: participantId,
        fundraiserId,
      },
      include: {
        fundraiser: {
          select: {
            id: true,
            name: true,
            slug: true,
            organizationName: true,
          },
        },
      },
    }),
    prisma.order.findMany({
      where: {
        participantId,
        fundraiserId,
      },
      orderBy: { createdAt: 'desc' },
      take: 50,
      select: {
        id: true,
        orderNumber: true,
        total: true,
        status: true,
        createdAt: true,
        items: {
          select: {
            quantity: true,
            price: true,
            product: {
              select: {
                name: true,
              },
            },
          },
        },
      },
    }),
  ])

  if (!participant) {
    notFound()
  }

  return { participant, orders }
}

const statusColors: Record<FundraiserParticipantStatus, string> = {
  ACTIVE: 'bg-green-100 text-green-800',
  INACTIVE: 'bg-slate-100 text-slate-800',
}

export default async function ParticipantDetailPage({
  params,
}: {
  params: Promise<{ id: string; participantId: string }>
}) {
  const { id, participantId } = await params
  const user = await getCurrentUser()

  if (!user || !(await hasPermission(user, 'orders:read'))) {
    redirect('/admin/fundraisers')
  }

  const canWrite = await hasPermission(user, 'orders:write')
  const { participant, orders } = await getParticipantWithDetails(participantId, id)

  // Construct referral URL
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'
  const referralUrl = `${baseUrl}/fundraisers/${participant.fundraiser.slug}/${participant.referralCode}`

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <div className="mb-2">
            <Button variant="ghost" size="sm" asChild>
              <Link href={`/admin/fundraisers/${id}/participants`}>
                <ArrowLeft className="mr-2 h-4 w-4" />
                Back to Participants
              </Link>
            </Button>
          </div>
          <div className="flex items-center gap-3">
            <h1 className="text-3xl font-bold">{participant.name}</h1>
            <Badge className={statusColors[participant.status]}>
              {participant.status}
            </Badge>
          </div>
          <p className="mt-1 text-slate-600">
            {participant.fundraiser.name} - {participant.fundraiser.organizationName}
          </p>
        </div>
        {canWrite && (
          <Button asChild>
            <Link href={`/admin/fundraisers/${id}/participants/${participantId}/edit`}>
              <Edit className="mr-2 h-4 w-4" />
              Edit Participant
            </Link>
          </Button>
        )}
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <DollarSign className="h-8 w-8 text-green-600" />
            <div>
              <p className="text-sm text-slate-600">Total Revenue</p>
              <p className="text-2xl font-bold">${Number(participant.totalRevenue).toFixed(2)}</p>
            </div>
          </div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <TrendingUp className="h-8 w-8 text-blue-600" />
            <div>
              <p className="text-sm text-slate-600">Total Commission</p>
              <p className="text-2xl font-bold">${Number(participant.totalCommission).toFixed(2)}</p>
            </div>
          </div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <ShoppingCart className="h-8 w-8 text-purple-600" />
            <div>
              <p className="text-sm text-slate-600">Total Orders</p>
              <p className="text-2xl font-bold">{participant.totalOrders}</p>
            </div>
          </div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <Package className="h-8 w-8 text-orange-600" />
            <div>
              <p className="text-sm text-slate-600">Avg Order Value</p>
              <p className="text-2xl font-bold">
                ${participant.totalOrders > 0
                  ? (Number(participant.totalRevenue) / participant.totalOrders).toFixed(2)
                  : '0.00'}
              </p>
            </div>
          </div>
        </Card>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="details" className="space-y-4">
        <TabsList>
          <TabsTrigger value="details">Details</TabsTrigger>
          <TabsTrigger value="orders">Sales History</TabsTrigger>
        </TabsList>

        {/* Details Tab */}
        <TabsContent value="details" className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            {/* Contact Info */}
            <Card className="p-6">
              <h3 className="mb-4 text-lg font-semibold">Contact Information</h3>
              <div className="space-y-3">
                <div className="flex items-start gap-2">
                  <User className="mt-0.5 h-4 w-4 text-slate-400" />
                  <div>
                    <p className="text-sm text-slate-600">Name</p>
                    <p className="font-medium">{participant.name}</p>
                  </div>
                </div>
                <div className="flex items-start gap-2">
                  <Mail className="mt-0.5 h-4 w-4 text-slate-400" />
                  <div>
                    <p className="text-sm text-slate-600">Email</p>
                    <p className="font-medium">{participant.email}</p>
                  </div>
                </div>
                {participant.phone && (
                  <div className="flex items-start gap-2">
                    <Phone className="mt-0.5 h-4 w-4 text-slate-400" />
                    <div>
                      <p className="text-sm text-slate-600">Phone</p>
                      <p className="font-medium">{participant.phone}</p>
                    </div>
                  </div>
                )}
                <div className="flex items-start gap-2">
                  <Calendar className="mt-0.5 h-4 w-4 text-slate-400" />
                  <div>
                    <p className="text-sm text-slate-600">Joined</p>
                    <p className="font-medium">
                      {format(new Date(participant.createdAt), 'MMM d, yyyy')}
                    </p>
                  </div>
                </div>
              </div>
            </Card>

            {/* Referral Info */}
            <Card className="p-6">
              <h3 className="mb-4 text-lg font-semibold">Referral Information</h3>
              <ReferralLinkDisplay
                url={referralUrl}
                code={participant.referralCode}
                participantName={participant.name}
              />
            </Card>
          </div>
        </TabsContent>

        {/* Orders Tab */}
        <TabsContent value="orders" className="space-y-4">
          <Card className="p-6">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-lg font-semibold">Sales History</h3>
              <p className="text-sm text-slate-600">
                {orders.length} {orders.length === 1 ? 'order' : 'orders'}
              </p>
            </div>

            {orders.length === 0 ? (
              <div className="py-8 text-center text-slate-500">
                <Package className="mx-auto mb-2 h-12 w-12 text-slate-300" />
                <p>No orders yet</p>
              </div>
            ) : (
              <div className="space-y-2">
                {orders.map((order) => (
                  <div
                    key={order.id}
                    className="flex items-start justify-between rounded-lg border p-4 hover:bg-slate-50"
                  >
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <Link
                          href={`/admin/orders/${order.id}`}
                          className="font-medium hover:underline"
                        >
                          Order #{order.orderNumber}
                        </Link>
                        <Badge variant="outline" className="text-xs">
                          {order.status}
                        </Badge>
                      </div>
                      <p className="mt-1 text-xs text-slate-500">
                        {format(new Date(order.createdAt), 'MMM d, yyyy h:mm a')}
                      </p>
                      <div className="mt-2 space-y-1">
                        {order.items.map((item, idx) => (
                          <p key={idx} className="text-sm text-slate-600">
                            {item.quantity}x {item.product.name} @ ${Number(item.price).toFixed(2)}
                          </p>
                        ))}
                      </div>
                    </div>
                    <div className="ml-4 text-right">
                      <p className="text-lg font-bold">${Number(order.total).toFixed(2)}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
